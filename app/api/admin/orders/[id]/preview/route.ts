import { cookies } from 'next/headers';
import { ADMIN_TOKEN_COOKIE } from '@/lib/admin-auth';
import { getBackendBaseUrl } from '@/lib/backend-url';

type Context = { params: Promise<{ id: string }> };

/** The extra details of an order (carrier, tracking, payment transaction, product references), for the order list. */
export async function GET(_request: Request, { params }: Context) {
  const token = (await cookies()).get(ADMIN_TOKEN_COOKIE)?.value;
  if (!token) return Response.json({ message: 'Authentification requise.' }, { status: 401 });
  const { id } = await params;
  try {
    const upstream = await fetch(`${getBackendBaseUrl()}/admin/orders/${encodeURIComponent(id)}/preview`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    return new Response(await upstream.text(), { status: upstream.status, headers: { 'Content-Type': upstream.headers.get('content-type') ?? 'application/json' } });
  } catch {
    return Response.json({ message: 'Impossible de joindre le serveur.' }, { status: 502 });
  }
}
