"use client";

import { useQuery } from "@tanstack/react-query";
import {
  categoryBreadcrumbQueryKey,
  categoryFiltersQueryKey,
  categoryProductsQueryKey,
} from "@/lib/category-catalog-query-keys";
import {
  fetchDescendantCategorySlugsById,
  fetchCategoryBreadcrumb,
  fetchCategoryFilters,
  fetchCategoryProducts,
  type CategoryNode,
  type CategoryFiltersResponse,
  type CategoryProductsParams,
  type CategoryProductsResponse,
} from "@/lib/category-catalog-api";

export { categoryFiltersQueryKey, categoryProductsQueryKey };

export function useCategoryBreadcrumb(slug: string | null) {
  return useQuery({
    queryKey: categoryBreadcrumbQueryKey(slug ?? ""),
    queryFn: () => fetchCategoryBreadcrumb(slug!),
    enabled: !!slug?.trim(),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

export function useExpandedCategoryFilterSlugs(params: {
  selectedCategorySlugs: string[];
  subcategories: Array<{ id: string; slug: string }>;
  enabled?: boolean;
}) {
  const key = params.selectedCategorySlugs.slice().sort().join(",");
  return useQuery({
    queryKey: ["category-filter-expanded", key] as const,
    enabled: (params.enabled ?? true) && params.selectedCategorySlugs.length > 0,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    queryFn: async () => {
      const slugToId = new Map(params.subcategories.map((c) => [c.slug, c.id]));
      const expanded = new Set<string>();

      for (const slug of params.selectedCategorySlugs) {
        const id = slugToId.get(slug);
        if (!id) {
          expanded.add(slug);
          continue;
        }
        const descendants = await fetchDescendantCategorySlugsById(id);
        if (descendants.length === 0) expanded.add(slug);
        else descendants.forEach((s) => expanded.add(s));
      }

      return Array.from(expanded);
    },
  });
}

export function useCategoryFilters(slug: string | null) {
  return useQuery({
    queryKey: categoryFiltersQueryKey(slug ?? ""),
    queryFn: () => fetchCategoryFilters(slug!),
    enabled: !!slug?.trim(),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

export function useCategoryProducts(
  params: CategoryProductsParams,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: categoryProductsQueryKey(params),
    queryFn: () => fetchCategoryProducts(params),
    enabled: (options?.enabled ?? true) && !!params.slug?.trim(),
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

export type { CategoryFiltersResponse, CategoryProductsParams, CategoryProductsResponse };

export type { CategoryNode };

