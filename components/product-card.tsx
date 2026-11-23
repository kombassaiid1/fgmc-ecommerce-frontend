/* eslint-disable @next/next/no-img-element */
"use client";

import { useMemo, type MouseEvent } from "react";
import Link from "next/link";
import { ArrowRight, Minus, Package, Plus } from "lucide-react";
import { toast } from "sonner";

import { getImageUrl } from "@/lib/api";
import { resolveSpecificPrice, type StorefrontSpecificPrice } from "@/lib/specific-pricing";
import { cartItemKey, useCartStore } from "@/lib/stores/cart-store";
import { cn } from "@/lib/utils";

/**
 * THE standard product card of the storefront (category, brand, search, home,
 * product page, Puck blocks). One design, one place to change it.
 *
 * Layout: image, brand, title, big TTC price, HT price, − / qty / + stepper
 * (no « Ajouter au panier » button: + adds the product).
 */

/* -------------------------------------------------------------------------- */
/* Tokens                                                                     */
/* -------------------------------------------------------------------------- */

const INK = "#0f1f45";
const MUTED = "#5b6b8a";
const LINE = "#d5deee";
const SURFACE = "#eef2f9";
const PLACEHOLDER = "#9fb0cc";

// Literal class names so Tailwind can see them.
const RATIO_CLASS = {
  "1/1": "aspect-square",
  "5/4": "aspect-[5/4]",
  "4/3": "aspect-[4/3]",
} as const;

export type ProductCardStyle = {
  /** Promotion colour (discount label and discounted price). */
  accentColor: string;
  /** Hover border, stepper border and stepper icons. */
  buttonColor: string;
  cardRadius: number;
  imageFit: "cover" | "contain";
  imageRatio: keyof typeof RATIO_CLASS;
};

export const DEFAULT_PRODUCT_CARD_STYLE: ProductCardStyle = {
  accentColor: "#d6202e",
  buttonColor: "#153675",
  cardRadius: 4,
  imageFit: "cover",
  imageRatio: "1/1",
};

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export type ProductCardProduct = {
  id: string;
  slug: string;
  title: string;
  price: string;
  specificPrices?: StorefrontSpecificPrice[] | null;
  taxRelation?: { rate: number } | null;
  mainCategoryId?: string | null;
  images?: string[];
  brand?: { title?: string | null } | null;
  categories?: unknown[] | null;
  /** Combinations (size, colour…). With at least one active, the customer must choose on the product page. */
  combinaisons?: Array<{ isActive?: boolean | null }> | null;
  createdAt?: string;
};

/** "grid": vertical card · "list": horizontal card · "featured": vertical, fills its slot. */
export type ProductCardVariant = "grid" | "list" | "featured";

export type ProductCardProps = {
  product: ProductCardProduct;
  variant?: ProductCardVariant;
  /** Fallback category for the product URL when the product carries none. */
  categorySlug?: string;
  /** Overrides of the default look (used by the page builder blocks). */
  style?: Partial<ProductCardStyle>;
  /** Page-builder preview: links are inert and the real cart is never touched. */
  isEditing?: boolean;
  onLinkClick?: (event: MouseEvent) => void;
};

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function parsePrice(value: string | null | undefined): number {
  const n = Number.parseFloat(String(value ?? "").replace(/[^0-9.,-]/g, "").replace(",", "."));
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

/** Splits a price into euros ("1 026") and cents ("96") for typographic display. */
function splitPrice(value: number) {
  const totalCents = Math.round(value * 100);
  return {
    euros: new Intl.NumberFormat("fr-FR").format(Math.floor(totalCents / 100)),
    cents: String(totalCents % 100).padStart(2, "0"),
  };
}

function buildProductHref(categorySlug: string | undefined, productSlug: string): string {
  const cat = (categorySlug ?? "").trim().replace(/^\/+|\/+$/g, "");
  const prod = String(productSlug ?? "").trim().replace(/^\/+|\/+$/g, "");
  if (!cat) return `/${prod}.html`;
  return `/${cat}/${prod}.html`;
}

type CategoryInfo = { title: string | null; slug: string | null };

/** Category of the product: the main one when known, else the first. */
function pickProductCategory(
  categories: unknown[] | null | undefined,
  mainCategoryId?: string | null,
): CategoryInfo {
  const empty: CategoryInfo = { title: null, slug: null };
  if (!Array.isArray(categories) || categories.length === 0) return empty;

  const asRecord = (item: unknown) =>
    item != null && typeof item === "object" ? (item as Record<string, unknown>) : null;
  const isMain = (item: unknown) => {
    const record = asRecord(item);
    if (!record || !mainCategoryId) return false;
    const category = asRecord(record.category);
    return record.categoryId === mainCategoryId || category?.id === mainCategoryId;
  };
  const text = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);

  const ordered = mainCategoryId ? [...categories].sort((a, b) => Number(isMain(b)) - Number(isMain(a))) : categories;
  const title = (() => {
    const first = asRecord(ordered[0]);
    const candidate = asRecord(first?.category) ?? first;
    return text(candidate?.title) ?? text(candidate?.name);
  })();
  for (const item of ordered) {
    const record = asRecord(item);
    const candidate = asRecord(record?.category) ?? record;
    const slug = text(candidate?.slug);
    if (slug) return { title, slug };
  }
  return { title, slug: null };
}

/* -------------------------------------------------------------------------- */
/* Component                                                                  */
/* -------------------------------------------------------------------------- */

export function ProductCard({
  product,
  variant = "grid",
  categorySlug,
  style,
  isEditing = false,
  onLinkClick,
}: ProductCardProps) {
  const { accentColor, buttonColor, cardRadius, imageFit, imageRatio } = { ...DEFAULT_PRODUCT_CARD_STYLE, ...style };
  const isList = variant === "list";

  const key = useMemo(() => cartItemKey(product.id, null), [product.id]);
  const quantity = useCartStore((state) => state.items[key]?.qty ?? 0);
  const addItem = useCartStore((state) => state.addItem);
  const setItemQty = useCartStore((state) => state.setItemQty);

  const vat = rateToFraction(product.taxRelation?.rate);
  const basePrice = parsePrice(product.price);
  const regularTtc = basePrice * (1 + vat);
  const resolved = resolveSpecificPrice(product.specificPrices, basePrice, vat, Math.max(1, quantity));
  const priceTtc = resolved.saleTtc;
  const priceHt = priceTtc / (1 + vat);
  const hasDiscount = regularTtc > 0 && priceTtc < regularTtc;
  const percentOff = hasDiscount
    ? Math.min(99, Math.max(1, Math.round(((regularTtc - priceTtc) / regularTtc) * 100)))
    : 0;
  const { euros, cents } = splitPrice(priceTtc);

  const category = pickProductCategory(product.categories, product.mainCategoryId);
  const image = product.images?.[0] ? getImageUrl(product.images[0]) : null;
  const href = buildProductHref(category.slug ?? categorySlug, product.slug);
  const eyebrow = product.brand?.title?.trim() || category.title;
  // A product with combinations cannot go straight to the cart: the card asks to choose one on the product page.
  const hasOptions = Boolean(product.combinaisons?.some((combination) => combination.isActive !== false));

  const increase = () => {
    if (isEditing) return; // never touch the real cart from the editor
    if (quantity <= 0) {
      addItem(
        {
          productId: product.id,
          productSlug: product.slug,
          title: product.title,
          image: product.images?.[0] ?? null,
          categorySlug: category.slug ?? categorySlug ?? null,
          variantId: null,
          price: String(priceHt),
          taxRate: product.taxRelation?.rate ?? null,
        },
        1,
      );
      toast.success("Ajouté au panier", { description: product.title });
      return;
    }
    setItemQty(key, quantity + 1);
    toast.success("Panier mis à jour", { description: `${product.title} × ${quantity + 1}` });
  };

  const decrease = () => {
    if (isEditing || quantity <= 0) return;
    setItemQty(key, quantity - 1);
  };

  return (
    <article
      className={cn(
        "group w-full overflow-hidden border bg-white transition-colors duration-200 hover:border-[var(--card-hover)] motion-reduce:transition-none",
        isList ? "flex flex-row" : "flex h-full flex-col",
      )}
      style={{ borderRadius: cardRadius, borderColor: LINE, color: INK, ["--card-hover" as string]: buttonColor }}>
      <Link
        href={href}
        onClick={onLinkClick}
        aria-label={product.title}
        className={cn(
          "relative block shrink-0 overflow-hidden focus-visible:outline-offset-[-3px]",
          isList ? "w-32 self-stretch sm:w-44" : RATIO_CLASS[imageRatio],
        )}
        style={{ background: SURFACE }}>
        {image ? (
          <img
            src={image}
            alt=""
            loading="lazy"
            className={cn(
              "size-full transition-transform duration-300 group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100",
              imageFit === "cover" ? "object-cover" : "object-contain",
            )}
          />
        ) : (
          <span className="grid size-full min-h-28 place-items-center" style={{ color: PLACEHOLDER }}>
            <Package className="size-12" aria-hidden="true" />
          </span>
        )}

        {/* A discount is a label sewn onto the corner. */}
        {hasDiscount ? (
          <span
            className="absolute left-0 top-3 p-[3px] pr-1.5 text-white sm:top-4"
            style={{ background: accentColor, borderTopRightRadius: 3, borderBottomRightRadius: 3 }}>
            <span className="block border border-dashed border-white/70 px-2 py-0.5 text-base font-semibold leading-tight tabular-nums sm:px-2.5 sm:text-xl">
              −{percentOff}%
            </span>
          </span>
        ) : null}
      </Link>

      <div className="flex min-w-0 flex-1 flex-col px-3 pb-3 pt-3 sm:px-4 sm:pb-4 sm:pt-4">
        <p className="mb-1 line-clamp-1 min-h-5 text-xs sm:text-sm" style={{ color: MUTED }}>
          {eyebrow ?? " "}
        </p>
        <h3 className="min-h-[2.75rem] sm:min-h-[3.1rem]">
          <Link
            href={href}
            onClick={onLinkClick}
            className="line-clamp-2 cursor-pointer text-base font-medium leading-snug transition-colors duration-200 hover:text-[var(--card-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 sm:text-lg">
            {product.title}
          </Link>
        </h3>

        <div className="mt-auto pt-3 sm:pt-4">
          <div className="flex items-baseline gap-x-2">
            <span
              className="whitespace-nowrap font-semibold leading-none tracking-tight tabular-nums"
              style={{ color: hasDiscount ? accentColor : INK }}
              aria-label={formatEur(priceTtc)}>
              <span className="text-[30px] sm:text-[38px]" aria-hidden="true">{euros}</span>
              <span className="align-top text-lg sm:text-xl" aria-hidden="true">,{cents}</span>
              <span className="ml-1 text-sm sm:text-base" aria-hidden="true">€</span>
            </span>
            <span className="text-xs font-medium sm:text-sm" style={{ color: MUTED }}>TTC</span>
          </div>
          <p
            className="mt-2 flex min-h-6 flex-wrap items-baseline gap-x-3 gap-y-0.5 text-sm tabular-nums sm:text-base"
            style={{ color: MUTED }}>
            {hasDiscount ? <s>{formatEur(regularTtc)}</s> : null}
            <span>{formatEur(priceHt)} HT</span>
          </p>

          {hasOptions ? (
            <Link
              href={href}
              onClick={onLinkClick}
              aria-label={`Choisir une option pour ${product.title}`}
              className="mt-3 flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded border-2 px-4 text-base font-semibold text-white transition-opacity duration-200 hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 sm:mt-4"
              style={{ borderColor: buttonColor, background: buttonColor }}>
              Choisir une option
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          ) : (
            <>
            {/* Quantity stepper, always visible: no « Ajouter au panier » button. */}
            <div
              className="mt-3 flex min-h-12 items-center justify-between rounded border-2 bg-white p-1 sm:mt-4"
              style={{ borderColor: buttonColor }}>
              <button
                type="button"
                aria-label={`Diminuer la quantité de ${product.title}`}
                onClick={decrease}
                disabled={quantity <= 0}
                className="grid size-10 cursor-pointer place-items-center rounded transition-colors duration-200 hover:bg-[#eef2f9] focus-visible:outline focus-visible:outline-2 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent"
                style={{ color: buttonColor }}>
                <Minus className="size-4" aria-hidden="true" />
              </button>
              <span className="min-w-8 text-center text-lg font-semibold tabular-nums" aria-live="polite">
                {quantity}
              </span>
              <button
                type="button"
                aria-label={`Augmenter la quantité de ${product.title}`}
                onClick={increase}
                className="grid size-10 cursor-pointer place-items-center rounded transition-colors duration-200 hover:bg-[#eef2f9] focus-visible:outline focus-visible:outline-2"
                style={{ color: buttonColor }}>
                <Plus className="size-4" aria-hidden="true" />
              </button>
            </div>
            </>
          )}
        </div>
      </div>
    </article>
  );
}
