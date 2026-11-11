import { cookies } from 'next/headers';
import { ADMIN_TOKEN_COOKIE } from '@/lib/admin-auth';
import { getBackendBaseUrl } from '@/lib/backend-url';

export async function proxySuppliers(request: Request, code?: string) {
  const token = (await cookies()).get(ADMIN_TOKEN_COOKIE)?.value;
  if (!token) return Response.json({ message: 'Authentification requise.' }, { status: 401 });
  if (code && !/^[a-z0-9_-]{1,64}$/.test(code)) return Response.json({ message: 'Code fournisseur invalide.' }, { status: 400 });
  try {
    const upstream = await fetch(`${getBackendBaseUrl()}/suppliers${code ? `/${encodeURIComponent(code)}/pricing` : ''}`, {
      method: code ? 'PUT' : 'GET',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: code ? await request.text() : undefined,
      cache: 'no-store', signal: AbortSignal.timeout(15000),
    });
    return new Response(await upstream.text(), { status: upstream.status, headers: { 'Content-Type': 'application/json' } });
  } catch { return Response.json({ message: 'Impossible de joindre le serveur fournisseur.' }, { status: 502 }); }
}
