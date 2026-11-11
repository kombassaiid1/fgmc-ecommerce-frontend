import { apiRequest } from "@/lib/api/http-client";
import type { OrderStatusColors } from "@/lib/order-statuses";

export type ProductSettings = {
  defaultStockQuantity: number;
  markupPercent: number;
  fixedFee: number;
  roundingIncrement: number;
};

export const DEFAULT_PRODUCT_SETTINGS: ProductSettings = {
  defaultStockQuantity: 0,
  markupPercent: 30,
  fixedFee: 0,
  roundingIncrement: 0.01,
};

export type AdminSettings = {
  orderStatusColors?: OrderStatusColors | null;
  productSettings?: Partial<ProductSettings> | null;
};

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
