import type { Data } from "@puckeditor/core";

/**
 * One-off updates to pages saved in the builder before a default changed.
 *
 * A block stores its settings when it is dropped on the page, so changing a
 * block's default never reaches blocks that are already saved. Each step here
 * rewrites such saved values once.
 */

type Json = unknown;

/** Offres du jour used to start at 4 products across; it now starts at 5. */
function offersFiveColumns(node: Json): boolean {
  let changed = false;
  if (Array.isArray(node)) {
    for (const item of node) changed = offersFiveColumns(item) || changed;
  } else if (node && typeof node === "object") {
    const record = node as Record<string, Json>;
    const props = record.props as Record<string, Json> | undefined;
    if (record.type === "DailyOffers" && props && props.columns === 4) {
      props.columns = 5;
      changed = true;
    }
    // Blocks can sit inside other blocks (slots), so look at everything.
    for (const value of Object.values(record)) changed = offersFiveColumns(value) || changed;
  }
  return changed;
}

const MIGRATION_KEY = "page-builder:migration:offers-five-columns";

/**
 * Applies pending updates to saved data and tells the caller whether anything
 * changed (so it can save the result). Runs once per browser.
 */
export function migrateSavedData(data: Data | null): { data: Data | null; changed: boolean } {
  if (!data) return { data, changed: false };
  try {
    if (window.localStorage.getItem(MIGRATION_KEY)) return { data, changed: false };
  } catch {
    return { data, changed: false };
  }
  return { data, changed: offersFiveColumns(data) };
}

/** Marks the updates as done; call after both saved copies have been migrated. */
export function markMigrated() {
  try {
    window.localStorage.setItem(MIGRATION_KEY, "1");
  } catch {
    /* storage unavailable: the update simply runs again next time */
  }
}
