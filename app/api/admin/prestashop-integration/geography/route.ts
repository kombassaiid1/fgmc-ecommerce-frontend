import { proxyPrestashop } from '../proxy';

/** GET: what an import would do (preview). POST: run the import. */
export function GET(request: Request) { return proxyPrestashop(request, 'geography/preview'); }
export function POST(request: Request) { return proxyPrestashop(request, 'geography/import', 'POST'); }
