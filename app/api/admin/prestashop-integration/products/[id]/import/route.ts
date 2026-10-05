import { proxyPrestashop } from '../../../proxy';

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return proxyPrestashop(_request, `products/${encodeURIComponent(id)}/import`, 'POST');
}
