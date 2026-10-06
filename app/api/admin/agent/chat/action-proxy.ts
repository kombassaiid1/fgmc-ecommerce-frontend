import { cookies } from "next/headers";

import { ADMIN_TOKEN_COOKIE } from "@/lib/admin-auth";
import { getBackendBaseUrl } from "@/lib/backend-url";

export async function proxyAgentChatAction(
  request: Request,
  action: "confirm" | "cancel",
) {
  const token = (await cookies()).get(ADMIN_TOKEN_COOKIE)?.value;

  if (!token) {
    return Response.json(
      { message: "Votre session administrateur a expiré. Reconnectez-vous." },
      { status: 401 },
    );
  }

  try {
    const upstream = await fetch(
      `${getBackendBaseUrl()}/agent/chat/${action}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: await request.text(),
        cache: "no-store",
        signal: request.signal,
      },
    );

    return new Response(await upstream.text(), {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("content-type") ?? "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return Response.json(
      { message: "Le service Agent est indisponible. Réessayez dans un instant." },
      { status: 502 },
    );
  }
}
