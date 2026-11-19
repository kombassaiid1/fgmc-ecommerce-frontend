import { apiRequest } from "./http-client";

export type OrdersQueryParams = {
  page?: number;
  limit?: number;
  search?: string;
  etat?: string;
  paymentStatus?: string;
};

export type OrderItemPayload = {
  id: string;
  title: string;
  slug: string;
  image?: string;
  variantId?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  unitPriceHt?: number;
  totalPriceHt?: number;
  taxRate?: number;
};

export type OrderTotalsPayload = {
  items: OrderItemPayload[];
  total: number;
  unitPrice?: number;
  discount?: number;
  priceHT?: number;
  tva?: number;
  priceTTC?: number;
  deliveryFee?: number;
  couponCode?: string;
  paymentMethod?: "En_ligne" | "COD";
  /** How the customer chose to pay, shown in the admin order list. */
  paymentType?: "Paiement par carte bancaire" | "Paiement à la livraison" | "Virement bancaire";
  /** Carrier chosen at checkout. The server recomputes and checks its price. */
  shipping?: { carrierId: string; countryCode: string };
};

export type GuestOrderPayload = OrderTotalsPayload & {
  guestName: string;
  guestEmail?: string;
  guestPhone: string;
  guestAddress: string;
};

export type AuthenticatedOrderPayload = OrderTotalsPayload & {
  addressId: string;
};

export type CreateAddressPayload = {
  country: string;
  street: string;
  City: string;
  state: string;
  zipCode: string;
};

export type CreatedAddress = CreateAddressPayload & {
  id: string;
  createdAt?: string;
};

export async function getClientAddresses(token: string): Promise<{ data: CreatedAddress[] }> {
  return apiRequest<{ data: CreatedAddress[] }>({
    path: "/auth/me/addresses",
    method: "GET",
    headers: authHeaders(token),
  });
}

export async function updateClientAddress(
  token: string,
  id: string,
  payload: Partial<CreateAddressPayload>,
): Promise<CreatedAddress> {
  return apiRequest<CreatedAddress>({
    path: `/auth/me/addresses/${id}`,
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
}

export async function deleteClientAddress(token: string, id: string): Promise<void> {
  await apiRequest<void>({
    path: `/auth/me/addresses/${id}`,
    method: "DELETE",
    headers: authHeaders(token),
  });
}

export type CreatedOrder = {
  id: string;
  /** The order number shown to the customer. */
  reference?: string | null;
  total: number;
  createdAt?: string;
};

export type OrderClient = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
};

export type OrderAddress = {
  state: string;
  City: string;
};

export type StoredOrderProduct = {
  id?: string;
  title?: string;
  slug?: string;
  image?: string | null;
  variantId?: string | null;
  quantity?: number;
  unitPrice?: number;
  totalPrice?: number;
};

export type OrderListItem = {
  id: string;
  /** The order number the shop shows (null on orders made before references existed). */
  reference?: string | null;
  products: StoredOrderProduct[] | unknown;
  Client?: OrderClient | null;
  Address?: OrderAddress | null;
  adressId?: string | null;
  total: number;
  unitPrice?: number | null;
  discount?: number | null;
  priceHT?: number | null;
  tva?: number | null;
  priceTTC?: number | null;
  deliveryFee?: number | null;
  paymentType?: string | null;
  paymentStatus: string;
  etat: string;
  paymentMethod: string;
  couponCode?: string | null;
  guestName?: string | null;
  guestEmail?: string | null;
  guestPhone?: string | null;
  guestAddress?: string | null;
  createdAt: string;
  updatedAt: string;
  dolibarrId?: string | null;
  dolibarrInvoice?: {
    reference: string;
    invoiceUrl: string | null;
    date: string | null;
    totalTtc: number | null;
    currency: string | null;
    status: string | null;
  } | null;
};

export type OrderDetail = Omit<OrderListItem, "Client" | "Address"> & {
  Client?: (OrderClient & {
    Titre?: string;
    phoneNumber?: string | null;
    company?: string | null;
    numberIdFiscale?: string | null;
  }) | null;
  Address?: (OrderAddress & {
    country: string;
    street: string;
    zipCode: string;
  }) | null;
  customerOrderCount: number;
  customerTotalSpent: number;
  /** A note only the shop's staff can see. */
  privateNote?: string | null;
  adjacentOrders?: { previous: string | null; next: string | null };
};

export type OrdersResponse = {
  data: OrderListItem[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
};

function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
  };
}

function buildOrdersQuery(params?: OrdersQueryParams) {
  const query = new URLSearchParams();

  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.search?.trim()) query.set("search", params.search.trim());
  if (params?.etat?.trim()) query.set("etat", params.etat.trim());
  if (params?.paymentStatus?.trim()) {
    query.set("paymentStatus", params.paymentStatus.trim());
  }

  const qs = query.toString();
  return `/orders${qs ? `?${qs}` : ""}`;
}

export async function getOrders(
  params?: OrdersQueryParams,
): Promise<OrdersResponse> {
  return apiRequest<OrdersResponse>({
    path: buildOrdersQuery(params),
    method: "GET",
  });
}

export async function getOrder(id: string): Promise<OrderDetail> {
  return apiRequest<OrderDetail>({
    path: `/orders/${encodeURIComponent(id)}`,
    method: "GET",
  });
}

/** Changes an order's status as the logged-in admin (through the admin route), so the history records who did it. */
export async function updateOrderStatus(id: string, etat: string): Promise<OrderListItem> {
  const response = await fetch(`/frontend-api/admin/orders/${encodeURIComponent(id)}/etat`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ etat }),
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(Array.isArray(data.message) ? data.message.join(", ") : data.message || "Impossible de mettre à jour le statut.");
  return data as OrderListItem;
}

export async function updateOrderPaymentStatus(id: string, paymentStatus: string): Promise<OrderListItem> {
  return apiRequest<OrderListItem>({
    path: `/orders/${encodeURIComponent(id)}/payment-status`,
    method: "PATCH",
    body: JSON.stringify({ paymentStatus }),
  });
}

export async function createGuestOrder(
  payload: GuestOrderPayload,
): Promise<CreatedOrder> {
  return apiRequest<CreatedOrder>({
    path: "/orders",
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function createClientAddress(
  token: string,
  payload: CreateAddressPayload,
): Promise<CreatedAddress> {
  return apiRequest<CreatedAddress>({
    path: "/auth/me/addresses",
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
}

export async function createAuthenticatedOrder(
  token: string,
  payload: AuthenticatedOrderPayload,
): Promise<CreatedOrder> {
  return apiRequest<CreatedOrder>({
    path: "/orders/authenticated",
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
}

/** What the order list shows when a row is opened. */
export type ProFormaDocument = { reference: string; comment: string | null };

export type OrderPreview = {
  carrierName: string | null;
  proForma?: { reference: string; comment?: string | null } | null;
  deliverySlip?: { reference: string } | null;
  /** The carrier family of the order: only that carrier's shipping card is usable on the order page. */
  carrierKind?: "GLS" | "COLISSIMO" | null;
  /** What the customer chose at checkout: the carrier and what it costs (null when no carrier was chosen). */
  shipping: { carrierName: string; zoneName: string | null; countryCode: string; weightKg: number; fee: number; handlingFee: number; createdAt: string } | null;
  /** The GLS choice: delivery type, relay point and mobile number. */
  delivery: { glsType: string; parcelShopId: string | null; relay: { name?: string; street?: string; zip?: string; city?: string } | null; customerMobile: string | null } | null;
  /** The Colissimo choice: delivery type, pickup point and mobile number. */
  colissimoDelivery?: { colissimoType: string; pickupPointId: string | null; relay: { name?: string; street?: string; zip?: string; city?: string } | null; customerMobile: string | null } | null;
  /** Every status the order has had, newest first. */
  history: Array<{ etat: string; by: string | null; at: string }>;
  trackingNumbers: string[];
  /** The carrier's page to follow the parcel(s), numbers included (null before a label exists). */
  trackingLink: string | null;
  /** Stripe payment session, when the order was paid online. */
  transactionId: string | null;
  /** By product id: its reference and tax rate in percent. */
  products: Record<string, { reference: string | null; taxRate: number }>;
};

export async function getOrderPreview(id: string): Promise<OrderPreview> {
  const response = await fetch(`/frontend-api/admin/orders/${encodeURIComponent(id)}/preview`, { cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(Array.isArray(data.message) ? data.message.join(" ") : data.message || "Impossible de charger les détails.");
  return data as OrderPreview;
}

export function getDeliverySlipUrl(id: string): string {
  return `/frontend-api/admin/orders/${encodeURIComponent(id)}/delivery-slip`;
}

export function getProFormaUrl(id: string): string {
  return `/frontend-api/admin/orders/${encodeURIComponent(id)}/pro-forma`;
}

/* ------------------------------------------------------------------ */
/* Admin: the customer card of an order                                */
/* ------------------------------------------------------------------ */

export type OrderAddressChoice = { id: string; street: string; zipCode: string; city: string; state: string; country: string };

async function adminOrderCall<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/frontend-api/admin/orders/${path}`, { cache: "no-store", ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(Array.isArray(data.message) ? data.message.join(" ") : data.message || "Action impossible.");
  return data as T;
}

export const getAdminOrder = (id: string) => adminOrderCall<OrderDetail>(encodeURIComponent(id));

/** The other addresses of the order's customer (none for a guest). */
export const getOrderAddresses = (id: string) => adminOrderCall<{ currentId: string | null; addresses: OrderAddressChoice[] }>(`${encodeURIComponent(id)}/addresses`);

export const chooseOrderAddress = (id: string, addressId: string) => adminOrderCall<OrderDetail>(`${encodeURIComponent(id)}/address-choice`, { method: "PATCH", body: JSON.stringify({ addressId }) });

/** Corrects the order's address. The customer's address book is not touched. */
export const updateOrderAddress = (id: string, address: { street: string; zipCode: string; city: string; state?: string; country: string }) =>
  adminOrderCall<OrderDetail>(`${encodeURIComponent(id)}/address`, { method: "PATCH", body: JSON.stringify(address) });

export const updateOrderGuest = (id: string, guest: { guestName?: string; guestEmail?: string; guestPhone?: string; guestAddress?: string }) =>
  adminOrderCall<OrderDetail>(`${encodeURIComponent(id)}/guest`, { method: "PATCH", body: JSON.stringify(guest) });

export const saveOrderNote = (id: string, note: string) => adminOrderCall<{ privateNote: string | null }>(`${encodeURIComponent(id)}/note`, { method: "PATCH", body: JSON.stringify({ note }) });

export const saveProFormaComment = (id: string, note: string) =>
  adminOrderCall<ProFormaDocument>(`${encodeURIComponent(id)}/pro-forma/comment`, { method: "PATCH", body: JSON.stringify({ note }) });

export const regenerateOrderProForma = (id: string) =>
  adminOrderCall<{ reference: string }>(`${encodeURIComponent(id)}/pro-forma/regenerate`, { method: "POST" });

export type PaymentInvoiceKind = "invoice" | "pro-forma";

export type OrderPayment = {
  id: string;
  paidAt: string;
  method: string;
  transactionId: string | null;
  amountCents: number;
  currency: string;
  invoiceKind: PaymentInvoiceKind | null;
  invoiceReference: string | null;
  source: "manual" | "stripe" | "stripe-test";
};

export type OrderPayments = {
  payments: OrderPayment[];
  invoices: Array<{ kind: PaymentInvoiceKind; reference: string }>;
  canRecord: boolean;
};

export type RecordOrderPayment = {
  id: string;
  paidAt: string;
  method: string;
  transactionId?: string;
  amountCents: number;
  currency: "EUR";
  invoiceKind?: PaymentInvoiceKind;
};

export const getOrderPayments = (id: string) =>
  adminOrderCall<OrderPayments>(`${encodeURIComponent(id)}/payments`);

export type PaymentCardDetails = {
  last4: string;
  brand: string | null;
  network: string | null;
  expiry: string | null;
  billingName: string | null;
};

export const getOrderPaymentDetails = (id: string, paymentId: string) =>
  adminOrderCall<{ card: PaymentCardDetails | null }>(`${encodeURIComponent(id)}/payments/${encodeURIComponent(paymentId)}/details`);

export const recordOrderPayment = (id: string, payment: RecordOrderPayment) =>
  adminOrderCall<OrderPayments>(`${encodeURIComponent(id)}/payments`, { method: "POST", body: JSON.stringify(payment) });
