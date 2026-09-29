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

function parseAmount(value: string | null | undefined) {
  const parsed = Number.parseFloat(String(value ?? "").replace(/[^\d,.-]/g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatEuro(value: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

function getOffer(product: OfferProduct) {
  const taxRate = product.taxRelation?.rate ?? 0;
  const taxFraction = taxRate > 1 ? taxRate / 100 : taxRate;
  const basePrice = parseAmount(product.price);
  const price = basePrice * (1 + taxFraction);
  if (price <= 0) return null;
  const salePrice = resolveSpecificPrice(product.specificPrices, basePrice, taxRate, 1).saleTtc;
  if (salePrice >= price) return null;
  const percentOff = Math.min(99, Math.max(1, Math.round(((price - salePrice) / price) * 100)));
  return { price, salePrice, saleBasePrice: salePrice / (1 + taxFraction), taxRate, percentOff };
}

function useDailyCountdown() {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    const update = () => {
      const now = new Date();
      const end = new Date(now);
      end.setHours(24, 0, 0, 0);
      setRemaining(Math.max(0, Math.floor((end.getTime() - now.getTime()) / 1000)));
    };
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, []);

  return {
    hours: String(Math.floor(remaining / 3600)).padStart(2, "0"),
    minutes: String(Math.floor((remaining % 3600) / 60)).padStart(2, "0"),
    seconds: String(remaining % 60).padStart(2, "0"),
  };
}

export function DailyOffer() {
  const countdown = useDailyCountdown();
  const productsQuery = useQuery({
    queryKey: ["daily-offer-products"],
    queryFn: () => getProducts({ page: 1, limit: 100, status: "PUBLIC" }),
    staleTime: 60_000,
  });
  const offers = useMemo(() =>
    ((productsQuery.data?.data ?? []) as OfferProduct[])
      .map((product) => ({ product, offer: getOffer(product) }))
      .filter((entry): entry is { product: OfferProduct; offer: NonNullable<ReturnType<typeof getOffer>> } => Boolean(entry.offer))
      .slice(0, 5),
  [productsQuery.data]);

  if (!productsQuery.isLoading && offers.length === 0) return null;

  return (
    <section className="bg-[#f2f5fa] px-4 pb-8 sm:px-6" aria-labelledby="daily-offer-title">
      <div className="mx-auto max-w-[1550px] overflow-hidden rounded-xl bg-white shadow-[0_8px_28px_rgba(10,34,79,0.12)]">
        <div className="flex min-h-[76px] items-center justify-between gap-4 bg-gradient-to-r from-[#153675] to-[#2456b1] px-5 py-3 text-white sm:px-7">
          <div className="flex items-center gap-3">
            <Bolt className="size-5 fill-[#ff9b3d] text-[#ff9b3d]" aria-hidden="true" />
            <div>
              <h2 id="daily-offer-title" className="text-lg font-bold uppercase leading-tight">Offre du jour</h2>
              <p className="text-xs text-white/80">Prix spécial valable aujourd’hui uniquement</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5" aria-label={`Fin dans ${countdown.hours} heures ${countdown.minutes} minutes ${countdown.seconds} secondes`}>
            <TimerUnit value={countdown.hours} label="H" />
            <span className="text-white/70">:</span>
            <TimerUnit value={countdown.minutes} label="Min" />
            <span className="text-white/70">:</span>
            <TimerUnit value={countdown.seconds} label="Sec" />
          </div>
        </div>

        <div className="flex min-h-[456px] flex-col justify-between p-4 sm:p-5">
          {productsQuery.isLoading ? (
            <div className="grid gap-3 sm:grid-cols-2" aria-label="Chargement des offres">
              {[0, 1].map((item) => <div key={item} className="h-[418px] w-full max-w-[360px] animate-pulse rounded-xl border border-slate-200 bg-slate-50" />)}
            </div>
          ) : (
            <div className="grid auto-rows-fr gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {offers.map(({ product, offer }) => <DailyOfferCard key={product.id} product={product} offer={offer} />)}
            </div>
          )}
          <div className="flex justify-end">
            <Link href="/categorie-produit" className="inline-flex min-h-8 items-center px-2 text-xs font-bold uppercase text-[#153675] transition-colors hover:text-[#d6202e]">
              Voir toutes les offres <span className="ml-1" aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function TimerUnit({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="min-w-9 rounded-md bg-white/15 px-2 py-1 text-center text-sm font-bold tabular-nums">{value}</span>
      <span className="text-[9px] uppercase tracking-wide text-white/75">{label}</span>
    </div>
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
    <article className="flex min-h-[418px] w-full flex-col overflow-hidden rounded-xl border border-[#dce3ec] bg-white">
      <Link href={category?.slug ? `/${category.slug}/${product.slug}.html` : `/${product.slug}.html`} className="relative block h-[250px] shrink-0 overflow-hidden bg-[#f8fafc]">
        {image ? (
          <img src={image} alt={product.title} loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-[#a8b3c4]"><Package className="size-12" /></span>
        )}
        <span className="absolute left-3 top-3 rounded-md bg-[#d6202e] px-2 py-1 text-[11px] font-bold text-white">-{offer.percentOff}%</span>
      </Link>

      <div className="flex flex-1 flex-col px-3 pb-3 pt-2">
        <p className="mb-1 line-clamp-1 text-[10px] font-bold uppercase tracking-wide text-[#153675]">{product.brand?.title ?? category?.title ?? "Offre spéciale"}</p>
        <Link href={category?.slug ? `/${category.slug}/${product.slug}.html` : `/${product.slug}.html`} className="line-clamp-1 text-sm font-medium text-[#142c5b] hover:text-[#2456b1]">
          {product.title}
        </Link>
        <div className="mt-auto pt-3">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-lg font-bold text-[#d6202e]">{formatEuro(offer.salePrice)}</span>
            <span className="text-xs text-[#73819a] line-through">{formatEuro(offer.price)}</span>
          </div>
          <div className="mt-2 flex">
            <div className="inline-flex h-9 items-center overflow-hidden rounded-lg border border-[#d4ddec]">
              <button type="button" aria-label={`Diminuer ${product.title}`} disabled={quantity <= 0} onClick={() => setItemQty(key, quantity - 1)} className="grid size-8 place-items-center text-[#153675] hover:bg-[#f2f5fa] disabled:opacity-40"><Minus className="size-3.5" /></button>
              <span className="min-w-7 text-center text-xs font-semibold tabular-nums">{quantity}</span>
              <button type="button" aria-label={`Augmenter ${product.title}`} onClick={increase} className="grid size-8 place-items-center text-[#153675] hover:bg-[#f2f5fa]"><Plus className="size-3.5" /></button>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
