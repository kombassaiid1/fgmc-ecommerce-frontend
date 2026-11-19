import { proxyAdminRequest } from "@/lib/admin-proxy";

export async function GET(request: Request, { params }: { params: Promise<{ id: string; paymentId: string }> }) {
  const { id, paymentId } = await params;
  const response = await proxyAdminRequest(request, `/admin/orders/${encodeURIComponent(id)}/payments/${encodeURIComponent(paymentId)}/details`, "GET");
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
