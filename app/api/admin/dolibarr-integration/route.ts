import { proxyDolibarr } from './proxy';

export function GET(request: Request) { return proxyDolibarr(request); }
export function PATCH(request: Request) { return proxyDolibarr(request, '', 'PATCH'); }
