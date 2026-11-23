import type { Metadata } from "next";

import { getImageUrl } from "@/lib/api";
import { getSiteUrl, toOgSafeImageUrl } from "@/lib/metadata";
import type { ProductDetailsResponse } from "@/lib/product-details-api";
import {
  buildBreadcrumbJsonLd,
  buildProductJsonLd,
  jsonLdString,
  productCategory,
  productPath,
  stripHtml,
  truncateText,
} from "@/lib/seo";
import { getSiteSeo } from "@/lib/site-seo";
import { storefrontPath } from "@/lib/storefront-path";

/**
 * The metadata of a product page, shared by the two product routes (/category/product.html and /product.html).
 * What the « SEO » tab of the product says wins; otherwise the product's own name and short description.
 */
export async function buildProductMetadata(product: ProductDetailsResponse): Promise<Metadata> {
  const seo = await getSiteSeo();
  const customTitle = product.metaTitle?.trim();
  const description =
    product.metaDescription?.trim() ||
    truncateText(stripHtml(product.shortDescription) || stripHtml(product.description), 160) ||
    seo.metaDescription ||
    undefined;
  const canonical = productPath(product, productCategory(product)?.slug);
  const firstImage = product.images?.[0] ? getImageUrl(product.images[0]) : null;
  const image = firstImage ? toOgSafeImageUrl(firstImage) : seo.ogImage ? toOgSafeImageUrl(seo.ogImage) : null;
  const keywords = product.metaKeywords?.split(",").map((word) => word.trim()).filter(Boolean);
  const fullTitle = customTitle ?? `${product.title} | ${seo.siteName}`;

  return {
    // The SEO title is the whole title (as shown in Google); without one the shop's title template adds the shop name.
    title: customTitle ? { absolute: customTitle } : product.title,
    description,
    ...(keywords?.length ? { keywords } : {}),
    alternates: { canonical },
    openGraph: {
      type: "website",
      siteName: seo.siteName,
      title: fullTitle,
      description,
      url: canonical,
      ...(image ? { images: [{ url: image.url, width: 1200, height: 630, alt: product.title, type: image.type }] } : {}),
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title: fullTitle,
      description,
      ...(image ? { images: [image.url] } : {}),
    },
  };
}

/** The structured data (Product and BreadcrumbList) Google reads to show price, stock and rating in results. */
export async function ProductJsonLd({ product }: { product: ProductDetailsResponse }) {
  const seo = await getSiteSeo();
  const siteUrl = getSiteUrl();
  const category = productCategory(product);
  const url = `${siteUrl}${productPath(product, category?.slug)}`;
  const description =
    product.metaDescription?.trim() ||
    truncateText(stripHtml(product.shortDescription) || stripHtml(product.description), 300);

  const productLd = buildProductJsonLd({
    product,
    url,
    images: (product.images ?? []).map((image) => getImageUrl(image)).filter(Boolean),
    description,
    siteName: seo.siteName,
  });
  const breadcrumbLd = buildBreadcrumbJsonLd([
    { name: "Accueil", url: `${siteUrl}${storefrontPath()}` },
    ...(category?.slug ? [{ name: category.title, url: `${siteUrl}${storefrontPath(`/${category.slug}`)}` }] : []),
    { name: product.title, url },
  ]);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(productLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(breadcrumbLd) }} />
    </>
  );
}
