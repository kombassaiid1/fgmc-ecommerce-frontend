"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Bolt, Minus, Package, Plus } from "lucide-react";
import { toast } from "sonner";

import { getImageUrl } from "@/lib/api";
import { getProducts, type ProductListItem } from "@/lib/api/products";
import { cartItemKey, useCartStore } from "@/lib/stores/cart-store";
import { resolveSpecificPrice } from "@/lib/specific-pricing";

type OfferProduct = ProductListItem & {
  categories?: Array<{ category?: { title?: string; slug?: string } }>;
};

type CountdownUnit = { value: string; label: string };

function parseAmount(value: string | null | undefined) {
  const parsed = Number.parseFloat(String(value ?? "").replace(/[^\d,.-]/g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatEuro(value: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function getOffer(product: OfferProduct) {
  const taxRate = product.taxRelation?.rate ?? 0;
  const taxFraction = taxRate > 1 ? taxRate / 100 : taxRate;
  const basePrice = parseAmount(product.price);
  const price = basePrice * (1 + taxFraction);
  if (price <= 0) return null;
  const resolved = resolveSpecificPrice(product.specificPrices, basePrice, taxRate, 1);
  const salePrice = resolved.saleTtc;
  if (salePrice >= price) return null;
  const percentOff = Math.min(99, Math.max(1, Math.round(((price - salePrice) / price) * 100)));
  return { price, salePrice, saleBasePrice: salePrice / (1 + taxFraction), taxRate, percentOff, expiresAt: resolved.rule?.toDate ?? null };
}

function useOfferCountdown(expiresAt: string | null): CountdownUnit[] {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    const update = () => {
      const now = new Date();
      const fallbackEnd = new Date(now);
      fallbackEnd.setHours(24, 0, 0, 0);
      const parsedEnd = expiresAt
        ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(expiresAt) ? `${expiresAt}T23:59:59` : expiresAt)
        : null;
      const end = parsedEnd && Number.isFinite(parsedEnd.getTime()) ? parsedEnd : fallbackEnd;
      setRemaining(Math.max(0, Math.floor((end.getTime() - now.getTime()) / 1000)));
    };

    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [expiresAt]);

  return [
    { value: String(Math.floor(remaining / 86_400)).padStart(2, "0"), label: "J" },
    { value: String(Math.floor((remaining % 86_400) / 3600)).padStart(2, "0"), label: "H" },
    { value: String(Math.floor((remaining % 3600) / 60)).padStart(2, "0"), label: "Min" },
    { value: String(remaining % 60).padStart(2, "0"), label: "Sec" },
  ];
}

export function DailyOffer() {
  const productsQuery = useQuery({
    queryKey: ["daily-offer-products"],
    queryFn: () => getProducts({ page: 1, limit: 100, status: "PUBLIC" }),
    staleTime: 60_000,
  });
  const offers = useMemo(
    () => ((productsQuery.data?.data ?? []) as OfferProduct[])
      .map((product) => ({ product, offer: getOffer(product) }))
      .filter((entry): entry is { product: OfferProduct; offer: NonNullable<ReturnType<typeof getOffer>> } => Boolean(entry.offer))
      .slice(0, 5),
    [productsQuery.data],
  );

  if (!productsQuery.isLoading && offers.length === 0) return null;

  return (
    <section className="bg-[#f2f5fa] px-4 pb-8 sm:px-6" aria-labelledby="daily-offer-title">
      <div className="mx-auto max-w-[1550px] overflow-hidden rounded-2xl border border-[#e1e8f1] bg-white shadow-[0_8px_28px_rgba(10,34,79,0.10)]">
        <div className="flex min-h-[76px] items-center justify-between gap-4 bg-gradient-to-r from-[#0a224f] via-[#153675] to-[#2456b1] px-5 py-3 text-white sm:px-7">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-white/10 ring-1 ring-white/15">
              <Bolt className="size-5 fill-[#ff9b3d] text-[#ff9b3d]" aria-hidden="true" />
            </span>
            <div>
              <h2 id="daily-offer-title" className="text-lg font-extrabold uppercase leading-tight tracking-wide sm:text-xl">Offre du jour</h2>
              <p className="mt-0.5 text-xs text-white/80">Des prix exclusifs sur une sélection de produits</p>
            </div>
          </div>
          <span className="hidden rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-white/90 sm:inline-flex">Offres à durée limitée</span>
        </div>

        <div className="flex flex-col gap-4 p-4 sm:p-5">
          {productsQuery.isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5" aria-label="Chargement des offres">
              {[0, 1, 2, 3, 4].map((item) => <div key={item} className="h-[440px] animate-pulse rounded-2xl border border-slate-200 bg-slate-50" />)}
            </div>
          ) : (
            <div className="grid auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {offers.map(({ product, offer }) => <DailyOfferCard key={product.id} product={product} offer={offer} />)}
            </div>
          )}
          <div className="flex justify-end border-t border-[#e6ebf2] pt-2">
            <Link href="/categorie-produit" className="inline-flex min-h-8 items-center px-2 text-xs font-bold uppercase text-[#153675] transition-colors hover:text-[#d6202e]">
              Voir toutes les offres <span className="ml-1" aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function DailyOfferCard({
  product,
  offer,
}: {
  product: OfferProduct;
  offer: NonNullable<ReturnType<typeof getOffer>>;
}) {
  const key = cartItemKey(product.id, null);
  const quantity = useCartStore((state) => state.items[key]?.qty ?? 0);
  const addItem = useCartStore((state) => state.addItem);
  const setItemQty = useCartStore((state) => state.setItemQty);
  const category = product.categories?.[0]?.category;
  const image = product.images?.[0] ? getImageUrl(product.images[0]) : null;
  const countdown = useOfferCountdown(offer.expiresAt);
  const productHref = category?.slug ? `/${category.slug}/${product.slug}.html` : `/${product.slug}.html`;

  const increase = () => {
    if (quantity === 0) {
      addItem({
        productId: product.id,
        productSlug: product.slug,
        title: product.title,
        image: product.images?.[0] ?? null,
        categorySlug: category?.slug ?? null,
        variantId: null,
        price: String(offer.saleBasePrice),
        taxRate: offer.taxRate,
      }, 1);
    } else {
      setItemQty(key, quantity + 1);
    }
    toast.success("Ajouté au panier", { description: product.title });
  };

  return (
    <article className="group flex min-h-[440px] w-full flex-col overflow-hidden rounded-2xl border border-[#dce3ec] bg-white shadow-[0_2px_8px_rgba(10,34,79,0.05)] transition duration-200 hover:-translate-y-0.5 hover:border-[#b8c9e3] hover:shadow-[0_10px_26px_rgba(10,34,79,0.12)]">
      <Link href={productHref} className="relative block aspect-[4/3] shrink-0 overflow-hidden bg-[#f7f9fc]">
        {image ? (
          <img src={image} alt={product.title} loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-[#a8b3c4]"><Package className="size-12" /></span>
        )}
        <span className="absolute left-3 top-3 rounded-lg bg-[#d6202e] px-2.5 py-1.5 text-xs font-extrabold text-white shadow-sm">-{offer.percentOff}%</span>
        <span className="absolute right-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#153675] shadow-sm">Offre du jour</span>
      </Link>

      <div className="flex flex-1 flex-col px-4 pb-4 pt-3">
        <p className="mb-1.5 line-clamp-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#71819b]">{product.brand?.title ?? category?.title ?? "Offre spéciale"}</p>
        <Link href={productHref} className="line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-[#142c5b] hover:text-[#2456b1]">
          {product.title}
        </Link>

        <div className="mt-auto pt-3">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-xl font-extrabold tracking-tight text-[#d6202e]">{formatEuro(offer.salePrice)} <span className="text-[10px] font-bold">TTC</span></span>
            <span className="text-xs text-[#73819a] line-through">{formatEuro(offer.price)}</span>
          </div>
          <p className="mt-1 text-xs font-semibold text-[#596b89]">{formatEuro(offer.saleBasePrice)} HT</p>

          <div className="mt-3 rounded-xl border border-[#e3e9f2] bg-[#f7f9fc] p-2.5" aria-label={`Fin de l'offre dans ${countdown[0].value} jours, ${countdown[1].value} heures, ${countdown[2].value} minutes et ${countdown[3].value} secondes`}>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wide text-[#596b89]">Fin de l'offre dans</span>
              <Bolt className="size-3.5 fill-[#ff9b3d] text-[#ff9b3d]" aria-hidden="true" />
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {countdown.map(({ value, label }) => (
                <div key={label} className="rounded-md bg-white px-1 py-1.5 text-center shadow-[0_1px_3px_rgba(10,34,79,0.08)]">
                  <span className="block text-sm font-extrabold leading-none tabular-nums text-[#0a224f]">{value}</span>
                  <span className="mt-1 block text-[8px] font-semibold uppercase leading-none tracking-wide text-[#8491a6]">{label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between gap-2">
            <span className="text-xs text-[#71819b]">Quantité</span>
            <div className="inline-flex h-9 items-center overflow-hidden rounded-lg border border-[#d4ddec] bg-white">
              <button type="button" aria-label={`Diminuer ${product.title}`} disabled={quantity <= 0} onClick={() => setItemQty(key, quantity - 1)} className="grid size-8 place-items-center text-[#153675] transition hover:bg-[#f2f5fa] disabled:opacity-40"><Minus className="size-3.5" /></button>
              <span className="min-w-7 text-center text-xs font-semibold tabular-nums text-[#0a224f]">{quantity}</span>
              <button type="button" aria-label={`Augmenter ${product.title}`} onClick={increase} className="grid size-8 place-items-center text-[#153675] transition hover:bg-[#f2f5fa]"><Plus className="size-3.5" /></button>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
