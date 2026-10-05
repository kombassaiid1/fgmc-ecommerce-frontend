import { proxyPrestashop } from './proxy';

export function GET(request: Request) { return proxyPrestashop(request); }
export function PATCH(request: Request) { return proxyPrestashop(request, '', 'PATCH'); }
