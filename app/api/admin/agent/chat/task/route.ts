import { cookies } from "next/headers";

import { ADMIN_TOKEN_COOKIE } from "@/lib/admin-auth";
import { getBackendBaseUrl } from "@/lib/backend-url";

export async function GET(request: Request) {
  const token = (await cookies()).get(ADMIN_TOKEN_COOKIE)?.value;
  if (!token) {
    return Response.json(
      { message: "Votre session administrateur a expiré. Reconnectez-vous." },
      { status: 401 },
    );
  }

  const sessionId = new URL(request.url).searchParams.get("sessionId") ?? "";
  if (!/^[\w-]{1,64}$/.test(sessionId)) {
    return Response.json(
      { message: "Identifiant de conversation invalide." },
      { status: 400 },
    );
  }

  try {
    const upstream = await fetch(
      `${getBackendBaseUrl()}/agent/chat/task?sessionId=${encodeURIComponent(sessionId)}`,
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
      { message: "Le service Agent est momentanément indisponible." },
      { status: 502 },
    );
  }
}
