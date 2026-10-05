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
  specificPrices?: Array<{
    currency?: string; country?: string; group?: string; customer?: string;
    fromDate?: string; toDate?: string; fromQuantity?: number; leaveInitialPrice?: boolean;
    fixedPrice?: string; discount?: string; discountType?: string; taxIncluded?: boolean;
  }>;
  reviewCount?: number;
  reviewRating?: number;
  sparePartIds?: string[];
  mainCategoryId?: string | null;
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

export type ProductReviewsResponse = {
  reviews: Array<{
    id: string;
    review: string;
    rating: number;
    name: string;
    createdAt: string;
  }>;
  total: number;
  avgRating: number;
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
};

export async function fetchProductReviews(
  productId: string,
): Promise<ProductReviewsResponse> {
  const base = getBaseUrl();
  const res = await fetch(`${base}/reviews/product/${encodeURIComponent(productId)}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Unable to load product reviews (${res.status})`);
  return (await res.json()) as ProductReviewsResponse;
}

export async function canClientReviewProduct(
  productId: string,
  token: string,
): Promise<{ purchased: boolean }> {
  const base = getBaseUrl();
  const res = await fetch(
    `${base}/reviews/product/${encodeURIComponent(productId)}/can-review`,
    { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
  );
  if (!res.ok) throw new Error(`Unable to check review eligibility (${res.status})`);
  return (await res.json()) as { purchased: boolean };
}

export async function submitProductReview(
  productId: string,
  token: string,
  payload: { review: string; rating: number; name: string; email: string },
): Promise<void> {
  const base = getBaseUrl();
  const res = await fetch(`${base}/reviews/product/${encodeURIComponent(productId)}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null) as { message?: string | string[] } | null;
    const message = Array.isArray(data?.message) ? data.message.join(", ") : data?.message;
    throw new Error(message || `Unable to submit product review (${res.status})`);
  }
}

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

