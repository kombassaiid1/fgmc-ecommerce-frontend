import { apiRequest } from "./http-client";

export type CategorySummary = {
  id: string;
  title: string;
  slug: string;
};

export type Category = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  image: string | null;
  parentCategoryId: string | null;
  parentCategory?: CategorySummary | null;
  _count?: {
    products?: number;
    subcategories?: number;
  };
  createdAt?: string;
  updatedAt?: string;
};

export type CreateCategoryPayload = {
  title: string;
  slug: string;
  description?: string | null;
  image?: string | null;
  parentCategoryId?: string | null;
};

export type UpdateCategoryPayload = Partial<CreateCategoryPayload>;

export async function getCategories(params?: {
  search?: string;
  slug?: string;
}): Promise<Category[]> {
  const query = new URLSearchParams();
  if (params?.search) {
    query.set("search", params.search);
  }
  if (params?.slug) {
    query.set("slug", params.slug);
  }

  const qs = query.toString();
  return apiRequest<Category[]>({
    path: `/categories${qs ? `?${qs}` : ""}`,
    method: "GET",
  });
}

export async function createCategory(
  payload: CreateCategoryPayload
): Promise<Category> {
  return apiRequest<Category>({
    path: "/categories",
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateCategory(
  id: string,
  payload: UpdateCategoryPayload
): Promise<Category> {
  return apiRequest<Category>({
    path: `/categories/${id}`,
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteCategory(id: string): Promise<void> {
  await apiRequest<void>({
    path: `/categories/${id}`,
    method: "DELETE",
  });
}
