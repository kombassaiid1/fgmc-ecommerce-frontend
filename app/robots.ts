import type { MetadataRoute } from "next";

import { getSiteOrigin } from "@/lib/site-origin";
import { getSiteSeo } from "@/lib/site-seo";
import { storefrontPath } from "@/lib/storefront-path";

export const revalidate = 3600;

/** Parts of the site that are private or have no value in search results. */
const PRIVATE_ROOTS = [
  "/admin_ben",
  "/api/",
  "/frontend-api/",
  "/cart",
  "/checkout",
  "/mon-compte",
  "/login",
  "/signup",
  "/forgot-password",
  "/impersonate",
  "/health",
];

// The storefront lives under /fr (proxy.ts): block the private pages there, and the bare paths that redirect to them.
const PRIVATE_PATHS = [...PRIVATE_ROOTS, ...PRIVATE_ROOTS.filter((path) => !["/admin_ben", "/api/", "/frontend-api/", "/impersonate", "/health"].includes(path)).map((path) => storefrontPath(path))];

/**
 * Search and answer engines run by AI companies. Named explicitly so that being cited by them is a decision, not an accident:
 * the shop wants to appear in ChatGPT, Perplexity, Claude, Gemini and Apple Intelligence answers.
 */
const AI_CRAWLERS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "PerplexityBot",
  "Perplexity-User",
  "ClaudeBot",
  "Claude-SearchBot",
  "Claude-User",
  "Google-Extended",
  "Applebot",
  "Applebot-Extended",
  "Bingbot",
];

export default async function robots(): Promise<MetadataRoute.Robots> {
  const [seo, origin] = await Promise.all([getSiteSeo(), getSiteOrigin()]);

  // The shop asked search engines to stay away (Paramètres → Référencement).
  if (!seo.indexable) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }

  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: PRIVATE_PATHS },
      { userAgent: AI_CRAWLERS, allow: "/", disallow: PRIVATE_PATHS },
    ],
    ...(origin ? { sitemap: `${origin}/sitemap.xml`, host: origin } : {}),
  };
}
