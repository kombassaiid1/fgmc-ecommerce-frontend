import { proxyOrderStates } from './proxy';

export function GET(request: Request) { return proxyOrderStates(request); }
export function POST(request: Request) { return proxyOrderStates(request, '', 'POST'); }
