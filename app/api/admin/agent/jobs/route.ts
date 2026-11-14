import { cookies } from "next/headers";

import { ADMIN_TOKEN_COOKIE } from "@/lib/admin-auth";
import { getBackendBaseUrl } from "@/lib/backend-url";

// La création d'une tâche répond tout de suite : un délai court suffit.
const JOB_REQUEST_TIMEOUT_MS = 10_000;

// POST /frontend-api/admin/agent/jobs : transmet la demande de chat à NestJS (JSON ou image jointe).
export async function POST(request: Request) {
  const token = (await cookies()).get(ADMIN_TOKEN_COOKIE)?.value;
  if (!token) {
    return Response.json(
      { message: "Votre session administrateur a expiré. Reconnectez-vous." },
      { status: 401 },
    );
  }

  try {
    const headers = new Headers({ Authorization: `Bearer ${token}` });
    let body: BodyInit;
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("multipart/form-data")) {
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
        return Response.json({ message: "Le message ou l’image est invalide." }, { status: 400 });
      }
      const forwarded = new FormData();
      forwarded.set("message", message);
      if (typeof sessionId === "string") forwarded.set("sessionId", sessionId);
      if (typeof taskId === "string") forwarded.set("taskId", taskId);
      if (regenerate === "true") forwarded.set("regenerate", "true");
      if (image instanceof File) forwarded.set("image", image, image.name || "agent-image");
      body = forwarded;
    } else {
      body = await request.text();
      headers.set("Content-Type", contentType || "application/json");
    }

    const upstream = await fetch(`${getBackendBaseUrl()}/agent/jobs`, {
      method: "POST",
      headers,
      body,
      cache: "no-store",
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(JOB_REQUEST_TIMEOUT_MS)]),
    });
    return new Response(await upstream.text(), {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("content-type") ?? "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch (error: unknown) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    return Response.json(
      {
        message: timedOut
          ? "Le service Agent n’a pas répondu à temps. Réessayez dans un instant."
          : "Le service Agent est indisponible. Réessayez dans un instant.",
      },
      { status: timedOut ? 504 : 502 },
    );
  }
}
