import { proxyGls } from '../proxy';

type Context = { params: Promise<{ path: string[] }> };

export async function GET(request: Request, { params }: Context) { return proxyGls(request, (await params).path); }
export async function POST(request: Request, { params }: Context) { return proxyGls(request, (await params).path); }
