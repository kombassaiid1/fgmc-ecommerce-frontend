import { cookies } from 'next/headers';
import { ADMIN_TOKEN_COOKIE } from '@/lib/admin-auth';
import { getBackendBaseUrl } from '@/lib/backend-url';

/** Downloads the FGMC PrestaShop module (zip). Binary, so it does not go through the JSON proxy. */
export async function GET() {
  const token = (await cookies()).get(ADMIN_TOKEN_COOKIE)?.value;
  if (!token) return Response.json({ message: 'Authentification requise.' }, { status: 401 });
  try {
    const upstream = await fetch(`${getBackendBaseUrl()}/admin/prestashop-integration/module-package`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!upstream.ok) {
      const detail = await upstream.json().catch(() => ({}));
      return Response.json({ message: detail.message || 'Téléchargement impossible.' }, { status: upstream.status });
    }
    return new Response(await upstream.arrayBuffer(), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="fgmcshipping.zip"',
        'Cache-Control': 'no-store',
      },
    });
  } catch {
    return Response.json({ message: 'Impossible de joindre le serveur.' }, { status: 502 });
  }
}
