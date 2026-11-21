"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Minus, Package, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { getImageUrl } from "@/lib/api";
import { useCartStore, type CartItem } from "@/lib/stores/cart-store";

function parsePrice(value: string): number {
  const parsed = Number.parseFloat(
    String(value).replace(/[^0-9.,-]/g, "").replace(",", "."),
  );
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatEuro(value: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/** Splits a price into euros ("1 026") and cents ("96") for typographic display. */
function splitPrice(value: number) {
  const totalCents = Math.round(value * 100);
  return {
    euros: new Intl.NumberFormat("fr-FR").format(Math.floor(totalCents / 100)),
    cents: String(totalCents % 100).padStart(2, "0"),
  };
}

function rateToFraction(rate: number | null | undefined): number {
  if (rate == null || !Number.isFinite(rate)) return 0;
  return rate > 1 ? rate / 100 : rate;
}

function buildItemHref(item: {
  categorySlug?: string | null;
  productSlug: string;
}) {
  const productSlug = item.productSlug.trim().replace(/^\/+|\/+$/g, "");
  const categorySlug = item.categorySlug?.trim().replace(/^\/+|\/+$/g, "");
  return categorySlug ? `/${categorySlug}/${productSlug}.html` : `/${productSlug}.html`;
}

/** Same big-euros / small-cents price as the product card. */
function BigPrice({ value, size = "md" }: { value: number; size?: "md" | "lg" }) {
  const { euros, cents } = splitPrice(value);
  return (
    <span
      className="whitespace-nowrap font-semibold leading-none tracking-tight tabular-nums"
      aria-label={formatEuro(value)}>
      <span className={size === "lg" ? "text-[44px]" : "text-[30px]"} aria-hidden="true">{euros}</span>
      <span className={size === "lg" ? "align-top text-2xl" : "align-top text-lg"} aria-hidden="true">,{cents}</span>
      <span className={size === "lg" ? "ml-1 text-xl" : "ml-1 text-sm"} aria-hidden="true">€</span>
    </span>
  );
}

/** Quantity you can type: tap the number to enter 50 spools at once. */
function QtyInput({
  value,
  label,
  onCommit,
}: {
  value: number;
  label: string;
  onCommit: (qty: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft === null) return;
    const next = Number.parseInt(draft, 10);
    if (Number.isFinite(next) && next >= 1 && next !== value) onCommit(next);
    setDraft(null);
  };
  return (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      aria-label={label}
      value={draft ?? String(value)}
      onFocus={(event) => event.currentTarget.select()}
      onChange={(event) => setDraft(event.target.value.replace(/\D/g, "").slice(0, 4))}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") setDraft(null);
      }}
      className="h-10 w-14 rounded bg-transparent text-center text-lg font-semibold tabular-nums outline-none focus:bg-[var(--cart-linen)] focus-visible:ring-2 focus-visible:ring-[var(--cart-royal)]"
    />
  );
}

const LEAVE_MS = 220;

export default function CartPage() {
  const itemsByKey = useCartStore((state) => state.items);
  const items = useMemo(() => Object.values(itemsByKey), [itemsByKey]);
  const setItemQty = useCartStore((state) => state.setItemQty);
  const removeItem = useCartStore((state) => state.removeItem);
  const addItem = useCartStore((state) => state.addItem);
  const clearCart = useCartStore((state) => state.clear);
  const [leaving, setLeaving] = useState<Set<string>>(new Set());

  const restore = useCallback(
    (removed: CartItem[]) => {
      for (const { qty, ...rest } of removed) {
        const payload: Parameters<typeof addItem>[0] = { ...rest };
        delete (payload as { key?: string }).key;
        addItem(payload, qty);
      }
    },
    [addItem],
  );

  /** Removes a line after a short exit, and offers to put it back. */
  const removeWithUndo = (item: CartItem) => {
    setLeaving((prev) => new Set(prev).add(item.key));
    window.setTimeout(() => {
      removeItem(item.key);
      setLeaving((prev) => {
        const next = new Set(prev);
        next.delete(item.key);
        return next;
      });
      toast("Article retiré du panier", {
        description: item.title,
        duration: 6000,
        action: { label: "Annuler", onClick: () => restore([item]) },
      });
    }, LEAVE_MS);
  };

  const emptyCart = () => {
    const snapshot = items;
    clearCart();
    toast("Panier vidé", {
      duration: 6000,
      action: { label: "Annuler", onClick: () => restore(snapshot) },
    });
  };

  const productsSubtotalTtc = useMemo(
    () =>
      items.reduce((sum, item) => {
        const unitHt = parsePrice(item.price);
        const unitTtc = unitHt * (1 + rateToFraction(item.taxRate));
        return sum + unitTtc * Math.max(0, item.qty ?? 0);
      }, 0),
    [items],
  );
  const unitCount = useMemo(
    () => items.reduce((sum, item) => sum + Math.max(0, item.qty ?? 0), 0),
    [items],
  );
  const hasItems = items.length > 0;

  return (
    <main
      className="min-h-screen bg-[var(--cart-linen)] pb-28 text-[var(--cart-ink)] lg:pb-0"
      style={
        {
          "--cart-ink": "#0f1f45",
          "--cart-royal": "#153675",
          "--cart-thread": "#d6202e",
          "--cart-linen": "#f2f5fa",
          "--cart-seam": "#b4c2dc",
          "--cart-line": "#d5deee",
          "--cart-muted": "#5b6b8a",
        } as React.CSSProperties
      }>
      {/* Same tailor's tape as the category pages: the item count is pinned to it. */}
      <header className="relative bg-[var(--cart-ink)] text-white">
        <div className="mx-auto w-full max-w-[1360px] px-4 pb-20 pt-6 sm:px-6 lg:px-10">
          <nav aria-label="Breadcrumb">
            <ol className="flex items-center gap-1.5 text-sm text-white/70">
              <li>
                <Link
                  href="/"
                  className="-mx-1 rounded px-1 transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
                  Accueil
                </Link>
              </li>
              <li aria-hidden className="flex items-center">
                <ChevronRight className="size-3.5" />
              </li>
              <li aria-current="page" className="font-medium text-white">Panier</li>
            </ol>
          </nav>
          <h1 className="mt-6 text-5xl! font-semibold! leading-[0.95]! tracking-tight sm:text-6xl!">
            Votre panier
          </h1>
        </div>
        <div className="cat-tape absolute inset-x-0 bottom-0" aria-hidden="true" />
        {hasItems ? (
          <p className="absolute bottom-2.5 left-4 rounded-[3px] bg-[var(--cart-thread)] px-3 py-1 text-sm font-medium tabular-nums text-white shadow-[0_2px_0_rgba(15,31,69,0.35)] sm:left-6 lg:left-10">
            {unitCount} article{unitCount !== 1 ? "s" : ""}
          </p>
        ) : null}
      </header>

      <div className="mx-auto w-full max-w-[1360px] px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
        {!hasItems ? (
          <section className="mx-auto max-w-xl py-16 text-center">
            <h2 className="text-3xl! font-semibold!">Votre panier est vide</h2>
            <p className="mt-3 text-base text-[var(--cart-muted)]">
              Ajoutez des produits depuis une catégorie : ils apparaîtront ici avec leur prix TTC et HT.
            </p>
            <Link
              href="/categorie-produit"
              className="mt-8 inline-flex min-h-12 items-center rounded-[4px] bg-[var(--cart-royal)] px-8 text-base font-medium text-white transition-colors duration-200 hover:bg-[var(--cart-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
              Voir les produits
            </Link>
          </section>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start xl:gap-12">
            <section className="min-w-0" aria-label="Articles du panier">
              <ul className="space-y-3">
                {items.map((item) => {
                  const image = item.image?.trim() ? getImageUrl(item.image) : null;
                  const qty = Math.max(0, item.qty ?? 0);
                  const unitHt = parsePrice(item.price);
                  const unitTtc = unitHt * (1 + rateToFraction(item.taxRate));
                  const lineHt = unitHt * qty;
                  const lineTtc = unitTtc * qty;
                  const href = buildItemHref(item);

                  return (
                    <li
                      key={item.key}
                      className={`grid grid-cols-[88px_minmax(0,1fr)] gap-x-4 gap-y-4 rounded-[4px] border border-[var(--cart-line)] bg-white p-3 transition-[opacity,transform,border-color] duration-200 hover:border-[var(--cart-seam)] motion-reduce:transition-none sm:grid-cols-[120px_minmax(0,1fr)_auto] sm:gap-x-6 sm:p-4 ${
                        leaving.has(item.key) ? "-translate-x-3 opacity-0" : ""
                      }`}>
                      <Link
                        href={href}
                        aria-label={item.title}
                        className="block size-[88px] shrink-0 overflow-hidden rounded-[3px] bg-[var(--cart-linen)] sm:size-[120px]">
                        {image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={image} alt="" loading="lazy" className="size-full object-cover" />
                        ) : (
                          <span className="grid size-full place-items-center text-[#9fb0cc]">
                            <Package className="size-8" aria-hidden="true" />
                          </span>
                        )}
                      </Link>

                      <div className="flex min-w-0 flex-col">
                        <Link
                          href={href}
                          className="line-clamp-2 text-base font-medium leading-snug transition-colors duration-200 hover:text-[var(--cart-royal)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 sm:text-lg">
                          {item.title}
                        </Link>
                        {item.variantId ? (
                          <p className="mt-1 text-sm text-[var(--cart-muted)]">Variante : {item.variantId}</p>
                        ) : null}
                        <p className="mt-1 text-sm tabular-nums text-[var(--cart-muted)]">
                          {formatEuro(unitTtc)} TTC · {formatEuro(unitHt)} HT l’unité
                        </p>

                        <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 pt-4">
                          <div className="flex min-h-12 items-center rounded border-2 border-[var(--cart-royal)] bg-white p-1">
                            <button
                              type="button"
                              onClick={() =>
                                item.qty <= 1
                                  ? removeWithUndo(item)
                                  : setItemQty(item.key, item.qty - 1)
                              }
                              aria-label={
                                item.qty <= 1
                                  ? `Retirer ${item.title} du panier`
                                  : `Diminuer la quantité de ${item.title}`
                              }
                              className={`grid size-10 cursor-pointer place-items-center rounded transition-colors duration-200 focus-visible:outline focus-visible:outline-2 ${
                                item.qty <= 1
                                  ? "text-[var(--cart-thread)] hover:bg-[#fdecee]"
                                  : "text-[var(--cart-royal)] hover:bg-[var(--cart-linen)]"
                              }`}>
                              {item.qty <= 1 ? (
                                <Trash2 className="size-4" aria-hidden="true" />
                              ) : (
                                <Minus className="size-4" aria-hidden="true" />
                              )}
                            </button>
                            <QtyInput
                              value={item.qty}
                              label={`Quantité de ${item.title}`}
                              onCommit={(qty) => setItemQty(item.key, qty)}
                            />
                            <button
                              type="button"
                              onClick={() => setItemQty(item.key, item.qty + 1)}
                              aria-label={`Augmenter la quantité de ${item.title}`}
                              className="grid size-10 cursor-pointer place-items-center rounded text-[var(--cart-royal)] transition-colors duration-200 hover:bg-[var(--cart-linen)] focus-visible:outline focus-visible:outline-2">
                              <Plus className="size-4" aria-hidden="true" />
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeWithUndo(item)}
                            aria-label={`Retirer ${item.title} du panier`}
                            className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded px-2 text-sm font-medium text-[var(--cart-muted)] transition-colors duration-200 hover:text-[var(--cart-thread)] focus-visible:outline focus-visible:outline-2">
                            <Trash2 className="size-4" aria-hidden="true" />
                            Retirer
                          </button>
                        </div>
                      </div>

                      <div className="col-span-2 flex items-baseline justify-between gap-3 border-t border-dashed border-[var(--cart-seam)] pt-3 sm:col-span-1 sm:flex-col sm:items-end sm:justify-start sm:border-t-0 sm:pt-0">
                        <span className="text-sm text-[var(--cart-muted)] sm:hidden">Total de la ligne</span>
                        <div className="sm:text-right">
                          <div className="flex items-baseline gap-x-1.5 sm:justify-end">
                            <BigPrice value={lineTtc} />
                            <span className="text-sm font-medium text-[var(--cart-muted)]">TTC</span>
                          </div>
                          <p className="mt-1.5 text-sm tabular-nums text-[var(--cart-muted)]">{formatEuro(lineHt)} HT</p>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>

              <div className="mt-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
                <Link
                  href="/categorie-produit"
                  className="inline-flex min-h-11 items-center gap-1 rounded text-base font-medium text-[var(--cart-royal)] underline decoration-2 underline-offset-[6px] transition-opacity duration-200 hover:opacity-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
                  Continuer mes achats
                </Link>
                <button
                  type="button"
                  onClick={emptyCart}
                  className="inline-flex min-h-11 cursor-pointer items-center rounded px-2 text-sm font-medium text-[var(--cart-muted)] transition-colors duration-200 hover:text-[var(--cart-thread)] focus-visible:outline focus-visible:outline-2">
                  Vider le panier
                </button>
              </div>
            </section>

            {/* Order summary: a till receipt, torn along a stitched edge. */}
            <aside aria-label="Récapitulatif" className="lg:sticky lg:top-6">
              <div className="rounded-t-[4px] border border-b-0 border-[var(--cart-line)] bg-white p-5 sm:p-6">
                <h2 className="text-2xl! font-semibold!">Récapitulatif</h2>

                <dl className="mt-5 space-y-3 text-base">
                  <div className="flex items-baseline justify-between gap-4">
                    <dt className="text-[var(--cart-muted)]">
                      Articles ({unitCount})
                    </dt>
                    <dd className="tabular-nums">{formatEuro(productsSubtotalTtc)}</dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-4">
                    <dt className="text-[var(--cart-muted)]">Livraison</dt>
                    <dd className="text-right text-[var(--cart-muted)]">Calculée à la caisse</dd>
                  </div>
                </dl>

                <div className="my-5 border-t-2 border-dashed border-[var(--cart-seam)]" aria-hidden="true" />

                <div className="flex items-end justify-between gap-4">
                  <span className="pb-1 text-base font-medium">Total TTC</span>
                  <BigPrice value={productsSubtotalTtc} size="lg" />
                </div>
                <p className="mt-2 text-sm text-[var(--cart-muted)]">
                  Hors frais de livraison, calculés à la caisse selon votre adresse.
                </p>

                <Link
                  href="/checkout"
                  className="mt-6 hidden min-h-14 w-full items-center justify-center rounded-[4px] bg-[var(--cart-royal)] text-lg font-medium text-white transition-colors duration-200 hover:bg-[var(--cart-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 lg:flex">
                  Passer la commande
                </Link>
              </div>
              {/* Torn edge of the receipt. */}
              <div
                aria-hidden="true"
                className="h-3 border-x border-[var(--cart-line)]"
                style={{
                  background:
                    "radial-gradient(circle at 50% 0, var(--cart-linen) 0 6px, #fff 6.5px) 0 0 / 16px 12px repeat-x",
                }}
              />
            </aside>
          </div>
        )}
      </div>

      {/* Phone: the total and the order button stay in reach. */}
      {hasItems ? (
        <div className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-4 border-t border-[var(--cart-line)] bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-4px_16px_rgba(15,31,69,0.08)] lg:hidden">
          <div>
            <p className="text-xs text-[var(--cart-muted)]">Total TTC hors livraison</p>
            <BigPrice value={productsSubtotalTtc} />
          </div>
          <Link
            href="/checkout"
            className="inline-flex min-h-12 flex-1 items-center justify-center rounded-[4px] bg-[var(--cart-royal)] px-6 text-base font-medium text-white transition-colors duration-200 hover:bg-[var(--cart-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
            Passer la commande
          </Link>
        </div>
      ) : null}
    </main>
  );
}
