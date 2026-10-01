import { cookies } from "next/headers";
import { ADMIN_TOKEN_COOKIE } from "@/lib/admin-auth";
import { getBackendBaseUrl } from "@/lib/backend-url";

const validDirections = new Set(["store-to-dolibarr", "dolibarr-to-store"]);

export async function POST(request: Request) {
  const token = (await cookies()).get(ADMIN_TOKEN_COOKIE)?.value;
  if (!token) return Response.json({ message: "Authentification requise." }, { status: 401 });

  const body = await request.json().catch(() => null) as { direction?: string } | null;
  const direction = body?.direction;
  if (!direction || !validDirections.has(direction)) {
    return Response.json({ message: "Direction de synchronisation invalide." }, { status: 400 });
  }

  try {
    const upstream = await fetch(`${getBackendBaseUrl()}/admin/dolibarr-integration/sync/${direction}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(125000),
    });
    const payload = await upstream.text();
    return new Response(payload, {
      status: upstream.status,
      headers: { "Content-Type": upstream.headers.get("content-type") ?? "application/json" },
    });
  } catch {
    return Response.json({ message: "Impossible de joindre le serveur ou la synchronisation a expire." }, { status: 502 });
  }
}
