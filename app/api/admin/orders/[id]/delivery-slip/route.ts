import { proxyAdminRequest } from "@/lib/admin-proxy";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return proxyAdminRequest(request, `/admin/orders/${encodeURIComponent(id)}/delivery-slip`, "GET");
}
