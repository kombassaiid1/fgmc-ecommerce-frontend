import type { Metadata } from "next";
import {
  QueryClient,
  HydrationBoundary,
  dehydrate,
} from "@tanstack/react-query";
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
import { redirect } from "next/navigation";

type Props = {
  params: Promise<{ slug: string }>;
};

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

  // A root-level .html URL is a product detail URL, not a category slug.
  if (slugTrim.toLowerCase().endsWith(".html")) {
    const productSlug = slugTrim.slice(0, -5);
    const { product } = await fetchProductBySlugWithDebug(productSlug);
    if (product) {
      const category = product.categories?.find(
        (item) => item.categoryId === product.mainCategoryId || item.category?.id === product.mainCategoryId,
      )?.category ?? product.categories?.[0]?.category;
      if (category?.slug) redirect(`/${category.slug}/${product.slug}.html`);
      return <ProductDetailClient categorySlug="" product={product} />;
    }

    return (
      <main className="min-h-[60vh] bg-muted/30 px-4 py-16">
        <div className="mx-auto max-w-xl rounded-2xl border border-border/80 bg-white p-6 text-center shadow-sm">
          <p className="text-sm font-semibold text-destructive">Produit introuvable ou non disponible pour le moment.</p>
        </div>
      </main>
    );
  }

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
