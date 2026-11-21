"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronRight,
  Filter,
  LayoutGrid,
  List,
  Search,
  X,
} from "lucide-react";

import { ProductCard } from "@/components/product-card";
import { getImageUrl } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import {
  fetchBrandCatalogFilters,
  fetchBrandCatalogProducts,
} from "@/lib/brand-catalog-api";
import type {
  CategoryFilterAttribute,
  CategoryFilterSubcategory,
  CategoryFilterTerm,
} from "@/lib/category-catalog-api";
import { useDebounce } from "@/hooks/use-debounce";

const ITEMS_PER_PAGE = 12;
const SORT_OPTIONS = [
  { value: "newest", label: "Plus récent" },
  { value: "oldest", label: "Plus ancien" },
  { value: "price-low", label: "Prix croissant" },
  { value: "price-high", label: "Prix décroissant" },
  { value: "name-asc", label: "Nom A-Z" },
  { value: "name-desc", label: "Nom Z-A" },
] as const;

const URL_KEYS = {
  page: "page",
  sort: "sort",
  search: "q",
  categories: "cat",
  minPrice: "min_price",
  maxPrice: "max_price",
  attrPrefix: "attr_",
} as const;

function parseFilters(searchParams: Readonly<URLSearchParams>) {
  const sortRaw = searchParams.get(URL_KEYS.sort);
  const attributes = new Map<string, Set<string>>();
  searchParams.forEach((value, key) => {
    if (!key.startsWith(URL_KEYS.attrPrefix)) return;
    const attrSlug = key.slice(URL_KEYS.attrPrefix.length);
    const terms = new Set(value.split(",").filter(Boolean));
    if (attrSlug && terms.size) attributes.set(attrSlug, terms);
  });

  const minPriceParam = searchParams.get(URL_KEYS.minPrice);
  const maxPriceParam = searchParams.get(URL_KEYS.maxPrice);
  const minPrice = minPriceParam != null ? parseFloat(minPriceParam) : null;
  const maxPrice = maxPriceParam != null ? parseFloat(maxPriceParam) : null;

  return {
    page: Math.max(1, parseInt(searchParams.get(URL_KEYS.page) ?? "1", 10) || 1),
    sort: SORT_OPTIONS.some((o) => o.value === sortRaw) ? sortRaw! : "newest",
    search: searchParams.get(URL_KEYS.search)?.trim() ?? "",
    categories: new Set(
      (searchParams.get(URL_KEYS.categories) ?? "").split(",").filter(Boolean),
    ),
    attributes,
    minPrice: minPrice != null && Number.isFinite(minPrice) ? minPrice : null,
    maxPrice: maxPrice != null && Number.isFinite(maxPrice) ? maxPrice : null,
    priceFilterActive:
      minPriceParam != null &&
      maxPriceParam != null &&
      Number.isFinite(minPrice) &&
      Number.isFinite(maxPrice),
  };
}

function buildSearchParams(params: {
  page: number;
  sort: string;
  search: string;
  categories: Set<string>;
  attributes: Map<string, Set<string>>;
  appliedPriceRange: number[];
  priceFilterActive: boolean;
}) {
  const next = new URLSearchParams();
  if (params.page > 1) next.set(URL_KEYS.page, String(params.page));
  if (params.sort !== "newest") next.set(URL_KEYS.sort, params.sort);
  if (params.search.trim()) next.set(URL_KEYS.search, params.search.trim());
  if (params.categories.size) {
    next.set(URL_KEYS.categories, Array.from(params.categories).sort().join(","));
  }
  if (params.priceFilterActive) {
    next.set(URL_KEYS.minPrice, String(params.appliedPriceRange[0]));
    next.set(URL_KEYS.maxPrice, String(params.appliedPriceRange[1]));
  }
  params.attributes.forEach((terms, attrSlug) => {
    if (terms.size) {
      next.set(
        `${URL_KEYS.attrPrefix}${attrSlug}`,
        Array.from(terms).sort().join(","),
      );
    }
  });
  return next;
}

export function BrandPageClient({ slug }: { slug: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const prevSortRef = useRef<string | null>(null);
  const prevSearchRef = useRef<string | null>(null);

  const [grid, setGrid] = useState(true);
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(
    new Set(),
  );
  const [selectedAttributes, setSelectedAttributes] = useState<
    Map<string, Set<string>>
  >(new Map());
  const [minPrice, setMinPrice] = useState(0);
  const [maxPrice, setMaxPrice] = useState(1000);
  const [selectedPriceRange, setSelectedPriceRange] = useState<number[]>([
    0, 1000,
  ]);
  const [appliedPriceRange, setAppliedPriceRange] = useState<number[]>([
    0, 1000,
  ]);
  const [priceFilterActive, setPriceFilterActive] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState("newest");
  const [searchQuery, setSearchQuery] = useState("");
  const [hasInitializedFromUrl, setHasInitializedFromUrl] = useState(false);

  const debouncedSearch = useDebounce(searchQuery, 500);

  const filtersQuery = useQuery({
    queryKey: ["brand-catalog-filters", slug],
    queryFn: () => fetchBrandCatalogFilters(slug),
    enabled: !!slug?.trim(),
    staleTime: 5 * 60 * 1000,
  });
  const filterData = filtersQuery.data ?? null;
  const categories = filterData?.categories ?? [];
  const attributes = filterData?.attributes ?? [];
  const brandTitle =
    filterData?.brands.find((brand) => brand.slug === slug)?.title ?? slug;

  const productsQuery = useQuery({
    queryKey: [
      "brand-catalog-products",
      slug,
      currentPage,
      sortBy,
      debouncedSearch,
      Array.from(selectedCategories).sort(),
      priceFilterActive ? appliedPriceRange : null,
      Array.from(selectedAttributes.entries()).map(([k, v]) => [
        k,
        Array.from(v).sort(),
      ]),
    ],
    queryFn: () =>
      fetchBrandCatalogProducts({
        brand: slug,
        page: currentPage,
        limit: ITEMS_PER_PAGE,
        categories:
          selectedCategories.size > 0 ? Array.from(selectedCategories) : undefined,
        ...(priceFilterActive
          ? { minPrice: appliedPriceRange[0], maxPrice: appliedPriceRange[1] }
          : {}),
        attributeFilters:
          selectedAttributes.size > 0
            ? Object.fromEntries(
                Array.from(selectedAttributes.entries()).map(([k, v]) => [
                  k,
                  Array.from(v),
                ]),
              )
            : undefined,
        search: debouncedSearch || undefined,
        sortBy,
      }),
    enabled: hasInitializedFromUrl && !!slug?.trim(),
    staleTime: 60 * 1000,
  });

  useEffect(() => {
    if (!filterData) return;
    const { min, max } = filterData.priceRange;
    queueMicrotask(() => {
      setMinPrice(min);
      setMaxPrice(max);
      if (!priceFilterActive) {
        setSelectedPriceRange([min, max]);
        setAppliedPriceRange([min, max]);
      }
    });
  }, [filterData, priceFilterActive]);

  useEffect(() => {
    const parsed = parseFilters(searchParams);
    prevSortRef.current = parsed.sort;
    prevSearchRef.current = parsed.search;
    queueMicrotask(() => {
      setCurrentPage(parsed.page);
      setSortBy(parsed.sort);
      setSearchQuery(parsed.search);
      setSelectedCategories(parsed.categories);
      setSelectedAttributes(parsed.attributes);
      if (
        parsed.priceFilterActive &&
        parsed.minPrice != null &&
        parsed.maxPrice != null
      ) {
        setAppliedPriceRange([parsed.minPrice, parsed.maxPrice]);
        setSelectedPriceRange([parsed.minPrice, parsed.maxPrice]);
        setPriceFilterActive(true);
      } else {
        setPriceFilterActive(false);
      }
      setHasInitializedFromUrl(true);
    });
  }, [searchParams]);

  useEffect(() => {
    if (!hasInitializedFromUrl) return;
    if (
      prevSortRef.current === sortBy &&
      prevSearchRef.current === debouncedSearch
    ) {
      return;
    }
    prevSortRef.current = sortBy;
    prevSearchRef.current = debouncedSearch;
    queueMicrotask(() => setCurrentPage(1));
  }, [hasInitializedFromUrl, sortBy, debouncedSearch]);

  useEffect(() => {
    if (!hasInitializedFromUrl) return;
    const next = buildSearchParams({
      page: currentPage,
      sort: sortBy,
      search: debouncedSearch,
      categories: selectedCategories,
      attributes: selectedAttributes,
      appliedPriceRange,
      priceFilterActive,
    });
    const nextStr = next.toString();
    if (nextStr === searchParams.toString()) return;
    router.replace(nextStr ? `${pathname}?${nextStr}` : pathname, {
      scroll: false,
    });
  }, [
    hasInitializedFromUrl,
    pathname,
    router,
    searchParams,
    currentPage,
    sortBy,
    debouncedSearch,
    selectedCategories,
    selectedAttributes,
    appliedPriceRange,
    priceFilterActive,
  ]);

  const products = productsQuery.data?.products ?? [];
  const totalCount = productsQuery.data?.totalCount ?? 0;
  const totalPages = productsQuery.data?.totalPages ?? 0;
  const loadingFilters = filtersQuery.isLoading;
  const loadingProducts = productsQuery.isFetching;
  const activeFilterCount =
    selectedCategories.size +
    (priceFilterActive ? 1 : 0) +
    Array.from(selectedAttributes.values()).reduce((sum, terms) => sum + terms.size, 0);

  const handleCategoryFilter = (categorySlug: string, checked: boolean) => {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (checked) next.add(categorySlug);
      else next.delete(categorySlug);
      return next;
    });
    setCurrentPage(1);
  };

  const handleAttributeFilter = (
    attrSlug: string,
    termSlug: string,
    checked: boolean,
  ) => {
    setSelectedAttributes((prev) => {
      const next = new Map(prev);
      const terms = next.get(attrSlug) ?? new Set<string>();
      if (checked) terms.add(termSlug);
      else terms.delete(termSlug);
      if (terms.size) next.set(attrSlug, terms);
      else next.delete(attrSlug);
      return next;
    });
    setCurrentPage(1);
  };

  const applyPriceFilter = () => {
    setAppliedPriceRange(selectedPriceRange);
    setPriceFilterActive(true);
    setCurrentPage(1);
  };

  const resetFilters = () => {
    setSelectedCategories(new Set());
    setSelectedAttributes(new Map());
    setPriceFilterActive(false);
    setSelectedPriceRange([minPrice, maxPrice]);
    setAppliedPriceRange([minPrice, maxPrice]);
    setCurrentPage(1);
  };

  const removeFilter = (
    type: "category" | "price" | "attribute",
    value?: string,
    attrSlug?: string,
  ) => {
    if (type === "category" && value) handleCategoryFilter(value, false);
    if (type === "price") {
      setPriceFilterActive(false);
      setSelectedPriceRange([minPrice, maxPrice]);
      setAppliedPriceRange([minPrice, maxPrice]);
      setCurrentPage(1);
    }
    if (type === "attribute" && value && attrSlug) {
      handleAttributeFilter(attrSlug, value, false);
    }
  };

  const renderActiveFilters = () => {
    const items: React.ReactNode[] = [];
    selectedCategories.forEach((categorySlug) => {
      const category = categories.find((item) => item.slug === categorySlug);
      if (!category) return;
      items.push(
        <Badge key={categorySlug} variant="secondary" className="gap-1 pr-1 text-xs font-normal">
          <span className="max-w-[100px] truncate">{category.title}</span>
          <button type="button" onClick={() => removeFilter("category", categorySlug)} className="rounded p-0.5 hover:bg-muted-foreground/20">
            <X className="size-3" />
          </button>
        </Badge>,
      );
    });
    if (priceFilterActive) {
      items.push(
        <Badge key="price" variant="secondary" className="gap-1 pr-1 text-xs font-normal">
          <span className="max-w-[120px] truncate">
            Prix: {appliedPriceRange[0]}–{appliedPriceRange[1]} €
          </span>
          <button type="button" onClick={() => removeFilter("price")} className="rounded p-0.5 hover:bg-muted-foreground/20">
            <X className="size-3" />
          </button>
        </Badge>,
      );
    }
    selectedAttributes.forEach((terms, attrSlug) => {
      const attr = attributes.find((item) => item.slug === attrSlug);
      if (!attr) return;
      terms.forEach((termSlug) => {
        const term = attr.terms.find((item) => item.slug === termSlug);
        if (!term) return;
        items.push(
          <Badge key={`${attrSlug}-${termSlug}`} variant="secondary" className="gap-1 pr-1 text-xs font-normal">
            <span className="max-w-[100px] truncate">
              {attr.name}: {term.name}
            </span>
            <button type="button" onClick={() => removeFilter("attribute", termSlug, attrSlug)} className="rounded p-0.5 hover:bg-muted-foreground/20">
              <X className="size-3" />
            </button>
          </Badge>,
        );
      });
    });
    return items;
  };

  /* ------------------------------------------------------------------ */
  /* Filters: one panel, shared by the desktop sidebar and the phone sheet */
  /* ------------------------------------------------------------------ */

  const filterSectionTitle = (label: string, count: number) => (
    <span className="flex items-center gap-2">
      {label}
      {count > 0 && (
        <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[var(--cat-royal)] px-1.5 text-xs font-semibold text-white">
          {count}
        </span>
      )}
    </span>
  );

  const filterOptionList = (
    idPrefix: string,
    options: {
      key: string;
      label: string;
      checked: boolean;
      onChange: (checked: boolean) => void;
    }[],
    emptyLabel: string,
  ) =>
    options.length === 0 ? (
      <p className="text-sm text-[var(--cat-muted)]">{emptyLabel}</p>
    ) : (
      <ul className="-mx-2 max-h-64 overflow-y-auto pr-1 [scrollbar-width:thin]">
        {options.map((option) => (
          <li key={option.key}>
            <label
              className={cn(
                "flex min-h-10 cursor-pointer items-center gap-3 rounded px-2 py-1.5 text-[15px] transition-colors duration-150 hover:bg-[var(--cat-linen)]",
                option.checked && "font-medium text-[var(--cat-royal)]",
              )}>
              <Checkbox
                id={`${idPrefix}-${option.key}`}
                checked={option.checked}
                onCheckedChange={(c) => option.onChange(c === true)}
              />
              <span>{option.label}</span>
            </label>
          </li>
        ))}
      </ul>
    );

  const filterPriceInput = (id: string, label: string, index: 0 | 1) => (
    <div className="relative flex-1">
      <Label htmlFor={id} className="sr-only">
        {label}
      </Label>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min={minPrice}
        max={maxPrice}
        value={selectedPriceRange[index]}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (!Number.isFinite(n)) return;
          setSelectedPriceRange(
            index === 0
              ? [n, selectedPriceRange[1]]
              : [selectedPriceRange[0], n],
          );
        }}
        onBlur={() => {
          const [a, b] = selectedPriceRange;
          setSelectedPriceRange([
            Math.max(minPrice, Math.min(a, b)),
            Math.min(maxPrice, Math.max(a, b)),
          ]);
        }}
        className="h-10 rounded-[4px] border-[var(--cat-line)] pr-8 text-base tabular-nums"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[var(--cat-muted)]">
        €
      </span>
    </div>
  );

  const filterTriggerClass =
    "py-4 text-base font-medium text-[var(--cat-ink)] hover:no-underline";
  const filterItemClass =
    "border-0 border-b border-dashed border-[var(--cat-seam)] last:border-b-0";

  const renderFilterPanel = (idp: string, openSections: string[]) => (
    <div className="space-y-2">
      <div className="relative">
        <Label htmlFor={`${idp}-search`} className="sr-only">
          Rechercher dans cette marque
        </Label>
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--cat-muted)]"
          aria-hidden
        />
        <Input
          id={`${idp}-search`}
          placeholder="Rechercher dans cette marque"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-11 rounded-[4px] border-[var(--cat-line)] bg-[var(--cat-linen)] pl-9 pr-9 text-[15px]"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            aria-label="Effacer la recherche"
            className="absolute right-1 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded text-[var(--cat-muted)] hover:text-[var(--cat-ink)] focus-visible:outline focus-visible:outline-2">
            <X className="size-4" aria-hidden />
          </button>
        )}
      </div>

      {loadingFilters ? (
        <div className="space-y-3 pt-4" role="status" aria-label="Chargement des filtres">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-10 animate-pulse rounded bg-[var(--cat-linen)] motion-reduce:animate-none"
            />
          ))}
        </div>
      ) : (
        <Accordion type="multiple" defaultValue={openSections}>
          <AccordionItem value="categories" className={filterItemClass}>
            <AccordionTrigger className={filterTriggerClass}>
              {filterSectionTitle("Catégories", selectedCategories.size)}
            </AccordionTrigger>
            <AccordionContent className="pb-4 pt-0">
              {filterOptionList(
                `${idp}-cat`,
                categories.map((category: CategoryFilterSubcategory) => ({
                  key: category.slug,
                  label: category.title,
                  checked: selectedCategories.has(category.slug),
                  onChange: (c) => handleCategoryFilter(category.slug, c),
                })),
                "Aucune catégorie",
              )}
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="price" className={filterItemClass}>
            <AccordionTrigger className={filterTriggerClass}>
              {filterSectionTitle("Prix", priceFilterActive ? 1 : 0)}
            </AccordionTrigger>
            <AccordionContent className="pb-4 pt-0">
              <div className="space-y-4 px-1">
                <Slider
                  className="w-full"
                  min={minPrice}
                  max={maxPrice}
                  step={1}
                  value={selectedPriceRange}
                  onValueChange={setSelectedPriceRange}
                  aria-label="Fourchette de prix"
                />
                <div className="flex items-center gap-2">
                  {filterPriceInput(`${idp}-price-min`, "Prix minimum", 0)}
                  <span aria-hidden className="text-[var(--cat-muted)]">
                    –
                  </span>
                  {filterPriceInput(`${idp}-price-max`, "Prix maximum", 1)}
                </div>
                <div className="flex gap-2">
                  <Button
                    className="h-10 flex-1 rounded-[4px] bg-[var(--cat-royal)] text-white hover:bg-[var(--cat-ink)]"
                    onClick={applyPriceFilter}>
                    Appliquer le prix
                  </Button>
                  {priceFilterActive && (
                    <Button
                      variant="outline"
                      className="h-10 rounded-[4px]"
                      onClick={() => removeFilter("price")}>
                      Réinitialiser
                    </Button>
                  )}
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {attributes.map((attr: CategoryFilterAttribute) => (
            <AccordionItem
              key={attr.id}
              value={attr.slug}
              className={filterItemClass}>
              <AccordionTrigger className={filterTriggerClass}>
                {filterSectionTitle(
                  attr.name,
                  selectedAttributes.get(attr.slug)?.size ?? 0,
                )}
              </AccordionTrigger>
              <AccordionContent className="pb-4 pt-0">
                {filterOptionList(
                  `${idp}-${attr.slug}`,
                  attr.terms.map((t: CategoryFilterTerm) => ({
                    key: t.slug,
                    label: t.name,
                    checked:
                      selectedAttributes.get(attr.slug)?.has(t.slug) ?? false,
                    onChange: (c) => handleAttributeFilter(attr.slug, t.slug, c),
                  })),
                  "Aucune option",
                )}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  );

  const brandLogo = filterData?.brands.find((brand) => brand.slug === slug)?.image?.trim();

  return (
    <main
      className="min-h-screen bg-[var(--cat-linen)]"
      style={
        {
          "--cat-ink": "#0f1f45",
          "--cat-royal": "#153675",
          "--cat-thread": "#d6202e",
          "--cat-linen": "#f2f5fa",
          "--cat-seam": "#b4c2dc",
          "--cat-line": "#d5deee",
          "--cat-muted": "#5b6b8a",
        } as React.CSSProperties
      }>
      {/* Same tailor's tape as the category pages: the product count is pinned to it. */}
      <header className="relative bg-[var(--cat-ink)] text-white">
        <div className="container mx-auto flex max-w-450 items-end justify-between gap-6 px-4 pb-20 pt-6 sm:px-6 lg:px-8 lg:pb-24">
          <div className="min-w-0">
            <nav aria-label="Breadcrumb">
              <ol className="flex flex-wrap items-center gap-1.5 text-sm text-white/70">
                <li>
                  <Link
                    href="/"
                    className="-mx-1 rounded px-1 transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
                    Accueil
                  </Link>
                </li>
                <li aria-hidden className="flex items-center gap-1">
                  <ChevronRight className="size-3.5 shrink-0" />
                </li>
                <li>Marques</li>
                <li aria-hidden className="flex items-center gap-1">
                  <ChevronRight className="size-3.5 shrink-0" />
                </li>
                <li aria-current="page" className="font-medium text-white">
                  {brandTitle}
                </li>
              </ol>
            </nav>
            <h1 className="mt-8 max-w-5xl text-5xl! font-semibold! leading-[0.95]! tracking-tight text-balance sm:text-6xl! lg:text-7xl!">
              {brandTitle}
            </h1>
          </div>
          {/* The brand's logo, on a white label like the ones sewn into garments. */}
          {brandLogo ? (
            <span className="hidden h-24 w-44 shrink-0 place-items-center rounded-[4px] bg-white p-3 sm:grid lg:h-28 lg:w-52">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={getImageUrl(brandLogo)} alt={`Logo ${brandTitle}`} className="max-h-full max-w-full object-contain" />
            </span>
          ) : null}
        </div>

        <div className="cat-tape absolute inset-x-0 bottom-0" aria-hidden="true" />
        <p className="absolute bottom-2.5 left-4 rounded-[3px] bg-[var(--cat-thread)] px-3 py-1 text-sm font-medium tabular-nums text-white shadow-[0_2px_0_rgba(15,31,69,0.35)] sm:left-6 lg:left-8">
          {loadingProducts
            ? "Chargement"
            : `${totalCount} produit${totalCount !== 1 ? "s" : ""}`}
        </p>
      </header>

      <div className="container mx-auto max-w-450 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:w-full">
          <aside className="hidden w-72 shrink-0 lg:block xl:w-80">
            <div className="sticky top-6 rounded-[4px] border border-[var(--cat-line)] bg-white p-5">
              <div className="flex items-center gap-2 border-b border-dashed border-[var(--cat-seam)] pb-4">
                <Filter className="size-4 text-[var(--cat-royal)]" aria-hidden />
                <h2 className="text-xl! font-semibold! text-[var(--cat-ink)]">Filtres</h2>
                {activeFilterCount > 0 && (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="ml-auto rounded px-1 text-sm font-medium text-[var(--cat-royal)] underline underline-offset-4 hover:text-[var(--cat-ink)] focus-visible:outline focus-visible:outline-2">
                    Tout effacer
                  </button>
                )}
              </div>

              {activeFilterCount > 0 && (
                <div className="flex flex-wrap gap-1.5 border-b border-dashed border-[var(--cat-seam)] py-4">
                  {renderActiveFilters()}
                </div>
              )}

              <div className="pt-4">{renderFilterPanel("d", ["categories", "price"])}</div>
            </div>
          </aside>

          <div className="min-w-0 flex-1 space-y-4 w-full">
            <div className="flex flex-col gap-4 border-b border-dashed border-[var(--cat-seam)] pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-base text-[var(--cat-muted)]" aria-live="polite">
                  {loadingProducts
                    ? "Chargement…"
                    : `${totalCount} produit${totalCount !== 1 ? "s" : ""} de cette marque`}
                </p>

                <Sheet>
                  <SheetTrigger asChild>
                    <button
                      type="button"
                      className="fixed left-0 top-1/2 z-40 -translate-y-1/2 flex flex-col items-center gap-1.5 bg-[var(--cat-royal)] px-1.5 py-3 text-white shadow-lg lg:hidden">
                      <Filter className="size-4" />
                      <span className="text-[11px] font-medium tracking-widest [writing-mode:vertical-lr]">
                        Filtrer
                      </span>
                      {activeFilterCount > 0 && (
                        <span className="flex size-5 items-center justify-center rounded-full bg-white text-[10px] font-bold text-black">
                          {activeFilterCount}
                        </span>
                      )}
                    </button>
                  </SheetTrigger>
                  <SheetContent
                    side="left"
                    className="w-full max-w-[400px] overflow-y-auto bg-white p-0"
                    onOpenAutoFocus={(e) => e.preventDefault()}>
                    <div className="sticky top-0 z-10 border-b border-border/60 bg-white px-4 py-4 shadow-sm">
                      <div className="flex items-center gap-2">
                        <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
                          <Filter className="text-primary size-4" />
                        </div>
                        <span className="text-base font-semibold">Filtres</span>
                        {activeFilterCount > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            {activeFilterCount}
                          </Badge>
                        )}
                        <SheetClose className="ml-auto flex size-8 items-center justify-center rounded-full hover:bg-muted">
                          <X className="size-4" />
                          <span className="sr-only">Fermer</span>
                        </SheetClose>
                      </div>
                      {activeFilterCount > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {renderActiveFilters()}
                        </div>
                      )}
                    </div>
                    <div className="px-4 pb-4 pt-4">
                      {renderFilterPanel("m", ["price"])}
                    </div>
                    <div className="sticky bottom-0 flex gap-3 border-t border-[var(--cat-line)] bg-white p-4">
                      {activeFilterCount > 0 && (
                        <Button
                          variant="outline"
                          className="h-12 rounded-[4px]"
                          onClick={resetFilters}>
                          Tout effacer
                        </Button>
                      )}
                      <SheetClose asChild>
                        <Button className="h-12 flex-1 rounded-[4px] bg-[var(--cat-royal)] text-base text-white hover:bg-[var(--cat-ink)]">
                          {loadingProducts
                            ? "Voir les produits"
                            : `Voir ${totalCount} produit${totalCount !== 1 ? "s" : ""}`}
                        </Button>
                      </SheetClose>
                    </div>
                  </SheetContent>
                </Sheet>
              </div>

              <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto">
                <div className="flex flex-1 items-center gap-2 sm:flex-none">
                  <span className="text-muted-foreground text-xs font-medium sm:text-sm">
                    Trier
                  </span>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="h-9 flex-1 rounded-lg border-border/80 text-sm sm:w-[200px] sm:flex-none">
                      <SelectValue placeholder="Trier par" />
                    </SelectTrigger>
                    <SelectContent>
                      {SORT_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div
                  className="flex rounded-lg border border-border/80 p-0.5"
                  role="group"
                  aria-label="Vue des produits">
                  <Button
                    size="sm"
                    variant={grid ? "secondary" : "ghost"}
                    className="h-8 w-8 rounded-md p-0"
                    onClick={() => setGrid(true)}
                    aria-pressed={grid}
                    aria-label="Vue grille">
                    <LayoutGrid className="size-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant={!grid ? "secondary" : "ghost"}
                    className="h-8 w-8 rounded-md p-0"
                    onClick={() => setGrid(false)}
                    aria-pressed={!grid}
                    aria-label="Vue liste">
                    <List className="size-4" />
                  </Button>
                </div>
              </div>
            </div>

            {activeFilterCount > 0 && (
              <div className="flex flex-wrap items-center gap-2 rounded-[4px] border border-[var(--cat-line)] bg-white px-4 py-3">
                <span className="text-muted-foreground text-xs font-medium">
                  Filtres actifs
                </span>
                {renderActiveFilters()}
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto h-7 rounded-md px-2 text-xs text-muted-foreground hover:text-foreground"
                  onClick={resetFilters}>
                  Tout effacer
                </Button>
              </div>
            )}

            <div>
              {loadingProducts ? (
                <div
                  className="grid w-full grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 lg:gap-5 xl:grid-cols-4 xl:gap-6 2xl:grid-cols-5"
                  role="status"
                  aria-label="Chargement des produits">
                  {Array.from({ length: 10 }, (_, i) => (
                    <div
                      key={i}
                      className="h-[430px] animate-pulse rounded-[4px] border border-[var(--cat-line)] bg-white motion-reduce:animate-none"
                    />
                  ))}
                </div>
              ) : products.length === 0 ? (
                <div className="flex min-h-[320px] flex-col items-center justify-center py-16 text-center">
                  <h3 className="text-2xl! font-semibold! text-[var(--cat-ink)]">
                    Aucun produit trouvé
                  </h3>
                  <p className="text-muted-foreground mt-1 max-w-sm text-sm">
                    Aucun produit de cette marque ne correspond à vos critères. Essayez d’ajuster les filtres.
                  </p>
                  {activeFilterCount > 0 && (
                    <Button
                      variant="outline"
                      className="mt-6 rounded-lg"
                      onClick={resetFilters}>
                      Effacer tous les filtres
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  <div className={grid ? "grid w-full grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 lg:gap-5 xl:grid-cols-4 xl:gap-6 2xl:grid-cols-5" : "flex w-full flex-col gap-4"}>
                    {products.map((product) => (
                      <div key={product.id} className={grid ? "" : "w-full"}>
                        <ProductCard product={product} variant={grid ? "grid" : "list"} />
                      </div>
                    ))}
                  </div>

                  {totalPages > 1 && (
                    <div className="mt-8 border-t border-dashed border-[var(--cat-seam)] pt-6">
                      <div className="flex flex-col items-center gap-4">
                        <p className="text-muted-foreground text-xs sm:text-sm">
                          Page {currentPage} sur {totalPages} · {totalCount} produit{totalCount !== 1 ? "s" : ""}
                        </p>
                        <Pagination>
                          <PaginationContent className="gap-1">
                            <PaginationItem>
                              <PaginationPrevious
                                href="#"
                                onClick={(e) => {
                                  e.preventDefault();
                                  if (currentPage > 1) {
                                    setCurrentPage(currentPage - 1);
                                    window.scrollTo({ top: 0, behavior: "smooth" });
                                  }
                                }}
                                className={currentPage <= 1 ? "pointer-events-none opacity-50" : "rounded-lg border-border/80"}
                              />
                            </PaginationItem>
                            {Array.from({ length: totalPages }, (_, index) => index + 1)
                              .filter(
                                (page) =>
                                  page === 1 ||
                                  page === totalPages ||
                                  (page >= currentPage - 2 && page <= currentPage + 2),
                              )
                              .map((page, index, pages) => (
                                <PaginationItem key={page}>
                                  {index > 0 && pages[index - 1] !== page - 1 && (
                                    <span className="px-1 text-muted-foreground">…</span>
                                  )}
                                  <PaginationLink
                                    href="#"
                                    isActive={page === currentPage}
                                    onClick={(e) => {
                                      e.preventDefault();
                                      setCurrentPage(page);
                                      window.scrollTo({ top: 0, behavior: "smooth" });
                                    }}
                                    className="min-w-9 justify-center rounded-lg border-border/80"
                                  >
                                    {page}
                                  </PaginationLink>
                                </PaginationItem>
                              ))}
                            <PaginationItem>
                              <PaginationNext
                                href="#"
                                onClick={(e) => {
                                  e.preventDefault();
                                  if (currentPage < totalPages) {
                                    setCurrentPage(currentPage + 1);
                                    window.scrollTo({ top: 0, behavior: "smooth" });
                                  }
                                }}
                                className={currentPage >= totalPages ? "pointer-events-none opacity-50" : "rounded-lg border-border/80"}
                              />
                            </PaginationItem>
                          </PaginationContent>
                        </Pagination>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
