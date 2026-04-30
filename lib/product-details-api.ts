import { getBaseUrl } from "@/lib/api";

export type ProductDetailsResponse = {
  id: string;
  slug: string;
  title: string;
  description: string;
  shortDescription: string;
  images: string[];
  price: string;
  sku?: string;
  reference?: string | null;
  /** Stock quantity as string in API payload. */
  qty?: string | null;
  stockStatus?: string;
  discount?: string;
  discountType?: string;
  taxRelation?: { rate: number; name?: string } | null;
  brand?: {
    id: string;
    title: string;
    slug: string;
    image?: string | null;
  } | null;
  categories?: Array<{
    categoryId?: string;
    category?: { id: string; title: string; slug: string } | null;
  }>;
  attributes?: Array<{
    attribute?: { id: string; name: string; slug: string } | null;
    term?: { id: string; name: string; slug: string } | null;
  }>;
  combinaisons?: Array<{
    id: string;
    isActive?: boolean;
    isDefault?: boolean;
    price?: string | null;
    qty?: string | null;
    stockStatus?: string | null;
    sku?: string | null;
    image?: string | null;
    options?: unknown;
  }>;
  /** Backward compatibility for old API responses. */
  variants?: Array<{
    id: string;
    isActive?: boolean;
    price?: string | null;
    qty?: string | null;
    stockStatus?: string | null;
    sku?: string | null;
    image?: string | null;
    options?: unknown;
  }>;
};

export type ProductFetchDebug = {
  url: string;
  status: number;
  ok: boolean;
  errorText?: string;
};

export async function fetchProductBySlug(
  slug: string,
): Promise<ProductDetailsResponse | null> {
  const base = getBaseUrl();
  const url = `${base}/products/by-slug/${encodeURIComponent(slug)}`;
  const res = await fetch(url, { cache: "no-store" });

  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `HTTP ${res.status}`);
  }

  return (await res.json()) as ProductDetailsResponse;
}

export async function fetchProductBySlugWithDebug(slug: string): Promise<{
  product: ProductDetailsResponse | null;
  debug: ProductFetchDebug;
}> {
  const base = getBaseUrl();
  const url = `${base}/products/by-slug/${encodeURIComponent(slug)}`;
  const res = await fetch(url, { cache: "no-store" });
  if (res.status === 404) {
    return { product: null, debug: { url, status: res.status, ok: false } };
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return {
      product: null,
      debug: { url, status: res.status, ok: false, errorText: text.slice(0, 200) },
    };
  }
  const product = (await res.json()) as ProductDetailsResponse;
  return { product, debug: { url, status: res.status, ok: true } };
}

