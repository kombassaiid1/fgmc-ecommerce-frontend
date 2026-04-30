"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  deletePage,
  fetchPageBySlug,
  fetchPagesList,
  savePage,
  type PageDataResponse,
  type PageListItem,
  type UpsertPageBody,
} from "@/lib/pages-api";

export const pageBySlugQueryKey = (slug: string) =>
  ["pages", "by-slug", slug] as const;
export const pagesListQueryKey = () => ["pages", "list"] as const;

export function usePageBySlug(
  slug: string,
  options?: { enabled?: boolean; initialData?: PageDataResponse },
) {
  return useQuery({
    queryKey: pageBySlugQueryKey(slug),
    queryFn: () => fetchPageBySlug(slug),
    enabled: (options?.enabled ?? true) && !!slug,
    initialData: options?.initialData,
    staleTime: 0,
    gcTime: 2 * 60 * 1000,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });
}

export function usePagesList() {
  return useQuery({
    queryKey: pagesListQueryKey(),
    queryFn: fetchPagesList,
    staleTime: 30 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

export function useSavePage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpsertPageBody) => savePage(body),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: pageBySlugQueryKey(variables.slug),
      });
      queryClient.invalidateQueries({ queryKey: pagesListQueryKey() });
    },
  });
}

export function useDeletePage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (slug: string) => deletePage(slug),
    onSuccess: (_, slug) => {
      queryClient.invalidateQueries({ queryKey: pageBySlugQueryKey(slug) });
      queryClient.invalidateQueries({ queryKey: pagesListQueryKey() });
    },
  });
}

export type { PageDataResponse, PageListItem };

