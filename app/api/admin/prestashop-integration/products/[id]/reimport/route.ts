import { proxyPrestashop } from '../../../proxy';

/** Imports a product again from the PrestaShop product it came from. `id` is the shop's own product id. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return proxyPrestashop(request, `products/${encodeURIComponent(id)}/reimport`, 'POST');
}
