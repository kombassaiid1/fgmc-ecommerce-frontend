/** Admin client management: goes through the Next proxy (httpOnly session cookie). */

export type AdminClient = {
  id: string;
  Titre: "M" | "Mme";
  email: string;
  username: string | null;
  firstName: string;
  lastName: string;
  phoneNumber: string | null;
  company: string | null;
  numberIdFiscale: string | null;
  dateOfBirth: string | null;
  isActive: boolean;
  newsletter: boolean;
  partnerOffers: boolean;
  lastVisitAt: string | null;
  createdAt: string;
  sales: number;
  ordersCount: number;
};

export type AdminClientFilters = {
  id: string;
  titre: string;
  firstName: string;
  lastName: string;
  email: string;
  company: string;
  isActive: string;
  newsletter: string;
  partnerOffers: string;
  createdFrom: string;
  createdTo: string;
};

export const EMPTY_CLIENT_FILTERS: AdminClientFilters = {
  id: "",
  titre: "",
  firstName: "",
  lastName: "",
  email: "",
  company: "",
  isActive: "",
  newsletter: "",
  partnerOffers: "",
  createdFrom: "",
  createdTo: "",
};

export type AdminClientStats = {
  total: number;
  femalePercent: number;
  averageAge: number | null;
  ordersPerCustomer: number;
  newsletterRegistrations: number;
};

export type AdminClientUpdate = Partial<{
  Titre: "M" | "Mme";
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  company: string;
  numberIdFiscale: string;
  dateOfBirth: string;
  isActive: boolean;
  newsletter: boolean;
  partnerOffers: boolean;
  password: string;
}>;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/admin/clients${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
    cache: "no-store",
  });
  const data = (await response.json().catch(() => null)) as
    | (T & { message?: string | string[] })
    | null;
  if (!response.ok) {
    const message = data?.message;
    throw new Error(
      (Array.isArray(message) ? message.join(", ") : message) || `Erreur ${response.status}`,
    );
  }
  return data as T;
}

export function listAdminClients(params: {
  page: number;
  limit: number;
  filters: AdminClientFilters;
  sortBy: string;
  sortDir: "asc" | "desc";
}) {
  const query = new URLSearchParams({
    page: String(params.page),
    limit: String(params.limit),
    sortBy: params.sortBy,
    sortDir: params.sortDir,
  });
  for (const [key, value] of Object.entries(params.filters)) {
    if (value.trim()) query.set(key, value.trim());
  }
  return request<{
    data: AdminClient[];
    meta: { total: number; page: number; totalPages: number };
  }>(`?${query.toString()}`);
}

export const getAdminClientStats = () => request<AdminClientStats>("/stats");

export const updateAdminClient = (id: string, payload: AdminClientUpdate) =>
  request<AdminClient>(`/${id}`, { method: "PATCH", body: JSON.stringify(payload) });

export const deleteAdminClient = (id: string) =>
  request<{ deleted: true }>(`/${id}`, { method: "DELETE" });

/** One-time code (60 s) opening the customer's storefront session. */
export const createClientImpersonationCode = (id: string) =>
  request<{ code: string }>(`/${id}/impersonate`, { method: "POST" });
