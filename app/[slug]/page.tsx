import Link from "next/link";
import { notFound } from "next/navigation";

import {
  getCategories,
  getCategoryFilters,
  getCategoryProducts,
} from "@/lib/api/categories";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type CategorySlugPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

const PRICE_BUCKETS = [
  { key: "0-500", label: "Less than 500 €", min: 0, max: 500 },
  { key: "500-1000", label: "500€-1000€", min: 500, max: 1000 },
  { key: "1000-1500", label: "1000€-1500€", min: 1000, max: 1500 },
  { key: "1500-2000", label: "1500€-2000€", min: 1500, max: 2000 },
  { key: "2000-2500", label: "2000€-2500€", min: 2000, max: 2500 },
  { key: "2500-3000", label: "2500€-3000€", min: 2500, max: 3000 },
  { key: "3000-3500", label: "3000€-3500€", min: 3000, max: 3500 },
  { key: "3500-4000", label: "3500€-4000€", min: 3500, max: 4000 },
  { key: "4000-plus", label: "plus que 4000€", min: 4000, max: 9999999 },
];

const SORT_OPTIONS = [
  { value: "newest", label: "meilleure vente" },
  { value: "price-low", label: "prix croissant" },
  { value: "price-high", label: "prix décroissant" },
  { value: "name-asc", label: "nom A-Z" },
  { value: "name-desc", label: "nom Z-A" },
];

function parseNumber(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function pickValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function formatPrice(price: string | number): string {
  const n = typeof price === "number" ? price : Number(price);
  if (!Number.isFinite(n)) return "0,00 €";
  return (
    new Intl.NumberFormat("fr-FR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n) + " €"
  );
}

function buildHref(
  slug: string,
  current: { [key: string]: string | undefined },
  patch: Partial<{ [key: string]: string | undefined }>,
) {
  const qs = new URLSearchParams();
  const merged = { ...current, ...patch };
  Object.entries(merged).forEach(([key, value]) => {
    if (value && value.trim()) {
      qs.set(key, value);
    }
  });
  const query = qs.toString();
  return query ? `/${slug}?${query}` : `/${slug}`;
}

export default async function CategorySlugPage({
  params,
  searchParams,
}: CategorySlugPageProps) {
  const { slug } = await params;
  const query = await searchParams;

  const categories = await getCategories({ slug });
  if (!categories.length) {
    notFound();
  }

  const currentSort = pickValue(query.sortBy) ?? "newest";
  const currentSearch = pickValue(query.search) ?? "";
  const currentSubcategory = pickValue(query.subcategory) ?? "";
  const currentPriceBucket = pickValue(query.priceBucket) ?? "";
  const currentPage = parseNumber(pickValue(query.page)) ?? 1;

  const selectedBucket = PRICE_BUCKETS.find(
    (b) => b.key === currentPriceBucket,
  );
  const minPrice =
    selectedBucket?.min ?? parseNumber(pickValue(query.minPrice));
  const maxPrice =
    selectedBucket?.max ?? parseNumber(pickValue(query.maxPrice));

  const [filters, productsResult] = await Promise.all([
    getCategoryFilters(slug),
    getCategoryProducts({
      slug,
      page: currentPage,
      limit: 18,
      sortBy: currentSort,
      search: currentSearch || undefined,
      filterCategories: currentSubcategory || undefined,
      minPrice,
      maxPrice,
    }),
  ]);

  const currentParams = {
    sortBy: currentSort,
    search: currentSearch,
    subcategory: currentSubcategory,
    priceBucket: currentPriceBucket,
    page: String(currentPage),
  };

  return (
    <main className="mx-auto w-full max-w-full px-2 py-3">
      <div className="grid grid-cols-1 gap-2 md:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="border border-[#d8d8d8] bg-[#f3f3f3] p-3">
          <h2 className="mb-2 border-b border-[#d0d0d0] pb-2 text-sm font-semibold uppercase tracking-wide text-[#444]">
            Filtre
          </h2>

          <form method="get" className="mb-3">
            <input type="hidden" name="search" value={currentSearch} />
            <input
              type="hidden"
              name="subcategory"
              value={currentSubcategory}
            />
            <input
              type="hidden"
              name="priceBucket"
              value={currentPriceBucket}
            />
            <label className="mb-1 block text-xs text-[#666]">sort</label>
            <div className="flex items-center gap-2">
              <select
                className="w-full rounded border border-[#cfcfcf] bg-white px-2 py-1 text-sm"
                defaultValue={currentSort}
                name="sortBy">
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="rounded border border-[#cfcfcf] bg-white px-2 py-1 text-sm">
                OK
              </button>
            </div>
          </form>

          <form method="get" className="mb-3">
            <input type="hidden" name="sortBy" value={currentSort} />
            <input
              type="hidden"
              name="subcategory"
              value={currentSubcategory}
            />
            <input
              type="hidden"
              name="priceBucket"
              value={currentPriceBucket}
            />
            <div className="flex items-center gap-2">
              <input
                name="search"
                defaultValue={currentSearch}
                placeholder="chercher"
                className="w-full rounded border border-[#cfcfcf] bg-white px-2 py-1 text-sm"
              />
              <button
                type="submit"
                className="rounded border border-[#cfcfcf] bg-white px-2 py-1 text-sm">
                OK
              </button>
            </div>
          </form>

          <div className="mb-2">
            <h3 className="mb-2 rounded border border-[#d2d2d2] bg-[#ebebeb] px-2 py-1 text-sm font-semibold text-[#555]">
              Marque
            </h3>
            <div className="space-y-1">
              {filters.subcategories.map((sub) => {
                const active = currentSubcategory === sub.slug;
                return (
                  <Link
                    key={sub.id}
                    href={buildHref(slug, currentParams, {
                      subcategory: active ? undefined : sub.slug,
                      page: "1",
                    })}
                    className={`block rounded px-2 py-1 text-sm ${
                      active
                        ? "bg-[#dedede] font-semibold text-[#262626]"
                        : "text-[#555] hover:bg-[#ebebeb]"
                    }`}>
                    {sub.title}
                  </Link>
                );
              })}
            </div>
          </div>

          <div>
            <h3 className="mb-2 rounded border border-[#d2d2d2] bg-[#ebebeb] px-2 py-1 text-sm font-semibold text-[#555]">
              Price
            </h3>
            <div className="space-y-1">
              {PRICE_BUCKETS.map((bucket) => {
                const active = currentPriceBucket === bucket.key;
                return (
                  <Link
                    key={bucket.key}
                    href={buildHref(slug, currentParams, {
                      priceBucket: active ? undefined : bucket.key,
                      page: "1",
                    })}
                    className={`block rounded px-2 py-1 text-sm ${
                      active
                        ? "bg-[#dedede] font-semibold text-[#262626]"
                        : "text-[#555] hover:bg-[#ebebeb]"
                    }`}>
                    {bucket.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </aside>

        <section className="border border-[#d8d8d8] bg-[#f3f3f3] p-2">
          <div className="mb-2 flex items-center justify-between border-b border-[#d9d9d9] pb-2">
            <h1 className="text-sm font-semibold text-[#444]">
              {productsResult.title}
            </h1>
            <span className="text-xs text-[#777]">
              {productsResult.totalCount} produits
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {productsResult.products.map((product) => (
              <article
                key={product.id}
                className="rounded border border-[#cfcfcf] bg-white p-1 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
                <Link href={`/${product.slug}`} className="block">
                  <div className="relative mb-1 aspect-square overflow-hidden border border-[#d5d5d5] bg-[#fafafa]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={product.images?.[0] || "/logo.png"}
                      alt={product.title}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <h3 className="line-clamp-3 min-h-[48px] text-center text-[12px] font-medium uppercase text-[#444]">
                    {product.title}
                  </h3>
                  <p className="mt-1 text-center text-lg font-semibold text-[#e02424]">
                    {formatPrice(product.price)}
                  </p>
                </Link>
                <div className="mt-1 flex items-center justify-center">
                  <button className="h-6 w-6 rounded-l border border-[#a9a9a9] text-sm">
                    -
                  </button>
                  <span className="h-6 min-w-[28px] border-y border-[#a9a9a9] px-2 text-center text-sm leading-6">
                    1
                  </span>
                  <button className="h-6 w-6 rounded-r border border-[#a9a9a9] text-sm">
                    +
                  </button>
                </div>
              </article>
            ))}
          </div>

          {productsResult.totalPages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-2">
              <Link
                href={buildHref(slug, currentParams, {
                  page: String(Math.max(currentPage - 1, 1)),
                })}
                className={`rounded border px-3 py-1 text-sm ${
                  currentPage <= 1 ? "pointer-events-none opacity-40" : ""
                }`}>
                Précédent
              </Link>
              <span className="text-sm text-[#555]">
                Page {productsResult.currentPage} / {productsResult.totalPages}
              </span>
              <Link
                href={buildHref(slug, currentParams, {
                  page: String(
                    Math.min(currentPage + 1, productsResult.totalPages),
                  ),
                })}
                className={`rounded border px-3 py-1 text-sm ${
                  currentPage >= productsResult.totalPages
                    ? "pointer-events-none opacity-40"
                    : ""
                }`}>
                Suivant
              </Link>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
