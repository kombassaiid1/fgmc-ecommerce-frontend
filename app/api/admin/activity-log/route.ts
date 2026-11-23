import { proxyAdminRequest } from "@/lib/admin-proxy";

/** Journal d'activité: the staff's actions, filtered by the query of the page. */
export async function GET(request: Request) {
  const response = await proxyAdminRequest(request, "/activity-log", "GET");
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
