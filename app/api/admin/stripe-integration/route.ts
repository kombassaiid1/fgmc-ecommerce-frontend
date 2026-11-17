import { proxyStripe } from './proxy';

export function GET(request: Request) { return proxyStripe(request); }
export function PATCH(request: Request) { return proxyStripe(request, '', 'PATCH'); }
