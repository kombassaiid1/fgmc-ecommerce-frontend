import { proxyColissimo } from './proxy';

export function GET(request: Request) { return proxyColissimo(request); }
export function PATCH(request: Request) { return proxyColissimo(request); }
