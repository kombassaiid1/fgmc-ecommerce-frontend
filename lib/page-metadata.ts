import type { Metadata } from "next";

import type { PublishedPage } from "@/lib/api/builder-page";
import { getImageUrl } from "@/lib/api";
import { getSiteUrl } from "@/lib/metadata";

/** The title, description and sharing image of a built page, from its search settings. */
export function pageMetadata(page: PublishedPage, slug: string): Metadata {
  const title = page.metaTitle?.trim() || page.title?.trim() || slug;
  const description = page.metaDescription?.trim() || undefined;
  const image = page.ogImage ? getImageUrl(page.ogImage) : null;
  const url = `${getSiteUrl()}/${slug}`;
  return {
    metadataBase: new URL(getSiteUrl()),
    title: `${title} | Elbootic`,
    description,
    alternates: { canonical: url },
    openGraph: { type: "website", title, description, url, ...(image ? { images: [{ url: image, width: 1200, height: 630 }] } : {}) },
    twitter: { card: image ? "summary_large_image" : "summary", title, description, ...(image ? { images: [image] } : {}) },
  };
}
