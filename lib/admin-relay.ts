/**
 * The areas of the backend whose changes are made by the back office and need the admin's session
 * (see app/api/admin/backend). The first word of the address, without the leading slash.
 */
export const ADMIN_RELAY_ROOTS = ["products", "categories", "attributes", "brands", "terms", "taxes", "coupons", "blog", "header", "color-palette", "seo", "improve-product"];

const WRITES = ["POST", "PATCH", "PUT", "DELETE"];

/** The address a browser call must use: through the relay for an admin change, straight to the backend otherwise. */
export function relayedPath(method: string | undefined, path: string): string | null {
  if (typeof window === "undefined" || !WRITES.includes((method ?? "GET").toUpperCase())) return null;
  const root = path.replace(/^\/+/, "").split(/[/?]/)[0];
  if (!ADMIN_RELAY_ROOTS.includes(root)) return null;
  // The storefront's coupon check is public and stays direct.
  if (root === "coupons" && /^\/?coupons\/validate/.test(path)) return null;
  return `/frontend-api/admin/backend/${path.replace(/^\/+/, "")}`;
}
