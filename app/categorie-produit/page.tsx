import type { Metadata } from "next";
import { QueryClient, HydrationBoundary, dehydrate } from "@tanstack/react-query";

import { CatalogSidePanels } from "@/components/catalog/catalog-side-panels";
import { CategoryPageClient } from "@/components/category-page/category-page-client";
import { fetchCategoryFilters, fetchCategoryProducts } from "@/lib/category-catalog-api";
import { categoryFiltersQueryKey, categoryProductsQueryKey } from "@/lib/category-catalog-query-keys";
import { getSiteSeo } from "@/lib/site-seo";

/** The shop root's slug on the backend: a virtual category holding every published product (see CategoriesService.shopRoot). */
const SHOP_SLUG = "categorie-produit";

export async function generateMetadata(): Promise<Metadata> {
  const seo = await getSiteSeo();
  const description = `Tous les produits de ${seo.siteName} : machines à coudre et à broder, pièces détachées, fils et accessoires. Filtrez par catégorie, marque ou prix.`;
  return {
    title: "Boutique",
    description,
    alternates: { canonical: "/categorie-produit" },
    openGraph: { type: "website", title: `Boutique | ${seo.siteName}`, description, url: "/categorie-produit" },
  };
}

const defaultProductsParams = { page: 1, limit: 12, sortBy: "newest" } as const;

/**
 * /categorie-produit: the whole catalogue with the same page as any category (filters by category, brand, price and
 * attributes, sorting, pagination), starting from every product and with the top-level categories as the first filter.
 */
export default async function ShopPage() {
  const [filters, products] = await Promise.all([
    fetchCategoryFilters(SHOP_SLUG).catch(() => null),
    fetchCategoryProducts({ slug: SHOP_SLUG, ...defaultProductsParams }).catch(() => null),
  ]);

  const queryClient = new QueryClient();
  if (filters != null) queryClient.setQueryData(categoryFiltersQueryKey(SHOP_SLUG), filters);
  if (products != null) queryClient.setQueryData(categoryProductsQueryKey({ slug: SHOP_SLUG, ...defaultProductsParams }), products);

  return (
    <CatalogSidePanels>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <CategoryPageClient slug={SHOP_SLUG} />
      </HydrationBoundary>
    </CatalogSidePanels>
  );
}
