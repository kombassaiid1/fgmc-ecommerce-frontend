import { proxyDolibarr } from '../../proxy';

export function POST(request: Request) { return proxyDolibarr(request, 'sync/customers-orders', 'POST'); }
