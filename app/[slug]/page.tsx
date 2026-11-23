import type { Metadata } from "next";
import {
  QueryClient,
  HydrationBoundary,
  dehydrate,
} from "@tanstack/react-query";
import { CatalogSidePanels } from "@/components/catalog/catalog-side-panels";
import { BuilderHome } from "@/components/home/builder-home";
import { getPublishedPage } from "@/lib/api/builder-page";
import { pageMetadata } from "@/lib/page-metadata";
import { getSiteSeo } from "@/lib/site-seo";
import { CategoryPageClient } from "@/components/category-page/category-page-client";
import { ProductDetailClient } from "@/components/product-detail/product-detail-client";
import {
  categoryFiltersQueryKey,
  categoryProductsQueryKey,
} from "@/lib/category-catalog-query-keys";
import {
  fetchCategoryFilters,
  fetchCategoryProducts,
} from "@/lib/category-catalog-api";
import { getImageUrl } from "@/lib/api";
import { getDefaultOgImageUrl, getSiteUrl, toOgSafeImageUrl } from "@/lib/metadata";
import { fetchProductBySlugWithDebug } from "@/lib/product-details-api";
import { notFound, redirect } from "next/navigation";
import { PageNotFound } from "@/components/shared/page-not-found";

type Props = {
  params: Promise<{ slug: string }>;
};

/** True when the backend answered « this category does not exist » (as opposed to being unreachable). */
const isMissing = (error: unknown) => error instanceof Error && /"statusCode"\s*:\s*404|HTTP 404/.test(error.message);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const slugTrim = slug?.trim() ?? "";
  if (!slugTrim) return { title: "Catégorie" };

  // Products without a category use the legacy root URL /[product-slug].html.
  if (slugTrim.toLowerCase().endsWith(".html")) {
    const productSlug = slugTrim.slice(0, -5);
    try {
      const { product } = await fetchProductBySlugWithDebug(productSlug);
      return {
        title: product?.title ?? productSlug,
        description: product?.shortDescription ?? undefined,
        alternates: { canonical: `${getSiteUrl()}/${slugTrim}` },
      };
    } catch {
      return { title: productSlug };
    }
  }

  try {
    let missing = false;
    const [filtersResult, productsResult] = await Promise.all([
      fetchCategoryFilters(slugTrim).catch((error: unknown) => {
        missing = isMissing(error);
        return null;
      }),
      fetchCategoryProducts({
        slug: slugTrim,
        page: 1,
        limit: 1,
      }).catch(() => null),
    ]);

    // Not a category: it may be a page built in the page builder (published pages live at /their-address).
    if (filtersResult == null && productsResult == null) {
      const page = await getPublishedPage(slugTrim);
      if (page) return pageMetadata(page, slugTrim);
      if (missing) return { title: "Page introuvable", robots: { index: false, follow: false } };
    }

    const title =
      productsResult?.title || filtersResult?.categoryTitle || slugTrim;
    const seo = await getSiteSeo();
    const description =
      productsResult?.description?.slice(0, 160) ||
      `Découvrez les produits de la catégorie ${title}`;
    const categoryImage = productsResult?.image?.trim()
      ? getImageUrl(productsResult.image)
      : null;
    const rawImage = categoryImage || (await getDefaultOgImageUrl());
    const ogSafe = toOgSafeImageUrl(rawImage);
    const canonicalUrl = `${getSiteUrl()}/categorie-produit/${slugTrim}`;

    return {
      metadataBase: new URL(getSiteUrl()),
      // The shop's title template adds the shop's name.
      title,
      description,
      alternates: { canonical: canonicalUrl },
      openGraph: {
        type: "website",
        title: `${title} | ${seo.siteName}`,
        description,
        url: canonicalUrl,
        siteName: seo.siteName,
        images: [
          {
            url: ogSafe.url,
            width: 1200,
            height: 630,
            alt: title,
            type: ogSafe.type,
          },
        ],
      },
      twitter: {
        card: "summary_large_image",
        title: `${title} | ${seo.siteName}`,
        description,
        images: [ogSafe.url],
      },
    };
  } catch {
    return { title: "Catégorie" };
  }
}

const defaultProductsParams = {
  page: 1,
  limit: 12,
  sortBy: "newest",
} as const;

/**
 * Category product page: /categorie-produit/[slug]
 *
 * Category pages are implemented in code and use the default catalog layout.
 */
export default async function CategoryProductPage({ params }: Props) {
  const { slug } = await params;
  const slugTrim = slug?.trim() ?? "";

  // A root-level .html URL is a product detail URL, not a category slug.
  if (slugTrim.toLowerCase().endsWith(".html")) {
    const productSlug = slugTrim.slice(0, -5);
    const { product } = await fetchProductBySlugWithDebug(productSlug);
    if (product) {
      const category = product.categories?.find(
        (item) => item.categoryId === product.mainCategoryId || item.category?.id === product.mainCategoryId,
      )?.category ?? product.categories?.[0]?.category;
      if (category?.slug) redirect(`/${category.slug}/${product.slug}.html`);
      return <CatalogSidePanels><ProductDetailClient categorySlug="" product={product} /></CatalogSidePanels>;
    }

    return <PageNotFound title="Ce produit n’est plus disponible" message="Il a peut-être été retiré de la boutique ou son adresse a changé. Cherchez-le par son nom ou sa référence." />;
  }

  let missing = false;
  const [filtersResult, productsResult] = await Promise.all([
    slugTrim
      ? fetchCategoryFilters(slugTrim).catch((error: unknown) => {
          missing = isMissing(error);
          return null;
        })
      : Promise.resolve(null),
    slugTrim
      ? fetchCategoryProducts({
          slug: slugTrim,
          ...defaultProductsParams,
        }).catch(() => null)
      : Promise.resolve(null),
  ]);

  // Not a category: show the page built in the page builder with this address, when it is published.
  if (slugTrim && filtersResult == null && productsResult == null) {
    const page = await getPublishedPage(slugTrim);
    if (page) return <main className="min-h-screen"><BuilderHome data={page.data} /></main>;
    // Neither a category nor a page: a real « not found » (the shop's friendly 404), not a raw error.
    if (missing) notFound();
  }

  const queryClient = new QueryClient();
  if (slugTrim && filtersResult != null) {
    queryClient.setQueryData(categoryFiltersQueryKey(slugTrim), filtersResult);
  }
  if (slugTrim && productsResult != null) {
    queryClient.setQueryData(
      categoryProductsQueryKey({
        slug: slugTrim,
        ...defaultProductsParams,
      }),
      productsResult,
    );
  }

  return (
    <CatalogSidePanels>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <CategoryPageClient slug={slug} />
      </HydrationBoundary>
    </CatalogSidePanels>
  );
}
