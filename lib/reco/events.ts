import { getBackendBaseUrl } from "@/lib/backend-url";
import { recoAuthHeaders } from "@/lib/reco/auth";
import { getRecoSessionId } from "@/lib/reco/session";
import {
  cartQtyByProduct,
  chunk,
  isValidRecoId,
  newlyAddedProducts,
  toRecoPosition,
} from "@/lib/reco/utils";
import { useCartStore } from "@/lib/stores/cart-store";
import { useRecoAttributionStore } from "@/lib/stores/reco-attribution-store";

/*
 * Recommendation tracking. Every function here is fire-and-forget: it never
 * throws, never returns a promise to await, and swallows network errors, so
 * tracking can never break or slow down the storefront.
 */

export type RecoEventType = "IMPRESSION" | "CLICK" | "ADD_TO_CART" | "PURCHASE";

export type RecoEventInput = {
  type: RecoEventType;
  requestId: string;
  productId: string;
  position?: number;
};

export function sendRecoEvents(events: RecoEventInput[]): void {
  try {
    if (typeof window === "undefined") return;
    const valid = events.filter(
      (event) => isValidRecoId(event.requestId) && isValidRecoId(event.productId),
    );
    if (valid.length === 0) return;

    const sessionId = getRecoSessionId();
    const url = `${getBackendBaseUrl()}/reco/events`;
    const payload = valid.map((event) => {
      const position = toRecoPosition(event.position);
      return {
        type: event.type,
        requestId: event.requestId,
        productId: event.productId,
        ...(position === undefined ? {} : { position }),
        sessionId,
      };
    });

    for (const batch of chunk(payload)) {
      // keepalive: the request survives a navigation (click on a product link).
      // The 202 response is empty: it is never read.
      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...recoAuthHeaders() },
        body: JSON.stringify({ events: batch }),
        keepalive: true,
        cache: "no-store",
      }).catch(() => undefined);
    }
  } catch {
    // Tracking must never break the site.
  }
}

export function trackRecoImpressions(
  requestId: string,
  products: Array<{ productId: string; position: number }>,
): void {
  sendRecoEvents(
    products.map(({ productId, position }) => ({
      type: "IMPRESSION",
      requestId,
      productId,
      position,
    })),
  );
}

/** Remembers which block led to this product (24 hours), without an event. */
export function rememberRecoAttribution(
  requestId: string,
  productId: string,
  position: number,
): void {
  try {
    useRecoAttributionStore.getState().remember(productId, requestId, position);
  } catch {
    // ignore
  }
}

export function trackRecoClick(
  requestId: string,
  productId: string,
  position: number,
): void {
  rememberRecoAttribution(requestId, productId, position);
  sendRecoEvents([{ type: "CLICK", requestId, productId, position }]);
}

/** PURCHASE for each ordered product with a valid attribution, then forgets them. */
export function trackRecoPurchase(productIds: string[]): void {
  try {
    const store = useRecoAttributionStore.getState();
    const events: RecoEventInput[] = [];
    for (const productId of new Set(productIds)) {
      const attribution = store.getValid(productId);
      if (!attribution) continue;
      events.push({
        type: "PURCHASE",
        requestId: attribution.requestId,
        productId,
        position: attribution.position,
      });
    }
    sendRecoEvents(events);
    store.forget(events.map((event) => event.productId));
  } catch {
    // ignore
  }
}

/**
 * Sends ADD_TO_CART when an attributed product enters the cart, wherever it is
 * added on the site. Reasons per productId (all variants summed) and only
 * starts once the persisted cart has been restored, using the restored cart as
 * the baseline: restoring it must not look like additions.
 * Returns a cleanup function.
 */
export function startRecoCartTracking(): () => void {
  let unsubscribeCart: (() => void) | null = null;
  let unsubscribeHydration: (() => void) | null = null;

  const start = () => {
    let previous = cartQtyByProduct(useCartStore.getState().items);
    unsubscribeCart = useCartStore.subscribe((state) => {
      try {
        const next = cartQtyByProduct(state.items);
        const added = newlyAddedProducts(previous, next);
        previous = next;
        if (added.length === 0) return;

        const attributions = useRecoAttributionStore.getState();
        const events: RecoEventInput[] = [];
        for (const productId of added) {
          const attribution = attributions.getValid(productId);
          if (!attribution) continue;
          events.push({
            type: "ADD_TO_CART",
            requestId: attribution.requestId,
            productId,
            position: attribution.position,
          });
        }
        sendRecoEvents(events);
      } catch {
        // ignore
      }
    });
  };

  try {
    if (useCartStore.persist.hasHydrated()) {
      start();
    } else {
      unsubscribeHydration = useCartStore.persist.onFinishHydration(() => {
        unsubscribeHydration?.();
        unsubscribeHydration = null;
        start();
      });
    }
  } catch {
    // ignore
  }

  return () => {
    unsubscribeHydration?.();
    unsubscribeCart?.();
  };
}
