import { proxyAdminRequest } from "@/lib/admin-proxy";

/** How the shop sends e-mail: read and saved with the signed-in admin's session. The password never comes back. */
export async function GET(request: Request) {
  const response = await proxyAdminRequest(request, "/admin/email-settings", "GET");
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export function PATCH(request: Request) {
  return proxyAdminRequest(request, "/admin/email-settings", "PATCH");
}
