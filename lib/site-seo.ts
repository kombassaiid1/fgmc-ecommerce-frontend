import { cache } from "react";

import { getBackendBaseUrl } from "@/lib/backend-url";
import { resolveUploadUrl } from "@/lib/metadata";

/** What « Paramètres de la boutique » (Identité and Référencement) says about the shop, ready to use in the page metadata. */
export type SiteSeo = {
  siteName: string;
  siteUrl: string | null;
  /** The language, as a code like « fr_TN ». */
  locale: string | null;
  /** Address of the favicon image, or null (the default icon is used). */
  favicon: string | null;
  /** The default title of the shop (the home page and pages without their own). */
  metaTitle: string;
  metaDescription: string;
  keywords: string[];
  /** Address of the default sharing image (Open Graph), or null. */
  ogImage: string | null;
  /** False when the shop asked search engines not to index it. */
  indexable: boolean;
};

const FALLBACK_NAME = "FGMC";

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

/**
 * The shop's SEO settings, read once per request from the public settings and kept for a minute. When the backend
 * does not answer, the page still gets sensible defaults instead of failing.
 */
export const getSiteSeo = cache(async (): Promise<SiteSeo> => {
  const baseUrl = getBackendBaseUrl();
  let data: Record<string, unknown> = {};
  try {
    const response = await fetch(`${baseUrl}/settings`, { next: { revalidate: 60 } });
    if (response.ok) data = ((await response.json()) as Record<string, unknown> | null) ?? {};
  } catch {
    // keep the defaults
  }

  const robots = text(data.robotsDefault).toLowerCase();
  const favicon = text(data.favicon);
  const ogImage = text(data.ogImage);
  return {
    siteName: text(data.siteName) || FALLBACK_NAME,
    siteUrl: text(data.siteUrl) || null,
    locale: text(data.locale) || null,
    favicon: favicon ? resolveUploadUrl(favicon, baseUrl) : null,
    metaTitle: text(data.metaTitle),
    metaDescription: text(data.metaDescription),
    keywords: text(data.metaKeywords)
      .split(",")
      .map((word) => word.trim())
      .filter(Boolean),
    ogImage: ogImage ? resolveUploadUrl(ogImage, baseUrl) : null,
    indexable: !robots.includes("noindex"),
  };
});
