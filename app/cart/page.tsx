"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ChevronDown, Minus, Plus, ShoppingCart } from "lucide-react";

import { getImageUrl } from "@/lib/api";
import { useCartStore } from "@/lib/stores/cart-store";

const SHIPPING_PRICE = 8;

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

export default function CartPage() {
  const itemsByKey = useCartStore((state) => state.items);
  const items = useMemo(() => Object.values(itemsByKey), [itemsByKey]);
  const setItemQty = useCartStore((state) => state.setItemQty);
  const removeItem = useCartStore((state) => state.removeItem);

  const productsSubtotalTtc = useMemo(
    () =>
      items.reduce(
        (sum, item) => {
          const unitHt = parsePrice(item.price);
          const unitTtc = unitHt * (1 + rateToFraction(item.taxRate));
          return sum + unitTtc * Math.max(0, item.qty ?? 0);
        },
        0,
      ),
    [items],
  );
  const subtotalTtc = items.length > 0 ? productsSubtotalTtc + SHIPPING_PRICE : 0;

  return (
    <main className="min-h-screen bg-white text-[#2f2f2f]">
      <div className="mx-auto grid w-full max-w-[1360px] gap-12 px-6 pt-12 pb-20 md:px-10 lg:grid-cols-[minmax(0,1fr)_320px] lg:px-20 xl:px-28">
        <section className="min-w-0">
          <div className="border-b border-[#d7d7d7] pb-4">
            <h1 className="text-lg font-semibold leading-none text-black">
              Votre panier
            </h1>
            <Link
              href="/"
              className="mt-1 inline-block text-[11px] font-bold tracking-[0.22em] text-black uppercase hover:underline">
              ‹ Continuer mes achats
            </Link>
          </div>

          {items.length === 0 ? (
            <div className="py-16 text-center">
              <div className="mx-auto mb-5 grid size-14 place-items-center rounded-full border border-[#d7d7d7]">
                <ShoppingCart className="size-6 text-[#8a8a8a]" />
              </div>
              <p className="text-lg font-semibold text-black">
                Votre panier est vide
              </p>
              <Link
                href="/"
                className="mt-4 inline-block border border-black px-8 py-3 text-xs font-bold tracking-[0.2em] text-black uppercase hover:bg-black hover:text-white">
                Continuer mes achats
              </Link>
            </div>
          ) : (
            <>
              <div className="hidden grid-cols-[minmax(280px,1fr)_140px_150px_130px] border-b border-[#d7d7d7] py-5 text-right text-[11px] font-bold tracking-[0.18em] text-[#8a8a8a] uppercase md:grid">
                <div />
                <div>Prix</div>
                <div>Quantité</div>
                <div>Total</div>
              </div>

              <ul className="divide-y divide-[#e2e2e2]">
                {items.map((item) => {
                  const image = item.image?.trim() ? getImageUrl(item.image) : null;
                  const unitHt = parsePrice(item.price);
                  const unitTtc = unitHt * (1 + rateToFraction(item.taxRate));
                  const lineHt = unitHt * Math.max(0, item.qty ?? 0);
                  const lineTtc = unitTtc * Math.max(0, item.qty ?? 0);

                  return (
                    <li
                      key={item.key}
                      className="grid gap-5 py-7 md:grid-cols-[minmax(280px,1fr)_140px_150px_130px] md:items-center">
                      <div className="flex min-w-0 gap-6">
                        <Link
                          href={buildItemHref(item)}
                          className="h-[84px] w-[84px] shrink-0 overflow-hidden bg-[#f5f1ea] shadow-sm">
                          {image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={image}
                              alt={item.title}
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="grid h-full w-full place-items-center text-[#9a9a9a]">
                              <ShoppingCart className="size-5" />
                            </div>
                          )}
                        </Link>

                        <div className="min-w-0 pt-1">
                          <Link
                            href={buildItemHref(item)}
                            className="text-base font-bold leading-tight text-black hover:underline">
                            {item.title}
                          </Link>
                          {item.variantId ? (
                            <p className="mt-2 text-xs uppercase text-[#5e6b82]">
                              Variante: {item.variantId}
                            </p>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => removeItem(item.key)}
                            className="mt-3 block border-b border-black text-[10px] font-bold tracking-[0.18em] text-black uppercase hover:text-[#d17b5b]">
                            Supprimer
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1 text-sm md:text-right">
                        <span className="md:hidden">Prix: </span>
                        <div className="font-semibold text-destructive">
                          {formatEuro(unitTtc)} TTC
                        </div>
                        <div className="text-xs font-medium text-primary">
                          {formatEuro(unitHt)} HT
                        </div>
                      </div>

                      <div className="flex md:justify-center">
                        <div className="grid h-9 grid-cols-3 border border-[#cfcfcf] bg-white">
                          <button
                            type="button"
                            onClick={() => setItemQty(item.key, item.qty - 1)}
                            disabled={item.qty <= 1}
                            aria-label="Diminuer la quantité"
                            className="grid w-9 place-items-center border-r border-[#cfcfcf] text-[#7b7b7b] hover:bg-[#f6f6f6] disabled:opacity-35">
                            <Minus className="size-3" />
                          </button>
                          <div className="grid w-10 place-items-center text-xs text-black tabular-nums">
                            {item.qty}
                          </div>
                          <button
                            type="button"
                            onClick={() => setItemQty(item.key, item.qty + 1)}
                            aria-label="Augmenter la quantité"
                            className="grid w-9 place-items-center border-l border-[#cfcfcf] text-[#7b7b7b] hover:bg-[#f6f6f6]">
                            <Plus className="size-3" />
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1 text-base md:text-right">
                        <span className="text-sm md:hidden">Total: </span>
                        <div className="font-semibold text-destructive">
                          {formatEuro(lineTtc)} TTC
                        </div>
                        <div className="text-xs font-medium text-primary">
                          {formatEuro(lineHt)} HT
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>

              <div className="mt-10 border-t border-[#d7d7d7] pt-7">
                <label
                  htmlFor="cart-notes"
                  className="mb-2 block text-sm text-[#444]">
                  Instructions spéciales pour le vendeur
                </label>
                <textarea
                  id="cart-notes"
                  className="h-24 w-full max-w-[560px] resize-y border border-[#cfcfcf] bg-white p-3 text-sm outline-none focus:border-black"
                />
              </div>

              <details className="mt-6 max-w-[560px] border-t border-[#d7d7d7] py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between text-sm text-[#303030] marker:hidden">
                  <span>Estimer la livraison</span>
                  <ChevronDown className="size-4" />
                </summary>
                <div className="pt-4 text-sm text-[#777]">
                  Les frais de livraison seront confirmés à la caisse.
                </div>
              </details>
            </>
          )}
        </section>

        {items.length > 0 ? (
          <aside className="pt-16 lg:pt-[72px]">
            <div className="flex">
              <input
                type="text"
                placeholder="Code de réduction"
                className="h-10 min-w-0 flex-1 border border-[#cfcfcf] px-3 text-sm outline-none placeholder:text-[#898989] focus:border-black"
              />
              <button
                type="button"
                className="h-10 border-y border-r border-[#cfcfcf] px-5 text-[11px] font-bold tracking-[0.16em] text-[#999] uppercase hover:text-black">
                Appliquer
              </button>
            </div>

            <div className="mt-8 space-y-5 border-b border-[#d7d7d7] pb-6 text-sm">
              <div className="flex items-center justify-between">
                <span>Livraison</span>
                <span>{formatEuro(SHIPPING_PRICE)}</span>
              </div>
            </div>

            <div className="py-5 text-right">
              <div className="flex items-baseline justify-end gap-3">
                <span className="text-sm font-bold tracking-[0.14em] text-[#8d8d8d] uppercase">
                  Sous-total TTC
                </span>
                <span className="text-[28px] leading-none font-medium text-black">
                  {formatEuro(subtotalTtc)}
                </span>
              </div>
              <p className="mt-1 text-sm italic text-[#9a9a9a]">
                Livraison & taxes calculées à la caisse
              </p>
            </div>

            <Link
              href="/checkout"
              className="mt-4 flex h-12 w-full items-center justify-center bg-destructive text-xs font-bold tracking-[0.2em] text-destructive-foreground uppercase transition-colors hover:bg-destructive/90">
              Passer la commande
            </Link>
          </aside>
        ) : null}
      </div>
    </main>
  );
}
