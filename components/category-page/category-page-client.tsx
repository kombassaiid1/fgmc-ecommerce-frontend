"use client";

import { ProductCard } from "@/components/product-card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
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
  useCategoryBreadcrumb,
  useExpandedCategoryFilterSlugs,
  useCategoryFilters,
  useCategoryProducts,
} from "@/hooks/use-category-catalog";
import { useDebounce } from "@/hooks/use-debounce";
import { fetchProductBySlug } from "@/lib/product-details-api";
import type {
  CategoryFilterAttribute,
  CategoryFilterBrand,
  CategoryFilterSubcategory,
  CategoryFilterTerm,
} from "@/lib/category-catalog-api";
import {
  ChevronRight,
  Filter,
  LayoutGrid,
  List,
  Package,
  Search,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { getImageUrl } from "@/lib/api";

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
  brands: "brand",
  minPrice: "min_price",
  maxPrice: "max_price",
  attrPrefix: "attr_",
} as const;

function parseFiltersFromSearchParams(
  searchParams: Readonly<URLSearchParams>,
): {
  page: number;
  sort: string;
  search: string;
  categories: Set<string>;
  brands: Set<string>;
  attributes: Map<string, Set<string>>;
  minPrice: number | null;
  maxPrice: number | null;
  priceFilterActive: boolean;
} {
  const page = Math.max(
    1,
    parseInt(searchParams.get(URL_KEYS.page) ?? "1", 10) || 1,
  );
  const sortRaw = searchParams.get(URL_KEYS.sort);
  const sort = SORT_OPTIONS.some((o) => o.value === sortRaw)
    ? sortRaw!
    : "newest";
  const search = searchParams.get(URL_KEYS.search)?.trim() ?? "";

  const catParam = searchParams.get(URL_KEYS.categories);
  const categories = new Set<string>(
    catParam ? catParam.split(",").filter(Boolean) : [],
  );
  const brandParam = searchParams.get(URL_KEYS.brands);
  const brands = new Set<string>(
    brandParam ? brandParam.split(",").filter(Boolean) : [],
  );

  const attributes = new Map<string, Set<string>>();
  searchParams.forEach((value, key) => {
    if (key.startsWith(URL_KEYS.attrPrefix)) {
      const attrSlug = key.slice(URL_KEYS.attrPrefix.length);
      if (attrSlug) {
        const terms = new Set(value.split(",").filter(Boolean));
        if (terms.size) attributes.set(attrSlug, terms);
      }
    }
  });

  const minPriceParam = searchParams.get(URL_KEYS.minPrice);
  const maxPriceParam = searchParams.get(URL_KEYS.maxPrice);
  const minPrice = minPriceParam != null ? parseFloat(minPriceParam) : null;
  const maxPrice = maxPriceParam != null ? parseFloat(maxPriceParam) : null;
  const priceFilterActive =
    minPriceParam != null &&
    maxPriceParam != null &&
    Number.isFinite(minPrice) &&
    Number.isFinite(maxPrice) &&
    (minPrice ?? 0) >= 0 &&
    (maxPrice ?? 0) >= (minPrice ?? 0);

  return {
    page,
    sort,
    search,
    categories,
    brands,
    attributes,
    minPrice: minPrice != null && Number.isFinite(minPrice) ? minPrice : null,
    maxPrice: maxPrice != null && Number.isFinite(maxPrice) ? maxPrice : null,
    priceFilterActive,
  };
}

function buildSearchParams(params: {
  page: number;
  sort: string;
  search: string;
  categories: Set<string>;
  brands: Set<string>;
  attributes: Map<string, Set<string>>;
  appliedPriceRange: number[];
  priceFilterActive: boolean;
}): URLSearchParams {
  const next = new URLSearchParams();

  if (params.page > 1) next.set(URL_KEYS.page, String(params.page));
  if (params.sort && params.sort !== "newest")
    next.set(URL_KEYS.sort, params.sort);
  if (params.search.trim()) next.set(URL_KEYS.search, params.search.trim());

  if (params.categories.size) {
    next.set(
      URL_KEYS.categories,
      Array.from(params.categories).sort().join(","),
    );
  }
  if (params.brands.size) {
    next.set(URL_KEYS.brands, Array.from(params.brands).sort().join(","));
  }
  if (params.priceFilterActive && params.appliedPriceRange.length >= 2) {
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

type Props = { slug: string };

export function CategoryPageClient({ slug }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const prevSortRef = useRef<string | null>(null);
  const prevSearchRef = useRef<string | null>(null);

  const [grid, setGrid] = useState(true);
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(
    new Set(),
  );
  const [selectedBrands, setSelectedBrands] = useState<Set<string>>(
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

  const filtersQuery = useCategoryFilters(slug?.trim() || null);
  const filterData = filtersQuery.data ?? null;

  const subcategories = filterData?.subcategories ?? [];
  const attributes = filterData?.attributes ?? [];

  const brandOptionsQuery = useCategoryProducts(
    {
      slug: slug ?? "",
      page: 1,
      limit: 200,
      sortBy: "newest",
    },
    {
      enabled:
        hasInitializedFromUrl &&
        !!slug?.trim() &&
        (filterData?.brands?.length ?? 0) === 0,
    },
  );

  const derivedBrands = useMemo<CategoryFilterBrand[]>(() => {
    const bySlug = new Map<string, CategoryFilterBrand>();
    for (const product of brandOptionsQuery.data?.products ?? []) {
      if (!product.brand?.slug?.trim()) continue;
      bySlug.set(product.brand.slug, {
        id: product.brand.id,
        title: product.brand.title,
        slug: product.brand.slug,
        image: product.brand.image,
      });
    }
    return Array.from(bySlug.values()).sort((a, b) =>
      a.title.localeCompare(b.title, "fr"),
    );
  }, [brandOptionsQuery.data?.products]);

  const detailBrandOptionsQuery = useQuery({
    queryKey: [
      "category-filter-product-detail-brands",
      slug,
      brandOptionsQuery.data?.products.map((product) => product.slug) ?? [],
    ] as const,
    queryFn: async () => {
      const products = brandOptionsQuery.data?.products ?? [];
      const details = await Promise.all(
        products.map((product) =>
          fetchProductBySlug(product.slug).catch(() => null),
        ),
      );

      const bySlug = new Map<string, CategoryFilterBrand>();
      for (const product of details) {
        if (!product?.brand?.slug?.trim()) continue;
        bySlug.set(product.brand.slug, {
          id: product.brand.id,
          title: product.brand.title,
          slug: product.brand.slug,
          image: product.brand.image,
        });
      }

      return Array.from(bySlug.values()).sort((a, b) =>
        a.title.localeCompare(b.title, "fr"),
      );
    },
    enabled:
      hasInitializedFromUrl &&
      !!slug?.trim() &&
      (filterData?.brands?.length ?? 0) === 0 &&
      derivedBrands.length === 0 &&
      (brandOptionsQuery.data?.products.length ?? 0) > 0,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const brands =
    filterData?.brands && filterData.brands.length > 0
      ? filterData.brands
      : derivedBrands.length > 0
        ? derivedBrands
        : (detailBrandOptionsQuery.data ?? []);

  const breadcrumbQuery = useCategoryBreadcrumb(slug?.trim() || null);
  const breadcrumbChain = breadcrumbQuery.data ?? [];

  const selectedCategorySlugs = Array.from(selectedCategories);
  const expandedCategorySlugsQuery = useExpandedCategoryFilterSlugs({
    selectedCategorySlugs,
    subcategories: subcategories.map((c) => ({ id: c.id, slug: c.slug })),
    enabled: selectedCategorySlugs.length > 0 && subcategories.length > 0,
  });
  const expandedCategorySlugs =
    expandedCategorySlugsQuery.data ?? selectedCategorySlugs;

  const productsParams = {
    slug: slug ?? "",
    page: currentPage,
    limit: ITEMS_PER_PAGE,
    filterCategories:
      expandedCategorySlugs.length > 0 ? expandedCategorySlugs : undefined,
    brands: selectedBrands.size > 0 ? Array.from(selectedBrands) : undefined,
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
    search: debouncedSearch.trim() || undefined,
    sortBy,
  };

  const productsQuery = useCategoryProducts(productsParams, {
    enabled: hasInitializedFromUrl,
  });

  const products = productsQuery.data?.products ?? [];
  const totalCount = productsQuery.data?.totalCount ?? 0;
  const totalPages = productsQuery.data?.totalPages ?? 0;
  const categoryTitle =
    productsQuery.data?.title ?? filterData?.categoryTitle ?? slug ?? "";

  const loadingFilters =
    filtersQuery.isLoading ||
    ((filterData?.brands?.length ?? 0) === 0 &&
      (brandOptionsQuery.isLoading || detailBrandOptionsQuery.isLoading));
  const loadingProducts = productsQuery.isFetching;
  const error =
    (filtersQuery.isError && filtersQuery.error
      ? (filtersQuery.error as Error).message
      : null) ??
    (productsQuery.isError && productsQuery.error
      ? (productsQuery.error as Error).message
      : null) ??
    null;

  useEffect(() => {
    if (!filterData) return;
    const { min, max } = filterData.priceRange;
    const priceFilterInactive = !priceFilterActive;
    const run = () => {
      setMinPrice(min);
      setMaxPrice(max);
      if (priceFilterInactive) {
        setSelectedPriceRange([min, max]);
        setAppliedPriceRange([min, max]);
      }
    };
    queueMicrotask(run);
  }, [filterData, priceFilterActive]);

  useEffect(() => {
    const parsed = parseFiltersFromSearchParams(searchParams);
    prevSortRef.current = parsed.sort;
    prevSearchRef.current = parsed.search;
    queueMicrotask(() => {
      setCurrentPage(parsed.page);
      setSortBy(parsed.sort);
      setSearchQuery(parsed.search);
      setSelectedCategories(parsed.categories);
      setSelectedBrands(parsed.brands);
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
    )
      return;
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
      brands: selectedBrands,
      attributes: selectedAttributes,
      appliedPriceRange,
      priceFilterActive,
    });
    const nextStr = next.toString();
    const currentStr = searchParams.toString();
    if (nextStr === currentStr) return;
    const url = nextStr ? `${pathname}?${nextStr}` : pathname;
    router.replace(url, { scroll: false });
  }, [
    hasInitializedFromUrl,
    pathname,
    router,
    searchParams,
    currentPage,
    sortBy,
    debouncedSearch,
    selectedCategories,
    selectedBrands,
    selectedAttributes,
    appliedPriceRange,
    priceFilterActive,
  ]);

  const activeFilterCount =
    selectedCategories.size +
    selectedBrands.size +
    (priceFilterActive ? 1 : 0) +
    Array.from(selectedAttributes.values()).reduce((s, t) => s + t.size, 0);

  const handleCategoryFilter = (categorySlug: string, checked: boolean) => {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (checked) next.add(categorySlug);
      else next.delete(categorySlug);
      return next;
    });
    setCurrentPage(1);
  };

  const handleBrandFilter = (brandSlug: string, checked: boolean) => {
    setSelectedBrands((prev) => {
      const next = new Set(prev);
      if (checked) next.add(brandSlug);
      else next.delete(brandSlug);
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
    setSelectedBrands(new Set());
    setSelectedAttributes(new Map());
    setPriceFilterActive(false);
    setSelectedPriceRange([minPrice, maxPrice]);
    setAppliedPriceRange([minPrice, maxPrice]);
    setCurrentPage(1);
  };

  const removeFilter = (
    type: "category" | "brand" | "price" | "attribute",
    slug?: string,
    attrSlug?: string,
  ) => {
    if (type === "category" && slug) handleCategoryFilter(slug, false);
    else if (type === "brand" && slug) handleBrandFilter(slug, false);
    else if (type === "price") {
      setPriceFilterActive(false);
      setSelectedPriceRange([minPrice, maxPrice]);
      setAppliedPriceRange([minPrice, maxPrice]);
      setCurrentPage(1);
    } else if (type === "attribute" && slug && attrSlug)
      handleAttributeFilter(attrSlug, slug, false);
  };

  const renderActiveFilters = () => {
    const els: React.ReactNode[] = [];
    if (priceFilterActive) {
      els.push(
        <Badge
          key="price"
          variant="secondary"
          className="gap-1 pr-1 text-xs font-normal">
          <span className="max-w-[120px] truncate">
            Prix: {appliedPriceRange[0]}–{appliedPriceRange[1]} €
          </span>
          <button
            type="button"
            onClick={() => removeFilter("price")}
            className="rounded p-0.5 hover:bg-muted-foreground/20 focus:outline-none focus:ring-2 focus:ring-primary/50"
            aria-label="Retirer filtre prix">
            <X className="size-3" />
          </button>
        </Badge>,
      );
    }
    selectedCategories.forEach((slug) => {
      const cat = subcategories.find(
        (c: CategoryFilterSubcategory) => c.slug === slug,
      );
      if (cat)
        els.push(
          <Badge
            key={`cat-${slug}`}
            variant="secondary"
            className="gap-1 pr-1 text-xs font-normal">
            <span className="max-w-[100px] truncate">{cat.title}</span>
            <button
              type="button"
              onClick={() => removeFilter("category", slug)}
              className="rounded p-0.5 hover:bg-muted-foreground/20 focus:outline-none focus:ring-2 focus:ring-primary/50"
              aria-label={`Retirer filtre ${cat.title}`}>
              <X className="size-3" />
            </button>
          </Badge>,
        );
    });
    selectedBrands.forEach((slug) => {
      const brand = brands.find((b: CategoryFilterBrand) => b.slug === slug);
      if (brand)
        els.push(
          <Badge
            key={`brand-${slug}`}
            variant="secondary"
            className="gap-1 pr-1 text-xs font-normal">
            <span className="max-w-[100px] truncate">
              Marque: {brand.title}
            </span>
            <button
              type="button"
              onClick={() => removeFilter("brand", slug)}
              className="rounded p-0.5 hover:bg-muted-foreground/20 focus:outline-none focus:ring-2 focus:ring-primary/50"
              aria-label={`Retirer filtre ${brand.title}`}>
              <X className="size-3" />
            </button>
          </Badge>,
        );
    });
    selectedAttributes.forEach((terms, attrSlug) => {
      const attr = attributes.find(
        (a: CategoryFilterAttribute) => a.slug === attrSlug,
      );
      if (attr) {
        terms.forEach((termSlug) => {
          const term = attr.terms.find(
            (t: CategoryFilterTerm) => t.slug === termSlug,
          );
          if (term)
            els.push(
              <Badge
                key={`${attrSlug}-${termSlug}`}
                variant="secondary"
                className="gap-1 pr-1 text-xs font-normal">
                <span className="max-w-[100px] truncate">
                  {attr.name}: {term.name}
                </span>
                <button
                  type="button"
                  onClick={() => removeFilter("attribute", termSlug, attrSlug)}
                  className="rounded p-0.5 hover:bg-muted-foreground/20 focus:outline-none focus:ring-2 focus:ring-primary/50"
                  aria-label={`Retirer filtre ${term.name}`}>
                  <X className="size-3" />
                </button>
              </Badge>,
            );
        });
      }
    });
    return els;
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
          Rechercher dans cette catégorie
        </Label>
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--cat-muted)]"
          aria-hidden
        />
        <Input
          id={`${idp}-search`}
          placeholder="Rechercher dans cette catégorie"
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
              {filterSectionTitle("Sous-catégories", selectedCategories.size)}
            </AccordionTrigger>
            <AccordionContent className="pb-4 pt-0">
              {filterOptionList(
                `${idp}-cat`,
                subcategories.map((cat: CategoryFilterSubcategory) => ({
                  key: cat.slug,
                  label: cat.title,
                  checked: selectedCategories.has(cat.slug),
                  onChange: (c) => handleCategoryFilter(cat.slug, c),
                })),
                "Aucune sous-catégorie",
              )}
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="brands" className={filterItemClass}>
            <AccordionTrigger className={filterTriggerClass}>
              {filterSectionTitle("Marques", selectedBrands.size)}
            </AccordionTrigger>
            <AccordionContent className="pb-4 pt-0">
              {filterOptionList(
                `${idp}-brand`,
                brands.map((brand: CategoryFilterBrand) => ({
                  key: brand.slug,
                  label: brand.title,
                  checked: selectedBrands.has(brand.slug),
                  onChange: (c) => handleBrandFilter(brand.slug, c),
                })),
                "Aucune marque",
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

  if (error && !filterData) {
    return (
      <main className="flex min-h-[50vh] items-center justify-center bg-muted/30 px-4">
        <div className="max-w-md rounded-xl border border-border/80 bg-card p-8 text-center shadow-sm">
          <h1 className="mb-2 text-xl! font-semibold!">
            {/"statusCode"\s*:\s*404|HTTP 404/.test(error) ? "Cette catégorie n’existe pas ou plus" : "Les produits ne se chargent pas"}
          </h1>
          <p className="mb-5 text-sm! text-muted-foreground">
            {/"statusCode"\s*:\s*404|HTTP 404/.test(error)
              ? "L’adresse est peut-être incorrecte. Parcourez la boutique pour trouver ce qu’il vous faut."
              : "Un problème de connexion empêche d’afficher cette page. Vérifiez votre connexion, puis réessayez."}
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button
              variant="outline"
              className="rounded-lg"
              onClick={() => {
                filtersQuery.refetch();
                productsQuery.refetch();
              }}>
              Réessayer
            </Button>
            <Button asChild className="rounded-lg">
              <Link href="/categorie-produit">Voir toute la boutique</Link>
            </Button>
          </div>
        </div>
      </main>
    );
  }

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
      {/* The category opens on a tailor's tape: the product count is pinned to it. */}
      <header className="relative bg-[var(--cat-ink)] text-white">
        <div className="container mx-auto max-w-450 px-4 pb-20 pt-6 sm:px-6 lg:px-8 lg:pb-24">
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
              <li>
                <span>Catégories</span>
              </li>
              {(breadcrumbChain.length > 0
                ? breadcrumbChain
                : [
                    {
                      id: "__current__",
                      title: categoryTitle || slug,
                      slug,
                    } as const,
                  ]
              ).map((c, idx, arr) => {
                const isLast = idx === arr.length - 1;
                return (
                  <li key={c.id} className="contents">
                    <span aria-hidden className="flex items-center gap-1">
                      <ChevronRight className="size-3.5 shrink-0" />
                    </span>
                    <span>
                      {isLast ? (
                        <span aria-current="page" className="font-medium text-white">
                          {c.title}
                        </span>
                      ) : (
                        <Link
                          href={`/${c.slug}`}
                          className="-mx-1 rounded px-1 transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
                          {c.title}
                        </Link>
                      )}
                    </span>
                  </li>
                );
              })}
            </ol>
          </nav>
          <h1 className="mt-8 max-w-5xl text-5xl! font-semibold! leading-[0.95]! tracking-tight text-balance sm:text-6xl! lg:text-7xl!">
            {categoryTitle || slug}
          </h1>
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

              <div className="pt-4">{renderFilterPanel("d", ["categories", "brands", "price"])}</div>
            </div>
          </aside>

          <div className="min-w-0 flex-1 space-y-4 w-full">
            <div className="flex flex-col gap-4 border-b border-dashed border-[var(--cat-seam)] pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-base text-[var(--cat-muted)]" aria-live="polite">
                  {loadingProducts
                    ? "Chargement…"
                    : `${totalCount} produit${totalCount !== 1 ? "s" : ""} dans cette catégorie`}
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
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs text-muted-foreground"
                            onClick={resetFilters}>
                            Tout effacer
                          </Button>
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
                      {SORT_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
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

            {subcategories.length > 0 && (
              <nav aria-label="Sous-catégories">
                <ul className="-mx-1 flex gap-2.5 overflow-x-auto px-1 pb-2 [scrollbar-width:thin]">
                  {subcategories.map((sc: CategoryFilterSubcategory) => {
                    const imgUrl = sc.image?.trim()
                      ? getImageUrl(sc.image)
                      : null;
                    return (
                      <li key={sc.id} className="shrink-0">
                        <Link
                          href={`/${sc.slug}`}
                          title={sc.title}
                          className="group flex min-h-12 items-center gap-3 rounded-full border border-[var(--cat-line)] bg-white py-1.5 pl-1.5 pr-5 text-[var(--cat-ink)] transition-colors duration-200 hover:border-[var(--cat-royal)] hover:text-[var(--cat-royal)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 active:bg-[var(--cat-linen)]">
                          <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-full bg-[var(--cat-linen)]">
                            {imgUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={imgUrl}
                                alt=""
                                loading="lazy"
                                className="size-full object-contain"
                              />
                            ) : (
                              <Package
                                className="size-4 text-[var(--cat-muted)]"
                                aria-hidden
                              />
                            )}
                          </span>
                          <span className="whitespace-nowrap text-sm font-medium">
                            {sc.title}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </nav>
            )}

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
                    Aucun produit ne correspond à vos critères. Essayez
                    d’ajuster les filtres.
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
                  <div
                    className={
                      grid
                        ? "grid w-full grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 lg:gap-5 xl:grid-cols-4 xl:gap-6 2xl:grid-cols-5"
                        : "flex w-full flex-col gap-4"
                    }>
                    {products.map((product) => (
                      <div key={product.id} className={grid ? "" : "w-full"}>
                        <ProductCard
                          product={product}
                          variant={grid ? "grid" : "list"}
                          categorySlug={slug}
                        />
                      </div>
                    ))}
                  </div>

                  {totalPages > 1 && (
                    <div className="mt-8 border-t border-border/60 pt-6">
                      <div className="flex flex-col items-center gap-4">
                        <p className="text-muted-foreground text-xs sm:text-sm">
                          Page {currentPage} sur {totalPages} · {totalCount}{" "}
                          produit
                          {totalCount !== 1 ? "s" : ""}
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
                                    window.scrollTo({
                                      top: 0,
                                      behavior: "smooth",
                                    });
                                  }
                                }}
                                className={
                                  currentPage <= 1
                                    ? "pointer-events-none opacity-50"
                                    : "rounded-lg border-border/80"
                                }
                              />
                            </PaginationItem>
                            {Array.from({ length: totalPages }, (_, i) => i + 1)
                              .filter(
                                (p) =>
                                  p === 1 ||
                                  p === totalPages ||
                                  (p >= currentPage - 2 &&
                                    p <= currentPage + 2),
                              )
                              .map((p, idx, arr) => (
                                <PaginationItem key={p}>
                                  {idx > 0 && arr[idx - 1] !== p - 1 && (
                                    <span className="px-1 text-muted-foreground">
                                      …
                                    </span>
                                  )}
                                  <PaginationLink
                                    href="#"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      setCurrentPage(p);
                                      window.scrollTo({
                                        top: 0,
                                        behavior: "smooth",
                                      });
                                    }}
                                    isActive={p === currentPage}
                                    className="min-w-9 justify-center rounded-lg border-border/80">
                                    {p}
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
                                    window.scrollTo({
                                      top: 0,
                                      behavior: "smooth",
                                    });
                                  }
                                }}
                                className={
                                  currentPage >= totalPages
                                    ? "pointer-events-none opacity-50"
                                    : "rounded-lg border-border/80"
                                }
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
