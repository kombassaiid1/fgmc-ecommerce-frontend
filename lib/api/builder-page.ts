import type { Data } from "@puckeditor/core";

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
