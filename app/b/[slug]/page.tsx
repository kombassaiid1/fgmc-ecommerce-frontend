import type { Metadata } from "next";

import { BrandPageClient } from "@/components/brand-page/brand-page-client";
import { getBrands } from "@/lib/api/brands";

type Props = {
  params: Promise<{ slug: string }>;
};

async function getBrandTitle(slug: string) {
  const response = await getBrands({ limit: 200 }).catch(() => null);
  return response?.data.find((brand) => brand.slug === slug)?.title ?? slug;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const title = await getBrandTitle(slug);

  return {
    title: `${title} | Marques`,
    description: `Découvrez les produits de la marque ${title}.`,
  };
}

export default async function BrandPage({ params }: Props) {
  const { slug } = await params;
  return <BrandPageClient slug={slug} />;
}
