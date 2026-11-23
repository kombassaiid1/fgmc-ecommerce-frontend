import type { MetadataRoute } from "next";

import { getBackendBaseUrl } from "@/lib/backend-url";
import { getSiteOrigin } from "@/lib/site-origin";
import { getSiteSeo } from "@/lib/site-seo";
import { storefrontPath } from "@/lib/storefront-path";

// The list changes when products are added or removed: rebuild it at most once an hour.
export const revalidate = 3600;

const PAGE_SIZE = 100; // the products endpoint refuses more
const MAX_PRODUCT_PAGES = 200; // 20 000 products: far below the 50 000 URLs a sitemap may hold

async function getJson<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${getBackendBaseUrl()}${path}`, { next: { revalidate: 3600 } });
    return response.ok ? ((await response.json()) as T) : null;
  } catch {
    return null;
  }
}

const asDate = (value: unknown) => {
  const date = typeof value === "string" ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : undefined;
};

type ProductRow = {
  slug: string;
  updatedAt?: string;
  mainCategoryId?: string | null;
  categories?: Array<{ categoryId?: string; category?: { id: string; slug: string } | null }>;
};

async function allProducts(): Promise<ProductRow[]> {
  const rows: ProductRow[] = [];
  for (let page = 1; page <= MAX_PRODUCT_PAGES; page += 1) {
    const result = await getJson<{ data: ProductRow[]; meta?: { hasNextPage?: boolean } }>(
      `/products?status=PUBLIC&limit=${PAGE_SIZE}&page=${page}`,
    );
    if (!result?.data) break;
    rows.push(...result.data);
    if (!result.meta?.hasNextPage) break;
  }
  return rows;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [origin, seo] = await Promise.all([getSiteOrigin(), getSiteSeo()]);
  if (!origin || !seo.indexable) return [];

  const [categories, brands, pages, products] = await Promise.all([
    getJson<Array<{ slug: string; updatedAt?: string }>>("/categories"),
    getJson<{ data: Array<{ slug: string; updatedAt?: string }> }>("/brands?limit=100"),
    getJson<{ pages: Array<{ slug: string }> }>("/pages"),
    allProducts(),
  ]);

  const entries: MetadataRoute.Sitemap = [
    { url: `${origin}${storefrontPath()}`, changeFrequency: "daily", priority: 1 },
    { url: `${origin}${storefrontPath("/categorie-produit")}`, changeFrequency: "daily", priority: 0.9 },
  ];

  for (const category of categories ?? []) {
    if (!category.slug || category.slug === "categorie-produit") continue;
    entries.push({
      url: `${origin}${storefrontPath(`/${category.slug}`)}`,
      lastModified: asDate(category.updatedAt),
      changeFrequency: "weekly",
      priority: 0.8,
    });
  }

  for (const brand of brands?.data ?? []) {
    if (!brand.slug) continue;
    entries.push({
      url: `${origin}${storefrontPath(`/b/${brand.slug}`)}`,
      lastModified: asDate(brand.updatedAt),
      changeFrequency: "weekly",
      priority: 0.6,
    });
  }

  // Pages built in the page builder; the home page is already « / ».
  for (const page of pages?.pages ?? []) {
    if (!page.slug || page.slug === "home") continue;
    entries.push({ url: `${origin}${storefrontPath(`/${page.slug}`)}`, changeFrequency: "monthly", priority: 0.5 });
  }

  for (const product of products) {
    if (!product.slug) continue;
    const category =
      product.categories?.find((item) => item.categoryId === product.mainCategoryId || item.category?.id === product.mainCategoryId)
        ?.category ?? product.categories?.[0]?.category;
    entries.push({
      // The same address the product page itself declares as canonical.
      url: `${origin}${storefrontPath(category?.slug ? `/${category.slug}/${product.slug}.html` : `/${product.slug}.html`)}`,
      lastModified: asDate(product.updatedAt),
      changeFrequency: "weekly",
      priority: 0.7,
    });
  }

  return entries;
}
