import { proxyAdminRequest } from "@/lib/admin-proxy";

/** The shop's e-mail models (Thème des e-mails, Modèles d'e-mail): list and create. */
export async function GET(request: Request) {
  const response = await proxyAdminRequest(request, "/email-templates", "GET");
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export function POST(request: Request) {
  return proxyAdminRequest(request, "/email-templates", "POST");
}
