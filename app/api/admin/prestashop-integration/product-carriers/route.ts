import { proxyPrestashop } from '../proxy';

/** GET: how many products and linked carriers there are. POST: copy one page of products' allowed carriers from PrestaShop. */
export function GET(request: Request) { return proxyPrestashop(request, 'product-carriers'); }
export function POST(request: Request) { return proxyPrestashop(request, 'product-carriers/import', 'POST'); }
