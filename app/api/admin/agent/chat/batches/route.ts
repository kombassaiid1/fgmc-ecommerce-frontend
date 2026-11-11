import { cookies } from 'next/headers';
import { ADMIN_TOKEN_COOKIE } from '@/lib/admin-auth';
import { getBackendBaseUrl } from '@/lib/backend-url';

export async function GET(request: Request) {
  const token = (await cookies()).get(ADMIN_TOKEN_COOKIE)?.value;
  if (!token) return Response.json({ message: 'Votre session administrateur a expiré. Reconnectez-vous.' }, { status: 401 });
  const sessionId = new URL(request.url).searchParams.get('sessionId') ?? '';
  if (!/^[\w-]{1,64}$/.test(sessionId)) return Response.json({ message: 'Identifiant de conversation invalide.' }, { status: 400 });
  return forward(`${getBackendBaseUrl()}/agent/chat/batches?sessionId=${encodeURIComponent(sessionId)}`, token, 'GET');
}

export async function POST(request: Request) {
  const token = (await cookies()).get(ADMIN_TOKEN_COOKIE)?.value;
  if (!token) return Response.json({ message: 'Votre session administrateur a expiré. Reconnectez-vous.' }, { status: 401 });
  return forward(`${getBackendBaseUrl()}/agent/chat/batches`, token, 'POST', await request.text(), request.signal);
}

async function forward(url: string, token: string, method: string, body?: string, signal?: AbortSignal) {
  try {
    const upstream = await fetch(url, {
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
