import { cookies } from 'next/headers';
import { ADMIN_TOKEN_COOKIE } from '@/lib/admin-auth';
import { getBackendBaseUrl } from '@/lib/backend-url';

/** Forwards an admin request to the backend Colissimo endpoints, binary-safe (label PDFs). */
export async function proxyColissimo(request: Request, path: string[] = []) {
  const token = (await cookies()).get(ADMIN_TOKEN_COOKIE)?.value;
  if (!token) return Response.json({ message: 'Authentification requise.' }, { status: 401 });

  const method = request.method;
  const body = method === 'GET' || method === 'HEAD' ? undefined : await request.text();
  const suffix = path.length ? `/${path.map(encodeURIComponent).join('/')}` : '';
  const query = new URL(request.url).search;

  try {
    const upstream = await fetch(`${getBackendBaseUrl()}/admin/colissimo-integration${suffix}${query}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body,
      cache: 'no-store',
    });
    const headers = new Headers({ 'Content-Type': upstream.headers.get('content-type') ?? 'application/json', 'Cache-Control': 'no-store' });
    const disposition = upstream.headers.get('content-disposition');
    if (disposition) headers.set('Content-Disposition', disposition);
    return new Response(await upstream.arrayBuffer(), { status: upstream.status, headers });
  } catch {
    return Response.json({ message: 'Impossible de joindre le serveur.' }, { status: 502 });
  }
}
