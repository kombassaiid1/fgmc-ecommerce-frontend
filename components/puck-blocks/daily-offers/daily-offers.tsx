/* eslint-disable @next/next/no-img-element */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight, Minus, Package, Plus, ShoppingCart } from "lucide-react";
import { toast } from "sonner";

import { getImageUrl } from "@/lib/api";
import { getProducts } from "@/lib/api/products";
import { cartItemKey, useCartStore } from "@/lib/stores/cart-store";
import { cn } from "@/lib/utils";

import { ClockProvider, useNow } from "./clock";
import {
  computeOfferClock,
  formatEuro,
  getOffer,
  splitPrice,
  type Offer,
  type OfferEntry,
  type OfferProduct,
} from "./offers";

/* -------------------------------------------------------------------------- */
/* Props                                                                      */
/* -------------------------------------------------------------------------- */

export type DailyOffersProps = {
  title: string;
  subtitle: string;
  maxProducts: number;
  columns: 2 | 3 | 4 | 5;
  /** Cards visible at once on a phone (under 640px). */
  mobileColumns: 1 | 2;
  autoplaySeconds: number;
  /** A countdown on every card, each for its own offer. */
  showCountdown: boolean;
  showDots: boolean;
  showViewAll: boolean;
  viewAllLabel: string;
  viewAllHref: string;

  /** "cover" fills the whole area (may crop); "contain" shows the entire photo. */
  imageFit: "cover" | "contain";
  imageRatio: "1/1" | "5/4" | "4/3";

  accentColor: string;
  buttonColor: string;
  background: string;
  maxWidth: number;
  cardRadius: number;
};

export const DAILY_OFFERS_DEFAULTS: DailyOffersProps = {
  title: "Offres du jour",
  subtitle: "Machines et accessoires à prix réduit, jusqu'à la fin de chaque offre.",
  maxProducts: 8,
  columns: 5,
  mobileColumns: 1,
  autoplaySeconds: 0,
  showCountdown: true,
  showDots: true,
  showViewAll: true,
  viewAllLabel: "Voir toutes les offres",
  viewAllHref: "/categorie-produit",
  imageFit: "cover",
  imageRatio: "1/1",
  accentColor: "#d6202e",
  buttonColor: "#153675",
  background: "#f2f5fa",
  maxWidth: 1550,
  cardRadius: 4,
};

// Literal class names so Tailwind can see them.
// On a phone: one card with the next one peeking in, or two side by side.
const MOBILE_CLASS: Record<DailyOffersProps["mobileColumns"], string> = {
  1: "basis-[85%] sm:basis-1/2",
  2: "basis-1/2",
};

const COLUMN_CLASS: Record<DailyOffersProps["columns"], string> = {
  2: "lg:basis-1/2",
  3: "lg:basis-1/3",
  4: "lg:basis-1/4",
  // Five across needs about 1280px; on smaller desktops it falls back to four.
  5: "lg:basis-1/4 xl:basis-1/5",
};

const INK = "#0f1f45";
const MUTED = "#5b6b8a";
const LINE = "#d5deee";
const STITCH = "#b4c2dc";

// Literal class names so Tailwind can see them.
const RATIO_CLASS: Record<DailyOffersProps["imageRatio"], string> = {
  "1/1": "aspect-square",
  "5/4": "aspect-[5/4]",
  "4/3": "aspect-[4/3]",
};

/* -------------------------------------------------------------------------- */
/* Block                                                                      */
/* -------------------------------------------------------------------------- */

export function DailyOffers(props: Partial<DailyOffersProps> & { isEditing?: boolean }) {
  const {
    title,
    subtitle,
    maxProducts,
    columns,
    mobileColumns,
    autoplaySeconds,
    showCountdown,
    showDots,
    showViewAll,
    viewAllLabel,
    viewAllHref,
    imageFit,
    imageRatio,
    accentColor,
    buttonColor,
    background,
    maxWidth,
    cardRadius,
  } = { ...DAILY_OFFERS_DEFAULTS, ...props };
  const isEditing = Boolean(props.isEditing);

  const productsQuery = useQuery({
    queryKey: ["daily-offer-products"],
    queryFn: () => getProducts({ page: 1, limit: 100, status: "PUBLIC" }),
    staleTime: 60_000,
  });

  const offers = useMemo(
    () =>
      ((productsQuery.data?.data ?? []) as OfferProduct[])
        .map((product): { product: OfferProduct; offer: Offer | null } => ({ product, offer: getOffer(product) }))
        .filter((entry): entry is OfferEntry => entry.offer !== null)
        .slice(0, Math.max(1, maxProducts)),
    [productsQuery.data, maxProducts],
  );

  const [emblaRef, emblaApi] = useEmblaCarousel({ align: "start", containScroll: "trimSnaps" });
  const [nav, setNav] = useState({ snaps: 0, selected: 0, canPrev: false, canNext: false });

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
  }, [emblaApi, syncNav, offers.length, columns]);

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

  const guardClick = (event: React.MouseEvent) => {
    if (isEditing) event.preventDefault();
  };

  // Nothing to show: stay invisible on the storefront, but explain it in the editor.
  if (!productsQuery.isLoading && offers.length === 0) {
    if (!isEditing) return null;
    return (
      <section className="px-4 py-8 sm:px-6" style={{ background: background || undefined }}>
        <div
          className="mx-auto flex flex-col gap-1 border-2 border-dashed bg-white/70 px-6 py-10"
          style={{ maxWidth, borderColor: STITCH, borderRadius: cardRadius }}
        >
          <p className="text-lg font-semibold" style={{ color: INK }}>
            Aucune offre en cours
          </p>
          <p className="max-w-xl text-sm leading-relaxed" style={{ color: MUTED }}>
            Ce bloc affiche les produits publiés qui ont un prix promotionnel actif. Il apparaîtra sur le site dès
            qu&apos;une promotion est configurée sur un produit.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section
      className="px-4 py-9 sm:px-6 lg:py-12"
      style={{ background: background || undefined, color: INK }}
      aria-labelledby="daily-offers-title"
    >
      <div className="mx-auto" style={{ maxWidth }}>
        {/* Header: the title runs into a stitched seam that ends at the arrows. */}
        <div className="mb-6 sm:mb-7">
          <div className="flex items-center gap-4">
            {/* Type styles sit on the inner span: the global Polaris stylesheet is
                unlayered and would override Tailwind's size and weight on a bare <h2>. */}
            <h2 id="daily-offers-title" className="shrink-0">
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
          {subtitle ? (
            <p className="mt-3 max-w-2xl text-base leading-snug" style={{ color: MUTED }}>
              {subtitle}
            </p>
          ) : null}
        </div>

        {/* Carousel */}
        <ClockProvider>
          <div
            ref={emblaRef}
            className="-mx-1 overflow-hidden px-1 pb-1"
            role="region"
            aria-roledescription="carousel"
            aria-label={title}
          >
            <div className="-ml-4 flex">
              {productsQuery.isLoading
                ? [0, 1, 2, 3].map((item) => (
                    <div key={item} className={cn("min-w-0 shrink-0 grow-0 pl-4", MOBILE_CLASS[mobileColumns], COLUMN_CLASS[columns])}>
                      <div className="h-[500px] animate-pulse border bg-white" style={{ borderRadius: cardRadius, borderColor: LINE }} />
                    </div>
                  ))
                : offers.map(({ product, offer }) => (
                    <div
                      key={product.id}
                      className={cn("min-w-0 shrink-0 grow-0 pl-4", MOBILE_CLASS[mobileColumns], COLUMN_CLASS[columns])}
                      role="group"
                      aria-roledescription="slide"
                      aria-label={product.title}
                    >
                      <OfferCard
                        product={product}
                        offer={offer}
                        accentColor={accentColor}
                        buttonColor={buttonColor}
                        cardRadius={cardRadius}
                        showCountdown={showCountdown}
                        imageFit={imageFit}
                        compact={mobileColumns === 2}
                        imageRatio={imageRatio}
                        isEditing={isEditing}
                        onLinkClick={guardClick}
                      />
                    </div>
                  ))}
            </div>
          </div>
        </ClockProvider>

        {/* Footer: stitched page markers + link */}
        {(showDots && nav.snaps > 1) || showViewAll ? (
          <div className="mt-5 flex items-center justify-between gap-4">
            <div className="flex items-center" role="group" aria-label="Pages du carrousel">
              {showDots && nav.snaps > 1
                ? Array.from({ length: nav.snaps }).map((_, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => emblaApi?.scrollTo(index)}
                      aria-label={`Aller à la page ${index + 1}`}
                      aria-current={index === nav.selected}
                      className="group grid h-8 w-8 cursor-pointer place-items-center focus-visible:outline-none"
                    >
                      <span
                        className="block h-1 rounded-full transition-all duration-200 group-focus-visible:ring-2 group-focus-visible:ring-offset-2 motion-reduce:transition-none"
                        style={
                          index === nav.selected
                            ? { width: 24, background: buttonColor }
                            : { width: 10, background: STITCH }
                        }
                      />
                    </button>
                  ))
                : null}
            </div>
            {showViewAll ? (
              <Link
                href={viewAllHref || "/categorie-produit"}
                onClick={guardClick}
                className="inline-flex min-h-11 cursor-pointer items-center text-base font-medium underline decoration-2 underline-offset-[6px] transition-opacity duration-200 hover:opacity-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                style={{ color: buttonColor }}
              >
                {viewAllLabel}
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Pieces                                                                     */
/* -------------------------------------------------------------------------- */

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
      aria-label={direction === "prev" ? "Offres précédentes" : "Offres suivantes"}
      // The colour comes from a CSS variable, not an inline `color`, so the hover
      // state can swap it: navy arrow on white, white arrow on navy.
      className="grid size-11 cursor-pointer place-items-center rounded border-2 border-[color:var(--btn)] bg-white text-[color:var(--btn)] transition-colors duration-200 hover:bg-[var(--btn)] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-white disabled:hover:text-[color:var(--btn)]"
      style={{ ["--btn" as string]: color }}
    >
      <Icon className="size-5" aria-hidden="true" />
    </button>
  );
}

const STITCH_COUNT = 20;

/**
 * Each offer's own countdown. The row of stitches is the time left: one stitch
 * disappears each time a twentieth of the offer's duration has passed. In the
 * last 24 hours it turns to the accent colour.
 */
function OfferCountdown({
  offer,
  accentColor,
  buttonColor,
  title,
  compact,
}: {
  offer: Offer;
  accentColor: string;
  buttonColor: string;
  title: string;
  compact: boolean;
}) {
  const clock = computeOfferClock(offer, useNow());
  const tone = clock.urgent ? accentColor : buttonColor;
  const filled = clock.expired ? 0 : Math.max(1, Math.ceil(clock.ratio * STITCH_COUNT));

  const parts = [
    { value: clock.days, unit: "j" },
    { value: clock.hours, unit: "h" },
    { value: clock.minutes, unit: "min" },
    { value: clock.seconds, unit: "s" },
  ].filter((part) => part.unit !== "j" || part.value > 0 || !clock.ready); // no "00 j" on the last day

  return (
    <div
      role="timer"
      aria-label={
        clock.ready
          ? clock.expired
            ? `Offre terminée : ${title}`
            : `Fin de l'offre dans ${clock.days} jours, ${clock.hours} heures, ${clock.minutes} minutes et ${clock.seconds} secondes`
          : "Calcul du temps restant"
      }
    >
      <div className={cn("mb-2 flex items-center gap-[3px]", compact && "max-sm:mb-1.5")} aria-hidden="true">
        {Array.from({ length: STITCH_COUNT }).map((_, index) => (
          <span
            key={index}
            className="h-[3px] flex-1 rounded-full"
            style={{ background: index < filled ? tone : "#dbe3f1" }}
          />
        ))}
      </div>

      {clock.expired ? (
        <p className="text-base font-medium" style={{ color: MUTED }}>
          Offre terminée
        </p>
      ) : (
        <div className="flex flex-col gap-1.5" aria-hidden="true">
          <span className={cn("whitespace-nowrap text-[13px]", compact && "max-sm:text-[11px]")} style={{ color: MUTED }}>
            Se termine dans
          </span>
          <span className="flex items-baseline justify-between" style={{ color: clock.urgent ? accentColor : INK }}>
            {parts.map(({ value, unit }) => (
              <span key={unit} className="flex items-baseline gap-0.5 tabular-nums">
                <span className={cn("text-xl font-semibold leading-none", compact && "max-sm:text-sm")}>
                  {clock.ready ? String(value).padStart(2, "0") : "--"}
                </span>
                <span className={cn("text-xs", compact && "max-sm:text-[10px]")} style={{ color: MUTED }}>
                  {unit}
                </span>
              </span>
            ))}
          </span>
        </div>
      )}
    </div>
  );
}

function OfferCard({
  product,
  offer,
  accentColor,
  buttonColor,
  cardRadius,
  showCountdown,
  imageFit,
  imageRatio,
  compact,
  isEditing,
  onLinkClick,
}: {
  product: OfferProduct;
  offer: Offer;
  accentColor: string;
  buttonColor: string;
  cardRadius: number;
  showCountdown: boolean;
  imageFit: DailyOffersProps["imageFit"];
  imageRatio: DailyOffersProps["imageRatio"];
  /** Two cards across on a phone: smaller type and spacing under 640px. */
  compact: boolean;
  isEditing: boolean;
  onLinkClick: (event: React.MouseEvent) => void;
}) {
  const key = cartItemKey(product.id, null);
  const quantity = useCartStore((state) => state.items[key]?.qty ?? 0);
  const addItem = useCartStore((state) => state.addItem);
  const setItemQty = useCartStore((state) => state.setItemQty);
  const expired = computeOfferClock(offer, useNow()).expired;

  const mainCategory = product.categories?.find(
    (item) => item.categoryId === product.mainCategoryId || item.category?.id === product.mainCategoryId,
  )?.category;
  const category = mainCategory ?? product.categories?.[0]?.category;
  const image = product.images?.[0] ? getImageUrl(product.images[0]) : null;
  const href = category?.slug ? `/${category.slug}/${product.slug}.html` : `/${product.slug}.html`;
  const { euros, cents } = splitPrice(offer.salePrice);

  const add = () => {
    if (isEditing || expired) return; // never touch the real cart from the editor
    addItem(
      {
        productId: product.id,
        productSlug: product.slug,
        title: product.title,
        image: product.images?.[0] ?? null,
        categorySlug: category?.slug ?? null,
        variantId: null,
        price: String(offer.saleBasePrice),
        taxRate: offer.taxRate,
      },
      1,
    );
    toast.success("Ajouté au panier", { description: product.title });
  };

  const change = (next: number) => {
    if (isEditing) return;
    setItemQty(key, next);
  };

  return (
    <article
      className="group flex h-full flex-col overflow-hidden border bg-white transition-colors duration-200 hover:border-[var(--offer-hover)] motion-reduce:transition-none"
      style={{ borderRadius: cardRadius, borderColor: LINE, ["--offer-hover" as string]: buttonColor }}
    >
      <Link
        href={href}
        onClick={onLinkClick}
        aria-label={product.title}
        className={cn(
          "relative block shrink-0 overflow-hidden bg-[#eef2f9] focus-visible:outline-offset-[-3px]",
          RATIO_CLASS[imageRatio],
        )}
      >
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

        {/* The discount is a label sewn onto the corner. */}
        <span
          className={cn("absolute left-0 top-4 p-[3px] pr-1.5 text-white", compact && "max-sm:top-2")}
          style={{ background: accentColor, borderTopRightRadius: 3, borderBottomRightRadius: 3 }}
        >
          <span
            className={cn(
              "block border border-dashed border-white/70 px-2.5 py-0.5 text-xl font-semibold leading-tight tabular-nums",
              compact && "max-sm:px-1.5 max-sm:text-sm",
            )}
          >
            −{offer.percentOff}%
          </span>
        </span>
      </Link>

      <div className={cn("flex flex-1 flex-col px-4 pb-4 pt-4", compact && "max-sm:px-2.5 max-sm:pb-3 max-sm:pt-2.5")}>
        <p className={cn("mb-1 line-clamp-1 text-sm", compact && "max-sm:text-xs")} style={{ color: MUTED }}>
          {product.brand?.title ?? category?.title ?? "Offre spéciale"}
        </p>
        <h3 className={cn("min-h-[3.1rem]", compact && "max-sm:min-h-[2.4rem]")}>
          <Link
            href={href}
            onClick={onLinkClick}
            className={cn(
              "line-clamp-2 cursor-pointer text-lg font-medium leading-snug transition-colors duration-200 hover:text-[var(--offer-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
              compact && "max-sm:text-sm",
            )}
          >
            {product.title}
          </Link>
        </h3>

        <div className={cn("mt-auto pt-4", compact && "max-sm:pt-2")}>
          <div className="flex items-baseline gap-x-2">
            <span
              className="whitespace-nowrap font-semibold leading-none tracking-tight tabular-nums"
              style={{ color: accentColor }}
              aria-label={formatEuro(offer.salePrice)}
            >
              <span className={cn("text-[38px]", compact && "max-sm:text-[26px]")} aria-hidden="true">
                {euros}
              </span>
              <span className={cn("align-top text-xl", compact && "max-sm:text-sm")} aria-hidden="true">
                ,{cents}
              </span>
              <span className={cn("ml-1 text-base", compact && "max-sm:text-xs")} aria-hidden="true">
                €
              </span>
            </span>
            <span className={cn("text-sm font-medium", compact && "max-sm:text-xs")} style={{ color: MUTED }}>
              TTC
            </span>
          </div>
          <p
            className={cn("mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-base tabular-nums", compact && "max-sm:text-xs")}
            style={{ color: MUTED }}
          >
            <s>{formatEuro(offer.price)}</s>
            <span>{formatEuro(offer.saleBasePrice)} HT</span>
          </p>

          {showCountdown ? (
            <div className={cn("mt-4 border-t border-dashed pt-4", compact && "max-sm:mt-2.5 max-sm:pt-2.5")} style={{ borderColor: STITCH }}>
              <OfferCountdown
                offer={offer}
                accentColor={accentColor}
                buttonColor={buttonColor}
                title={product.title}
                compact={compact}
              />
            </div>
          ) : null}

          <div className={cn("mt-4", compact && "max-sm:mt-2.5")}>
            {quantity === 0 ? (
              <button
                type="button"
                onClick={add}
                disabled={expired}
                className={cn(
                  "flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded px-4 text-base font-medium text-white transition duration-200 hover:brightness-110 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-45 motion-reduce:transition-none",
                  compact && "max-sm:min-h-11 max-sm:gap-1 max-sm:px-1.5 max-sm:text-sm",
                )}
                style={{ background: buttonColor }}
              >
                <ShoppingCart className={cn("size-[18px]", compact && "max-sm:size-4")} aria-hidden="true" />
                {expired ? "Offre terminée" : "Ajouter au panier"}
              </button>
            ) : (
              <div
                className={cn("flex min-h-12 items-center justify-between rounded border-2 bg-white p-1", compact && "max-sm:min-h-11")}
                style={{ borderColor: buttonColor }}
              >
                <button
                  type="button"
                  aria-label={`Diminuer la quantité de ${product.title}`}
                  onClick={() => change(quantity - 1)}
                  className={cn(
                    "grid size-10 cursor-pointer place-items-center rounded transition-colors duration-200 hover:bg-[#eef2f9] focus-visible:outline focus-visible:outline-2",
                    compact && "max-sm:size-9",
                  )}
                  style={{ color: buttonColor }}
                >
                  <Minus className="size-4" aria-hidden="true" />
                </button>
                <span className="min-w-8 text-center text-lg font-semibold tabular-nums" aria-live="polite">
                  {quantity}
                </span>
                <button
                  type="button"
                  aria-label={`Augmenter la quantité de ${product.title}`}
                  onClick={() => change(quantity + 1)}
                  className={cn(
                    "grid size-10 cursor-pointer place-items-center rounded transition-colors duration-200 hover:bg-[#eef2f9] focus-visible:outline focus-visible:outline-2",
                    compact && "max-sm:size-9",
                  )}
                  style={{ color: buttonColor }}
                >
                  <Plus className="size-4" aria-hidden="true" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
