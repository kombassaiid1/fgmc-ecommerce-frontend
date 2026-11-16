/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { Minus, Package, Plus } from "lucide-react";
import { toast } from "sonner";

import { getImageUrl } from "@/lib/api";
import { resolveSpecificPrice } from "@/lib/specific-pricing";
import { cartItemKey, useCartStore } from "@/lib/stores/cart-store";
import { cn } from "@/lib/utils";

import { formatEuro, parseAmount, splitPrice, type OfferProduct } from "../daily-offers/offers";

const INK = "#0f1f45";
const MUTED = "#5b6b8a";
const LINE = "#d5deee";

// Literal class names so Tailwind can see them.
const RATIO_CLASS = {
  "1/1": "aspect-square",
  "5/4": "aspect-[5/4]",
  "4/3": "aspect-[4/3]",
} as const;

export type FeaturedCardStyle = {
  accentColor: string;
  buttonColor: string;
  cardRadius: number;
  imageFit: "cover" | "contain";
  imageRatio: keyof typeof RATIO_CLASS;
};

/**
 * Product card in the « Offres du jour » style. The cart control stays the
 * − / quantity / + stepper (no « Ajouter au panier » button): + adds the product.
 */
export function FeaturedProductCard({
  product,
  style,
  isEditing,
  onLinkClick,
}: {
  product: OfferProduct;
  style: FeaturedCardStyle;
  isEditing: boolean;
  onLinkClick: (event: React.MouseEvent) => void;
}) {
  const { accentColor, buttonColor, cardRadius, imageFit, imageRatio } = style;
  const key = cartItemKey(product.id, null);
  const quantity = useCartStore((state) => state.items[key]?.qty ?? 0);
  const addItem = useCartStore((state) => state.addItem);
  const setItemQty = useCartStore((state) => state.setItemQty);

  const taxRate = product.taxRelation?.rate ?? 0;
  const taxFraction = taxRate > 1 ? taxRate / 100 : taxRate;
  const basePrice = parseAmount(product.price);
  const regularTtc = basePrice * (1 + taxFraction);
  const resolved = resolveSpecificPrice(product.specificPrices, basePrice, taxRate, Math.max(1, quantity));
  const priceTtc = resolved.saleTtc;
  const priceHt = priceTtc / (1 + taxFraction);
  const hasDiscount = regularTtc > 0 && priceTtc < regularTtc;
  const percentOff = hasDiscount
    ? Math.min(99, Math.max(1, Math.round(((regularTtc - priceTtc) / regularTtc) * 100)))
    : 0;

  const mainCategory = product.categories?.find(
    (item) => item.categoryId === product.mainCategoryId || item.category?.id === product.mainCategoryId,
  )?.category;
  const category = mainCategory ?? product.categories?.[0]?.category;
  const image = product.images?.[0] ? getImageUrl(product.images[0]) : null;
  const href = category?.slug ? `/${category.slug}/${product.slug}.html` : `/${product.slug}.html`;
  const { euros, cents } = splitPrice(priceTtc);

  const increase = () => {
    if (isEditing) return; // never touch the real cart from the editor
    if (quantity <= 0) {
      addItem(
        {
          productId: product.id,
          productSlug: product.slug,
          title: product.title,
          image: product.images?.[0] ?? null,
          categorySlug: category?.slug ?? null,
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
      className="group flex h-full w-full flex-col overflow-hidden border bg-white transition-colors duration-200 hover:border-[var(--card-hover)] motion-reduce:transition-none"
      style={{ borderRadius: cardRadius, borderColor: LINE, color: INK, ["--card-hover" as string]: buttonColor }}>
      <Link
        href={href}
        onClick={onLinkClick}
        aria-label={product.title}
        className={cn("relative block shrink-0 overflow-hidden bg-[#eef2f9] focus-visible:outline-offset-[-3px]", RATIO_CLASS[imageRatio])}>
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
          <span className="grid size-full place-items-center" style={{ color: "#9fb0cc" }}>
            <Package className="size-12" aria-hidden="true" />
          </span>
        )}

        {/* A discount is a label sewn onto the corner. */}
        {hasDiscount ? (
          <span
            className="absolute left-0 top-4 p-[3px] pr-1.5 text-white"
            style={{ background: accentColor, borderTopRightRadius: 3, borderBottomRightRadius: 3 }}>
            <span className="block border border-dashed border-white/70 px-2.5 py-0.5 text-xl font-semibold leading-tight tabular-nums">
              −{percentOff}%
            </span>
          </span>
        ) : null}
      </Link>

      <div className="flex flex-1 flex-col px-4 pb-4 pt-4">
        <p className="mb-1 line-clamp-1 text-sm" style={{ color: MUTED }}>
          {product.brand?.title ?? category?.title ?? " "}
        </p>
        <h3 className="min-h-[3.1rem]">
          <Link
            href={href}
            onClick={onLinkClick}
            className="line-clamp-2 cursor-pointer text-lg font-medium leading-snug transition-colors duration-200 hover:text-[var(--card-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
            {product.title}
          </Link>
        </h3>

        <div className="mt-auto pt-4">
          <div className="flex items-baseline gap-x-2">
            <span
              className="whitespace-nowrap font-semibold leading-none tracking-tight tabular-nums"
              style={{ color: hasDiscount ? accentColor : INK }}
              aria-label={formatEuro(priceTtc)}>
              <span className="text-[38px]" aria-hidden="true">{euros}</span>
              <span className="align-top text-xl" aria-hidden="true">,{cents}</span>
              <span className="ml-1 text-base" aria-hidden="true">€</span>
            </span>
            <span className="text-sm font-medium" style={{ color: MUTED }}>TTC</span>
          </div>
          <p className="mt-2 flex min-h-6 flex-wrap items-baseline gap-x-3 gap-y-0.5 text-base tabular-nums" style={{ color: MUTED }}>
            {hasDiscount ? <s>{formatEuro(regularTtc)}</s> : null}
            <span>{formatEuro(priceHt)} HT</span>
          </p>

          {/* Quantity stepper, always visible: no « Ajouter au panier » button. */}
          <div
            className="mt-4 flex min-h-12 items-center justify-between rounded border-2 bg-white p-1"
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
        </div>
      </div>
    </article>
  );
}
