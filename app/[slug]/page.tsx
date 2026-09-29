import type { Metadata } from "next";
import {
  QueryClient,
  HydrationBoundary,
  dehydrate,
} from "@tanstack/react-query";
import { CategoryPageClient } from "@/components/category-page/category-page-client";
import {
  categoryFiltersQueryKey,
  categoryProductsQueryKey,
} from "@/lib/category-catalog-query-keys";
import {
  fetchCategoryFilters,
  fetchCategoryProducts,
} from "@/lib/category-catalog-api";
import { getImageUrl } from "@/lib/api";
import { getDefaultOgImageUrl, toOgSafeImageUrl } from "@/lib/metadata";

function getSiteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "https://elbootic.com"
  );
}

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const slugTrim = slug?.trim() ?? "";
  if (!slugTrim) return { title: "Catégorie" };

  try {
    const [filtersResult, productsResult] = await Promise.all([
      fetchCategoryFilters(slugTrim).catch(() => null),
      fetchCategoryProducts({
        slug: slugTrim,
        page: 1,
        limit: 1,
      }).catch(() => null),
    ]);

    const title =
      productsResult?.title || filtersResult?.categoryTitle || slugTrim;
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
      title: `${title} | Elbootic`,
      description,
      alternates: { canonical: canonicalUrl },
      openGraph: {
        type: "website",
        title: `${title} | Elbootic`,
        description,
        url: canonicalUrl,
        siteName: "Elbootic",
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
        title: `${title} | Elbootic`,
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

  const [filtersResult, productsResult] = await Promise.all([
    slugTrim
      ? fetchCategoryFilters(slugTrim).catch(() => null)
      : Promise.resolve(null),
    slugTrim
      ? fetchCategoryProducts({
          slug: slugTrim,
          ...defaultProductsParams,
        }).catch(() => null)
      : Promise.resolve(null),
  ]);

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
    <HydrationBoundary state={dehydrate(queryClient)}>
      <CategoryPageClient slug={slug} />
    </HydrationBoundary>
  );
}
