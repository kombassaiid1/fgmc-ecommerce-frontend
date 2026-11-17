import { proxyGls } from './proxy';

export function GET(request: Request) { return proxyGls(request); }
export function PATCH(request: Request) { return proxyGls(request); }
