import { getBackendBaseUrl } from "@/lib/backend-url";
import { getClientSession, subscribeToClientSession } from "@/lib/client-auth";
import { recoAuthHeaders } from "@/lib/reco/auth";
import { getRecoSessionId, rotateRecoSessionId } from "@/lib/reco/session";
import { useRecentlyViewedStore } from "@/lib/stores/recently-viewed-store";
import { useRecoAttributionStore } from "@/lib/stores/reco-attribution-store";

/*
 * Links the anonymous browser session to the logged-in client through
 * POST /reco/session. Fire-and-forget like the rest of the tracking: nothing
 * here throws or is awaited by the UI, and network errors are swallowed.
 */

export type RecoDevice = "mobile" | "tablet" | "desktop";

/** Set once per full page load: the session is registered once, not on every page. */
let registeredOnLoad = false;

export function detectRecoDevice(width: number): RecoDevice {
  if (width < 768) return "mobile";
  if (width < 1024) return "tablet";
  return "desktop";
}

function getClientToken(): string | null {
  try {
    return getClientSession()?.token ?? null;
  } catch {
    return null;
  }
}

/**
 * Sends the current sessionId (with the client token when logged in). If the
 * backend answers `rotate: true` (session already linked to another client),
 * a new sessionId is created and registered once.
 */
export function registerRecoSession(allowRotate = true): void {
  try {
    if (typeof window === "undefined") return;
    fetch(`${getBackendBaseUrl()}/reco/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...recoAuthHeaders() },
      body: JSON.stringify({
        sessionId: getRecoSessionId(),
        device: detectRecoDevice(window.innerWidth),
      }),
      keepalive: true,
      cache: "no-store",
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { rotate?: unknown } | null) => {
        if (data?.rotate !== true || !allowRotate) return;
        rotateRecoSessionId();
        registerRecoSession(false);
      })
      .catch(() => undefined);
  } catch {
    // Tracking must never break the site.
  }
}

/**
 * Registers the session once per site load, again right after a login or a
 * signup, and rotates the sessionId on logout. Returns a cleanup function.
 */
export function startRecoSessionSync(): () => void {
  try {
    let lastToken = getClientToken();
    if (!registeredOnLoad) {
      registeredOnLoad = true;
      registerRecoSession();
    }

    return subscribeToClientSession(() => {
      try {
        const token = getClientToken();
        if (token === lastToken) return;
        lastToken = token;
        // Logout: the next visitor on this computer gets a new session and
        // an empty local history (viewed products, block attributions). The
        // cart is deliberately kept.
        if (token === null) {
          rotateRecoSessionId();
          useRecentlyViewedStore.setState({ items: [] });
          useRecoAttributionStore.setState({ attributions: {} });
        }
        // Login, signup or the new anonymous session after a logout.
        registerRecoSession();
      } catch {
        // ignore
      }
    });
  } catch {
    return () => undefined;
  }
}
