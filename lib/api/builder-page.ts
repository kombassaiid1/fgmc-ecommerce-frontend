import type { Data } from "@puckeditor/core";

import type { HeroProps } from "@/components/puck-blocks/hero/hero";

import { isUsableBuilderPage } from "@/lib/builder-blocks";
import { getBackendBaseUrl } from "@/lib/backend-url";

/** A page of the shop, as visitors may see it. */
export type PublishedPage = { data: Data; title: string | null; metaTitle: string | null; metaDescription: string | null; ogImage: string | null };

/** The published page with this address, or null when there is none, it is a draft, or it has nothing in it. */
export async function getPublishedPage(slug: string): Promise<PublishedPage | null> {
  try {
    const response = await fetch(`${getBackendBaseUrl()}/pages?slug=${encodeURIComponent(slug)}`, { cache: "no-store" });
    if (!response.ok) return null;
    const page = (await response.json()) as Partial<PublishedPage>;
    return isUsableBuilderPage(page.data)
      ? { data: page.data, title: page.title ?? null, metaTitle: page.metaTitle ?? null, metaDescription: page.metaDescription ?? null, ogImage: page.ogImage ?? null }
      : null;
  } catch {
    return null;
  }
}

/** The content of the page saved in the page builder for a slug, or null. */
export async function getBuilderPage(slug: string): Promise<Data | null> {
  return (await getPublishedPage(slug))?.data ?? null;
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
