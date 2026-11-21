/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";

import { getBrands, type Brand } from "@/lib/api/brands";
import { getImageUrl } from "@/lib/api";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* Props                                                                      */
/* -------------------------------------------------------------------------- */

export type BrandsProps = {
  title: string;
  /** Written before the brand name under each logo, e.g. « Machine à coudre » (empty = the name alone). */
  captionPrefix: string;
  /** Logos visible at once on a computer. */
  columns: 4 | 5 | 6 | 8;
  /** Logos visible at once on a phone. */
  mobileColumns: 2 | 3;
  maxBrands: number;
  /** "alpha": A to Z. "products": the brands with the most products first. */
  sort: "alpha" | "products";
  /** Leave out brands that have no logo. */
  hideWithoutLogo: boolean;
  /** Logos stay grey until pointed at. */
  greyLogos: boolean;
  /** Seconds between two moves (0 = the visitor slides by hand). */
  autoplaySeconds: number;
  showArrows: boolean;
  showProgress: boolean;

  accentColor: string;
  background: string;
  maxWidth: number;
};

export const BRANDS_DEFAULTS: BrandsProps = {
  title: "Nos marques",
  captionPrefix: "Machine à coudre",
  columns: 6,
  mobileColumns: 2,
  maxBrands: 30,
  sort: "alpha",
  hideWithoutLogo: false,
  greyLogos: false,
  autoplaySeconds: 3,
  showArrows: true,
  showProgress: true,
  accentColor: "#d6202e",
  background: "#ffffff",
  maxWidth: 1450,
};

// Literal class names so Tailwind can see them.
const MOBILE_CLASS: Record<BrandsProps["mobileColumns"], string> = {
  2: "basis-1/2",
  3: "basis-1/3",
};
const COLUMN_CLASS: Record<BrandsProps["columns"], string> = {
  4: "md:basis-1/4",
  5: "md:basis-1/4 lg:basis-1/5",
  6: "md:basis-1/4 lg:basis-1/6",
  8: "md:basis-1/4 lg:basis-1/6 xl:basis-1/8",
};

const INK = "#0f1f45";
const MUTED = "#5b6b8a";
const LINE = "#b4c2dc";
const ROYAL = "#153675";

/* -------------------------------------------------------------------------- */
/* Block                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * « Nos marques »: the brand logos slide by on their own, one brand at a time,
 * with the brand name under each. Stitched seams separate the logos. The strip
 * stops under the pointer, on keyboard focus and with the pause button.
 */
export function Brands(props: Partial<BrandsProps> & { isEditing?: boolean }) {
  const { title, captionPrefix, columns, mobileColumns, maxBrands, sort, hideWithoutLogo, greyLogos, autoplaySeconds, showArrows, showProgress, accentColor, background, maxWidth } = {
    ...BRANDS_DEFAULTS,
    ...props,
  };
  const isEditing = Boolean(props.isEditing);

  const brandsQuery = useQuery({
    queryKey: ["storefront-brands"],
    queryFn: () => getBrands({ limit: 200 }),
    staleTime: 60_000,
  });

  const brands = useMemo(() => {
    const all = (brandsQuery.data?.data ?? []).filter((brand) => (hideWithoutLogo ? Boolean(brand.image?.trim()) : true));
    const sorted =
      sort === "products"
        ? [...all].sort((a, b) => (b._count?.products ?? 0) - (a._count?.products ?? 0) || a.title.localeCompare(b.title, "fr"))
        : [...all].sort((a, b) => a.title.localeCompare(b.title, "fr"));
    return sorted.slice(0, Math.max(1, maxBrands));
  }, [brandsQuery.data, hideWithoutLogo, sort, maxBrands]);

  const isLoading = brandsQuery.isLoading;

  // Looping needs more logos than fit on the screen.
  const canLoop = brands.length > columns + 1;
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: canLoop, align: "start", slidesToScroll: 1, duration: 28 });
  const [position, setPosition] = useState({ index: 0, snaps: 0 });
  const [userPaused, setUserPaused] = useState(false);
  const [hoverPaused, setHoverPaused] = useState(false);

  const sync = useCallback(() => {
    if (!emblaApi) return;
    setPosition({ index: emblaApi.selectedScrollSnap(), snaps: emblaApi.scrollSnapList().length });
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    const frame = window.requestAnimationFrame(sync);
    emblaApi.on("select", sync).on("reInit", sync);
    return () => {
      window.cancelAnimationFrame(frame);
      emblaApi.off("select", sync).off("reInit", sync);
    };
  }, [emblaApi, sync, brands.length, columns]);

  // Autoplay: never for visitors who prefer reduced motion; stops while the strip is pointed at or focused.
  const running = autoplaySeconds > 0 && !userPaused && !hoverPaused;
  useEffect(() => {
    if (!emblaApi || !running) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => {
      if (emblaApi.canScrollNext()) emblaApi.scrollNext();
      else emblaApi.scrollTo(0);
    }, autoplaySeconds * 1000);
    return () => window.clearInterval(timer);
  }, [emblaApi, running, autoplaySeconds]);

  // Nothing to show: invisible on the storefront, explained in the editor.
  if (!isLoading && brands.length === 0) {
    return isEditing ? (
      <section className="px-4 py-8 sm:px-6" style={{ background }}>
        <p className="mx-auto border-2 border-dashed bg-white/70 px-6 py-10 text-center text-sm" style={{ maxWidth, borderColor: LINE, color: INK }}>
          Aucune marque à afficher. Ajoutez des marques dans Produits &gt; Marques.
        </p>
      </section>
    ) : null;
  }

  const guardClick = (event: React.MouseEvent) => {
    if (isEditing) event.preventDefault();
  };
  const showControls = !isLoading && position.snaps > 1;

  return (
    <section className="px-4 py-10 sm:px-6 lg:py-12" style={{ background: background || undefined, color: INK }} aria-labelledby="brands-title">
      <div className="mx-auto" style={{ maxWidth }}>
        {title ? (
          <div className="mb-8 flex items-center gap-4">
            <span className="h-0 min-w-6 flex-1 border-t-2 border-dashed" style={{ borderColor: LINE }} aria-hidden="true" />
            {/* Type styles sit on the inner span: the global Polaris stylesheet would override a bare heading. */}
            <h2 id="brands-title" className="shrink-0">
              <span className="block text-3xl font-semibold leading-none tracking-tight sm:text-4xl">{title}</span>
            </h2>
            <span className="h-0 min-w-6 flex-1 border-t-2 border-dashed" style={{ borderColor: LINE }} aria-hidden="true" />
          </div>
        ) : null}

        <div
          onMouseEnter={() => setHoverPaused(true)}
          onMouseLeave={() => setHoverPaused(false)}
          onFocus={() => setHoverPaused(true)}
          onBlur={() => setHoverPaused(false)}>
          <div ref={emblaRef} className="overflow-hidden" role="region" aria-roledescription="carousel" aria-label={title || "Nos marques"}>
            <div className="flex">
              {isLoading
                ? Array.from({ length: columns }, (_, index) => (
                    <div key={index} className={cn("min-w-0 shrink-0 grow-0 px-3", MOBILE_CLASS[mobileColumns], COLUMN_CLASS[columns])}>
                      <div className="h-36 animate-pulse bg-[#eef2f9] motion-reduce:animate-none" />
                    </div>
                  ))
                : brands.map((brand) => (
                    <div
                      key={brand.id}
                      className={cn("min-w-0 shrink-0 grow-0 border-r-2 border-dashed", MOBILE_CLASS[mobileColumns], COLUMN_CLASS[columns])}
                      style={{ borderColor: LINE }}
                      role="group"
                      aria-roledescription="slide"
                      aria-label={brand.title}>
                      <BrandItem brand={brand} captionPrefix={captionPrefix} grey={greyLogos} onClick={guardClick} />
                    </div>
                  ))}
            </div>
          </div>

          {showControls && (showProgress || showArrows || autoplaySeconds > 0) ? (
            <div className="mt-6 flex items-center gap-3">
              {/* A stitched line: the red stitch shows where the strip is. */}
              {showProgress ? (
                <div className="relative h-5 flex-1" aria-hidden="true">
                  <span className="absolute inset-x-0 top-1/2 border-t-2 border-dashed" style={{ borderColor: LINE }} />
                  <span
                    className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full transition-[left] duration-500 ease-out motion-reduce:transition-none"
                    style={{ background: accentColor, width: `${100 / position.snaps}%`, left: `${(position.index * 100) / position.snaps}%`, minWidth: 28 }}
                  />
                </div>
              ) : (
                <span className="flex-1" />
              )}
              {autoplaySeconds > 0 ? (
                <ControlButton onClick={() => setUserPaused((value) => !value)} label={userPaused ? "Relancer le défilement" : "Mettre le défilement en pause"}>
                  {userPaused ? <Play className="size-4" aria-hidden="true" /> : <Pause className="size-4" aria-hidden="true" />}
                </ControlButton>
              ) : null}
              {showArrows ? (
                <>
                  <ControlButton onClick={() => emblaApi?.scrollPrev()} label="Marques précédentes">
                    <ChevronLeft className="size-5" aria-hidden="true" />
                  </ControlButton>
                  <ControlButton onClick={() => emblaApi?.scrollNext()} label="Marques suivantes">
                    <ChevronRight className="size-5" aria-hidden="true" />
                  </ControlButton>
                </>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function ControlButton({ onClick, label, children }: { onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-[4px] border bg-white transition-colors duration-200 hover:bg-[#eef2f9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      style={{ borderColor: LINE, color: ROYAL }}>
      {children}
    </button>
  );
}

function BrandItem({
  brand,
  captionPrefix,
  grey,
  onClick,
}: {
  brand: Brand;
  captionPrefix: string;
  grey: boolean;
  onClick: (event: React.MouseEvent) => void;
}) {
  const [failed, setFailed] = useState(false);
  const logo = brand.image?.trim() ? getImageUrl(brand.image) : "";
  const caption = [captionPrefix.trim(), brand.title].filter(Boolean).join(" ");

  return (
    <Link
      href={`/b/${brand.slug}`}
      onClick={onClick}
      className="group flex h-full min-h-40 flex-col items-center justify-between gap-4 px-4 py-4 text-center focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2">
      <span className="grid h-24 w-full place-items-center">
        {logo && !failed ? (
          <img
            src={logo}
            alt=""
            loading="lazy"
            onError={() => setFailed(true)}
            className={cn(
              "max-h-full max-w-full object-contain transition duration-300 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100",
              grey && "opacity-70 grayscale group-hover:opacity-100 group-hover:grayscale-0 group-focus-visible:opacity-100 group-focus-visible:grayscale-0",
            )}
          />
        ) : (
          // No logo, or it does not load: the name takes its place instead of a broken image.
          <span className="line-clamp-2 text-2xl font-semibold leading-tight tracking-tight" style={{ color: ROYAL }}>
            {brand.title}
          </span>
        )}
      </span>
      <span className="line-clamp-2 text-sm leading-snug transition-colors duration-200 group-hover:text-[#153675]" style={{ color: MUTED }}>
        {caption}
      </span>
    </Link>
  );
}
