import type { OrderSettings, ReferenceReset, ReferenceType } from "@/lib/order-reference";

export type OrderSettingsInput = { type: ReferenceType; prefix: string; digits: number; reset: ReferenceReset; nextNumber?: number };

const URL = "/frontend-api/admin/order-settings";

async function request<T>(init?: RequestInit): Promise<T> {
  const response = await fetch(URL, { cache: "no-store", ...init, headers: { ...(init?.body ? { "Content-Type": "application/json" } : {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(Array.isArray(data.message) ? data.message.join(" ") : data.message || "Action impossible.");
  return data as T;
}

export const orderSettingsApi = {
  get: () => request<OrderSettings>(),
  save: (input: OrderSettingsInput) => request<OrderSettings>({ method: "PUT", body: JSON.stringify(input) }),
};
