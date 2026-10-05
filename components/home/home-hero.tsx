"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { getImageUrl } from "@/lib/api";
import { getCategories, type Category } from "@/lib/api/categories";
import { getPublicHeaderSettings } from "@/lib/api/header";
import { cn } from "@/lib/utils";

type CategoryNode = Category & { children: CategoryNode[] };

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function buildCategoryTree(categories: Category[]): CategoryNode[] {
  const nodes = new Map<string, CategoryNode>();
  categories.forEach((category) => nodes.set(category.id, { ...category, children: [] }));
  const roots: CategoryNode[] = [];
  categories.forEach((category) => {
    const node = nodes.get(category.id);
    if (!node) return;
    const parent = category.parentCategoryId ? nodes.get(category.parentCategoryId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  });
  return roots;
}

function flattenCategoryTree(categories: CategoryNode[]): CategoryNode[] {
  return categories.flatMap((category) => [category, ...flattenCategoryTree(category.children)]);
}

function getAudienceCategories(
  categories: CategoryNode[],
  audience: "professionnels" | "particuliers",
  selectedIds: string[] | null,
) {
  const names = audience === "professionnels"
    ? ["professionnel", "professionnels", "pro"]
    : ["particulier", "particuliers"];
  const audienceRoot = categories.find((category) =>
    names.includes(normalize(category.title.trim())) || names.includes(normalize(category.slug.trim())),
  );
  const source = audienceRoot?.children ?? categories;
  const allCategories = flattenCategoryTree(categories);
  const visible = selectedIds === null
    ? source
    : selectedIds.map((id) => allCategories.find((category) => category.id === id)).filter((category): category is CategoryNode => Boolean(category));
  return { audienceRoot, categories: visible };
}

export function HomeHero() {
  const [activeSlide, setActiveSlide] = useState(0);
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
  const config = settingsQuery.data?.heroConfig;
  const tree = useMemo(() => buildCategoryTree(categoriesQuery.data ?? []), [categoriesQuery.data]);
  const professionals = getAudienceCategories(tree, "professionnels", config?.professionalsCategoryIds ?? null);
  const individuals = getAudienceCategories(tree, "particuliers", config?.individualsCategoryIds ?? null);
  const slides = config?.slides ?? [];

  useEffect(() => {
    if (slides.length < 2) return;
    const timer = window.setInterval(() => setActiveSlide((current) => (current + 1) % slides.length), 6000);
    return () => window.clearInterval(timer);
  }, [slides.length]);

  useEffect(() => {
    if (activeSlide >= slides.length) setActiveSlide(0);
  }, [activeSlide, slides.length]);

  const moveSlide = (step: number) => {
    if (slides.length < 2) return;
    setActiveSlide((current) => (current + step + slides.length) % slides.length);
  };

  return (
    <section className="bg-[#f2f5fa] px-4 py-5 sm:px-6 lg:py-6" aria-label="Accueil et catégories">
      <div className="mx-auto grid max-w-[1550px] grid-cols-1 gap-4 lg:grid-cols-[minmax(230px,310px)_minmax(0,1fr)_minmax(230px,310px)] lg:gap-[18px]">
        <CategoryPanel
          title={professionals.audienceRoot?.title ?? "Professionnels"}
          href={professionals.audienceRoot ? `/${professionals.audienceRoot.slug}` : "/categorie-produit"}
          color="blue"
          categories={professionals.categories}
          className="order-2 lg:order-1"
          submenuSide="right"
          footer="Devis, financement & SAV dédiés aux professionnels."
        />

        <div className="relative order-1 aspect-[1046/657] w-full overflow-hidden rounded-xl bg-[#0a224f] shadow-sm lg:order-2">
          {slides.length > 0 ? (
            <>
              {slides.map((slide, index) => (
                <Link
                  key={slide.id}
                  href={slide.href || "/categorie-produit"}
                  aria-hidden={index !== activeSlide}
                  tabIndex={index === activeSlide ? 0 : -1}
                  className={cn("absolute inset-0 transition-opacity duration-500", index === activeSlide ? "opacity-100" : "pointer-events-none opacity-0")}>
                  <img width={1046} height={657} src={getImageUrl(slide.imageUrl)} alt={slide.altText || ""} className="h-full w-full object-cover" />
                </Link>
              ))}
              {slides.length > 1 ? (
                <>
                  <button type="button" onClick={() => moveSlide(-1)} aria-label="Image précédente" className="absolute left-3 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/70 bg-[#0a224f]/75 text-white shadow transition hover:bg-[#0a224f]">
                    <ChevronLeft className="size-5" />
                  </button>
                  <button type="button" onClick={() => moveSlide(1)} aria-label="Image suivante" className="absolute right-3 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/70 bg-[#0a224f]/75 text-white shadow transition hover:bg-[#0a224f]">
                    <ChevronRight className="size-5" />
                  </button>
                  <div className="absolute inset-x-0 bottom-4 flex justify-center gap-2" aria-label="Choisir une image">
                    {slides.map((slide, index) => (
                      <button key={slide.id} type="button" aria-label={`Afficher l’image ${index + 1}`} aria-current={index === activeSlide} onClick={() => setActiveSlide(index)} className={cn("h-2.5 w-2.5 rounded-full border border-white transition", index === activeSlide ? "w-7 bg-white" : "bg-white/50 hover:bg-white/80")} />
                    ))}
                  </div>
                </>
              ) : null}
            </>
          ) : (
            <div className="absolute inset-0 flex flex-col justify-end overflow-hidden bg-[linear-gradient(135deg,#0a224f_0%,#153675_58%,#d6202e_160%)] p-7 text-white sm:p-10">
              <div className="absolute -right-10 -top-16 size-64 rounded-full border-[36px] border-white/10" aria-hidden="true" />
              <p className="relative mb-3 text-xs font-bold uppercase tracking-[0.22em] text-white/75">France Général Machines à Coudre</p>
              <h1 className="relative max-w-xl text-3xl font-bold leading-tight sm:text-5xl">Votre partenaire industriel</h1>
              <p className="relative mt-4 max-w-lg text-sm text-white/80 sm:text-base">Réparation · Vente · Achat · Location</p>
              <Link href="/categorie-produit" className="relative mt-6 inline-flex min-h-11 w-fit items-center rounded-md bg-white px-5 text-sm font-bold text-[#0a224f] transition hover:bg-[#f0f4fa]">Découvrir nos produits</Link>
            </div>
          )}
        </div>

        <CategoryPanel
          title={individuals.audienceRoot?.title ?? "Particuliers"}
          href={individuals.audienceRoot ? `/${individuals.audienceRoot.slug}` : "/categorie-produit"}
          color="red"
          categories={individuals.categories}
          className="order-3 lg:order-3"
          submenuSide="left"
        />
      </div>
    </section>
  );
}

function CategoryPanel({
  title,
  href,
  color,
  categories,
  className,
  footer,
  submenuSide,
}: {
  title: string;
  href: string;
  color: "blue" | "red";
  categories: CategoryNode[];
  className?: string;
  footer?: string;
  submenuSide: "left" | "right";
}) {
  return (
    <aside className={cn("relative z-20 h-fit self-start rounded-xl border border-[#dce3ec] bg-white shadow-sm hover:z-50 focus-within:z-50 lg:sticky lg:top-[180px]", className)} aria-label={title}>
      <h2 className={cn("overflow-hidden rounded-t-xl", color === "blue" ? "bg-[#153675]" : "bg-[#d6202e]")}>
        <Link href={href} className="flex min-h-[52px] items-center justify-between px-4 text-base font-bold uppercase tracking-wide text-white transition-colors hover:bg-black/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
          {title}<ChevronRight className="size-4" aria-hidden="true" />
        </Link>
      </h2>
      <ul className="divide-y divide-[#e8edf3]" aria-label={`${title} categories`}>
        {categories.map((category) => (
          <li key={category.id} className="group relative">
            <Link href={`/${category.slug}`} aria-haspopup={category.children.length > 0 ? "true" : undefined} className="flex min-h-[39px] items-center justify-between gap-2 px-4 py-2 text-[13px] text-[#12264b] transition-colors hover:bg-[#f2f6fc] hover:text-[#2456b1] focus-visible:bg-[#f2f6fc] focus-visible:text-[#2456b1] focus-visible:outline-none">
              <span>{category.title}</span>
              {category.children.length > 0 ? <ChevronRight className="size-3 shrink-0 text-[#687b98]" aria-hidden="true" /> : null}
            </Link>
            {category.children.length > 0 ? (
              <ul
                aria-label={`${category.title} sous-catégories`}
                className={cn(
                  "invisible absolute top-0 z-50 max-h-[420px] w-64 overflow-y-auto rounded-lg border border-[#dce3ec] bg-white py-2 opacity-0 shadow-xl transition-opacity group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100",
                  submenuSide === "right" ? "left-full" : "right-full",
                )}>
                <li className="px-4 py-2 text-xs font-bold uppercase text-[#929db0]">{category.title}</li>
                {category.children.map((child) => (
                  <li key={child.id}>
                    <Link href={`/${child.slug}`} className="block px-4 py-2 text-[13px] text-[#12264b] transition-colors hover:bg-[#f2f6fc] hover:text-[#2456b1] focus-visible:bg-[#f2f6fc] focus-visible:text-[#2456b1] focus-visible:outline-none">
                      {child.title}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ul>
      {footer ? <p className="border-t border-[#e8edf3] bg-[#f6f8fc] px-4 py-3 text-xs leading-relaxed text-[#63748f]">{footer}</p> : null}
    </aside>
  );
}
