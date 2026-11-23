import type { Metadata } from "next";
import { getSiteSeo } from "@/lib/site-seo";
import { redirect } from "next/navigation";

import { fetchProductBySlugWithDebug } from "@/lib/product-details-api";
import { CatalogSidePanels } from "@/components/catalog/catalog-side-panels";
import { ProductDetailClient } from "@/components/product-detail/product-detail-client";
import { PageNotFound } from "@/components/shared/page-not-found";

type Props = {
  params: Promise<{ slug: string; productSlug: string }>;
};

function normalizeProductSlug(value: string): string {
  const v = (value ?? "").trim();
  return v.toLowerCase().endsWith(".html") ? v.slice(0, -5) : v;
}

function parsePrice(value: string): number {
  const n = parseFloat(
    String(value)
      .replace(/[^0-9.,-]/g, "")
      .replace(",", "."),
  );
  return Number.isFinite(n) ? n : 0;
}

function rateToFraction(rate: number | null | undefined): number {
  if (rate == null || !Number.isFinite(rate)) return 0;
  return rate > 1 ? rate / 100 : rate;
}

function formatEur(value: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { productSlug } = await params;
  const normalized = normalizeProductSlug(productSlug);
  try {
    const { product } = await fetchProductBySlugWithDebug(normalized);
    const seo = await getSiteSeo();
    const description = product?.shortDescription?.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 160) || seo.metaDescription || undefined;
    return {
      title: product?.title ?? normalized,
      description,
      openGraph: {
        type: "website",
        siteName: seo.siteName,
        title: `${product?.title ?? normalized} | ${seo.siteName}`,
        description,
      },
    };
  } catch {
    return { title: normalized };
  }
}

export default async function ProductDetailsPage({ params }: Props) {
  const { slug, productSlug } = await params;
  const normalized = normalizeProductSlug(productSlug);

  const { product, debug } = await fetchProductBySlugWithDebug(normalized);

  if (!product) {
    // Not a hard 404 (the API can blip during reloads), but a friendly page: the technical details stay in the server log.
    console.warn(`Product page: no product for "${normalized}" (fetch ${debug.status} ${debug.url})`);
    return <PageNotFound title="Ce produit n’est plus disponible" message="Il a peut-être été retiré de la boutique ou son adresse a changé. Cherchez-le par son nom ou sa référence." />;
  }

  const mainCategory = product.mainCategoryId
    ? product.categories?.find((item) =>
        item.categoryId === product.mainCategoryId || item.category?.id === product.mainCategoryId,
      )?.category
    : null;
  if (mainCategory?.slug && slug !== mainCategory.slug) {
    redirect(`/${mainCategory.slug}/${product.slug}.html`);
  }

  return <CatalogSidePanels><ProductDetailClient categorySlug={slug} product={product} /></CatalogSidePanels>;
}
