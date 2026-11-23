import { getSiteUrl } from "@/lib/metadata";
import { getSiteSeo } from "@/lib/site-seo";

/**
 * The public address of the shop without a trailing slash: NEXT_PUBLIC_SITE_URL, else the « URL du site » setting.
 * Returns null when neither is known, so callers can skip absolute URLs instead of failing the build.
 */
export async function getSiteOrigin(): Promise<string | null> {
  try {
    return getSiteUrl();
  } catch {
    const seo = await getSiteSeo();
    return seo.siteUrl ? seo.siteUrl.replace(/\/+$/, "") : null;
  }
}
