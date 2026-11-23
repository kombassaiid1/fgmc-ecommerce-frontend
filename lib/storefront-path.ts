/**
 * The storefront is served under /fr (see proxy.ts: a URL without the prefix is redirected to the prefixed one).
 * Every address given to search engines (canonical, sitemap, structured data) must be the prefixed one.
 */
export const STOREFRONT_PREFIX = "/fr";

/** "/cat/prod.html" → "/fr/cat/prod.html"; "" or "/" → "/fr". */
export function storefrontPath(path = ""): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return clean === "/" ? STOREFRONT_PREFIX : `${STOREFRONT_PREFIX}${clean}`;
}
