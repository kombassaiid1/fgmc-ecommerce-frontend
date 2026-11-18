import { proxyOrderStates } from '../proxy';

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Context) { return proxyOrderStates(request, encodeURIComponent((await params).id)); }
export async function PUT(request: Request, { params }: Context) { return proxyOrderStates(request, encodeURIComponent((await params).id), 'PUT'); }
