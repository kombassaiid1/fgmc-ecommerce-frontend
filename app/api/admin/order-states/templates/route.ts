import { proxyOrderStates } from '../proxy';

export function GET(request: Request) { return proxyOrderStates(request, 'templates'); }
