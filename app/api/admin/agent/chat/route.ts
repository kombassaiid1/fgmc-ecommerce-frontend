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

  try {
    const upstream = await fetch(`${getBackendBaseUrl()}/agent/chat`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: await request.text(),
      cache: "no-store",
      signal: request.signal,
    });

    const headers = new Headers();
    for (const name of [
      "content-type",
      "cache-control",
      "x-vercel-ai-ui-message-stream",
      "x-accel-buffering",
    ]) {
      const value = upstream.headers.get(name);
      if (value) headers.set(name, value);
    }

    return new Response(upstream.body, {
      status: upstream.status,
      headers,
    });
  } catch {
    return Response.json(
      { message: "Le service Agent est indisponible. Réessayez dans un instant." },
      { status: 502 },
    );
  }
}
