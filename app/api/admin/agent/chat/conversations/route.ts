import { cookies } from "next/headers";

import { ADMIN_TOKEN_COOKIE } from "@/lib/admin-auth";
import { getBackendBaseUrl } from "@/lib/backend-url";

export async function GET() {
  const token = (await cookies()).get(ADMIN_TOKEN_COOKIE)?.value;
  if (!token) {
    return Response.json(
      { message: "Votre session administrateur a expiré. Reconnectez-vous." },
      { status: 401 },
    );
  }

  try {
    const upstream = await fetch(
      `${getBackendBaseUrl()}/agent/chat/conversations`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      },
    );
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        "content-type": upstream.headers.get("content-type") ?? "application/json",
        "cache-control": "no-store",
      },
    });
  } catch {
    return Response.json(
      { message: "Le service Agent est indisponible." },
      { status: 502 },
    );
  }
}
