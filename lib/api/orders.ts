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

export async function updateOrderStatus(id: string, etat: string): Promise<OrderListItem> {
  return apiRequest<OrderListItem>({
    path: `/orders/${encodeURIComponent(id)}/etat`,
    method: "PATCH",
    body: JSON.stringify({ etat }),
  });
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
