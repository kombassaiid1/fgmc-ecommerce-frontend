import { apiFetch } from "@/lib/api";
import type {
  CategoryFilterAttribute,
  CategoryFilterBrand,
  CategoryFilterSubcategory,
  CategoryProductItem,
  CategoryProductsResponse,
} from "@/lib/category-catalog-api";

export type BrandCatalogFiltersResponse = {
  priceRange: { min: number; max: number };
  brands: CategoryFilterBrand[];
  categories: CategoryFilterSubcategory[];
  attributes: CategoryFilterAttribute[];
  totalProducts: number;
};

export type BrandCatalogProductsParams = {
  brand: string;
  page?: number;
  limit?: number;
  categories?: string[];
  minPrice?: number;
  maxPrice?: number;
  attributeFilters?: Record<string, string[]>;
  search?: string;
  sortBy?: string;
};

export type BrandCatalogProductsResponse = Omit<
  CategoryProductsResponse,
  "title" | "description" | "image"
> & {
  products: CategoryProductItem[];
};

export function getBrandCatalogFiltersUrl(brand: string) {
  const query = new URLSearchParams();
  query.set("brand", brand);
  return `/products/catalog/filters?${query.toString()}`;
}

export function getBrandCatalogProductsUrl(params: BrandCatalogProductsParams) {
  const query = new URLSearchParams();
  query.set("brand", params.brand);
  if (params.page != null) query.set("page", String(params.page));
  if (params.limit != null) query.set("limit", String(params.limit));
  if (params.categories?.length) query.set("category", params.categories.join(","));
  if (params.minPrice != null) query.set("minPrice", String(params.minPrice));
  if (params.maxPrice != null) query.set("maxPrice", String(params.maxPrice));
  if (params.attributeFilters && Object.keys(params.attributeFilters).length > 0) {
    query.set("attributes", JSON.stringify(params.attributeFilters));
  }
  if (params.search?.trim()) query.set("search", params.search.trim());
  if (params.sortBy?.trim()) query.set("sortBy", params.sortBy.trim());
  return `/products/catalog?${query.toString()}`;
}

export async function fetchBrandCatalogFilters(
  brand: string,
): Promise<BrandCatalogFiltersResponse> {
  return apiFetch<BrandCatalogFiltersResponse>(getBrandCatalogFiltersUrl(brand));
}

export async function fetchBrandCatalogProducts(
  params: BrandCatalogProductsParams,
): Promise<BrandCatalogProductsResponse> {
  return apiFetch<BrandCatalogProductsResponse>(getBrandCatalogProductsUrl(params));
}
