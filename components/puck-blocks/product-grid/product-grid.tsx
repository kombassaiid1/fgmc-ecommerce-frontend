"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Package } from "lucide-react";

import { ProductCard } from "@/components/product-card";
import {
  fetchCategoryProducts,
  type CategoryProductItem,
} from "@/lib/category-catalog-api";
import { getCategories, type Category } from "@/lib/api/categories";
import { cn } from "@/lib/utils";

export type CardsToShow = 4 | 6 | 8;

export type HeaderStyle = {
  color?: string;
  backgroundColor?: string;
  borderRadius?: string;
  margin?: string;
  padding?: string;
};

type ProductGridProps = {
  title: string;
  cardsToShow: CardsToShow;
  categoryId: string | undefined;
  headerStyle?: HeaderStyle;
};

function normalizeCardsToShow(value: number | string | undefined): CardsToShow {
  const parsed = Number(value);
  if (parsed === 6 || parsed === 8) return parsed;
  return 4;
}

export function ProductGrid({
  title,
  cardsToShow,
  categoryId,
  headerStyle,
}: ProductGridProps) {
  const [products, setProducts] = useState<CategoryProductItem[]>([]);
  const [category, setCategory] = useState<Category | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const visibleCards = normalizeCardsToShow(cardsToShow);
  const normalizedCategoryId = (categoryId ?? "").trim();

  const loadProducts = useCallback(async () => {
    if (!normalizedCategoryId || normalizedCategoryId === "__none__") {
      setProducts([]);
      setCategory(null);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const categories = await getCategories();
      const selectedCategory =
        categories.find((item) => item.id === normalizedCategoryId) ?? null;

      if (!selectedCategory?.slug) {
        setProducts([]);
        setCategory(null);
        setError("Categorie introuvable.");
        return;
      }

      const response = await fetchCategoryProducts({
        slug: selectedCategory.slug,
        limit: visibleCards,
      });

      setCategory(selectedCategory);
      setProducts(response.products ?? []);
    } catch (e) {
      setProducts([]);
      setCategory(null);
      setError(
        e instanceof Error ? e.message : "Impossible de charger les produits.",
      );
    } finally {
      setLoading(false);
    }
  }, [normalizedCategoryId, visibleCards]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadProducts();
  }, [loadProducts]);

  const gridClassName = useMemo(
    () =>
      cn(
        "grid gap-4 sm:grid-cols-2 lg:gap-5",
        visibleCards === 4 && "lg:grid-cols-4",
        visibleCards === 6 && "lg:grid-cols-3 xl:grid-cols-6",
        visibleCards === 8 && "lg:grid-cols-4 xl:grid-cols-8",
      ),
    [visibleCards],
  );

  if (!normalizedCategoryId || normalizedCategoryId === "__none__") {
    return (
      <section className="py-10 md:py-12">
        <h2 className="mb-6 text-2xl font-bold tracking-tight md:text-3xl">
          {title}
        </h2>
        <div className="rounded-2xl border-2 border-dashed border-muted-foreground/25 bg-muted/20 py-16 text-center text-muted-foreground">
          <Package className="mx-auto mb-3 size-10 opacity-50" />
          <p className="text-sm font-medium">
            Selectionnez une categorie dans l&apos;editeur pour afficher les
            produits.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="py-10 md:py-12">
      <div
        className="mb-6 flex flex-wrap items-end justify-between gap-4 md:mb-8"
        style={{
          color: headerStyle?.color || undefined,
          backgroundColor: headerStyle?.backgroundColor || undefined,
          borderRadius: headerStyle?.borderRadius || undefined,
          margin: headerStyle?.margin || undefined,
          padding: headerStyle?.padding || undefined,
        }}>
        <h2
          className="text-2xl font-bold tracking-tight md:text-3xl"
          style={{ color: "inherit" }}>
          {category?.title ?? title}
        </h2>
        {category ? (
          <Link
            href={`/${category.slug}`}
            className="text-sm font-semibold underline-offset-4 transition hover:underline"
            style={{ color: "inherit" }}>
            Voir tout
          </Link>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-6 text-center text-destructive">
          {error}
        </div>
      ) : loading ? (
        <div className={gridClassName}>
          {Array.from({ length: visibleCards }).map((_, index) => (
            <div
              key={index}
              className="aspect-[3/4] animate-pulse rounded-2xl bg-muted"
            />
          ))}
        </div>
      ) : products.length ? (
        <div className={gridClassName}>
          {products.slice(0, visibleCards).map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              categorySlug={category?.slug}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-border/60 bg-muted/20 py-16 text-center text-muted-foreground">
          <Package className="mx-auto mb-4 size-14" />
          <h3 className="mb-2 text-lg font-semibold">Aucun produit trouve</h3>
          <p className="text-sm">
            Aucun produit disponible dans cette categorie pour le moment.
          </p>
        </div>
      )}
    </section>
  );
}
