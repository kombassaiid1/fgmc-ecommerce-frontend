import { cookies } from "next/headers";
import { ADMIN_TOKEN_COOKIE } from "@/lib/admin-auth";
import { getBackendBaseUrl } from "@/lib/backend-url";
import { ADMIN_RELAY_ROOTS } from "@/lib/admin-relay";

type Context = { params: Promise<{ path: string[] }> };

/**
 * Changes made from the back office to the catalogue (products, categories, brands, attributes, terms, taxes,
 * coupons, blog, header, colours). The admin's session token lives in a cookie the browser cannot read, so the
 * browser sends the change here and this adds the token: the backend then knows who made it (Journal d'activité)
 * and can check their permission. Only the listed areas are relayed.
 */
async function relay(request: Request, { params }: Context) {
  const segments = (await params).path ?? [];
  if (!segments.length || !ADMIN_RELAY_ROOTS.includes(segments[0]) || segments.some((segment) => segment === ".." || segment === ".")) {
    return Response.json({ message: "Adresse non autorisée." }, { status: 404 });
  }
  const token = (await cookies()).get(ADMIN_TOKEN_COOKIE)?.value;
  if (!token) return Response.json({ message: "Authentification requise." }, { status: 401 });

  const search = new URL(request.url).search;
  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  const contentType = request.headers.get("content-type");
  try {
    const upstream = await fetch(`${getBackendBaseUrl()}/${segments.map(encodeURIComponent).join("/")}${search}`, {
      method: request.method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(contentType ? { "Content-Type": contentType } : {}),
        // The journal records where the change came from.
        ...(request.headers.get("x-forwarded-for") ? { "X-Forwarded-For": request.headers.get("x-forwarded-for") as string } : {}),
        ...(request.headers.get("user-agent") ? { "User-Agent": request.headers.get("user-agent") as string } : {}),
      },
      body: hasBody ? await request.arrayBuffer() : undefined,
      cache: "no-store",
    });
    return new Response(upstream.status === 204 ? null : upstream.body, {
      status: upstream.status,
      headers: { "Content-Type": upstream.headers.get("content-type") ?? "application/json", "Cache-Control": "private, no-store" },
    });
  } catch {
    return Response.json({ message: "Impossible de joindre le serveur." }, { status: 502 });
  }
}

export const POST = relay;
export const PATCH = relay;
export const PUT = relay;
export const DELETE = relay;
