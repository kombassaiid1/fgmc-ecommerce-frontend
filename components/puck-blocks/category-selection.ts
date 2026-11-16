/**
 * A category chosen for a panel of the Hero, plus which of its direct
 * sub-categories appear in its hover menu.
 */
export type CategorySelection = {
  id: string;
  /** null = show all its sub-categories (new ones appear automatically). */
  childIds: string[] | null;
  /** Optional picture shown beside the sub-categories in the hover menu. */
  imageUrl?: string;
};

/**
 * Accepts the current shape and the older one (a plain list of ids), so
 * drafts saved before sub-category selection existed keep working.
 */
export function normalizeSelection(value: unknown): CategorySelection[] {
  if (!Array.isArray(value)) return [];
  const result: CategorySelection[] = [];
  for (const item of value) {
    if (typeof item === "string") {
      result.push({ id: item, childIds: null });
    } else if (item && typeof item === "object" && typeof (item as CategorySelection).id === "string") {
      const { id, childIds, imageUrl } = item as CategorySelection;
      result.push({
        id,
        childIds: Array.isArray(childIds) ? childIds.filter((value): value is string => typeof value === "string") : null,
        ...(typeof imageUrl === "string" && imageUrl ? { imageUrl } : {}),
      });
    }
  }
  return result;
}
