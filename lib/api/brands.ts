import { apiRequest } from "./http-client";

export type Brand = {
  id: string;
  title: string;
  slug: string;
  description: string;
  image: string;
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

export type CreateBrandPayload = {
  title: string;
  slug: string;
  description: string;
  image: string;
};

export type UpdateBrandPayload = Partial<CreateBrandPayload>;

export async function getBrands(params?: {
  page?: number;
  limit?: number;
  search?: string;
}): Promise<PaginatedResponse<Brand>> {
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
  return apiRequest<PaginatedResponse<Brand>>({
    path: `/brands${qs ? `?${qs}` : ""}`,
    method: "GET",
  });
}

export async function getBrandById(id: string): Promise<Brand> {
  return apiRequest<Brand>({
    path: `/brands/${id}`,
    method: "GET",
  });
}

export async function createBrand(payload: CreateBrandPayload): Promise<Brand> {
  return apiRequest<Brand>({
    path: "/brands",
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateBrand(
  id: string,
  payload: UpdateBrandPayload
): Promise<Brand> {
  return apiRequest<Brand>({
    path: `/brands/${id}`,
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteBrand(id: string): Promise<void> {
  await apiRequest<void>({
    path: `/brands/${id}`,
    method: "DELETE",
  });
}
