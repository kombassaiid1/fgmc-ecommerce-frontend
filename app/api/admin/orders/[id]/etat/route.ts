import { cookies } from 'next/headers';
import { ADMIN_TOKEN_COOKIE } from '@/lib/admin-auth';
import { getBackendBaseUrl } from '@/lib/backend-url';

type Context = { params: Promise<{ id: string }> };

/** Changes an order's status as the logged-in admin, so the change is recorded in the order history under their name. */
export async function PATCH(request: Request, { params }: Context) {
  const token = (await cookies()).get(ADMIN_TOKEN_COOKIE)?.value;
  if (!token) return Response.json({ message: 'Authentification requise.' }, { status: 401 });
  const { id } = await params;
  try {
    const upstream = await fetch(`${getBackendBaseUrl()}/admin/orders/${encodeURIComponent(id)}/etat`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: await request.text(),
      cache: 'no-store',
    });
    return new Response(await upstream.text(), { status: upstream.status, headers: { 'Content-Type': upstream.headers.get('content-type') ?? 'application/json' } });
  } catch {
    return Response.json({ message: 'Impossible de joindre le serveur.' }, { status: 502 });
  }
}
