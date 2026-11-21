import { proxyAdminRequest } from "@/lib/admin-proxy";

/** How the shop's e-mails look: read and saved with the signed-in admin's session. */
export async function GET(request: Request) {
  const response = await proxyAdminRequest(request, "/admin/email-theme", "GET");
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export function PATCH(request: Request) {
  return proxyAdminRequest(request, "/admin/email-theme", "PATCH");
}
