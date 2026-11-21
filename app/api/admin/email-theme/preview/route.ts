import { proxyAdminRequest } from "@/lib/admin-proxy";

/** A sample e-mail drawn with the theme being edited. */
export function POST(request: Request) {
  return proxyAdminRequest(request, "/admin/email-theme/preview", "POST");
}
