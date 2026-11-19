import { proxyAdminRequest } from "@/lib/admin-proxy";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const response = await proxyAdminRequest(request, `/admin/orders/${encodeURIComponent(id)}`, "GET");
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
