import type { Metadata } from "next";

import type { PublishedPage } from "@/lib/api/builder-page";
import { getImageUrl } from "@/lib/api";
import { getSiteUrl, toOgSafeImageUrl } from "@/lib/metadata";
import { getSiteSeo } from "@/lib/site-seo";
import { storefrontPath } from "@/lib/storefront-path";

/**
 * The title, description and sharing image of a built page, from its own search settings.
 * What the page does not say comes from the shop's settings (Référencement).
 */
export async function pageMetadata(page: PublishedPage, slug: string): Promise<Metadata> {
  const seo = await getSiteSeo();
  const title = page.metaTitle?.trim() || page.title?.trim() || slug;
  const description = page.metaDescription?.trim() || seo.metaDescription || undefined;
  const own = page.ogImage ? getImageUrl(page.ogImage) : null;
  const image = own ? { url: own, type: undefined } : seo.ogImage ? toOgSafeImageUrl(seo.ogImage) : null;
  const url = `${getSiteUrl()}${storefrontPath(`/${slug}`)}`;
  const fullTitle = `${title} | ${seo.siteName}`;
  return {
    metadataBase: new URL(getSiteUrl()),
    // The shop's title template adds the shop's name.
    title,
    description,
    alternates: { canonical: url },
    openGraph: { type: "website", siteName: seo.siteName, title: fullTitle, description, url, ...(image ? { images: [{ url: image.url, width: 1200, height: 630 }] } : {}) },
    twitter: { card: image ? "summary_large_image" : "summary", title: fullTitle, description, ...(image ? { images: [image.url] } : {}) },
  };
}
