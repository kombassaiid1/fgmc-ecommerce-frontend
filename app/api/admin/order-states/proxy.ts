import { cookies } from 'next/headers';
import { ADMIN_TOKEN_COOKIE } from '@/lib/admin-auth';
import { getBackendBaseUrl } from '@/lib/backend-url';

/** Forwards an admin request to the backend order status endpoints, with the admin's token. */
export async function proxyOrderStates(request: Request, path = '', method: 'GET' | 'POST' | 'PUT' = 'GET') {
  const token = (await cookies()).get(ADMIN_TOKEN_COOKIE)?.value;
  if (!token) return Response.json({ message: 'Authentification requise.' }, { status: 401 });
  const body = method === 'GET' ? undefined : await request.text();
  try {
    const upstream = await fetch(`${getBackendBaseUrl()}/admin/order-states${path ? `/${path}` : ''}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body,
      cache: 'no-store',
    });
    return new Response(await upstream.text(), { status: upstream.status, headers: { 'Content-Type': upstream.headers.get('content-type') ?? 'application/json' } });
  } catch {
    return Response.json({ message: 'Impossible de joindre le serveur.' }, { status: 502 });
  }
}
