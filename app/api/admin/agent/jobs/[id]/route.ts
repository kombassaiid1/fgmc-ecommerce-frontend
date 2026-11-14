import { cookies } from "next/headers";

import { ADMIN_TOKEN_COOKIE } from "@/lib/admin-auth";
import { getBackendBaseUrl } from "@/lib/backend-url";

type Context = { params: Promise<{ id: string }> };

// La lecture d'une tâche répond tout de suite : un délai court suffit.
const JOB_REQUEST_TIMEOUT_MS = 10_000;

// GET /frontend-api/admin/agent/jobs/:id : état d'une tâche de chat (statut, texte partiel, erreur).
export async function GET(request: Request, context: Context) {
  const token = (await cookies()).get(ADMIN_TOKEN_COOKIE)?.value;
  if (!token) {
    return Response.json(
      { message: "Votre session administrateur a expiré. Reconnectez-vous." },
      { status: 401 },
    );
  }
  const { id } = await context.params;
  if (!/^[\w-]{1,64}$/.test(id)) {
    return Response.json({ message: "Identifiant de tâche invalide." }, { status: 400 });
  }

  try {
    const upstream = await fetch(`${getBackendBaseUrl()}/agent/jobs/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${token}` },
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
          ? "Le service Agent n’a pas répondu à temps."
          : "Le service Agent est momentanément indisponible.",
      },
      { status: timedOut ? 504 : 502 },
    );
  }
}
