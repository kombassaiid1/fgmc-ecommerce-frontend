import { cookies } from 'next/headers';
import { ADMIN_TOKEN_COOKIE } from '@/lib/admin-auth';
import { getBackendBaseUrl } from '@/lib/backend-url';

/** Forwards the footer page's load and save to /admin/footer on the backend, adding the admin token. */
async function forward(request: Request) {
  const token = (await cookies()).get(ADMIN_TOKEN_COOKIE)?.value;
  if (!token) return Response.json({ message: 'Authentification requise.' }, { status: 401 });

  const method = request.method;
  const body = method === 'GET' ? undefined : await request.text();

  try {
    const upstream = await fetch(`${getBackendBaseUrl()}/admin/footer`, {
      method,
      headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body,
      cache: 'no-store',
    });
    return new Response(await upstream.text(), {
      status: upstream.status,
      headers: { 'Content-Type': upstream.headers.get('content-type') ?? 'application/json', 'Cache-Control': 'no-store' },
    });
  } catch {
    return Response.json({ message: 'Impossible de joindre le serveur.' }, { status: 502 });
  }
}

export const GET = forward;
export const PUT = forward;
