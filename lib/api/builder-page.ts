import type { Data } from "@puckeditor/core";

import type { HeroProps } from "@/components/puck-blocks/hero/hero";

import { isUsableBuilderPage } from "@/lib/builder-blocks";
import { getBackendBaseUrl } from "@/lib/backend-url";

/** The page saved in the page builder for a slug, or null when nothing was saved there yet. */
export async function getBuilderPage(slug: string): Promise<Data | null> {
  try {
    const response = await fetch(`${getBackendBaseUrl()}/pages?slug=${encodeURIComponent(slug)}`, { cache: "no-store" });
    if (!response.ok) return null;
    const { data } = (await response.json()) as { data?: Data };
    return isUsableBuilderPage(data) ? data : null;
  } catch {
    return null;
  }
}

/**
 * The category panels of the home page's Hero block, when the block is set to show them on the category and
 * product pages. Null when the switch is off, there is no Hero, or no page was saved in the builder.
 */
export async function getCatalogPanelsConfig(): Promise<Partial<HeroProps> | null> {
  const data = await getBuilderPage("home");
  if (!data) return null;
  const zones = Object.values((data.zones ?? {}) as Record<string, Array<{ type: string; props: unknown }>>).flat();
  const hero = [...(data.content as Array<{ type: string; props: unknown }>), ...zones].find((item) => item.type === "Hero");
  const props = hero?.props as Partial<HeroProps> | undefined;
  return props?.showOnCatalogPages === true ? props : null;
}
