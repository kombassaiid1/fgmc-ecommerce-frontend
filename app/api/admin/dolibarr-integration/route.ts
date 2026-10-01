import { cookies } from "next/headers";
import { ADMIN_TOKEN_COOKIE } from "@/lib/admin-auth";
import { getBackendBaseUrl } from "@/lib/backend-url";

const endpoint = `${getBackendBaseUrl()}/admin/dolibarr-integration`;

async function proxy(request: Request, method: "GET" | "PATCH") {
  const token = (await cookies()).get(ADMIN_TOKEN_COOKIE)?.value;
  if (!token) return Response.json({ message: "Authentification requise." }, { status: 401 });

  let body: string | undefined;
  if (method === "PATCH") body = await request.text();
  try {
    const upstream = await fetch(endpoint, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body,
      cache: "no-store",
    });
    const payload = await upstream.text();
    if (method === "GET" && upstream.ok) {
      const data = JSON.parse(payload) as Record<string, unknown>;
      return Response.json({ ...data, storeApiUrl: getBackendBaseUrl() }, { status: upstream.status });
    }
    return new Response(payload, {
      status: upstream.status,
      headers: { "Content-Type": upstream.headers.get("content-type") ?? "application/json" },
    });
  } catch {
    return Response.json({ message: "Impossible de joindre le serveur." }, { status: 502 });
  }
}

export function GET(request: Request) {
  return proxy(request, "GET");
}

export function PATCH(request: Request) {
  return proxy(request, "PATCH");
}
