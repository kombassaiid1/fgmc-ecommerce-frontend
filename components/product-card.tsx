"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Minus, Package, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { getImageUrl } from "@/lib/api";
import { cartItemKey, useCartStore } from "@/lib/stores/cart-store";
import { toast } from "sonner";
import { resolveSpecificPrice, type StorefrontSpecificPrice } from "@/lib/specific-pricing";

function parsePrice(value: string): number {
  const n = parseFloat(String(value).replace(/[^0-9.,-]/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function rateToFraction(rate: number | null | undefined): number {
  if (rate == null || !Number.isFinite(rate)) return 0;
  // Support either 20 (percent) or 0.2 (fraction).
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

export type ProductCardProduct = {
  id: string;
  slug: string;
  title: string;
  price: string;
  specificPrices?: StorefrontSpecificPrice[] | null;
  taxRelation?: { rate: number } | null;
  images?: string[];
  categories?: unknown[] | null;
  createdAt?: string;
};

export type ProductCardVariant = "grid" | "list" | "featured";

function buildProductHref(categorySlug: string | undefined, productSlug: string): string {
  const cat = (categorySlug ?? "").trim().replace(/^\/+|\/+$/g, "");
  const prod = String(productSlug ?? "").trim().replace(/^\/+|\/+$/g, "");
  if (!cat) return `/${prod}.html`;
  return `/${cat}/${prod}.html`;
}

function pickProductCategoryLabel(
  categories: unknown[] | null | undefined,
): string | null {
  if (!Array.isArray(categories) || categories.length === 0) return null;

  const first = categories[0];
  if (first == null || typeof first !== "object") return null;

  const firstRecord = first as Record<string, unknown>;
  const candidateRaw =
    (firstRecord["category"] as unknown) ?? (firstRecord as unknown);

  if (candidateRaw == null || typeof candidateRaw !== "object") return null;
  const candidate = candidateRaw as Record<string, unknown>;

  const title =
    typeof candidate["title"] === "string"
      ? (candidate["title"] as string)
      : typeof candidate["name"] === "string"
        ? (candidate["name"] as string)
        : null;

  if (!title?.trim()) return null;
  return title.trim();
}

function pickProductCategorySlug(
  categories: unknown[] | null | undefined,
): string | null {
  if (!Array.isArray(categories) || categories.length === 0) return null;

  for (const item of categories) {
    if (item == null || typeof item !== "object") continue;
    const itemRecord = item as Record<string, unknown>;
    const candidateRaw =
      (itemRecord["category"] as unknown) ?? (itemRecord as unknown);
    if (candidateRaw == null || typeof candidateRaw !== "object") continue;
    const candidate = candidateRaw as Record<string, unknown>;
    const slug =
      typeof candidate["slug"] === "string" ? (candidate["slug"] as string) : null;
    if (slug && slug.trim()) return slug.trim();
  }

  return null;
}

export function ProductCard({
  product,
  variant = "grid",
  categorySlug,
}: {
  product: ProductCardProduct;
  variant?: ProductCardVariant;
  categorySlug?: string;
}) {
  const key = useMemo(() => cartItemKey(product.id, null), [product.id]);
  const qtyInCart = useCartStore((s) => s.items[key]?.qty ?? 0);
  const addItem = useCartStore((s) => s.addItem);
  const setItemQty = useCartStore((s) => s.setItemQty);
  const imageUrl = product.images?.[0] ? getImageUrl(product.images[0]) : null;
  const ht = parsePrice(product.price);
  const vat = rateToFraction(product.taxRelation?.rate);
  const originalTtc = ht * (1 + vat);
  const resolvedPrice = resolveSpecificPrice(product.specificPrices, ht, vat, Math.max(1, qtyInCart));
  const ttc = resolvedPrice.saleTtc;
  const hasDiscount = ttc < originalTtc;
  const displayedHt = ttc / (1 + vat);
  const discountPercent = originalTtc > 0
    ? Math.min(100, Math.max(1, Math.round(((originalTtc - ttc) / originalTtc) * 100)))
    : 0;
  const productCategorySlug = pickProductCategorySlug(product.categories);
  const href = buildProductHref(productCategorySlug ?? categorySlug, product.slug);
  const categoryLabel = pickProductCategoryLabel(product.categories) ?? null;

  return (
    <article
      className={cn(
        "group overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm transition-all duration-300 hover:border-primary/20 hover:shadow-md",
        variant === "list" && "flex",
        variant === "featured" && "flex h-full flex-col",
      )}>
      <Link
        href={href}
        className={cn(
          "block",
          variant === "list" ? "h-28 w-28 shrink-0 sm:h-32 sm:w-32" : "",
        )}>
        <div
          className={cn(
            "relative overflow-hidden bg-muted/50",
          variant === "list" ? "h-full w-full" : "aspect-square",
          )}>
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt={product.title}
              loading="lazy"
              className={cn(
                "h-full w-full transition-transform duration-300 group-hover:scale-[1.02]",
                variant === "featured" ? "bg-white object-cover" : "object-cover",
              )}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground text-xs">
              <Package className="size-8 opacity-40" />
            </div>
          )}
        </div>
      </Link>

      <div className={cn(
        "p-4",
        variant === "list" && "min-w-0 flex-1",
        variant === "featured" && "flex flex-1 flex-col",
      )}>
        <Link href={href} className="block">
          {categoryLabel ? (
            <p className={cn("mb-1 line-clamp-1 text-xs font-medium text-muted-foreground", variant === "featured" && "min-h-4")}>
              {categoryLabel}
            </p>
          ) : variant === "featured" ? <p className="mb-1 min-h-4" aria-hidden="true" /> : null}
          <h3 className={cn("line-clamp-2 text-sm font-semibold leading-tight transition-colors group-hover:text-primary sm:text-base", variant === "featured" && "min-h-10")}>
            {product.title}
          </h3>
          {hasDiscount ? (
            <div className={cn("mt-2 flex flex-wrap items-center gap-2", variant === "featured" && "min-h-5")}>
              <span className="rounded bg-[#d6202e] px-1.5 py-0.5 text-[10px] font-bold text-white">-{discountPercent}%</span>
              <span className="text-xs text-muted-foreground line-through">{formatEur(originalTtc)} TTC</span>
            </div>
          ) : variant === "featured" ? <div className="mt-2 min-h-5" aria-hidden="true" /> : null}
          <p className={cn("mt-1 text-sm font-semibold tabular-nums sm:text-base", variant === "featured" && "whitespace-nowrap text-[13px]")}>
            <span className={hasDiscount ? "text-[#d6202e]" : "text-foreground"}>{formatEur(ttc)} TTC</span>
            <span className="text-muted-foreground"> - </span>
            <span className="text-[#0858B1]">{formatEur(displayedHt)} HT</span>
          </p>
        </Link>

        <div className="mt-3 flex items-center justify-center">
          <div className="inline-flex items-stretch overflow-hidden rounded-md border border-border/80 bg-white shadow-sm">
            <button
              type="button"
              className="grid h-8 w-8 place-items-center text-foreground hover:bg-muted/50 disabled:opacity-40"
              onClick={() => {
                if (qtyInCart <= 0) return;
                setItemQty(key, qtyInCart - 1);
              }}
              disabled={qtyInCart <= 0}
              aria-label="Diminuer la quantité">
              <Minus className="size-4" />
            </button>
            <div className="grid h-8 min-w-9 place-items-center border-x border-border/80 px-2 text-sm font-semibold tabular-nums">
              {qtyInCart}
            </div>
            <button
              type="button"
              className="grid h-8 w-8 place-items-center text-foreground hover:bg-muted/50"
              onClick={() => {
                if (qtyInCart <= 0) {
                  addItem(
                    {
                      productId: product.id,
                      productSlug: product.slug,
                      title: product.title,
                      image: product.images?.[0] ?? null,
                      categorySlug: productCategorySlug ?? categorySlug ?? null,
                      variantId: null,
                      price: String(displayedHt),
                      taxRate: product.taxRelation?.rate ?? null,
                    },
                    1,
                  );
                  toast.success("Ajouté au panier", { description: product.title });
                  return;
                }
                setItemQty(key, qtyInCart + 1);
                toast.success("Panier mis à jour", {
                  description: `${product.title} × ${qtyInCart + 1}`,
                });
              }}
              aria-label="Augmenter la quantité">
              <Plus className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
