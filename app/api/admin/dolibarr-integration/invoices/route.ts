import { proxyDolibarr } from '../proxy';

export function GET(request: Request) { return proxyDolibarr(request, 'invoices'); }
