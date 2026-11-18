/** Order statuses, managed in Paramètres, Commandes, États de commandes (like PrestaShop). */
export type OrderStateRow = {
  id: string;
  /** What orders hold; never changes. */
  key: string;
  name: string;
  /** Background color, #rrggbb. */
  color: string;
  /** A readable text color for the background. */
  textColor: string;
  iconUrl: string | null;
  logable: boolean;
  invoice: boolean;
  hidden: boolean;
  sendEmail: boolean;
  pdfInvoice: boolean;
  pdfDelivery: boolean;
  shipped: boolean;
  paid: boolean;
  delivery: boolean;
  template: string | null;
  unremovable: boolean;
  prestashopId: string | null;
};

export type OrderStateInput = Omit<OrderStateRow, "id" | "key" | "textColor" | "unremovable" | "prestashopId" | "iconUrl" | "template"> & {
  iconUrl: string;
  template: string;
};

export type OrderStateImportPreview = { source: number; create: string[]; update: number };
export type OrderStateImportResult = { created: number; updated: number; icons: number };

const BASE = "/frontend-api/admin/order-states";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init, headers: { ...(init?.body ? { "Content-Type": "application/json" } : {}), ...init?.headers } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(Array.isArray(data.message) ? data.message.join(" ") : data.message || "Action impossible.");
  return data as T;
}

const json = (value: unknown) => JSON.stringify(value);

export const orderStatesApi = {
  list: () => request<OrderStateRow[]>(BASE),
  get: (id: string) => request<OrderStateRow>(`${BASE}/${id}`),
  create: (input: OrderStateInput) => request<OrderStateRow>(BASE, { method: "POST", body: json(input) }),
  update: (id: string, input: OrderStateInput) => request<OrderStateRow>(`${BASE}/${id}`, { method: "PUT", body: json(input) }),
  remove: (ids: string[]) => request<{ deleted: number; skipped: Array<{ id: string; name: string; reason: string }> }>(`${BASE}/delete`, { method: "POST", body: json({ ids }) }),
  templates: () => request<string[]>(`${BASE}/templates`),
  importPreview: () => request<OrderStateImportPreview>("/frontend-api/admin/prestashop-integration/order-states"),
  importFromPrestashop: () => request<OrderStateImportResult>("/frontend-api/admin/prestashop-integration/order-states", { method: "POST" }),
};

export const EMPTY_ORDER_STATE: OrderStateInput = {
  name: "", color: "#d1d5db", iconUrl: "", logable: false, invoice: false, hidden: false, sendEmail: false,
  pdfInvoice: false, pdfDelivery: false, shipped: false, paid: false, delivery: false, template: "",
};

export const toInput = (state: OrderStateRow): OrderStateInput => ({
  name: state.name, color: state.color, iconUrl: state.iconUrl ?? "", logable: state.logable, invoice: state.invoice, hidden: state.hidden,
  sendEmail: state.sendEmail, pdfInvoice: state.pdfInvoice, pdfDelivery: state.pdfDelivery, shipped: state.shipped, paid: state.paid,
  delivery: state.delivery, template: state.template ?? "",
});
