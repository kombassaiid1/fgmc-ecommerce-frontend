"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";

import { getImageUrl } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useCartStore } from "@/lib/stores/cart-store";
import { Button } from "@/components/ui/button";

export default function CartPage() {
  const itemsByKey = useCartStore((s) => s.items);
  const items = useMemo(() => Object.values(itemsByKey), [itemsByKey]);
  const setItemQty = useCartStore((s) => s.setItemQty);
  const removeItem = useCartStore((s) => s.removeItem);
  const clear = useCartStore((s) => s.clear);

  const totalQty = useMemo(
    () => items.reduce((sum, item) => sum + (item.qty ?? 0), 0),
    [items],
  );

  return (
    <main className="min-h-screen bg-muted/30">
      <div className="container mx-auto max-w-[1200px] px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Panier
          </h1>
          {items.length > 0 ? (
            <Button variant="outline" onClick={clear} className="rounded-lg">
              Vider le panier
            </Button>
          ) : null}
        </div>

        {items.length === 0 ? (
          <div className="rounded-2xl border border-border/70 bg-white p-10 text-center shadow-sm">
            <div className="mx-auto mb-4 grid size-14 place-items-center rounded-full bg-muted/60">
              <ShoppingCart className="size-6 text-muted-foreground" />
            </div>
            <p className="text-base font-semibold text-foreground">
              Votre panier est vide
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Ajoutez des produits pour les retrouver ici.
            </p>
            <Button asChild className="mt-6 rounded-lg">
              <Link href="/">Continuer vos achats</Link>
            </Button>
          </div>
        ) : (
          <div className="grid gap-4">
            <div className="rounded-xl border border-border/70 bg-white px-5 py-4 shadow-sm">
              <p className="text-sm text-muted-foreground">
                {totalQty} article{totalQty !== 1 ? "s" : ""}
              </p>
            </div>

            <div className="rounded-2xl border border-border/70 bg-white shadow-sm">
              <ul className="divide-y divide-border/60">
                {items.map((item) => {
                  const img = item.image?.trim()
                    ? getImageUrl(item.image)
                    : null;
                  return (
                    <li key={item.key} className="p-4 sm:p-5">
                      <div className="flex gap-4">
                        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-border/70 bg-muted/30">
                          {img ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={img}
                              alt={item.title}
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          ) : null}
                        </div>

                        <div className="min-w-0 flex-1">
                          <Link
                            href={
                              item.categorySlug?.trim()
                                ? `/${item.categorySlug}/${item.productSlug}.html`
                                : `/${item.productSlug}.html`
                            }
                            className="line-clamp-2 text-sm font-semibold text-foreground hover:underline"
                          >
                            {item.title}
                          </Link>

                          <div className="mt-3 flex flex-wrap items-center gap-3">
                            <div className="inline-flex items-stretch overflow-hidden rounded-md border border-border/80 bg-white shadow-sm">
                              <button
                                type="button"
                                className="grid h-9 w-9 place-items-center text-foreground hover:bg-muted/50 disabled:opacity-40"
                                onClick={() => setItemQty(item.key, item.qty - 1)}
                                disabled={item.qty <= 0}
                                aria-label="Diminuer la quantité"
                              >
                                <Minus className="size-4" />
                              </button>
                              <div className="grid h-9 min-w-10 place-items-center border-x border-border/80 px-2 text-sm font-semibold tabular-nums">
                                {item.qty}
                              </div>
                              <button
                                type="button"
                                className="grid h-9 w-9 place-items-center text-foreground hover:bg-muted/50"
                                onClick={() => setItemQty(item.key, item.qty + 1)}
                                aria-label="Augmenter la quantité"
                              >
                                <Plus className="size-4" />
                              </button>
                            </div>

                            <Button
                              variant="ghost"
                              size="sm"
                              className={cn("h-9 rounded-md px-2")}
                              onClick={() => removeItem(item.key)}
                            >
                              <Trash2 className="size-4" />
                              Supprimer
                            </Button>
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

