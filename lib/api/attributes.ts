import { apiRequest } from "./http-client";

export type AttributeTerm = {
  id: string;
  name: string;
  slug: string;
  description: string;
  attributeId: string;
  createdAt?: string;
  updatedAt?: string;
};

export type Attribute = {
  id: string;
  name: string;
  slug: string;
  description: string;
  terms?: AttributeTerm[];
  _count?: {
    terms?: number;
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

export type CreateAttributePayload = {
  name: string;
  slug: string;
  description: string;
};

export type UpdateAttributePayload = Partial<CreateAttributePayload>;

export type CreateTermPayload = {
  name: string;
  slug: string;
  description: string;
  attributeId: string;
};

export type UpdateTermPayload = Partial<CreateTermPayload>;

export async function getAttributes(params?: {
  page?: number;
  limit?: number;
  search?: string;
  includeTerms?: boolean;
}): Promise<PaginatedResponse<Attribute>> {
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
  if (params?.includeTerms) {
    query.set("include", "terms");
  }

  const qs = query.toString();
  return apiRequest<PaginatedResponse<Attribute>>({
    path: `/attributes${qs ? `?${qs}` : ""}`,
    method: "GET",
  });
}

export async function getAttributeById(id: string): Promise<Attribute> {
  return apiRequest<Attribute>({
    path: `/attributes/${id}`,
    method: "GET",
  });
}

export async function createAttribute(
  payload: CreateAttributePayload
): Promise<Attribute> {
  return apiRequest<Attribute>({
    path: "/attributes",
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateAttribute(
  id: string,
  payload: UpdateAttributePayload
): Promise<Attribute> {
  return apiRequest<Attribute>({
    path: `/attributes/${id}`,
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteAttribute(id: string): Promise<void> {
  await apiRequest<void>({
    path: `/attributes/${id}`,
    method: "DELETE",
  });
}

export async function getTerms(): Promise<AttributeTerm[]> {
  return apiRequest<AttributeTerm[]>({
    path: "/terms",
    method: "GET",
  });
}

export async function getTermById(id: string): Promise<AttributeTerm> {
  return apiRequest<AttributeTerm>({
    path: `/terms/${id}`,
    method: "GET",
  });
}

export async function createTerm(payload: CreateTermPayload): Promise<AttributeTerm> {
  return apiRequest<AttributeTerm>({
    path: "/terms",
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateTerm(
  id: string,
  payload: UpdateTermPayload
): Promise<AttributeTerm> {
  return apiRequest<AttributeTerm>({
    path: `/terms/${id}`,
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteTerm(id: string): Promise<void> {
  await apiRequest<void>({
    path: `/terms/${id}`,
    method: "DELETE",
  });
}
