import { proxyPrestashop } from '../proxy';

export function POST(request: Request) { return proxyPrestashop(request, 'test', 'POST'); }
