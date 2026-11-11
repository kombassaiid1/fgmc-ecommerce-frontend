import { proxySuppliers } from '../../proxy';
export async function PUT(request: Request, context: { params: Promise<{ code: string }> }) {
  const { code } = await context.params;
  return proxySuppliers(request, code);
}
