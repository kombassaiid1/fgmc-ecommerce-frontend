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

export type CategoryFiltersResponse = {
  priceRange: {
    min: number;
    max: number;
  };
  subcategories: Array<{
    id: string;
    title: string;
    slug: string;
  }>;
  brands?: Array<{
    id: string;
    title: string;
    slug: string;
    image?: string | null;
  }>;
  attributes: Array<{
    id: string;
    name: string;
    slug: string;
    terms: Array<{
      id: string;
      name: string;
      slug: string;
    }>;
  }>;
  totalProducts: number;
  categoryTitle: string;
};

export type CategoryProductsResponse = {
  products: Array<{
    id: string;
    title: string;
    slug: string;
    images: string[];
    price: string;
    stockStatus: string;
    brand?: {
      id: string;
      title: string;
      slug: string;
      image?: string | null;
    } | null;
    categories?: Array<{
      category?: {
        id: string;
        title: string;
        slug: string;
      } | null;
    }>;
  }>;
  totalCount: number;
  currentPage: number;
  totalPages: number;
  title: string;
  description: string | null;
  image: string | null;
};

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

export async function getCategoryFilters(slug: string): Promise<CategoryFiltersResponse> {
  const query = new URLSearchParams();
  query.set("slug", slug);
  return apiRequest<CategoryFiltersResponse>({
    path: `/categories/filters?${query.toString()}`,
    method: "GET",
  });
}

export async function getCategoryProducts(params: {
  slug: string;
  page?: number;
  limit?: number;
  filterCategories?: string;
  brands?: string;
  minPrice?: number;
  maxPrice?: number;
  attributes?: string;
  search?: string;
  sortBy?: string;
}): Promise<CategoryProductsResponse> {
  const query = new URLSearchParams();
  query.set("slug", params.slug);
  if (params.page) {
    query.set("page", String(params.page));
  }
  if (params.limit) {
    query.set("limit", String(params.limit));
  }
  if (params.filterCategories?.trim()) {
    query.set("filterCategories", params.filterCategories.trim());
  }
  if (params.brands?.trim()) {
    query.set("brands", params.brands.trim());
  }
  if (typeof params.minPrice === "number") {
    query.set("minPrice", String(params.minPrice));
  }
  if (typeof params.maxPrice === "number") {
    query.set("maxPrice", String(params.maxPrice));
  }
  if (params.attributes?.trim()) {
    query.set("attributes", params.attributes.trim());
  }
  if (params.search?.trim()) {
    query.set("search", params.search.trim());
  }
  if (params.sortBy?.trim()) {
    query.set("sortBy", params.sortBy.trim());
  }

  return apiRequest<CategoryProductsResponse>({
    path: `/categories/products?${query.toString()}`,
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

export function deleteSelectedCategories(ids: string[]): Promise<{ count: number }> {
  if (!Array.isArray(ids) || ids.length === 0) {
    return Promise.reject(new Error("Sélectionnez au moins une catégorie."));
  }
  return requestCategoryDeletion(ids);
}

async function requestCategoryDeletion(ids: string[]): Promise<{ count: number }> {
  const response = await fetch("/api/admin/categories", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
    signal: AbortSignal.timeout(30000),
  });
  const payload = (await response.json().catch(() => null)) as {
    count?: number;
    message?: string | string[];
  } | null;
  if (!response.ok) {
    throw new Error(
      Array.isArray(payload?.message)
        ? payload.message.join(", ")
        : payload?.message ?? "Impossible de supprimer les catégories.",
    );
  }
  if (typeof payload?.count !== "number") {
    throw new Error("Réponse du serveur invalide. Actualisez la liste des catégories.");
  }
  return { count: payload.count };
}
