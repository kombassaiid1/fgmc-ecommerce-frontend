import { apiRequest } from "./http-client";

export type ClientTitre = "M" | "Mme" | "Autre";

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

/** The signed-in customer's own profile. Fails with 401 when the token is expired or no longer valid. */
export async function getClientProfile(token: string): Promise<ClientAuthUser> {
  return apiRequest<ClientAuthUser>({
    path: "/auth/me",
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
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

/** Password reset, step 1: a 6-digit code is e-mailed. The answer is the same whether or not the address has an account. */
export async function requestPasswordResetCode(email: string): Promise<{ message: string; resendAfterSeconds: number }> {
  return apiRequest({
    path: "/auth/client/forgot-password",
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

/** Step 2: the code is checked and swapped for a one-time token. */
export async function verifyPasswordResetCode(email: string, code: string): Promise<{ resetToken: string; expiresInSeconds: number }> {
  return apiRequest({
    path: "/auth/client/verify-reset-code",
    method: "POST",
    body: JSON.stringify({ email, code }),
  });
}

/** Step 3: the new password, with the token from step 2. */
export async function resetClientPassword(resetToken: string, newPassword: string): Promise<{ message: string }> {
  return apiRequest({
    path: "/auth/client/reset-password",
    method: "POST",
    body: JSON.stringify({ resetToken, newPassword }),
  });
}
