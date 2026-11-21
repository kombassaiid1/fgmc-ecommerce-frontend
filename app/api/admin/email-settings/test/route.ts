import { proxyAdminRequest } from "@/lib/admin-proxy";

/** Sends a test e-mail with the saved settings. */
export function POST(request: Request) {
  return proxyAdminRequest(request, "/admin/email-settings/test", "POST");
}
