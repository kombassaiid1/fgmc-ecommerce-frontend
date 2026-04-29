import { apiRequest } from "./http-client";

export type Tax = {
  id: string;
  name: string;
  rate: number;
  isDefault: boolean;
  _count?: {
    products?: number;
  };
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

export type CreateTaxPayload = {
  name: string;
  rate: number;
  isDefault?: boolean;
};

export type UpdateTaxPayload = Partial<CreateTaxPayload>;

export async function getTaxes(params?: {
  page?: number;
  limit?: number;
  search?: string;
}): Promise<PaginatedResponse<Tax>> {
  const query = new URLSearchParams();
  if (params?.page) {
    query.set("page", String(params.page));
  }
  if (params?.limit) {
    query.set("limit", String(params.limit));
  }
  if (params?.search) {
    query.set("search", params.search);
  }

  const qs = query.toString();
  return apiRequest<PaginatedResponse<Tax>>({
    path: `/taxes${qs ? `?${qs}` : ""}`,
    method: "GET",
  });
}

export async function createTax(payload: CreateTaxPayload): Promise<Tax> {
  return apiRequest<Tax>({
    path: "/taxes",
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateTax(id: string, payload: UpdateTaxPayload): Promise<Tax> {
  return apiRequest<Tax>({
    path: `/taxes/${id}`,
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteTax(id: string): Promise<void> {
  await apiRequest<void>({
    path: `/taxes/${id}`,
    method: "DELETE",
  });
}
