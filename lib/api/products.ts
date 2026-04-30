import { apiRequest } from "./http-client";

export type ProductListItem = {
  id: string;
  title: string;
  slug: string;
  images: string[];
  price: string;
  sku: string;
  qty: string;
  stockStatus: string;
  status: "DRAFT" | "PUBLIC";
  brandId: string;
  brand?: {
    id: string;
    title: string;
    slug: string;
    image: string;
  } | null;
  createdAt?: string;
  updatedAt?: string;
};

export type ProductDetails = ProductListItem & {
  description: string;
  shortDescription: string;
  discount: string;
  discountType: string;
  tag: string;
  allowBackorders?: string | null;
  lowStockThreshold?: string | null;
  reference?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  metaKeywords?: string | null;
  taxId?: string | null;
  categories?: Array<{
    categoryId?: string;
    category?: {
      id: string;
      title: string;
      slug: string;
    } | null;
  }>;
  attributes?: Array<{
    attributeId: string;
    termId: string;
  }>;
  combinaisons?: ProductVariantPayload[];
};

export type PaginatedProductsResponse = {
  data: ProductListItem[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
};

export type ProductAttributeTermPayload = {
  attributeId: string;
  termId: string;
};

export type ProductVariantOptionPayload = {
  attributeId: string;
  attributeName: string;
  termId: string;
  termName: string;
};

export type ProductVariantPayload = {
  id?: string;
  sku?: string;
  price?: string;
  qty?: string;
  stockStatus?: string;
  image?: string;
  isActive?: boolean;
  isDefault?: boolean;
  options: ProductVariantOptionPayload[];
};

export type CreateProductPayload = {
  title: string;
  slug: string;
  description: string;
  shortDescription: string;
  images: string[];
  price: string;
  tax?: string;
  taxId?: string;
  buyPriceHT?: string;
  buyPriceTTC?: string;
  sellPriceHT?: string;
  benefit?: string;
  benefitType?: string;
  discount: string;
  discountType: string;
  tag: string;
  sku: string;
  qty: string;
  stockStatus: string;
  allowBackorders: string;
  lowStockThreshold: string;
  brandId: string;
  status?: "DRAFT" | "PUBLIC";
  reference?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  metaKeywords?: string | null;
  reviewRating?: number | null;
  reviewCount?: number | null;
  categoryIds?: string[];
  attributeTerms?: ProductAttributeTermPayload[];
  combinaisons?: ProductVariantPayload[];
};

export async function createProduct(payload: CreateProductPayload) {
  return apiRequest({
    path: "/products",
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateProduct(id: string, payload: Partial<CreateProductPayload>) {
  return apiRequest({
    path: `/products/${id}`,
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function getProducts(params?: {
  page?: number;
  limit?: number;
  search?: string;
  status?: "DRAFT" | "PUBLIC";
}): Promise<PaginatedProductsResponse> {
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
  if (params?.status) {
    query.set("status", params.status);
  }

  const qs = query.toString();
  return apiRequest<PaginatedProductsResponse>({
    path: `/products${qs ? `?${qs}` : ""}`,
    method: "GET",
  });
}

export async function getProductById(id: string): Promise<ProductDetails> {
  return apiRequest<ProductDetails>({
    path: `/products/${id}`,
    method: "GET",
  });
}
