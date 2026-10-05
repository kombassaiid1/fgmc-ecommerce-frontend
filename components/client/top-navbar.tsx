/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { CSSProperties, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  ChevronDown,
  Clock,
  LayoutDashboard,
  LogOut,
  Loader2,
  Mail,
  Menu,
  Package,
  Phone,
  Search as SearchIcon,
  ShoppingCart,
  User,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getImageUrl } from "@/lib/api";
import { getPublicHeaderSettings } from "@/lib/api/header";
import { getCategories, type Category } from "@/lib/api/categories";
import { getProducts, type ProductListItem } from "@/lib/api/products";
import {
  clearClientSession,
  getClientSession,
  subscribeToClientSession,
  type ClientSession,
} from "@/lib/client-auth";
import {
  DEFAULT_HEADER_CONFIG,
  type HeaderConfig,
  type HeaderLink,
} from "@/lib/header-config";
import { useCartStore } from "@/lib/stores/cart-store";
import { cn } from "@/lib/utils";

type ParentWithChildren = Category & { children: ParentWithChildren[] };
type SearchProduct = ProductListItem & { categories?: unknown[] | null };

const SITE_SETTINGS = {
  siteName: "FGMC",
  logo: "/logo.png",
  mobileLogo: "/logo.png",
};

function subscribeToScroll(onStoreChange: () => void) {
  window.addEventListener("scroll", onStoreChange, { passive: true });
  return () => window.removeEventListener("scroll", onStoreChange);
}

function getScrollSnapshot() {
  return window.scrollY > 10;
}

function getServerScrollSnapshot() {
  return false;
}

function useClientSessionState() {
  const [session, setSession] = useState<ClientSession | null>(null);

  useEffect(() => {
    const syncSession = () => setSession(getClientSession());

    syncSession();
    return subscribeToClientSession(syncSession);
  }, []);

  return session;
}

function telHref(phone: string | null | undefined): string {
  if (!phone?.trim()) return "tel:";
  const digits = phone.replace(/\s/g, "").replace(/[^\d+]/g, "");
  return `tel:${digits.startsWith("+") ? digits : `+216${digits}`}`;
}

function formatOpeningHours(config: HeaderConfig): string {
  const days = config.openingDays.trim();
  const openingTime = config.openingTime.trim();
  const closingTime = config.closingTime.trim();
  const timeRange = [openingTime, closingTime].filter(Boolean).join("-");

  if (days && timeRange) return `${days}: ${timeRange}`;
  return days || timeRange || "Horaires non renseignes";
}

function buildProductHref(product: SearchProduct): string {
  const categorySlug = pickProductCategorySlug(product.categories, product.mainCategoryId);
  const productSlug = product.slug.trim().replace(/^\/+|\/+$/g, "");
  if (!categorySlug) return `/${productSlug}.html`;
  return `/${categorySlug}/${productSlug}.html`;
}

function pickProductCategorySlug(
  categories: unknown[] | null | undefined,
  mainCategoryId?: string | null,
): string | null {
  if (!Array.isArray(categories) || categories.length === 0) return null;

  const ordered = mainCategoryId
    ? [...categories].sort((left, right) => {
        const isMain = (item: unknown) => {
          if (item == null || typeof item !== "object") return false;
          const record = item as Record<string, unknown>;
          const category = record.category as Record<string, unknown> | null | undefined;
          return record.categoryId === mainCategoryId || category?.id === mainCategoryId;
        };
        return Number(isMain(right)) - Number(isMain(left));
      })
    : categories;
  for (const item of ordered) {
    if (item == null || typeof item !== "object") continue;
    const itemRecord = item as Record<string, unknown>;
    const candidateRaw = itemRecord.category ?? itemRecord;
    if (candidateRaw == null || typeof candidateRaw !== "object") continue;
    const candidate = candidateRaw as Record<string, unknown>;
    const slug = typeof candidate.slug === "string" ? candidate.slug : null;
    if (slug?.trim()) return slug.trim();
  }

  return null;
}

function useCategoryTree() {
  const { data: categories = [] } = useQuery({
    queryKey: ["navbar-categories"],
    queryFn: () => getCategories(),
  });

  return useMemo(() => {
    const nodes = new Map<string, ParentWithChildren>();
    categories.forEach((category) => {
      nodes.set(category.id, { ...category, children: [] });
    });

    const roots: ParentWithChildren[] = [];
    categories.forEach((category) => {
      const node = nodes.get(category.id);
      if (!node) return;
      const parent = category.parentCategoryId
        ? nodes.get(category.parentCategoryId)
        : undefined;
      if (parent) parent.children.push(node);
      else roots.push(node);
    });

    const sortTree = (items: ParentWithChildren[]): ParentWithChildren[] =>
      items.sort(sortCategoryByDate).map((item) => ({
        ...item,
        children: sortTree(item.children),
      }));

    return sortTree(roots);
  }, [categories]);
}

function sortCategoryByDate(a: Category, b: Category) {
  return (
    new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime()
  );
}

export function TopNavBar() {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [searchCategory, setSearchCategory] = useState<Category | null>(null);
  const clientSession = useClientSessionState();
  const isScrolled = useSyncExternalStore(
    subscribeToScroll,
    getScrollSnapshot,
    getServerScrollSnapshot,
  );
  const parentCategories = useCategoryTree();
  const headerSettingsQuery = useQuery({
    queryKey: ["storefront-header-settings"],
    queryFn: getPublicHeaderSettings,
    staleTime: 30_000,
  });
  const headerConfig = headerSettingsQuery.data ?? DEFAULT_HEADER_CONFIG;

  if (pathname.startsWith("/admin_ben")) {
    return null;
  }

  if (headerSettingsQuery.isLoading && !headerSettingsQuery.data) {
    return <TopNavBarSkeleton isScrolled={isScrolled} />;
  }

  const headerVars = {
    "--header-bg": headerConfig.backgroundColor,
    "--header-text": headerConfig.textColor,
    "--header-accent": headerConfig.accentColor,
    "--header-height": `${headerConfig.headerHeight}px`,
    "--header-logo-width": `${headerConfig.logoWidth}px`,
  } as CSSProperties;

  return (
    <header
      className={cn(
        "z-[9999] bg-white text-[#142c5b] transition-shadow",
        headerConfig.sticky && "sticky top-0",
        isScrolled && "shadow-lg",
      )}
      style={headerVars}>
      <div className="flex h-[3px]" aria-hidden="true">
        <span className="flex-1 bg-[#0A224F]" />
        <span className="flex-1 bg-[#FFFFFF]" />
        <span className="flex-1 bg-[#D6202E]" />
      </div>
      {headerConfig.showUtilityBar ? <div
        className="hidden h-8 bg-[#10295f] text-xs text-white lg:block"
        style={{ backgroundColor: headerConfig.utilityColor, color: headerConfig.utilityTextColor }}>
        <div className="mx-auto flex h-full max-w-[1500px] items-center justify-end px-4">
          <Link href={telHref(headerConfig.phoneNumber)} className="inline-flex items-center gap-1.5">
            <Phone className="size-3.5" /> {headerConfig.phoneNumber}
          </Link>
          <span className="mx-4 opacity-50">|</span>
          <Link href={`mailto:${headerConfig.contactEmail}`}>Nous contacter</Link>
          <span className="mx-4 opacity-50">|</span>
          <Link href="/informations">Aide &amp; SAV</Link>
        </div>
      </div> : null}

      <div className="mx-auto flex min-h-[96px] max-w-[1500px] items-center gap-6 px-4 py-3">
        <HeaderLogo config={headerConfig} />
        <div className="flex min-w-0 flex-1 items-stretch">
          {headerConfig.showSearch ? (
            <div className="flex min-w-0 flex-1 items-stretch overflow-visible rounded-lg border-2 border-[#153675]">
              <CategoriesDropdown
                categories={parentCategories}
                label={searchCategory?.title ?? "Tout le magasin"}
                compact
                onCategorySelect={setSearchCategory}
              />
              <NavbarSearch
                className="min-w-0 flex-1"
                inputClassName="h-[46px] rounded-none border-0 bg-white pl-4 text-sm shadow-none focus-visible:ring-0"
                category={searchCategory}
              />
            </div>
          ) : null}
        </div>
        <HeaderActions
          config={headerConfig}
          session={clientSession}
        />
      </div>

      <nav
        className="bg-[#153675] text-white"
        style={{ "--header-text": "#ffffff", "--header-accent": "#ffffff" } as CSSProperties}
        aria-label="Navigation principale">
        <div className="mx-auto flex min-h-[50px] max-w-[1500px] items-center justify-between gap-6 px-4">
          <div className="hidden min-w-0 items-center gap-9 lg:flex">
            <DesktopHeaderLinks links={headerConfig.links} categories={parentCategories} />
          </div>
          <span className="hidden shrink-0 text-sm font-semibold lg:block">Livraison France &amp; Europe</span>
          <button
            type="button"
            className="inline-flex items-center gap-2 py-3 text-sm font-semibold lg:hidden"
            onClick={() => setIsMobileMenuOpen((open) => !open)}>
            <Menu className="size-5" /> Menu
          </button>
        </div>
        <MobileMenu
          isOpen={isMobileMenuOpen}
          onClose={() => setIsMobileMenuOpen(false)}
          categories={parentCategories}
          session={clientSession}
          config={headerConfig}
        />
      </nav>
    </header>
  );
}

function TopNavBarSkeleton({ isScrolled }: { isScrolled: boolean }) {
  return (
    <header className={cn("sticky top-0 z-[9999] bg-white", isScrolled && "shadow-lg")} aria-busy="true" aria-label="Header loading">
      <div className="flex h-[3px]" aria-hidden="true">
        <span className="flex-1 bg-[#0A224F]" />
        <span className="flex-1 bg-[#FFFFFF]" />
        <span className="flex-1 bg-[#D6202E]" />
      </div>
      <div className="hidden h-8 bg-[#10295f] lg:block" />
      <div className="mx-auto flex min-h-[96px] max-w-[1500px] items-center gap-6 px-4 py-3">
        <SkeletonBar className="h-12 w-56 rounded-md" />
        <SkeletonBar className="h-12 min-w-0 flex-1 rounded-md" />
        <SkeletonBar className="h-10 w-36 rounded-md" />
      </div>
      <div className="flex min-h-[50px] items-center gap-8 bg-[#153675] px-8">
        <SkeletonBar className="h-4 w-28 bg-white/30" />
        <SkeletonBar className="h-4 w-28 bg-white/30" />
        <SkeletonBar className="h-4 w-24 bg-white/30" />
      </div>
    </header>
  );
}

function SkeletonBar({ className }: { className: string }) {
  return (
    <span
      className={cn(
        "block animate-pulse rounded-full bg-muted-foreground/15",
        className,
      )}
    />
  );
}

function HeaderLogo({ config }: { config: HeaderConfig }) {
  return (
    <div className="shrink-0">
      <Link
        href="/"
        className="flex items-center gap-2 text-xl font-bold text-[var(--header-text)]">
        <img
          src={resolveHeaderLogo(config.logoUrl)}
          alt={config.logoAlt || SITE_SETTINGS.siteName}
          className="hidden h-auto max-h-14 w-[var(--header-logo-width)] object-contain lg:block"
        />
        <img
          src={resolveHeaderLogo(config.logoUrl || SITE_SETTINGS.mobileLogo)}
          alt={config.logoAlt || SITE_SETTINGS.siteName}
          className="h-auto max-h-12 w-[min(var(--header-logo-width),8rem)] object-contain lg:hidden"
        />
      </Link>
    </div>
  );
}

function HeaderActions({
  config,
  session,
}: {
  config: HeaderConfig;
  session: ClientSession | null;
}) {
  return (
    <div className="flex shrink-0 items-center gap-3">
      <div className="flex items-center gap-2">
        {config.showCart ? <CartActionButton /> : null}

        {config.showAccount ? <DesktopClientAuth session={session} /> : null}
      </div>
    </div>
  );
}

function resolveHeaderLogo(src: string | null | undefined) {
  const value = src?.trim();
  if (!value) return SITE_SETTINGS.logo;
  if (value.startsWith("/") || /^https?:\/\//i.test(value)) return value;
  return getImageUrl(value);
}

function isCategoriesLink(link: HeaderLink) {
  const normalizedLabel = link.label.trim().toLowerCase();
  const normalizedUrl = link.url.trim().replace(/\/$/, "");
  return (
    normalizedLabel === "categories" ||
    normalizedLabel === "catégories" ||
    normalizedLabel === "catÃ©gories" ||
    normalizedUrl === "/categorie-produit"
  );
}

function DesktopHeaderLinks({
  links,
  categories,
}: {
  links: HeaderLink[];
  categories: ParentWithChildren[];
}) {
  return (
    <>
      {links.slice(0, 6).map((link) =>
        isCategoriesLink(link) ? (
          <CategoriesDropdown key={`${link.label}-${link.url}`} categories={categories} />
        ) : (
          <NavLink key={`${link.label}-${link.url}`} href={link.url || "/"}>
            {link.label || "Link"}
          </NavLink>
        ),
      )}
    </>
  );
}

function getClientDisplayName(session: ClientSession | null) {
  const user = session?.user;
  const fullName = [user?.firstName, user?.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();

  return fullName || user?.username || user?.email || "Profil";
}

function DesktopClientAuth({ session }: { session: ClientSession | null }) {
  if (session) {
    return (
      <div className="hidden items-center gap-2 md:flex">
        <Button
        asChild
        variant="outline"
        size="sm"
          className="min-h-9 max-w-44 border-current/20 bg-current/5 px-3 text-[var(--header-text)] hover:border-current/40 hover:bg-current/10">
          <Link href="/mon-compte" title={getClientDisplayName(session)}>
            <User className="size-4 text-[var(--header-accent)]" />
            <span className="truncate">{getClientDisplayName(session)}</span>
          </Link>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          onClick={clearClientSession}
          aria-label="Se deconnecter">
          <LogOut className="size-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="hidden items-center gap-2 md:flex">
      <Button asChild variant="ghost" size="sm" className="h-auto gap-2 px-2 text-left text-[#153675] hover:bg-slate-100">
        <Link href="/login">
          <span className="flex size-9 items-center justify-center rounded-full border-2 border-[#153675]"><User className="size-4" /></span>
          <span className="flex flex-col text-[11px] leading-tight"><span>Bonjour</span><strong className="text-xs">SE CONNECTER</strong></span>
        </Link>
      </Button>
    </div>
  );
}

function NavbarSearch({
  className,
  inputClassName,
  category,
}: {
  className?: string;
  inputClassName?: string;
  category: Category | null;
}) {
  const router = useRouter();
  const [searchValue, setSearchValue] = useState("");
  const deferredSearch = useDeferredValue(searchValue.trim());

  const productsQuery = useQuery({
    queryKey: ["navbar-search-products", deferredSearch, category?.id ?? null],
    queryFn: () =>
      getProducts({
        search: deferredSearch,
        categoryId: category?.id,
        includeDescendants: Boolean(category),
        limit: 10,
        page: 1,
        status: "PUBLIC",
      }),
    enabled: deferredSearch.length > 0,
  });

  const products = (productsQuery.data?.data ?? []) as SearchProduct[];
  const totalCount = productsQuery.data?.meta?.total ?? 0;

  const clearSearch = () => {
    setSearchValue("");
  };

  const handleViewAllResults = () => {
    if (!searchValue.trim()) return;
    const searchParams = new URLSearchParams({ [category ? "q" : "search"]: searchValue.trim() });
    router.push(`${category ? `/${category.slug}` : "/"}?${searchParams.toString()}`);
    clearSearch();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && searchValue.trim()) {
      handleViewAllResults();
    }
  };

  return (
    <div className={cn("w-full min-w-0", className)}>
      <div className="relative min-w-0 flex-1">
        <Input
          value={searchValue}
          onChange={(event) => setSearchValue(event.target.value)}
          onKeyDown={handleKeyDown}
          type="search"
          placeholder="Rechercher une machine, une marque, une reference..."
          className={cn(
            "h-[46px] w-full rounded-md border border-border bg-background/80 py-2 pr-12 pl-4 text-sm focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none",
            inputClassName,
          )}
          aria-label="Recherche"
        />
        {productsQuery.isFetching ? (
          <Loader2 className="absolute top-1/2 right-2.5 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        ) : (
          <Button
            type="button"
            variant="default"
            size="icon"
            className="absolute top-0 right-0 h-full w-12 rounded-none rounded-r-sm bg-[#2456b1] text-white hover:bg-[#153675]"
            onClick={handleViewAllResults}
            aria-label="Voir tous les résultats">
            <SearchIcon className="size-4" />
          </Button>
        )}

        {(products.length > 0 || (searchValue.trim() && !productsQuery.isFetching)) && (
          <div className="absolute z-[10000] mt-2 max-h-[80vh] w-full overflow-y-auto rounded-lg border border-border bg-background shadow-md">
            {products.length === 0 ? (
              <div className="flex items-center justify-center p-10">
                <span className="text-muted-foreground">
                  Aucun produit trouvé
                </span>
              </div>
            ) : (
              <>
                <div>
                  {products.map((product) => (
                    <Link
                      onClick={clearSearch}
                      href={buildProductHref(product)}
                      key={product.id}
                      className="flex items-center gap-4 p-2 hover:bg-foreground/5">
                      {product.images?.[0] ? (
                        <img
                          src={getImageUrl(product.images[0])}
                          alt={product.title}
                          width={56}
                          height={56}
                          className="h-14 w-14 rounded object-cover"
                        />
                      ) : (
                        <div className="flex h-14 w-14 items-center justify-center rounded bg-muted">
                          <Package className="size-5 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate font-medium">
                          {product.title}
                        </span>
                        {product.brand ? (
                          <span className="text-sm text-muted-foreground">
                            {product.brand.title}
                          </span>
                        ) : null}
                      </div>
                    </Link>
                  ))}
                </div>

                {totalCount > products.length ? (
                  <div className="border-t border-border p-3">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex w-full items-center justify-between"
                      onClick={handleViewAllResults}>
                      <span>Voir tous les résultats ({totalCount})</span>
                      <ArrowRight className="ml-2 size-4 shrink-0" />
                    </Button>
                  </div>
                ) : null}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function CategoriesDropdown({
  categories,
  label = "Categories",
  compact = false,
  onCategorySelect,
}: {
  categories: ParentWithChildren[];
  label?: string;
  compact?: boolean;
  onCategorySelect?: (category: Category | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [activeAudience, setActiveAudience] = useState<"professionnels" | "particuliers">("professionnels");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = compact ? "store-category-menu-search" : "store-category-menu-nav";
  const audienceRoot = findAudienceRoot(categories, activeAudience);
  const audienceCategories = audienceRoot?.children ?? categories;
  const selectedCategory =
    audienceCategories.find((category) => category.id === selectedCategoryId) ??
    audienceCategories[0] ??
    null;

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={cn("relative", compact && "hidden lg:block")}>
      <Button
        type="button"
        variant="ghost"
        className={cn(
          "flex items-center gap-1 text-[var(--header-text)] hover:bg-current/10",
          compact && "h-[46px] rounded-none border-0 border-r border-[#d7dfec] px-4 text-xs font-bold uppercase",
        )}
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={menuId}
        aria-haspopup="menu">
        {!compact ? <Menu className="size-4" /> : null}
        <span>{label}</span>
        <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
      </Button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label="Store categories"
          className="absolute top-full left-0 z-[10000] mt-2 w-[min(560px,calc(100vw-2rem))] overflow-hidden rounded-lg border border-[#dce3ee] bg-white text-[#263954] shadow-xl">
          <button
            type="button"
            className="w-full border-b border-[#e6ebf2] px-4 py-3 text-left text-sm font-bold uppercase text-[#153675] hover:bg-[#f1f5fb]"
            onClick={() => {
              onCategorySelect?.(null);
              setOpen(false);
            }}>
            Tout le magasin
          </button>
          <div className="grid grid-cols-2 border-b border-[#e6ebf2]" role="tablist" aria-label="Audience">
            {(["professionnels", "particuliers"] as const).map((audience) => (
              <button
                key={audience}
                type="button"
                role="tab"
                aria-selected={activeAudience === audience}
                className={cn(
                  "min-h-11 border-b-2 border-transparent px-3 text-xs font-bold uppercase text-[#929db0] transition-colors hover:text-[#153675]",
                  activeAudience === audience && "border-[#2456b1] text-[#2456b1]",
                )}
                onClick={() => {
                  setActiveAudience(audience);
                  setSelectedCategoryId(null);
                }}>
                {audience}
              </button>
            ))}
          </div>

          <div className="grid min-h-[320px] max-h-[min(520px,calc(100vh-12rem))] grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
            <ul className="overflow-y-auto border-r border-[#e6ebf2] py-2">
              {audienceCategories.map((category) => (
                <li key={category.id}>
                  {compact ? (
                    <button
                      type="button"
                      role="menuitem"
                      onMouseEnter={() => setSelectedCategoryId(category.id)}
                      onClick={() => {
                        onCategorySelect?.(category);
                        setOpen(false);
                      }}
                      className={cn(
                      "flex min-h-[38px] items-center justify-between gap-2 px-4 py-2 text-sm transition-colors hover:bg-[#f1f5fb] hover:text-[#2456b1]",
                      selectedCategory?.id === category.id && "bg-[#f1f5fb] text-[#2456b1]",
                      )}>
                      <span>{category.title}</span>
                      {category.children.length > 0 ? <span aria-hidden="true" className="text-xs text-[#7787a1]">&rsaquo;</span> : null}
                    </button>
                  ) : (
                    <Link
                      href={`/${category.slug}`}
                      role="menuitem"
                      onMouseEnter={() => setSelectedCategoryId(category.id)}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "flex min-h-[38px] items-center justify-between gap-2 px-4 py-2 text-sm transition-colors hover:bg-[#f1f5fb] hover:text-[#2456b1]",
                        selectedCategory?.id === category.id && "bg-[#f1f5fb] text-[#2456b1]",
                      )}>
                      <span>{category.title}</span>
                      {category.children.length > 0 ? <span aria-hidden="true" className="text-xs text-[#7787a1]">&rsaquo;</span> : null}
                    </Link>
                  )}
                </li>
              ))}
            </ul>

            <div className="overflow-y-auto px-5 py-4">
              {selectedCategory ? (
                <>
                  <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-[#929db0]">
                    {selectedCategory.title}
                  </h3>
                  <ul className="space-y-2">
                    {selectedCategory.children.map((child) => (
                      <li key={child.id}>
                        {compact ? (
                          <button
                            type="button"
                            className="block py-1 text-left text-sm hover:text-[#2456b1]"
                            onClick={() => {
                              onCategorySelect?.(child);
                              setOpen(false);
                            }}>
                            {child.title}
                          </button>
                        ) : (
                          <Link
                            href={`/${child.slug}`}
                            onClick={() => setOpen(false)}
                            className="block py-1 text-sm hover:text-[#2456b1]">
                            {child.title}
                          </Link>
                        )}
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function findAudienceRoot(
  categories: ParentWithChildren[],
  audience: "professionnels" | "particuliers",
): ParentWithChildren | null {
  for (const category of categories) {
    const normalize = (value: string) =>
      value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const title = normalize(category.title.trim());
    const slug = normalize(category.slug.trim());
    const matches = audience === "professionnels"
      ? ["professionnel", "professionnels"].includes(title) || ["professionnel", "professionnels", "pro"].includes(slug)
      : ["particulier", "particuliers"].includes(title) || ["particulier", "particuliers"].includes(slug);
    if (matches) return category;
    const nested = findAudienceRoot(category.children, audience);
    if (nested) return nested;
  }
  return null;
}
function NavLink({ href, children }: { href: string; children: ReactNode }) {
  const pathname = usePathname();
  const active =
    pathname === href || (href !== "/" && pathname.startsWith(href));

  return (
    <Link
      href={href}
      className={cn(
        "group relative font-medium transition-colors",
        active ? "text-[var(--header-accent)]" : "text-[var(--header-text)] hover:text-[var(--header-accent)]",
      )}>
      {children}
      <span className="absolute -bottom-1 left-0 h-0.5 w-0 bg-[var(--header-accent)] transition-all duration-300 group-hover:w-full" />
    </Link>
  );
}

function CartActionButton() {
  const [mounted, setMounted] = useState(false);
  const totalItems = useCartStore((state) => state.totalItems());
  const totalAmount = useCartStore((state) =>
    Object.values(state.items).reduce((sum, item) => {
      const price = Number(item.price.replace(/[^\d,.-]/g, "").replace(",", "."));
      return sum + (Number.isFinite(price) ? price * item.qty : 0);
    }, 0),
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  return (
    <Link href="/cart" aria-label="Panier" className="inline-flex min-h-11 items-center gap-2 rounded-md bg-[#153675] px-4 py-2 text-white hover:bg-[#10295f]">
      <ShoppingCart className="size-5" />
      <span className="hidden flex-col text-[11px] leading-tight sm:flex">
        <span>Panier{mounted && totalItems > 0 ? ` (${totalItems})` : ""}</span>
        <strong>{new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(mounted ? totalAmount : 0)}</strong>
      </span>
    </Link>
  );
}

function MobileMenu({
  isOpen,
  onClose,
  categories,
  session,
  config,
}: {
  isOpen: boolean;
  onClose: () => void;
  categories: ParentWithChildren[];
  session: ClientSession | null;
  config: HeaderConfig;
}) {
  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[10000] bg-black/50 lg:hidden"
        onClick={onClose}
        aria-hidden
      />
      <div className="fixed top-0 right-0 z-[10001] h-full w-80 overflow-y-auto border-l border-border bg-background shadow-xl lg:hidden">
        <div className="p-6">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl font-bold">Menu</h2>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
              aria-label="Fermer le menu">
              <X className="size-5" />
            </Button>
          </div>

          {config.showAccount && session ? (
            <div className="mb-6 rounded-lg border border-border bg-primary/5 p-3">
              <Link
                href="/mon-compte"
                onClick={onClose}
                className="flex items-center gap-3 rounded-md p-1 transition-colors hover:bg-primary/10 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <User className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {getClientDisplayName(session)}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {session.user?.email ?? "Compte client"}
                  </p>
                </div>
              </Link>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3 w-full justify-center text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => {
                  clearClientSession();
                  onClose();
                }}>
                <LogOut className="size-4" />
                Se deconnecter
              </Button>
            </div>
          ) : config.showAccount ? (
            <div className="mb-6 flex gap-2">
              <Button asChild variant="outline" size="sm" className="flex-1">
                <Link href="/login" onClick={onClose}>
                  Connexion
                </Link>
              </Button>
              <Button asChild size="sm" className="flex-1">
                <Link href="/signup" onClick={onClose}>
                  Inscription
                </Link>
              </Button>
            </div>
          ) : null}

          <div className="mb-6 space-y-4">
            {config.mobileLinks.map((link) => (
              <MobileNavLink
                key={`${link.label}-${link.url}`}
                href={link.url || "/"}
                onClick={onClose}>
                {link.label || "Link"}
              </MobileNavLink>
            ))}
            <MobileNavLink href="/admin_ben/login" onClick={onClose}>
              <span className="inline-flex items-center gap-2">
                <LayoutDashboard className="size-4" />
                Administration
              </span>
            </MobileNavLink>
          </div>

          <div className="mb-6">
            <h3 className="mb-3 font-semibold text-muted-foreground">
              Catégories
            </h3>
            <div className="space-y-2">
              {categories.slice(0, 8).map((category) => (
                <Link
                  key={category.id}
                  href={`/${category.slug}`}
                  onClick={onClose}
                  className="flex items-center gap-3 rounded-lg p-2 hover:bg-muted">
                  {category.image ? (
                    <img
                      src={getImageUrl(category.image)}
                      alt=""
                      className="size-6 rounded-full object-cover"
                    />
                  ) : null}
                  <span>{category.title}</span>
                </Link>
              ))}
            </div>
          </div>

          <div className="rounded-lg bg-primary/10 p-4">
            <h3 className="mb-2 font-semibold">Service Client</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Phone className="size-4" />
                <Link
                  href={telHref(config.phoneNumber)}
                  className="text-primary">
                  {config.phoneNumber}
                </Link>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="size-4" />
                <Link href={`mailto:${config.contactEmail}`} className="text-primary">
                  {config.contactEmail}
                </Link>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="size-4" />
                <span>{formatOpeningHours(config)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function MobileNavLink({
  href,
  children,
  onClick,
}: {
  href: string;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="block rounded-lg p-3 font-medium hover:bg-muted">
      {children}
    </Link>
  );
}
