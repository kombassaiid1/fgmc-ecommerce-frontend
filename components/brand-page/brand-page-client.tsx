"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronRight,
  Filter,
  Grid3X3,
  LayoutGrid,
  List,
  Loader2,
  Package,
  Search,
  X,
} from "lucide-react";

import { ProductCard } from "@/components/product-card";
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
            Prix: {appliedPriceRange[0]}-{appliedPriceRange[1]} TND
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

  const filtersContent = (
    <>
      <div>
        <Label htmlFor="brand-search" className="sr-only">
          Rechercher dans cette marque
        </Label>
        <div className="relative">
          <Search className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" />
          <Input
            id="brand-search"
            placeholder="Rechercher dans cette marque..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 rounded-lg border-border/80 bg-background pl-9 text-sm focus-visible:ring-2"
          />
        </div>
      </div>

      {loadingFilters ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="text-primary size-6 animate-spin" />
        </div>
      ) : (
        <Accordion
          type="multiple"
          defaultValue={["categories", "price", "attributes"]}
          className="space-y-0"
        >
          <AccordionItem value="categories" className="border-none">
            <AccordionTrigger className="py-3 text-sm font-medium hover:no-underline">
              <div className="flex items-center gap-2">
                <Grid3X3 className="text-primary size-4 shrink-0" />
                <span>Catégories</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-3 pt-0">
              {categories.length === 0 ? (
                <p className="text-muted-foreground text-sm">Aucune catégorie</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {categories.map((category: CategoryFilterSubcategory) => (
                    <label key={category.id} className="flex cursor-pointer items-center gap-2 rounded-md py-1.5 pr-2 hover:bg-muted/50">
                      <Checkbox
                        checked={selectedCategories.has(category.slug)}
                        onCheckedChange={(checked) =>
                          handleCategoryFilter(category.slug, checked === true)
                        }
                      />
                      <span className="text-sm">{category.title}</span>
                    </label>
                  ))}
                </div>
              )}
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="price" className="border-none">
            <AccordionTrigger className="py-3 text-sm font-medium hover:no-underline">
              Prix (TND)
            </AccordionTrigger>
            <AccordionContent className="pb-3 pt-0">
              <Slider
                className="mt-2 w-full"
                min={minPrice}
                max={maxPrice}
                step={1}
                value={selectedPriceRange}
                onValueChange={setSelectedPriceRange}
              />
              <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                <span>{selectedPriceRange[0]} TND</span>
                <span>{selectedPriceRange[1]} TND</span>
              </div>
              <Button size="sm" className="mt-3 w-full rounded-lg" onClick={applyPriceFilter}>
                Appliquer
              </Button>
            </AccordionContent>
          </AccordionItem>

          {attributes.map((attr: CategoryFilterAttribute) => (
            <AccordionItem key={attr.id} value={attr.slug} className="border-none">
              <AccordionTrigger className="py-3 text-sm font-medium hover:no-underline">
                {attr.name}
              </AccordionTrigger>
              <AccordionContent className="pb-3 pt-0">
                <div className="flex flex-col gap-2">
                  {attr.terms.map((term: CategoryFilterTerm) => (
                    <label key={term.id} className="flex cursor-pointer items-center gap-2 rounded-md py-1.5 pr-2 hover:bg-muted/50">
                      <Checkbox
                        checked={selectedAttributes.get(attr.slug)?.has(term.slug) ?? false}
                        onCheckedChange={(checked) =>
                          handleAttributeFilter(attr.slug, term.slug, checked === true)
                        }
                      />
                      <span className="text-sm">{term.name}</span>
                    </label>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </>
  );

  return (
    <main className="min-h-screen bg-muted/30">
      <div className="border-b border-border/50 bg-card shadow-sm">
        <div className="container mx-auto max-w-450 px-4 py-6 sm:px-6 lg:px-8">
          <nav aria-label="Breadcrumb" className="mb-4">
            <ol className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
              <li>
                <Link href="/" className="rounded px-1 -mx-1 hover:text-foreground">
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
              <li className="font-medium text-foreground">{brandTitle}</li>
            </ol>
          </nav>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl md:text-4xl">
            {brandTitle}
          </h1>
        </div>
      </div>

      <div className="container mx-auto max-w-450 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:w-full">
          <aside className="hidden w-72 shrink-0 lg:block xl:w-80">
            <div className="sticky top-6 space-y-4 rounded-xl border border-border/80 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 border-b border-border/60 pb-4">
                <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
                  <Filter className="text-primary size-4" />
                </div>
                <h2 className="text-base font-semibold">Filtres</h2>
                {activeFilterCount > 0 && (
                  <Badge variant="secondary" className="ml-auto text-xs">
                    {activeFilterCount}
                  </Badge>
                )}
              </div>
              {activeFilterCount > 0 && (
                <div className="rounded-lg border border-border/60 bg-muted/40 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">
                      Filtres actifs
                    </span>
                    <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={resetFilters}>
                      Tout effacer
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">{renderActiveFilters()}</div>
                </div>
              )}
              {filtersContent}
            </div>
          </aside>

          <div className="min-w-0 flex-1 space-y-4 w-full">
            <div className="flex flex-col gap-4 rounded-xl border border-border/80 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Package className="size-4 shrink-0" />
                  <span>
                    {totalCount} produit{totalCount !== 1 ? "s" : ""}
                  </span>
                </div>
                <Sheet>
                  <SheetTrigger asChild>
                    <button type="button" className="fixed left-0 top-1/2 z-40 -translate-y-1/2 flex flex-col items-center gap-1.5 bg-black px-1.5 py-3 text-white shadow-lg lg:hidden">
                      <Filter className="size-4" />
                      <span className="text-[10px] font-bold uppercase tracking-widest [writing-mode:vertical-lr]">
                        Filtrer
                      </span>
                      {activeFilterCount > 0 && (
                        <span className="flex size-5 items-center justify-center rounded-full bg-white text-[10px] font-bold text-black">
                          {activeFilterCount}
                        </span>
                      )}
                    </button>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-full max-w-[400px] overflow-y-auto bg-white p-0" onOpenAutoFocus={(e) => e.preventDefault()}>
                    <div className="sticky top-0 z-10 border-b border-border/60 bg-white px-4 py-4 shadow-sm">
                      <div className="flex items-center gap-2">
                        <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
                          <Filter className="text-primary size-4" />
                        </div>
                        <span className="text-base font-semibold">Filtres</span>
                        <SheetClose className="ml-auto flex size-8 items-center justify-center rounded-full hover:bg-muted">
                          <X className="size-4" />
                        </SheetClose>
                      </div>
                      {activeFilterCount > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {renderActiveFilters()}
                          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={resetFilters}>
                            Tout effacer
                          </Button>
                        </div>
                      )}
                    </div>
                    <div className="space-y-0 p-4">
                      <div className="border-b border-border/60 pb-4">{filtersContent}</div>
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
                <div className="flex rounded-lg border border-border/80 p-0.5" role="group" aria-label="Vue des produits">
                  <Button size="sm" variant={grid ? "secondary" : "ghost"} className="h-8 w-8 rounded-md p-0" onClick={() => setGrid(true)} aria-label="Vue grille">
                    <LayoutGrid className="size-4" />
                  </Button>
                  <Button size="sm" variant={!grid ? "secondary" : "ghost"} className="h-8 w-8 rounded-md p-0" onClick={() => setGrid(false)} aria-label="Vue liste">
                    <List className="size-4" />
                  </Button>
                </div>
              </div>
            </div>

            {activeFilterCount > 0 && (
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-card px-4 py-3 shadow-sm">
                <span className="text-muted-foreground text-xs font-medium">
                  Filtres actifs
                </span>
                {renderActiveFilters()}
                <Button variant="ghost" size="sm" className="ml-auto h-7 rounded-md px-2 text-xs" onClick={resetFilters}>
                  Tout effacer
                </Button>
              </div>
            )}

            <div className="rounded-xl border border-border/80 bg-card p-4 shadow-sm sm:p-6">
              {loadingProducts ? (
                <div className="flex min-h-[320px] flex-col items-center justify-center py-16">
                  <Loader2 className="text-primary size-10 animate-spin" />
                  <p className="text-muted-foreground mt-4 text-sm">
                    Chargement des produits...
                  </p>
                </div>
              ) : products.length === 0 ? (
                <div className="flex min-h-[320px] flex-col items-center justify-center py-16 text-center">
                  <Package className="text-muted-foreground size-12" />
                  <h3 className="mt-4 text-lg font-semibold">Aucun produit trouvé</h3>
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
                    <div className="mt-8 border-t border-border/60 pt-6">
                      <Pagination>
                        <PaginationContent className="gap-1">
                          <PaginationItem>
                            <PaginationPrevious
                              href="#"
                              onClick={(e) => {
                                e.preventDefault();
                                if (currentPage > 1) setCurrentPage(currentPage - 1);
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
                                  <span className="px-1 text-muted-foreground">...</span>
                                )}
                                <PaginationLink
                                  href="#"
                                  isActive={page === currentPage}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    setCurrentPage(page);
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
                                if (currentPage < totalPages) setCurrentPage(currentPage + 1);
                              }}
                              className={currentPage >= totalPages ? "pointer-events-none opacity-50" : "rounded-lg border-border/80"}
                            />
                          </PaginationItem>
                        </PaginationContent>
                      </Pagination>
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
