import { proxyPrestashop } from '../proxy';

/** GET: what an import would do (preview). POST: run the import. */
export function GET(request: Request) { return proxyPrestashop(request, 'carriers/preview'); }
export function POST(request: Request) { return proxyPrestashop(request, 'carriers/import', 'POST'); }
