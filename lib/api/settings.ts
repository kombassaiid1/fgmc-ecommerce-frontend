import { apiRequest } from "@/lib/api/http-client";
import type { OrderStatusColors } from "@/lib/order-statuses";

export type AdminSettings = { orderStatusColors?: OrderStatusColors | null };

export function getAdminSettings() {
  return apiRequest<AdminSettings>({ path: "/settings" });
}

export function updateAdminSettings(settings: Partial<AdminSettings>) {
  return apiRequest<AdminSettings>({
    path: "/settings",
    method: "PATCH",
    body: JSON.stringify(settings),
  });
}
