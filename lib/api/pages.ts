import { apiRequest } from "./http-client";

export type PageListItem = {
  id: string;
  slug: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PageDataResponse = {
  data: Record<string, unknown>;
  updatedAt: string | null;
};

export async function listPages() {
  return apiRequest<{ pages: PageListItem[] }>({
    path: "/pages",
    method: "GET",
  });
}

export async function getPageBySlug(slug: string) {
  const query = new URLSearchParams({ slug });
  return apiRequest<PageDataResponse>({
    path: `/pages?${query.toString()}`,
    method: "GET",
  });
}

export async function upsertPage(payload: {
  slug: string;
  title?: string;
  data: Record<string, unknown>;
}) {
  return apiRequest<{ ok: true; name: string; updatedAt: string }>({
    path: "/pages",
    method: "POST",
    body: JSON.stringify(payload),
  });
}
