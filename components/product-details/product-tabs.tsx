"use client";

import { useMemo, useState } from "react";

import type { ProductDetailsResponse } from "@/lib/product-details-api";

type TabKey = "description" | "details" | "comments";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function ProductTabs({
  product,
}: {
  product: ProductDetailsResponse;
}) {
  const [tab, setTab] = useState<TabKey>("description");

  const categoriesText = useMemo(() => {
    const slugs =
      product.categories
        ?.map((c) => c.category?.title || c.category?.slug)
        .filter(Boolean) ?? [];
    return slugs.join(" · ");
  }, [product.categories]);

  return (
    <section className="mt-6 overflow-hidden rounded-2xl border border-border/80 bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-border/60 bg-muted/30 px-2 pt-2">
        <button
          type="button"
          onClick={() => setTab("description")}
          className={cx(
            "rounded-t-xl border border-transparent px-4 py-2 text-sm font-semibold transition",
            tab === "description"
              ? "border-border/60 bg-white text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Description
        </button>
        <button
          type="button"
          onClick={() => setTab("details")}
          className={cx(
            "rounded-t-xl border border-transparent px-4 py-2 text-sm font-semibold transition",
            tab === "details"
              ? "border-border/60 bg-white text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Détail de produit
        </button>
        <button
          type="button"
          onClick={() => setTab("comments")}
          className={cx(
            "rounded-t-xl border border-transparent px-4 py-2 text-sm font-semibold transition",
            tab === "comments"
              ? "border-border/60 bg-white text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Commentaires
        </button>
      </div>

      <div className="px-5 py-5">
        {tab === "description" ? (
          product.description ? (
            <div
              className="prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: product.description }}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              Aucune description.
            </p>
          )
        ) : null}

        {tab === "details" ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-border/60 bg-muted/20 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-[#0858B1]">
                Marque
              </p>
              <p className="mt-1 text-sm font-medium text-foreground">
                {product.brand?.title ?? "—"}
              </p>
            </div>
            <div className="rounded-xl border border-border/60 bg-muted/20 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-[#0858B1]">
                Catégories
              </p>
              <p className="mt-1 text-sm font-medium text-foreground">
                {categoriesText || "—"}
              </p>
            </div>
            <div className="rounded-xl border border-border/60 bg-muted/20 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-[#0858B1]">
                TVA
              </p>
              <p className="mt-1 text-sm font-medium text-foreground">
                {product.taxRelation?.rate != null
                  ? `${product.taxRelation.rate > 1 ? product.taxRelation.rate : product.taxRelation.rate * 100}%`
                  : "—"}
              </p>
            </div>
            <div className="rounded-xl border border-border/60 bg-muted/20 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-[#0858B1]">
                Slug
              </p>
              <p className="mt-1 break-all text-sm font-medium text-foreground">
                {product.slug}
              </p>
            </div>
          </div>
        ) : null}

        {tab === "comments" ? (
          <div className="rounded-xl border border-border/60 bg-muted/20 px-4 py-6 text-center">
            <p className="text-sm font-semibold text-foreground">
              Commentaires
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Cette section sera bientôt disponible.
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}

