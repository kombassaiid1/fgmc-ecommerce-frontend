import type { Data } from "@puckeditor/core";

/**
 * One-off updates to pages saved in the builder before a default changed or a
 * setting was added.
 *
 * A block stores its settings when it is dropped on the page, so changing a
 * block's default never reaches blocks that are already saved. Each step here
 * rewrites such saved values once per browser.
 */

type Json = unknown;
type Step = { key: string; run: (data: Json) => boolean };

/** Calls `visit` on every block (anything with a `type` and `props`), including nested ones. */
function forEachBlock(node: Json, visit: (block: { type: string; props: Record<string, Json> }) => boolean): boolean {
  let changed = false;
  if (Array.isArray(node)) {
    for (const item of node) changed = forEachBlock(item, visit) || changed;
  } else if (node && typeof node === "object") {
    const record = node as Record<string, Json>;
    const props = record.props as Record<string, Json> | undefined;
    if (typeof record.type === "string" && props && typeof props === "object") {
      changed = visit({ type: record.type, props }) || changed;
    }
    // Blocks can sit inside other blocks (slots), so look at everything.
    for (const value of Object.values(record)) changed = forEachBlock(value, visit) || changed;
  }
  return changed;
}

const STEPS: Step[] = [
  {
    // Offres du jour used to start at 4 products across; it now starts at 5.
    key: "page-builder:migration:offers-five-columns",
    run: (data) =>
      forEachBlock(data, (block) => {
        if (block.type !== "DailyOffers" || block.props.columns !== 4) return false;
        block.props.columns = 5;
        return true;
      }),
  },
  {
    // Offres du jour gained "Produits visibles (mobile)"; saved blocks get its default.
    key: "page-builder:migration:offers-mobile-columns",
    run: (data) =>
      forEachBlock(data, (block) => {
        if (block.type !== "DailyOffers" || block.props.mobileColumns !== undefined) return false;
        block.props.mobileColumns = 1;
        return true;
      }),
  },
];

function isDone(key: string) {
  try {
    return Boolean(window.localStorage.getItem(key));
  } catch {
    return true; // storage unavailable: do nothing rather than repeat on every load
  }
}

/**
 * Applies pending updates to saved data and tells the caller whether anything
 * changed (so it can save the result). Each update runs once per browser.
 */
export function migrateSavedData(data: Data | null): { data: Data | null; changed: boolean } {
  if (!data) return { data, changed: false };
  let changed = false;
  for (const step of STEPS) {
    if (!isDone(step.key)) changed = step.run(data) || changed;
  }
  return { data, changed };
}

/** Marks every update as done; call after all saved copies have been migrated. */
export function markMigrated() {
  for (const step of STEPS) {
    try {
      window.localStorage.setItem(step.key, "1");
    } catch {
      /* storage unavailable: the update simply runs again next time */
    }
  }
}
