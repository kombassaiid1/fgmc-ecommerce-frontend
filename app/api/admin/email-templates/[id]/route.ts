import { proxyAdminRequest } from "@/lib/admin-proxy";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Context) {
  return proxyAdminRequest(request, `/email-templates/${encodeURIComponent((await params).id)}`, "PATCH");
}

export async function DELETE(request: Request, { params }: Context) {
  return proxyAdminRequest(request, `/email-templates/${encodeURIComponent((await params).id)}`, "DELETE");
}
