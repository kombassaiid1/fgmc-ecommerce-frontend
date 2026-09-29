"use client";

import { useMemo, useRef } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { ProductCard } from "@/components/product-card";
import { getCategories } from "@/lib/api/categories";
import { getProducts } from "@/lib/api/products";
import { getPublicHeaderSettings } from "@/lib/api/header";

export function FeaturedProducts() {
  const trackRef = useRef<HTMLDivElement>(null);
  const settingsQuery = useQuery({
    queryKey: ["storefront-header-settings"],
    queryFn: getPublicHeaderSettings,
    staleTime: 30_000,
  });
  const categoriesQuery = useQuery({
    queryKey: ["navbar-categories"],
    queryFn: () => getCategories(),
    staleTime: 60_000,
  });
  const featuredConfig = settingsQuery.data?.heroConfig.featuredProducts;
  const categoryId = featuredConfig?.categoryId ?? null;
  const productsQuery = useQuery({
    queryKey: ["home-featured-products", categoryId],
    queryFn: () =>
      getProducts({
        page: 1,
        limit: 100,
        status: "PUBLIC",
        categoryId: categoryId ?? undefined,
        includeDescendants: Boolean(categoryId),
      }),
    enabled: Boolean(featuredConfig),
    staleTime: 60_000,
  });
  const products = useMemo(
    () => productsQuery.data?.data ?? [],
    [productsQuery.data],
  );
  const selectedCategory = categoriesQuery.data?.find(
    (category) => category.id === categoryId,
  );

  if (
    !settingsQuery.data ||
    (!productsQuery.isLoading && products.length === 0)
  ) {
    return null;
  }

  const title = featuredConfig?.title || "Meilleures ventes";
  const viewAllHref = selectedCategory?.slug
    ? `/${selectedCategory.slug}`
    : "/categorie-produit";

  function moveCarousel(direction: -1 | 1) {
    const track = trackRef.current;
    if (!track) return;
    track.scrollBy({
      left: direction * Math.max(track.clientWidth * 0.85, 280),
      behavior: "smooth",
    });
  }

  return (
    <section
      className="bg-[#f2f5fa] px-4 py-7 sm:px-6 lg:py-9"
      aria-labelledby="featured-products-title">
      <div className="mx-auto max-w-387.5!">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <h2
              id="featured-products-title"
              className="text-2xl! font-extrabold uppercase tracking-wide text-[#0a224f] sm:text-3xl!">
              {title}
            </h2>
            <div
              className="mt-2 flex h-1 w-16 overflow-hidden rounded-full"
              aria-hidden="true">
              <span className="w-1/2 bg-[#0a224f]" />
              <span className="w-1/2 bg-[#d6202e]" />
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href={viewAllHref}
              className="hidden min-h-11 items-center px-2 text-xs font-bold uppercase text-[#153675] hover:text-[#d6202e] sm:inline-flex">
              Voir tout{" "}
              <span className="ml-1" aria-hidden="true">
                →
              </span>
            </Link>
            <button
              type="button"
              onClick={() => moveCarousel(-1)}
              aria-label="Produits precedents"
              className="grid size-11 place-items-center rounded-full border border-[#d8e0ed] bg-white text-[#0a224f] transition hover:border-[#153675] hover:bg-[#153675] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#153675]">
              <ChevronLeft className="size-5" />
            </button>
            <button
              type="button"
              onClick={() => moveCarousel(1)}
              aria-label="Produits suivants"
              className="grid size-11 place-items-center rounded-full border border-[#d8e0ed] bg-white text-[#0a224f] transition hover:border-[#153675] hover:bg-[#153675] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#153675]">
              <ChevronRight className="size-5" />
            </button>
          </div>
        </div>

        <div
          ref={trackRef}
          className="flex snap-x snap-mandatory items-stretch gap-4 overflow-x-auto scroll-smooth pb-3 [scrollbar-width:thin]">
          {productsQuery.isLoading
            ? Array.from({ length: 6 }, (_, index) => (
                <div
                  key={index}
                  className="w-[78%] shrink-0 snap-start animate-pulse overflow-hidden rounded-2xl border border-border/60 bg-white sm:w-[calc((100%_-_1rem)_/_2)] lg:w-[calc((100%_-_3rem)_/_4)] xl:w-[calc((100%_-_5rem)_/_6)]">
                  <div className="aspect-square bg-slate-200" />
                  <div className="space-y-3 p-4">
                    <div className="h-4 w-4/5 rounded bg-slate-200" />
                    <div className="h-4 w-2/3 rounded bg-slate-200" />
                  </div>
                </div>
              ))
            : products.map((product) => (
                <div
                  key={product.id}
                  className="flex w-[78%] shrink-0 snap-start sm:w-[calc((100%_-_1rem)_/_2)] lg:w-[calc((100%_-_3rem)_/_4)] xl:w-[calc((100%_-_5rem)_/_6)]">
                  <ProductCard product={product} variant="featured" />
                </div>
              ))}
        </div>
        <Link
          href={viewAllHref}
          className="mt-2 inline-flex min-h-11 items-center text-xs font-bold uppercase text-[#153675] hover:text-[#d6202e] sm:hidden">
          Voir tout{" "}
          <span className="ml-1" aria-hidden="true">
            →
          </span>
        </Link>
      </div>
    </section>
  );
}
