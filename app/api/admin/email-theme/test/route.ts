import { proxyAdminRequest } from "@/lib/admin-proxy";

/** Sends a sample e-mail with the saved theme. */
export function POST(request: Request) {
  return proxyAdminRequest(request, "/admin/email-theme/test", "POST");
}
