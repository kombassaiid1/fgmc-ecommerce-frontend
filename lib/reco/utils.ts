/**
 * Pure helpers for the "À découvrir" recommendation block.
 * No browser API here, so they can be unit-tested in isolation.
 */

export type RecoHistoryKind = "view" | "cart";

export type RecoHistoryItem = {
  productId: string;
  kind: RecoHistoryKind;
  at?: string;
};

export type RecentlyViewedItem = {
  productId: string;
  /** ISO 8601 date of the last view. */
  at: string;
};

export type RecoAttribution = {
  requestId: string;
  position: number;
  /** Timestamp (ms) of the click in the block. */
  at: number;
};

export const RECENTLY_VIEWED_MAX = 10;
export const RECO_HISTORY_MAX = 50;
export const RECO_EVENTS_BATCH_SIZE = 20;
export const RECO_ID_MAX_LENGTH = 64;
export const RECO_POSITION_MAX = 100;
export const RECO_ATTRIBUTION_TTL_MS = 24 * 60 * 60 * 1000;

export function isValidRecoId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= RECO_ID_MAX_LENGTH
  );
}

/** Returns a valid event position (integer 0..100), or undefined. */
export function toRecoPosition(value: unknown): number | undefined {
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= RECO_POSITION_MAX
    ? value
    : undefined;
}

/** Moves (or adds) a product at the head of the list, without duplicates. */
export function pushRecentlyViewed(
  items: RecentlyViewedItem[],
  productId: string,
  at: string,
  max = RECENTLY_VIEWED_MAX,
): RecentlyViewedItem[] {
  if (!isValidRecoId(productId)) return items;
  return [
    { productId, at },
    ...items.filter((item) => item.productId !== productId),
  ].slice(0, max);
}

/**
 * History sent to POST /reco/home: cart products first (`kind: "cart"`),
 * then viewed products (most recent first). One entry per product, the cart
 * wins over a view. At most 50 entries.
 */
export function buildRecoHistory(
  viewed: RecentlyViewedItem[],
  cartProductIds: string[],
  max = RECO_HISTORY_MAX,
): RecoHistoryItem[] {
  const seen = new Set<string>();
  const history: RecoHistoryItem[] = [];

  for (const productId of cartProductIds) {
    if (!isValidRecoId(productId) || seen.has(productId)) continue;
    seen.add(productId);
    history.push({ productId, kind: "cart" });
  }
  for (const item of viewed) {
    if (!isValidRecoId(item.productId) || seen.has(item.productId)) continue;
    seen.add(item.productId);
    history.push(
      Number.isNaN(Date.parse(item.at))
        ? { productId: item.productId, kind: "view" }
        : { productId: item.productId, kind: "view", at: item.at },
    );
  }

  return history.slice(0, max);
}

export function chunk<T>(items: T[], size = RECO_EVENTS_BATCH_SIZE): T[][] {
  if (size <= 0) return [items];
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

export function isAttributionValid(
  attribution: RecoAttribution | null | undefined,
  now: number,
  ttlMs = RECO_ATTRIBUTION_TTL_MS,
): attribution is RecoAttribution {
  if (!attribution || !isValidRecoId(attribution.requestId)) return false;
  const age = now - attribution.at;
  return Number.isFinite(age) && age >= 0 && age <= ttlMs;
}

/** Drops attributions older than 24 hours. */
export function pruneAttributions(
  attributions: Record<string, RecoAttribution>,
  now: number,
  ttlMs = RECO_ATTRIBUTION_TTL_MS,
): Record<string, RecoAttribution> {
  return Object.fromEntries(
    Object.entries(attributions).filter(([, attribution]) =>
      isAttributionValid(attribution, now, ttlMs),
    ),
  );
}

/** Total quantity per productId (all variants summed). */
export function cartQtyByProduct(
  items: Record<string, { productId: string; qty: number }>,
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const item of Object.values(items)) {
    const qty = Number.isFinite(item.qty) ? Math.max(0, item.qty) : 0;
    totals.set(item.productId, (totals.get(item.productId) ?? 0) + qty);
  }
  return totals;
}

/** Products whose total quantity went from 0 to more than 0. */
export function newlyAddedProducts(
  previous: Map<string, number>,
  next: Map<string, number>,
): string[] {
  const added: string[] = [];
  for (const [productId, qty] of next) {
    if (qty > 0 && (previous.get(productId) ?? 0) <= 0) added.push(productId);
  }
  return added;
}
