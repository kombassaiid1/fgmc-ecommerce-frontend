import "server-only";

import { cookies } from "next/headers";
import { ADMIN_TOKEN_COOKIE } from "@/lib/admin-auth";
import { getBackendBaseUrl } from "@/lib/backend-url";

/** Forwards an admin request to the backend with the httpOnly session token. */
export async function proxyAdminRequest(
  request: Request,
  backendPath: string,
  method: "GET" | "POST" | "PATCH" | "DELETE",
) {
  const token = (await cookies()).get(ADMIN_TOKEN_COOKIE)?.value;
  if (!token) {
    return Response.json({ message: "Authentification requise." }, { status: 401 });
  }
  const search = new URL(request.url).search;
  const body = method === "POST" || method === "PATCH" ? await request.text() : undefined;
  try {
    const upstream = await fetch(`${getBackendBaseUrl()}${backendPath}${search}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body,
      cache: "no-store",
    });
    const headers = new Headers({
      "Content-Type": upstream.headers.get("content-type") ?? "application/json",
    });
    const disposition = upstream.headers.get("content-disposition");
    if (disposition) {
      headers.set("Content-Disposition", disposition);
      headers.set("Cache-Control", "private, no-store");
    }
    return new Response(upstream.body, { status: upstream.status, headers });
  } catch {
    return Response.json({ message: "Impossible de joindre le serveur." }, { status: 502 });
  }
}

export function adminCatchAll(basePath: string) {
  type Ctx = { params: Promise<{ path?: string[] }> };
  const target = async (ctx: Ctx) => {
    const { path = [] } = await ctx.params;
    return [basePath, ...path.map(encodeURIComponent)].join("/");
  };
  return {
    GET: async (request: Request, ctx: Ctx) =>
      proxyAdminRequest(request, await target(ctx), "GET"),
    POST: async (request: Request, ctx: Ctx) =>
      proxyAdminRequest(request, await target(ctx), "POST"),
    PATCH: async (request: Request, ctx: Ctx) =>
      proxyAdminRequest(request, await target(ctx), "PATCH"),
    DELETE: async (request: Request, ctx: Ctx) =>
      proxyAdminRequest(request, await target(ctx), "DELETE"),
  };
}
