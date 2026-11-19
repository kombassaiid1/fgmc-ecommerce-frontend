import { proxyAdminRequest } from "@/lib/admin-proxy";

const path = "/admin/order-pro-forma-settings";

export const GET = (request: Request) => proxyAdminRequest(request, path, "GET");
export const PATCH = (request: Request) => proxyAdminRequest(request, path, "PATCH");
