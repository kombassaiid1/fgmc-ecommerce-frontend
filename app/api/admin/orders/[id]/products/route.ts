import { proxyAdminRequest } from "@/lib/admin-proxy";

/** An employee changes the quantity or price of some product lines of an order. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return proxyAdminRequest(request, `/admin/orders/${encodeURIComponent(id)}/products`, "PATCH");
}
