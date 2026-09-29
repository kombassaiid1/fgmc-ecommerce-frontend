import { apiRequest } from "./http-client";

export type ClientTitre = "M" | "Mme";

export type Client = {
  id: string;
  Titre: ClientTitre;
  email: string;
  username?: string | null;
  firstName: string;
  lastName: string;
  phoneNumber?: string | null;
  company?: string | null;
  numberIdFiscale?: string | null;
  dateOfBirth?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type PaginatedResponse<T> = {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
};

export type CreateClientPayload = {
  Titre?: ClientTitre;
  email: string;
  username?: string | null;
  firstName: string;
  lastName: string;
  phoneNumber?: string | null;
  company?: string | null;
  numberIdFiscale?: string | null;
  password: string;
  dateOfBirth?: string | null;
};

export type UpdateClientPayload = Partial<CreateClientPayload>;

export type ClientLoginPayload = {
  email: string;
  password: string;
};

export type ClientAuthUser = Partial<Client> &
  Pick<Client, "id" | "email"> & {
    firstName?: string | null;
    lastName?: string | null;
    role?: string;
  };

export type ClientAuthResponse = {
  access_token?: string;
  token?: string;
  client?: ClientAuthUser;
  user?: ClientAuthUser;
};

function buildClientsQuery(params?: {
  page?: number;
  limit?: number;
  search?: string;
}) {
  const query = new URLSearchParams();
  if (params?.page) {
    query.set("page", String(params.page));
  }
  if (params?.limit) {
    query.set("limit", String(params.limit));
  }
  if (params?.search?.trim()) {
    query.set("search", params.search.trim());
  }

  const qs = query.toString();
  return `/clients${qs ? `?${qs}` : ""}`;
}

export async function getClients(params?: {
  page?: number;
  limit?: number;
  search?: string;
}): Promise<PaginatedResponse<Client>> {
  return apiRequest<PaginatedResponse<Client>>({
    path: buildClientsQuery(params),
    method: "GET",
  });
}

export async function getClientById(id: string): Promise<Client> {
  return apiRequest<Client>({
    path: `/clients/${id}`,
    method: "GET",
  });
}

export async function createClient(payload: CreateClientPayload): Promise<Client> {
  return apiRequest<Client>({
    path: "/clients",
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateClient(
  id: string,
  payload: UpdateClientPayload,
): Promise<Client> {
  return apiRequest<Client>({
    path: `/clients/${id}`,
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteClient(id: string): Promise<void> {
  await apiRequest<void>({
    path: `/clients/${id}`,
    method: "DELETE",
  });
}

export async function signupClient(
  payload: CreateClientPayload,
): Promise<ClientAuthResponse> {
  return apiRequest<ClientAuthResponse>({
    path: "/auth/signup",
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function loginClient(
  payload: ClientLoginPayload,
): Promise<ClientAuthResponse> {
  return apiRequest<ClientAuthResponse>({
    path: "/auth/login",
    method: "POST",
    body: JSON.stringify(payload),
  });
}
