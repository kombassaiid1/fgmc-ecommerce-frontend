import { cookies } from 'next/headers';
import { ADMIN_TOKEN_COOKIE } from '@/lib/admin-auth';
import { getBackendBaseUrl } from '@/lib/backend-url';

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  return forward(context, undefined, 'GET');
}

export async function PATCH(request: Request, context: Context) {
  return forward(context, await request.text(), 'PATCH', request.signal);
}

export async function POST(request: Request, context: Context) {
  return forward(context, await request.text(), 'POST', request.signal, '/action');
}

async function forward(context: Context, body: string | undefined, method: string, signal?: AbortSignal, suffix = '') {
  const token = (await cookies()).get(ADMIN_TOKEN_COOKIE)?.value;
  if (!token) return Response.json({ message: 'Votre session administrateur a expiré. Reconnectez-vous.' }, { status: 401 });
  const { id } = await context.params;
  if (!/^[\w-]{1,64}$/.test(id)) return Response.json({ message: 'Identifiant du lot invalide.' }, { status: 400 });
  try {
    const upstream = await fetch(`${getBackendBaseUrl()}/agent/chat/batches/${encodeURIComponent(id)}${suffix}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body } : {}),
      cache: 'no-store',
      ...(signal ? { signal } : {}),
    });
    return new Response(await upstream.text(), {
      status: upstream.status,
      headers: { 'Content-Type': upstream.headers.get('content-type') ?? 'application/json', 'Cache-Control': 'no-store' },
    });
  } catch {
    return Response.json({ message: 'Le service Agent est momentanément indisponible.' }, { status: 502 });
  }
}
