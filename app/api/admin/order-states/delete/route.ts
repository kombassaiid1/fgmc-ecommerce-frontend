import { proxyOrderStates } from '../proxy';

export function POST(request: Request) { return proxyOrderStates(request, 'delete', 'POST'); }
