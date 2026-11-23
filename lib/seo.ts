import type { ProductDetailsResponse } from "@/lib/product-details-api";
import { resolveSpecificPrice } from "@/lib/specific-pricing";
import { storefrontPath } from "@/lib/storefront-path";

/** Plain text of an HTML snippet, on one line. */
export function stripHtml(html: string | null | undefined): string {
  return (html ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** Cuts a text to `max` characters on a word boundary, with an ellipsis when it was cut. */
export function truncateText(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/** The category a product lives under in its address: its main category, else the first one. */
export function productCategory(product: ProductDetailsResponse) {
  return (
    product.categories?.find(
      (item) => item.categoryId === product.mainCategoryId || item.category?.id === product.mainCategoryId,
    )?.category ??
    product.categories?.[0]?.category ??
    null
  );
}

/** The one public address of a product: /fr/category/product.html (or /fr/product.html without a category). */
export function productPath(product: Pick<ProductDetailsResponse, "slug">, categorySlug: string | null | undefined): string {
  return storefrontPath(categorySlug ? `/${categorySlug}/${product.slug}.html` : `/${product.slug}.html`);
}

/** JSON for a `<script type="application/ld+json">`: `<` is escaped so the data can never close the tag. */
export function jsonLdString(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

function parseAmount(value: string | null | undefined): number {
  const n = parseFloat(String(value ?? "").replace(/[^0-9.,-]/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function rateToFraction(rate: number | null | undefined): number {
  if (rate == null || !Number.isFinite(rate)) return 0;
  return rate > 1 ? rate / 100 : rate;
}

function availability(product: ProductDetailsResponse): string {
  const qty = product.qty != null ? parseInt(String(product.qty).replace(/[^0-9-]/g, ""), 10) : NaN;
  const status = String(product.stockStatus ?? "").toLowerCase();
  const inStock = Number.isFinite(qty) ? qty > 0 : status !== "outofstock";
  return inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock";
}

/** schema.org Product, with the price a visitor pays (VAT included, current special price applied). */
export function buildProductJsonLd(args: {
  product: ProductDetailsResponse;
  url: string;
  images: string[];
  description: string;
  siteName: string;
}) {
  const { product, url, images, description, siteName } = args;
  const vat = rateToFraction(product.taxRelation?.rate);
  const baseHt = parseAmount(product.price);
  let priceTtc = baseHt * (1 + vat);
  try {
    priceTtc = resolveSpecificPrice(product.specificPrices, baseHt, vat, 1).saleTtc;
  } catch {
    // keep the base price
  }

  const hasReviews = (product.reviewCount ?? 0) > 0 && Number(product.reviewRating) > 0;
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description,
    ...(images.length ? { image: images } : {}),
    ...(product.sku ? { sku: product.sku } : {}),
    ...(product.reference ? { mpn: product.reference } : {}),
    ...(product.brand?.title ? { brand: { "@type": "Brand", name: product.brand.title } } : {}),
    url,
    offers: {
      "@type": "Offer",
      url,
      priceCurrency: "EUR",
      price: priceTtc.toFixed(2),
      availability: availability(product),
      itemCondition: "https://schema.org/NewCondition",
      seller: { "@type": "Organization", name: siteName },
    },
    ...(hasReviews
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: Number(product.reviewRating).toFixed(1),
            reviewCount: product.reviewCount,
          },
        }
      : {}),
  };
}

export function buildBreadcrumbJsonLd(items: Array<{ name: string; url: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}
