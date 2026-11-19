import { proxyAdminRequest } from "@/lib/admin-proxy";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Context) {
  const { id } = await params;
  const response = await proxyAdminRequest(request, `/admin/orders/${encodeURIComponent(id)}/refunds`, "GET");
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export async function POST(request: Request, { params }: Context) {
  const { id } = await params;
  return proxyAdminRequest(request, `/admin/orders/${encodeURIComponent(id)}/refunds`, "POST");
}
