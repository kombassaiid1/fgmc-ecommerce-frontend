import { proxyStripe } from '../proxy';

export function POST(request: Request) { return proxyStripe(request, 'test', 'POST'); }
