"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BadgeIcon } from "lucide-react";

import { getImageUrl } from "@/lib/api";
import { getBrands, type Brand } from "@/lib/api/brands";
import { cn } from "@/lib/utils";

type ShopByTopBrandsBlockProps = {
  title?: string;
  limit?: number;
  backgroundColor?: string;
  cardBackgroundColor?: string;
  titleFontSize?: number;
  titleFontWeight?: string;
};

function clampLimit(value: number | string | undefined) {
  const parsed = Math.round(Number(value));
  if (!Number.isFinite(parsed)) return 10;
  return Math.min(24, Math.max(1, parsed));
}

function clampTitleFontSize(value: number | string | undefined) {
  const parsed = Math.round(Number(value));
  if (!Number.isFinite(parsed)) return 24;
  return Math.min(64, Math.max(12, parsed));
}

function sortTopBrands(brands: Brand[]) {
  return [...brands].sort((a, b) => {
    const productDelta = (b._count?.products ?? 0) - (a._count?.products ?? 0);
    if (productDelta !== 0) return productDelta;
    return a.title.localeCompare(b.title, "fr");
  });
}

export function ShopByTopBrandsBlock({
  title = "Shop By Top Brands",
  limit = 10,
  backgroundColor = "#f6f6f6",
  cardBackgroundColor = "#ffffff",
  titleFontSize = 24,
  titleFontWeight = "700",
}: ShopByTopBrandsBlockProps) {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const safeLimit = clampLimit(limit);
  const safeTitleFontSize = clampTitleFontSize(titleFontSize);

  const loadBrands = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await getBrands({ limit: Math.max(safeLimit, 12) });
      setBrands(sortTopBrands(response.data).slice(0, safeLimit));
    } catch (e) {
      setBrands([]);
      setError(
        e instanceof Error ? e.message : "Impossible de charger les marques.",
      );
    } finally {
      setLoading(false);
    }
  }, [safeLimit]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadBrands();
  }, [loadBrands]);

  const skeletonItems = useMemo(
    () => Array.from({ length: Math.min(safeLimit, 10) }),
    [safeLimit],
  );

  return (
    <section
      className="w-full overflow-hidden py-6"
      style={{ backgroundColor: backgroundColor || "#f6f6f6" }}>
      <div className="px-6 md:px-12">
        <h2
          className="mb-7! tracking-normal text-foreground"
          style={{
            fontSize: safeTitleFontSize,
            fontWeight: titleFontWeight || "700",
            lineHeight: 1.2,
          }}>
          {title}
        </h2>

        {error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        ) : (
          <div
            className={cn(
              "flex gap-1.5 overflow-x-auto pb-2",
              "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
            )}>
            {loading
              ? skeletonItems.map((_, index) => (
                  <div
                    key={index}
                    className="h-[94px] w-[168px] shrink-0 animate-pulse rounded-lg border border-border/70 bg-white/70"
                  />
                ))
              : brands.map((brand) => (
                  <Link
                    key={brand.id}
                    href={`/b/${brand.slug}`}
                    className="flex h-[94px] w-[168px] shrink-0 items-center justify-center rounded-lg border border-border/70 px-7 py-5 shadow-[0_1px_0_rgba(15,23,42,0.03)]"
                    style={{
                      backgroundColor: cardBackgroundColor || "#ffffff",
                    }}
                    aria-label={`Voir les produits ${brand.title}`}>
                    {brand.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={getImageUrl(brand.image)}
                        alt={brand.title}
                        loading="lazy"
                        className="max-h-12 w-full object-contain"
                      />
                    ) : (
                      <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                        <BadgeIcon className="size-5" aria-hidden />
                        <span className="line-clamp-1">{brand.title}</span>
                      </div>
                    )}
                  </Link>
                ))}
          </div>
        )}
      </div>
    </section>
  );
}
