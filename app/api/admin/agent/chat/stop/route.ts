import { cookies } from "next/headers";

import { ADMIN_TOKEN_COOKIE } from "@/lib/admin-auth";
import { getBackendBaseUrl } from "@/lib/backend-url";

export async function POST(request: Request) {
  const token = (await cookies()).get(ADMIN_TOKEN_COOKIE)?.value;
  if (!token) {
    return Response.json(
      { message: "Votre session administrateur a expiré. Reconnectez-vous." },
      { status: 401 },
    );
  }

  let sessionId: unknown;
  try {
    sessionId = ((await request.json()) as { sessionId?: unknown }).sessionId;
  } catch {
    sessionId = undefined;
  }
  if (typeof sessionId !== "string" || !/^[\w-]{1,64}$/.test(sessionId)) {
    return Response.json(
      { message: "Identifiant de conversation invalide." },
      { status: 400 },
    );
  }

  try {
    const upstream = await fetch(`${getBackendBaseUrl()}/agent/chat/stop`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sessionId }),
      cache: "no-store",
    });
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
