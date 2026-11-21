import { proxyAdminRequest } from "@/lib/admin-proxy";

/** The orders list of the back office: forwarded with the admin's session, so only a logged-in admin gets it. */
export async function GET(request: Request) {
  const response = await proxyAdminRequest(request, "/admin/orders", "GET");
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
