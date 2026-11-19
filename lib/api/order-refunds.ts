type RefundLine = { index: number; quantity: number; amountCents: number };
type RefundMethod = "stripe" | "external" | "voucher";

export type RefundInput = {
  requestId: string;
  method: RefundMethod;
  lines: RefundLine[];
  shippingCents: number;
  restock: boolean;
};

export type OrderRefund = {
  id: string;
  reference: string | null;
  status: "pending" | "succeeded" | "failed";
  createdAt: string;
  amountCents: number;
  shippingCents: number;
  lines: RefundLine[];
  voucherCode: string | null;
  method: RefundMethod;
  stripeLivemode: boolean | null;
};

export type RefundContext = {
  refunds: OrderRefund[];
  payment: { method: "stripe" | "external"; livemode: boolean | null } | null;
  remainingCents: number;
  paymentError: string | null;
};

export class RefundRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

const refundPath = (orderId: string) => `/frontend-api/admin/orders/${encodeURIComponent(orderId)}/refunds`;
export const getCreditNoteUrl = (orderId: string, refundId: string) => `${refundPath(orderId)}/${encodeURIComponent(refundId)}/pdf`;

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, { cache: "no-store", ...options });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body) {
    const message = Array.isArray(body?.message) ? body.message.join(" ") : body?.message;
    throw new RefundRequestError(message || "Le service de remboursement est temporairement indisponible.", response.ok ? 502 : response.status);
  }
  return body as T;
}

export const getOrderRefunds = (orderId: string) => request<RefundContext>(refundPath(orderId));
export const createOrderRefund = (orderId: string, input: RefundInput) => request<OrderRefund>(refundPath(orderId), {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input),
});
export const retryOrderRefund = (orderId: string, refundId: string) => request<OrderRefund>(
  `${refundPath(orderId)}/${encodeURIComponent(refundId)}/retry`, { method: "POST" },
);
