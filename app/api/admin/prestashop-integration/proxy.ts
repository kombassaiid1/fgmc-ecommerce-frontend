import { cookies } from 'next/headers';
import { ADMIN_TOKEN_COOKIE } from '@/lib/admin-auth';
import { getBackendBaseUrl } from '@/lib/backend-url';

export async function proxyPrestashop(request: Request, path = '', method: 'GET' | 'PATCH' | 'POST' = 'GET') {
  const token = (await cookies()).get(ADMIN_TOKEN_COOKIE)?.value;
  if (!token) return Response.json({ message: 'Authentification requise.' }, { status: 401 });
  const body = method === 'PATCH' ? await request.text() : undefined;
  const suffix = path ? `/${path.replace(/^\//, '')}` : '';
  const upstreamUrl = `${getBackendBaseUrl()}/admin/prestashop-integration${suffix}${method === 'GET' ? new URL(request.url).search : ''}`;
  try {
    const upstream = await fetch(upstreamUrl, {
      method,
      headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body,
      cache: 'no-store',
    });
    const payload = await upstream.text();
    return new Response(payload, { status: upstream.status, headers: { 'Content-Type': upstream.headers.get('content-type') ?? 'application/json' } });
  } catch {
    return Response.json({ message: 'Impossible de joindre le serveur.' }, { status: 502 });
  }
}
