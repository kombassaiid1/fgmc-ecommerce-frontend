import { proxyPrestashop } from '../proxy';

/** GET: what importing the PrestaShop order statuses would do. POST: run the import. */
export function GET(request: Request) { return proxyPrestashop(request, 'order-states/preview'); }
export function POST(request: Request) { return proxyPrestashop(request, 'order-states/import', 'POST'); }
