import { adminCatchAll } from "@/lib/admin-proxy";

const handlers = adminCatchAll("/roles");

export const GET = handlers.GET;
export const POST = handlers.POST;
export const PATCH = handlers.PATCH;
export const DELETE = handlers.DELETE;
