import type { Data } from "@puckeditor/core";

/**
 * The blocks the page builder offers today (keep in step with `components` of puck-config.tsx).
 * A page saved with an older builder can contain blocks that no longer exist: Puck draws those as nothing,
 * so such a page is not used and the original home page is shown instead.
 */
export const BUILDER_BLOCK_TYPES = ["Hero", "DailyOffers", "FeaturedProducts", "ImageMosaic", "Container", "Grid", "Button", "Input"];

/** A saved page that has content and only uses blocks the builder still has. */
export function isUsableBuilderPage(data: Data | null | undefined): data is Data {
  if (!data || !Array.isArray(data.content) || data.content.length === 0) return false;
  const known = new Set(BUILDER_BLOCK_TYPES);
  const zones = Object.values((data.zones ?? {}) as Record<string, Array<{ type: string }>>).flat();
  return [...data.content, ...zones].every((item) => known.has(item.type));
}
