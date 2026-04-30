import { apiFetch } from "@/lib/api";

export interface CategoryPriceRange {
  min: number;
  max: number;
}

export interface CategoryFilterSubcategory {
  id: string;
  title: string;
  slug: string;
  image?: string | null;
}

export interface CategoryFilterTerm {
  id: string;
  name: string;
  slug: string;
}

export interface CategoryFilterAttribute {
  id: string;
  name: string;
  slug: string;
  terms: CategoryFilterTerm[];
}

export interface CategoryFiltersResponse {
  priceRange: CategoryPriceRange;
  subcategories: CategoryFilterSubcategory[];
  attributes: CategoryFilterAttribute[];
  totalProducts: number;
  categoryTitle: string;
}

export interface CategoryProductsParams {
  slug: string;
  page?: number;
  limit?: number;
  filterCategories?: string[];
  minPrice?: number;
  maxPrice?: number;
  attributeFilters?: Record<string, string[]>;
  search?: string;
  sortBy?: string;
}

export interface CategoryProductItem {
  id: string;
  title: string;
  slug: string;
  description: string;
  shortDescription: string;
  images: string[];
  price: string;
  taxRelation?: { rate: number } | null;
  discount: string;
  discountType: string;
  status: string;
  brand: {
    id: string;
    title: string;
    slug: string;
    image?: string | null;
  } | null;
  categories: unknown[];
  _count: { reviews: number };
  createdAt: string;
  updatedAt: string;
}

export interface CategoryProductsResponse {
  products: CategoryProductItem[];
  totalCount: number;
  currentPage: number;
  totalPages: number;
  title: string;
  description: string;
  image: string;
}

export interface CategoryNode {
  id: string;
  title: string;
  slug: string;
  parentCategoryId: string | null;
  parentCategory?: { id: string; title: string; slug: string } | null;
  subcategories?: Array<{ id: string; title: string; slug: string }> | null;
}

export function getCategoryFiltersUrl(slug: string): string {
  return `/categories/filters?slug=${encodeURIComponent(slug)}`;
}

export function getCategoryProductsUrl(params: CategoryProductsParams): string {
  const searchParams = new URLSearchParams();
  searchParams.set("slug", params.slug);
  if (params.page != null) searchParams.set("page", String(params.page));
  if (params.limit != null) searchParams.set("limit", String(params.limit));
  if (params.filterCategories?.length) {
    searchParams.set("filterCategories", params.filterCategories.join(","));
  }
  if (params.minPrice != null) searchParams.set("minPrice", String(params.minPrice));
  if (params.maxPrice != null) searchParams.set("maxPrice", String(params.maxPrice));
  if (params.attributeFilters && Object.keys(params.attributeFilters).length > 0) {
    searchParams.set("attributes", JSON.stringify(params.attributeFilters));
  }
  if (params.search?.trim()) searchParams.set("search", params.search.trim());
  if (params.sortBy?.trim()) searchParams.set("sortBy", params.sortBy.trim());
  const q = searchParams.toString();
  return `/categories/products?${q}`;
}

export function getCategoryBySlugUrl(slug: string): string {
  return `/categories?slug=${encodeURIComponent(slug)}`;
}

export function getCategoryByIdUrl(id: string): string {
  return `/categories/${encodeURIComponent(id)}`;
}

export async function fetchCategoryFilters(
  slug: string,
): Promise<CategoryFiltersResponse> {
  return apiFetch<CategoryFiltersResponse>(getCategoryFiltersUrl(slug));
}

export async function fetchCategoryProducts(
  params: CategoryProductsParams,
): Promise<CategoryProductsResponse> {
  return apiFetch<CategoryProductsResponse>(getCategoryProductsUrl(params));
}

export async function fetchCategoryBySlug(slug: string): Promise<CategoryNode | null> {
  const list = await apiFetch<unknown>(getCategoryBySlugUrl(slug));
  if (!Array.isArray(list) || list.length === 0) return null;
  const item = list[0];
  if (item == null || typeof item !== "object") return null;
  return item as CategoryNode;
}

export async function fetchCategoryById(id: string): Promise<CategoryNode | null> {
  const item = await apiFetch<unknown>(getCategoryByIdUrl(id));
  if (item == null || typeof item !== "object") return null;
  return item as CategoryNode;
}

export async function fetchDescendantCategorySlugsById(
  rootId: string,
): Promise<string[]> {
  const root = await fetchCategoryById(rootId);
  if (!root?.slug?.trim()) return [];

  const slugs = new Set<string>([root.slug.trim()]);
  const visited = new Set<string>([rootId]);

  let frontier: Array<{ id: string; slug: string }> = [{ id: rootId, slug: root.slug.trim() }];

  for (let depth = 0; depth < 10 && frontier.length > 0; depth++) {
    const next: Array<{ id: string; slug: string }> = [];

    for (const node of frontier) {
      const full = await fetchCategoryById(node.id);
      const children = full?.subcategories ?? [];
      if (!Array.isArray(children) || children.length === 0) continue;

      for (const child of children) {
        if (!child?.id || visited.has(child.id)) continue;
        visited.add(child.id);
        if (child.slug?.trim()) slugs.add(child.slug.trim());
        next.push({ id: child.id, slug: child.slug });
      }
    }

    frontier = next;
  }

  return Array.from(slugs);
}

export async function fetchCategoryBreadcrumb(slug: string): Promise<CategoryNode[]> {
  const start = await fetchCategoryBySlug(slug);
  if (!start) return [];

  const chain: CategoryNode[] = [start];
  const seen = new Set<string>([start.id]);

  let current: CategoryNode | null = start;
  for (let i = 0; i < 10; i++) {
    const parentId = current?.parentCategoryId;
    if (!parentId) break;
    if (seen.has(parentId)) break;
    seen.add(parentId);
    const parent = await fetchCategoryById(parentId);
    if (!parent) break;
    chain.unshift(parent);
    current = parent;
  }

  return chain;
}

