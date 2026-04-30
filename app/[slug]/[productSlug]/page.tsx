import type { Metadata } from "next";

import { fetchProductBySlugWithDebug } from "@/lib/product-details-api";
import { ProductDetailClient } from "@/components/product-detail/product-detail-client";

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
    return {
      title: product?.title ?? normalized,
      description: product?.shortDescription ?? undefined,
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
    // Keep a simple, non-404 fallback to avoid flaky API 404s during dev reloads.
    return (
      <main className="h-screen! min-h-[60vh]! bg-muted/30 px-4 py-16">
        <div className="mx-auto max-w-xl rounded-2xl border border-border/80 bg-white p-6 text-center shadow-sm">
          <p className="text-sm font-semibold text-destructive">
            Produit introuvable ou non disponible pour le moment.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Fetch: {debug.status} {debug.url}
          </p>
        </div>
      </main>
    );
  }

  return <ProductDetailClient categorySlug={slug} product={product} />;
}
