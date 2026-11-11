import { proxySuppliers } from './proxy';
export async function GET(request: Request) { return proxySuppliers(request); }
