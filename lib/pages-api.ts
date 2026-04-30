import { apiFetch } from "@/lib/api";

export type PageListItem = {
  id: string;
  slug: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PagesListResponse = { pages: PageListItem[] };

export type PageDataResponse = {
  data: { content: unknown[]; root: { props: Record<string, unknown> } };
  updatedAt: string | null;
};

export type UpsertPageBody = {
  slug: string;
  title?: string;
  data: Record<string, unknown>;
};

export async function fetchPagesList(): Promise<PageListItem[]> {
  const res = await apiFetch<PagesListResponse>("/pages");
  return res.pages ?? [];
}

export async function fetchPageBySlug(slug: string): Promise<PageDataResponse> {
  return apiFetch<PageDataResponse>(`/pages?slug=${encodeURIComponent(slug)}`, {
    cache: "no-store",
  });
}

export async function savePage(body: UpsertPageBody): Promise<{
  ok: boolean;
  name: string;
  updatedAt: string;
}> {
  return apiFetch("/pages", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function deletePage(slug: string): Promise<{ ok: boolean }> {
  return apiFetch(`/pages?slug=${encodeURIComponent(slug)}`, {
    method: "DELETE",
  });
}

