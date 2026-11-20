import type { Data } from "@puckeditor/core";

/** The pages of the shop, as the back office sees them. The front page has the slug "home". */
export const HOME_SLUG = "home";

export type PageSummary = { slug: string; title: string | null; published: boolean; updatedAt: string };

export type PageSettings = {
  slug: string;
  title: string;
  published: boolean;
  metaTitle: string | null;
  metaDescription: string | null;
  ogImage: string | null;
};

export type BuilderPage = PageSettings & { data: Data; updatedAt: string | null };

/** What can be saved on a page. Only the parts that are sent change. */
export type PageChanges = Partial<Pick<PageSettings, "title" | "published" | "metaTitle" | "metaDescription" | "ogImage">> & { data?: Data };

const BASE = "/frontend-api/admin/pages";

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE}${path}`, { cache: "no-store", ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(Array.isArray(body.message) ? body.message.join(" ") : body.message || "Action impossible.");
  return body as T;
}

export const listPages = () => call<{ pages: PageSummary[] }>("").then((result) => result.pages);
export const getPage = (slug: string) => call<BuilderPage>(`/${encodeURIComponent(slug)}`);
export const savePage = (slug: string, changes: PageChanges) => call<BuilderPage>(`/${encodeURIComponent(slug)}`, { method: "PUT", body: JSON.stringify(changes) });
export const createPage = (page: { title: string; slug?: string; copyFrom?: string }) => call<BuilderPage>("", { method: "POST", body: JSON.stringify(page) });
export const renamePage = (slug: string, newSlug: string) => call<BuilderPage>(`/${encodeURIComponent(slug)}/slug`, { method: "PATCH", body: JSON.stringify({ slug: newSlug }) });
export const deletePage = (slug: string) => call<{ ok: boolean }>(`/${encodeURIComponent(slug)}`, { method: "DELETE" });

export const pagePath = (slug: string) => (slug === HOME_SLUG ? "/" : `/${slug}`);

/** "À propos de nous" becomes "a-propos-de-nous". */
export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
