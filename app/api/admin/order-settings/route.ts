import { cookies } from 'next/headers';
import { ADMIN_TOKEN_COOKIE } from '@/lib/admin-auth';
import { getBackendBaseUrl } from '@/lib/backend-url';

/** Forwards the order settings (reference format) to the admin-only backend endpoint, with the admin's token. */
async function forward(method: 'GET' | 'PUT', request: Request) {
  const token = (await cookies()).get(ADMIN_TOKEN_COOKIE)?.value;
  if (!token) return Response.json({ message: 'Authentification requise.' }, { status: 401 });
  const body = method === 'PUT' ? await request.text() : undefined;
  try {
    const upstream = await fetch(`${getBackendBaseUrl()}/admin/order-settings`, {
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

export function GET(request: Request) { return forward('GET', request); }
export function PUT(request: Request) { return forward('PUT', request); }
