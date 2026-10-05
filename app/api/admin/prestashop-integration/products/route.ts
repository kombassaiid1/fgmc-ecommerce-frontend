import { proxyPrestashop } from '../proxy';

export function GET(request: Request) { return proxyPrestashop(request, 'products'); }
