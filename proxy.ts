import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * The storefront is served under /fr (http://localhost:3000/fr). The pages themselves stay where they are:
 *  - /fr/anything is rewritten to /anything, so no route file has to move;
 *  - a storefront URL without the prefix (/cart, /) is redirected to /fr/cart (/fr).
 * The admin, the APIs, Next internals and files (images, fonts…) are never prefixed.
 */
const LOCALE = "fr";
const PREFIX = `/${LOCALE}`;
const UNPREFIXED = ["/admin_ben", "/api", "/frontend-api", "/impersonate", "/health", "/_next"];

function isStorefrontPath(pathname: string) {
  if (UNPREFIXED.some((root) => pathname === root || pathname.startsWith(`${root}/`))) return false;
  // A file (favicon.ico, /colissimo/icon.png…) — but legacy product pages end in .html and are pages.
  const last = pathname.split("/").pop() ?? "";
  return !last.includes(".") || last.endsWith(".html");
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === PREFIX || pathname.startsWith(`${PREFIX}/`)) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.slice(PREFIX.length) || "/";
    return NextResponse.rewrite(url);
  }

  if (!isStorefrontPath(pathname)) return NextResponse.next();
  // Only navigations are redirected: a POST would lose its body.
  if (request.method !== "GET" && request.method !== "HEAD") return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = pathname === "/" ? PREFIX : `${PREFIX}${pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
