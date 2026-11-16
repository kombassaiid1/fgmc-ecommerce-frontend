import { adminCatchAll } from "@/lib/admin-proxy";

const handlers = adminCatchAll("/clients");

export const GET = handlers.GET;
export const POST = handlers.POST;
export const PATCH = handlers.PATCH;
export const DELETE = handlers.DELETE;
