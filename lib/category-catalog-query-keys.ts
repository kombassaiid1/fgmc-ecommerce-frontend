import type { CategoryProductsParams } from "@/lib/category-catalog-api";

const CATEGORY_FILTERS_KEY = "category-filters" as const;
const CATEGORY_PRODUCTS_KEY = "category-products" as const;
const CATEGORY_BREADCRUMB_KEY = "category-breadcrumb" as const;

export function categoryFiltersQueryKey(slug: string) {
  return [CATEGORY_FILTERS_KEY, slug] as const;
}

export function categoryProductsQueryKey(params: CategoryProductsParams) {
  return [
    CATEGORY_PRODUCTS_KEY,
    params.slug,
    params.page ?? 1,
    params.limit ?? 12,
    params.sortBy ?? "newest",
    params.search ?? "",
    params.filterCategories ?? [],
    params.brands ?? [],
    params.minPrice ?? null,
    params.maxPrice ?? null,
    params.attributeFilters
      ? Object.entries(params.attributeFilters).sort(([a], [b]) =>
          a.localeCompare(b),
        )
      : null,
  ] as const;
}

export function categoryBreadcrumbQueryKey(slug: string) {
  return [CATEGORY_BREADCRUMB_KEY, slug] as const;
}

