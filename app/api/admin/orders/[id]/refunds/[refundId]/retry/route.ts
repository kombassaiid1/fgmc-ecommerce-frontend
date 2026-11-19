import { proxyAdminRequest } from "@/lib/admin-proxy";

export async function POST(request: Request, { params }: { params: Promise<{ id: string; refundId: string }> }) {
  const { id, refundId } = await params;
  return proxyAdminRequest(request, `/admin/orders/${encodeURIComponent(id)}/refunds/${encodeURIComponent(refundId)}/retry`, "POST");
}
