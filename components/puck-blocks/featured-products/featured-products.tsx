"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { DiscoverProducts } from "@/components/home/discover-products";
import { getCategories } from "@/lib/api/categories";
import { getProducts } from "@/lib/api/products";
import { cn } from "@/lib/utils";

import type { OfferProduct } from "../daily-offers/offers";
import { FeaturedProductCard } from "./featured-product-card";
import { SewingMachine } from "../sewing-machine";

/* -------------------------------------------------------------------------- */
/* Props                                                                      */
/* -------------------------------------------------------------------------- */

export type FeaturedProductsProps = {
  /** Empty = automatic: the selected category name. */
  title: string;
  /** "category": products of a category; "recommendations": the « À découvrir » block. */
  source: "category" | "recommendations";
  /** Empty = all categories. Only used when source is "category". */
  categoryId: string;
  maxProducts: number;
  columns: 2 | 3 | 4 | 5 | 6;
  /** Cards visible at once on a phone (under 640px). */
  mobileColumns: 1 | 2;
  autoplaySeconds: number;
  showDots: boolean;
  showViewAll: boolean;
  viewAllLabel: string;

  /** "cover" fills the whole area (may crop); "contain" shows the entire photo. */
  imageFit: "cover" | "contain";
  imageRatio: "1/1" | "5/4" | "4/3";

  accentColor: string;
  buttonColor: string;
  cardRadius: number;
  background: string;
  maxWidth: number;
};

/** Shown when no title is typed and no category is selected. */
export const FEATURED_PRODUCTS_FALLBACK_TITLE = "Meilleures ventes";

export const FEATURED_PRODUCTS_DEFAULTS: FeaturedProductsProps = {
  title: "",
  source: "category",
  categoryId: "",
  maxProducts: 12,
  columns: 5,
  mobileColumns: 1,
  autoplaySeconds: 0,
  showDots: true,
  showViewAll: true,
  viewAllLabel: "Voir tout",
  imageFit: "cover",
  imageRatio: "1/1",
  accentColor: "#d6202e",
  buttonColor: "#153675",
  cardRadius: 4,
  background: "#f2f5fa",
  maxWidth: 1550,
};

// Literal class names so Tailwind can see them (same scale as « Offres du jour »).
const MOBILE_CLASS: Record<FeaturedProductsProps["mobileColumns"], string> = {
  1: "basis-[85%] sm:basis-1/2",
  2: "basis-1/2",
};

const COLUMN_CLASS: Record<FeaturedProductsProps["columns"], string> = {
  2: "lg:basis-1/2",
  3: "lg:basis-1/3",
  4: "lg:basis-1/4",
  // Five across needs about 1280px; on smaller desktops it falls back to four.
  5: "lg:basis-1/4 xl:basis-1/5",
  6: "lg:basis-1/4 xl:basis-1/6",
};

const INK = "#0f1f45";
const STITCH = "#b4c2dc";
const LINE = "#d5deee";

/* -------------------------------------------------------------------------- */
/* Block                                                                      */
/* -------------------------------------------------------------------------- */

export function FeaturedProducts(props: Partial<FeaturedProductsProps> & { isEditing?: boolean }) {
  const merged = { ...FEATURED_PRODUCTS_DEFAULTS, ...props };
  const {
    source,
    categoryId,
    maxProducts,
    columns,
    mobileColumns,
    autoplaySeconds,
    showDots,
    showViewAll,
    viewAllLabel,
    imageFit,
    imageRatio,
    accentColor,
    buttonColor,
    cardRadius,
    background,
    maxWidth,
  } = merged;
  const isEditing = Boolean(props.isEditing);
  const isRecommendations = source === "recommendations";

  const categoriesQuery = useQuery({
    queryKey: ["navbar-categories"],
    queryFn: () => getCategories(),
    staleTime: 60_000,
  });
  const productsQuery = useQuery({
    queryKey: ["home-featured-products", "block", categoryId],
    queryFn: () =>
      getProducts({
        page: 1,
        limit: 100,
        status: "PUBLIC",
        categoryId: categoryId || undefined,
        includeDescendants: Boolean(categoryId),
      }),
    enabled: !isRecommendations,
    staleTime: 60_000,
  });

  const products = useMemo(
    () => (productsQuery.data?.data ?? []).slice(0, Math.max(1, maxProducts)),
    [productsQuery.data, maxProducts],
  );
  const category = categoriesQuery.data?.find((item) => item.id === categoryId);
  const viewAllHref = category?.slug ? `/${category.slug}` : "/categorie-produit";

  // A block saved while the title was inline-editable can hold a non-string value.
  const typedTitle = typeof merged.title === "string" ? merged.title.trim() : "";
  // « Meilleures ventes » was the old default: it follows the category too.
  const isAutoTitle = typedTitle === "" || typedTitle === FEATURED_PRODUCTS_FALLBACK_TITLE;
  const title = isAutoTitle
    ? (!isRecommendations && category?.title) || FEATURED_PRODUCTS_FALLBACK_TITLE
    : typedTitle;

  const [emblaRef, emblaApi] = useEmblaCarousel({ align: "start", containScroll: "trimSnaps" });
  const [nav, setNav] = useState({ snaps: 0, selected: 0, canPrev: false, canNext: false });
  // The sewing machine swings while it travels to the new page.
  const [machineMoving, setMachineMoving] = useState(false);
  useEffect(() => {
    if (nav.snaps === 0) return;
    setMachineMoving(true);
    const timer = window.setTimeout(() => setMachineMoving(false), 600);
    return () => window.clearTimeout(timer);
  }, [nav.selected, nav.snaps]);

  const syncNav = useCallback(() => {
    if (!emblaApi) return;
    setNav({
      snaps: emblaApi.scrollSnapList().length,
      selected: emblaApi.selectedScrollSnap(),
      canPrev: emblaApi.canScrollPrev(),
      canNext: emblaApi.canScrollNext(),
    });
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    const frame = window.requestAnimationFrame(syncNav);
    emblaApi.on("select", syncNav).on("reInit", syncNav);
    return () => {
      window.cancelAnimationFrame(frame);
      emblaApi.off("select", syncNav).off("reInit", syncNav);
    };
  }, [emblaApi, syncNav, products.length, columns]);

  // Optional autoplay (never when the visitor prefers reduced motion).
  useEffect(() => {
    if (!emblaApi || autoplaySeconds <= 0) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => {
      if (emblaApi.canScrollNext()) emblaApi.scrollNext();
      else emblaApi.scrollTo(0);
    }, autoplaySeconds * 1000);
    return () => window.clearInterval(timer);
  }, [emblaApi, autoplaySeconds]);

  if (isRecommendations) {
    return (
      <div style={{ background }}>
        <DiscoverProducts title={isAutoTitle ? undefined : typedTitle} />
      </div>
    );
  }

  // Nothing to show: stay invisible on the storefront, but explain it in the editor.
  if (!productsQuery.isLoading && products.length === 0) {
    return isEditing ? (
      <section className="px-4 py-8 sm:px-6" style={{ background }}>
        <p
          className="mx-auto border-2 border-dashed bg-white/70 px-6 py-10 text-center text-sm"
          style={{ maxWidth, borderColor: STITCH, color: INK }}>
          « {title} » : aucun produit publié dans cette catégorie.
        </p>
      </section>
    ) : null;
  }

  const guardClick = (event: React.MouseEvent) => {
    if (isEditing) event.preventDefault();
  };

  return (
    <section
      className="px-4 py-9 sm:px-6 lg:py-12"
      style={{ background: background || undefined, color: INK }}
      aria-labelledby="featured-products-title">
      <div className="mx-auto" style={{ maxWidth }}>
        {/* Header: the title runs into a stitched seam that ends at the arrows. */}
        <div className="mb-6 sm:mb-7">
          <div className="flex items-center gap-4">
            {/* Type styles sit on the inner span: the global Polaris stylesheet is
                unlayered and would override Tailwind's size and weight on a bare <h2>. */}
            <h2 id="featured-products-title" className="shrink-0">
              <span className="block text-3xl font-semibold leading-none tracking-tight sm:text-4xl">{title}</span>
            </h2>
            <span
              className="h-0 min-w-6 flex-1 border-t-2 border-dashed"
              style={{ borderColor: STITCH }}
              aria-hidden="true"
            />
            {/* Touch screens swipe, so the arrows only show from tablet size up. */}
            <div className="hidden shrink-0 items-center gap-2 sm:flex">
              <CarouselButton direction="prev" disabled={!nav.canPrev} onClick={() => emblaApi?.scrollPrev()} color={buttonColor} />
              <CarouselButton direction="next" disabled={!nav.canNext} onClick={() => emblaApi?.scrollNext()} color={buttonColor} />
            </div>
          </div>
        </div>

        {/* Carousel */}
        <div
          ref={emblaRef}
          className="-mx-1 overflow-hidden px-1 pb-1"
          role="region"
          aria-roledescription="carousel"
          aria-label={title}>
          <div className="-ml-4 flex">
            {productsQuery.isLoading
              ? [0, 1, 2, 3].map((item) => (
                  <div key={item} className={cn("min-w-0 shrink-0 grow-0 pl-4", MOBILE_CLASS[mobileColumns], COLUMN_CLASS[columns])}>
                    <div className="h-[460px] animate-pulse border bg-white" style={{ borderColor: LINE, borderRadius: cardRadius }} />
                  </div>
                ))
              : products.map((product) => (
                  <div
                    key={product.id}
                    className={cn("flex min-w-0 shrink-0 grow-0 pl-4", MOBILE_CLASS[mobileColumns], COLUMN_CLASS[columns])}
                    role="group"
                    aria-roledescription="slide"
                    aria-label={product.title}>
                    <FeaturedProductCard
                      product={product as OfferProduct}
                      style={{ accentColor, buttonColor, cardRadius, imageFit, imageRatio }}
                      isEditing={isEditing}
                      onLinkClick={guardClick}
                    />
                  </div>
                ))}
          </div>
        </div>

        {/* Footer: stitched page markers + link */}
        {(showDots && nav.snaps > 1) || showViewAll ? (
          <div className="mt-12 flex items-center justify-between gap-4">
            <div className="relative flex items-center" role="group" aria-label="Pages du carrousel">
              {showDots && nav.snaps > 1 ? (
                <div className="absolute left-0 top-1/2 h-0">
                  <SewingMachine index={nav.selected} moving={machineMoving} color={buttonColor} threadColor={accentColor} />
                </div>
              ) : null}
              {showDots && nav.snaps > 1
                ? Array.from({ length: nav.snaps }).map((_, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => emblaApi?.scrollTo(index)}
                      aria-label={`Aller à la page ${index + 1}`}
                      aria-current={index === nav.selected}
                      className="group grid h-8 w-8 cursor-pointer place-items-center focus-visible:outline-none">
                      {/* Blue at the start; stitches the machine has left behind turn red; the ones ahead stay light. */}
                      <span
                        className="block h-1 rounded-full transition-all duration-200 group-focus-visible:ring-2 group-focus-visible:ring-offset-2 motion-reduce:transition-none"
                        style={{ width: 10, background: index < nav.selected ? accentColor : index === nav.selected ? buttonColor : STITCH }}
                      />
                    </button>
                  ))
                : null}
            </div>
            {showViewAll ? (
              <Link
                href={viewAllHref}
                onClick={guardClick}
                className="inline-flex min-h-11 cursor-pointer items-center text-base font-medium underline decoration-2 underline-offset-[6px] transition-opacity duration-200 hover:opacity-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                style={{ color: buttonColor }}>
                {viewAllLabel || "Voir tout"}
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function CarouselButton({
  direction,
  disabled,
  onClick,
  color,
}: {
  direction: "prev" | "next";
  disabled: boolean;
  onClick: () => void;
  color: string;
}) {
  const Icon = direction === "prev" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={direction === "prev" ? "Produits précédents" : "Produits suivants"}
      // The colour comes from a CSS variable so hover can swap it: navy arrow on white, white on navy.
      className="grid size-11 cursor-pointer place-items-center rounded border-2 border-[color:var(--btn)] bg-white text-[color:var(--btn)] transition-colors duration-200 hover:bg-[var(--btn)] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-white disabled:hover:text-[color:var(--btn)]"
      style={{ ["--btn" as string]: color }}>
      <Icon className="size-5" aria-hidden="true" />
    </button>
  );
}
