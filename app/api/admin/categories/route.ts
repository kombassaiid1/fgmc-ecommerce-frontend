import { cookies } from "next/headers";
import { ADMIN_TOKEN_COOKIE } from "@/lib/admin-auth";
import { getBackendBaseUrl } from "@/lib/backend-url";

export async function DELETE(request: Request) {
  const token = (await cookies()).get(ADMIN_TOKEN_COOKIE)?.value;
  if (!token) {
    return Response.json({ message: "Authentification requise." }, { status: 401 });
  }

  try {
    const body = await request.text();
    if (!body.trim()) {
      return Response.json({ message: "Sélectionnez au moins une catégorie." }, { status: 400 });
    }
    const upstream = await fetch(`${getBackendBaseUrl()}/categories/selected`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(30000),
    });
    return new Response(await upstream.text(), {
      status: upstream.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return Response.json(
      { message: "Impossible de joindre le serveur des catégories." },
      { status: 502 },
    );
  }
}
