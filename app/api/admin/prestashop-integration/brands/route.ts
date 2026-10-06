import { proxyPrestashop } from '../proxy';

export function GET(request: Request) {
  return proxyPrestashop(request, 'brands', 'GET');
}

export function POST(request: Request) {
  return proxyPrestashop(request, 'brands/import', 'POST');
}
