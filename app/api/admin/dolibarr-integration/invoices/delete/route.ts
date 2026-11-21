import { proxyDolibarr } from '../../proxy';

export function POST(request: Request) { return proxyDolibarr(request, 'invoices/delete', 'POST'); }
