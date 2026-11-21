"use client";

import { ProductCard, type ProductCardStyle } from "@/components/product-card";

import type { OfferProduct } from "../daily-offers/offers";

export type FeaturedCardStyle = ProductCardStyle;

/** Page-builder wrapper: the block only forwards its style settings to the standard card. */
export function FeaturedProductCard({
  product,
  style,
  isEditing,
  onLinkClick,
}: {
  product: OfferProduct;
  style: FeaturedCardStyle;
  isEditing: boolean;
  onLinkClick: (event: React.MouseEvent) => void;
}) {
  return (
    <ProductCard
      product={product}
      variant="featured"
      style={style}
      isEditing={isEditing}
      onLinkClick={onLinkClick}
    />
  );
}
