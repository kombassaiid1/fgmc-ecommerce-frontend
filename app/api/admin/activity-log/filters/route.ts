import { proxyAdminRequest } from "@/lib/admin-proxy";

/** What the journal's filters offer (people, areas, kinds of action). */
export async function GET(request: Request) {
  const response = await proxyAdminRequest(request, "/activity-log/filters", "GET");
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
