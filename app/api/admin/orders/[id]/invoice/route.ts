import { proxyAdminRequest } from "@/lib/admin-proxy";

/** The PDF of the order's Dolibarr invoice, for a signed-in admin. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return proxyAdminRequest(request, `/admin/orders/${encodeURIComponent(id)}/invoice`, "GET");
}
