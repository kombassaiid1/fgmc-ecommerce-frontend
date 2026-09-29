"use client";

import { useMemo, useRef } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Package } from "lucide-react";

import { getImageUrl } from "@/lib/api";
import { getCategories } from "@/lib/api/categories";
import { getPublicHeaderSettings } from "@/lib/api/header";
import { getDefaultPopularCategoryIds } from "@/lib/popular-category-defaults";

export function PopularCategories() {
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
  const allCategories = categoriesQuery.data ?? [];
  const categoryIds =
    settingsQuery.data?.heroConfig.popularCategories.categoryIds;
  const categories = useMemo(() => {
    const visibleIds =
      categoryIds ?? getDefaultPopularCategoryIds(allCategories);
    return visibleIds
      .map((id) => allCategories.find((category) => category.id === id))
      .filter((category): category is NonNullable<typeof category> =>
        Boolean(category),
      );
  }, [allCategories, categoryIds]);

  if (!settingsQuery.data || !categoriesQuery.data || categories.length === 0)
    return null;
  const title = settingsQuery.data.heroConfig.popularCategories.title;

  function move(direction: -1 | 1) {
    trackRef.current?.scrollBy({ left: direction * 340, behavior: "smooth" });
  }

  return (
    <section
      className="bg-white px-4 py-7 sm:px-6 lg:py-8"
      aria-labelledby="popular-categories-title">
      <div className="mx-auto max-w-[1450px]">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2
            id="popular-categories-title"
            className="text-[20px]! leading-tight font-bold tracking-tight text-[#172033] sm:text-[24px]!">
            {title}
          </h2>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/categorie-produit"
              className="hidden min-h-10 items-center px-2 text-xs font-semibold text-[#2456b1] hover:text-[#d6202e] sm:inline-flex">
              Voir tout{" "}
              <span className="ml-1" aria-hidden="true">
                →
              </span>
            </Link>
            <button
              type="button"
              onClick={() => move(-1)}
              aria-label="Catégories précédentes"
              className="grid size-10 place-items-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:border-[#153675] hover:text-[#153675] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#153675]">
              <ChevronLeft className="size-5" />
            </button>
            <button
              type="button"
              onClick={() => move(1)}
              aria-label="Catégories suivantes"
              className="grid size-10 place-items-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:border-[#153675] hover:text-[#153675] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#153675]">
              <ChevronRight className="size-5" />
            </button>
          </div>
        </div>

        <div
          ref={trackRef}
          className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-4">
          {categories.map((category) => (
            <Link
              key={category.id}
              href={`/${category.slug}`}
              className="group flex w-[104px] shrink-0 snap-start flex-col items-center gap-2 text-center focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#153675] sm:w-[124px]">
              <span className="relative grid size-[92px] place-items-center overflow-hidden rounded-full bg-[#f1f4f8] ring-1 ring-slate-100 transition duration-200 group-hover:-translate-y-0.5 group-hover:shadow-md sm:size-[112px]">
                {category.image ? (
                  <>
                    <Package
                      className="size-7 text-slate-300"
                      aria-hidden="true"
                    />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={getImageUrl(category.image)}
                      alt=""
                      loading="lazy"
                      className="absolute inset-0 size-full object-cover"
                      onError={(event) => {
                        event.currentTarget.style.display = "none";
                      }}
                    />
                  </>
                ) : (
                  <Package
                    className="size-8 text-[#153675]/50"
                    aria-hidden="true"
                  />
                )}
              </span>
              <span className="line-clamp-2 min-h-8 text-xs font-semibold text-[#172033] transition-colors group-hover:text-[#2456b1] sm:text-sm">
                {category.title}
              </span>
            </Link>
          ))}
        </div>
        <Link
          href="/categorie-produit"
          className="mt-2 inline-flex min-h-10 items-center text-xs font-semibold text-[#2456b1] hover:text-[#d6202e] sm:hidden">
          Voir tout{" "}
          <span className="ml-1" aria-hidden="true">
            →
          </span>
        </Link>
      </div>
    </section>
  );
}
