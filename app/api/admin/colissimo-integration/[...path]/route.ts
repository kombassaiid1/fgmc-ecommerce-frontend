import { proxyColissimo } from '../proxy';

type Context = { params: Promise<{ path: string[] }> };

export async function GET(request: Request, { params }: Context) { return proxyColissimo(request, (await params).path); }
export async function POST(request: Request, { params }: Context) { return proxyColissimo(request, (await params).path); }
export async function PATCH(request: Request, { params }: Context) { return proxyColissimo(request, (await params).path); }
export async function DELETE(request: Request, { params }: Context) { return proxyColissimo(request, (await params).path); }
