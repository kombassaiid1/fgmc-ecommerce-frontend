import { cookies } from "next/headers";

import { ADMIN_TOKEN_COOKIE } from "@/lib/admin-auth";
import { getBackendBaseUrl } from "@/lib/backend-url";

function debugAgent(
  event: string,
  details: Record<string, string | number | boolean>,
) {
  if (
    process.env.AGENT_DEBUG === "true" &&
    process.env.NODE_ENV !== "production"
  ) {
    console.info(`[Agent][Next] ${event}`, details);
  }
}

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
    return Response.json({ message: "Identifiant de conversation invalide." }, { status: 400 });
  }
  try {
    const upstream = await fetch(
      `${getBackendBaseUrl()}/agent/chat/history?sessionId=${encodeURIComponent(sessionId)}`,
      { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
    );
    return new Response(upstream.body, {
      status: upstream.status,
      headers: { "content-type": upstream.headers.get("content-type") ?? "application/json", "cache-control": "no-store" },
    });
  } catch {
    return Response.json({ message: "Le service Agent est indisponible." }, { status: 502 });
  }
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  const token = (await cookies()).get(ADMIN_TOKEN_COOKIE)?.value;

  if (!token) {
    debugAgent("request_rejected", {
      reason: "admin_cookie_missing",
      status: 401,
    });
    return Response.json(
      { message: "Votre session administrateur a expiré. Reconnectez-vous." },
      { status: 401 },
    );
  }

  try {
    const upstreamHeaders = new Headers({
      Authorization: `Bearer ${token}`,
    });
    let body: BodyInit;
    const requestContentType = request.headers.get("content-type") ?? "";

    if (requestContentType.includes("multipart/form-data")) {
      const incoming = await request.formData();
      const message = incoming.get("message");
      const image = incoming.get("image");
      const sessionId = incoming.get("sessionId");
      const taskId = incoming.get("taskId");
      const regenerate = incoming.get("regenerate");
      if (
        typeof message !== "string" ||
        (sessionId !== null && typeof sessionId !== "string") ||
        (taskId !== null && typeof taskId !== "string") ||
        (image !== null && !(image instanceof File))
      ) {
        debugAgent("request_rejected", {
          reason: "invalid_multipart_body",
          status: 400,
        });
        return Response.json(
          { message: "Le message ou l’image est invalide." },
          { status: 400 },
        );
      }
      const forwarded = new FormData();
      forwarded.set("message", message);
      if (typeof sessionId === "string") forwarded.set("sessionId", sessionId);
      if (typeof taskId === "string") forwarded.set("taskId", taskId);
      if (regenerate === "true") forwarded.set("regenerate", "true");
      if (image instanceof File) {
        forwarded.set("image", image, image.name || "agent-image");
      }
      debugAgent("request_received", {
        mode:
          image instanceof File
            ? message
              ? "text_and_image"
              : "image_only"
            : "text_only",
        messageLength: message.length,
        ...(image instanceof File
          ? { imageType: image.type, imageBytes: image.size }
          : {}),
      });
      body = forwarded;
    } else {
      body = await request.text();
      if (requestContentType) upstreamHeaders.set("Content-Type", requestContentType);
      debugAgent("request_received", {
        mode: "text_only",
        contentType: requestContentType || "unknown",
        requestBodyLength: body.length,
      });
    }

    const upstream = await fetch(`${getBackendBaseUrl()}/agent/chat`, {
      method: "POST",
      headers: upstreamHeaders,
      body,
      cache: "no-store",
      signal: request.signal,
    });
    debugAgent("backend_response", {
      status: upstream.status,
      contentType: upstream.headers.get("content-type") ?? "unknown",
      durationMs: Date.now() - startedAt,
    });

    const responseHeaders = new Headers();
    for (const name of [
      "content-type",
      "cache-control",
      "x-vercel-ai-ui-message-stream",
      "x-accel-buffering",
    ]) {
      const value = upstream.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }

    return new Response(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (error: unknown) {
    debugAgent("proxy_error", {
      errorType: error instanceof Error ? error.name : "UnknownError",
      durationMs: Date.now() - startedAt,
    });
    return Response.json(
      { message: "Le service Agent est indisponible. Réessayez dans un instant." },
      { status: 502 },
    );
  }
}
