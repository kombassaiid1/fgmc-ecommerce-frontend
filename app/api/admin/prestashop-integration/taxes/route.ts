import { proxyPrestashop } from '../proxy';

export function GET(request: Request) {
  return proxyPrestashop(request, 'taxes', 'GET');
}

export function POST(request: Request) {
  return proxyPrestashop(request, 'taxes/import', 'POST');
}
