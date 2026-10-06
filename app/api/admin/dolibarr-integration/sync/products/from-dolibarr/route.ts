import { proxyDolibarr } from '../../../proxy';

export function POST(request: Request) {
  return proxyDolibarr(request, 'sync/products/from-dolibarr', 'POST');
}
