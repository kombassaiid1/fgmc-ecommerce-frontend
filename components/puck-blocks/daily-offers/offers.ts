"use client";

import { type ProductListItem } from "@/lib/api/products";
import { resolveSpecificPrice } from "@/lib/specific-pricing";

/* Pricing rules are the same as the storefront's DailyOffer section. */

export type OfferProduct = ProductListItem & {
  categories?: Array<{ categoryId?: string; category?: { id?: string; title?: string; slug?: string } }>;
};

export type Offer = {
  /** Regular price, tax included. */
  price: number;
  /** Discounted price, tax included. */
  salePrice: number;
  /** Discounted price, before tax. */
  saleBasePrice: number;
  taxRate: number;
  percentOff: number;
  /** Start of the promotion (ISO date or datetime), when it has one. */
  startsAt: string | null;
  /** End of the promotion (ISO date or datetime), when it has one. */
  expiresAt: string | null;
};

export type OfferEntry = { product: OfferProduct; offer: Offer };

export function parseAmount(value: string | null | undefined) {
  const parsed = Number.parseFloat(String(value ?? "").replace(/[^\d,.-]/g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatEuro(value: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/** Splits a price into euros ("1 026") and cents ("96") for typographic display. */
export function splitPrice(value: number) {
  const totalCents = Math.round(value * 100);
  return {
    euros: new Intl.NumberFormat("fr-FR").format(Math.floor(totalCents / 100)),
    cents: String(totalCents % 100).padStart(2, "0"),
  };
}

/** The offer for a product, or null when it has no active discount. */
export function getOffer(product: OfferProduct): Offer | null {
  const taxRate = product.taxRelation?.rate ?? 0;
  const taxFraction = taxRate > 1 ? taxRate / 100 : taxRate;
  const basePrice = parseAmount(product.price);
  const price = basePrice * (1 + taxFraction);
  if (price <= 0) return null;
  const resolved = resolveSpecificPrice(product.specificPrices, basePrice, taxRate, 1);
  const salePrice = resolved.saleTtc;
  if (salePrice >= price) return null;
  const percentOff = Math.min(99, Math.max(1, Math.round(((price - salePrice) / price) * 100)));
  return {
    price,
    salePrice,
    saleBasePrice: salePrice / (1 + taxFraction),
    taxRate,
    percentOff,
    startsAt: resolved.rule?.fromDate ?? null,
    expiresAt: resolved.rule?.toDate ?? null,
  };
}

function toTime(value: string | null, endOfDay: boolean): number | null {
  if (!value) return null;
  const parsed = new Date(
    /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T${endOfDay ? "23:59:59" : "00:00:00"}` : value,
  );
  return Number.isFinite(parsed.getTime()) ? parsed.getTime() : null;
}

/** End of an offer as a timestamp; date-only values end at 23:59:59 local time. */
export function offerEndTime(expiresAt: string | null): number | null {
  return toTime(expiresAt, true);
}

/** Start of an offer as a timestamp; date-only values start at 00:00:00 local time. */
export function offerStartTime(startsAt: string | null): number | null {
  return toTime(startsAt, false);
}

const DAY_MS = 86_400_000;

export type OfferClock = {
  /** False until the first tick on the client (avoids a wrong first paint). */
  ready: boolean;
  expired: boolean;
  /** Under 24 hours left. */
  urgent: boolean;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  /** Share of the offer's duration still left, from 0 to 1. */
  ratio: number;
};

/**
 * Time left for one offer, given the current time in ms (0 = not ticking yet).
 *
 * - No end date: the offer runs until midnight.
 * - The progress ratio uses the start date when there is one; otherwise it is
 *   measured against 30 days (or 24 hours for the midnight case).
 */
export function computeOfferClock(offer: Pick<Offer, "startsAt" | "expiresAt">, now: number): OfferClock {
  if (now <= 0) {
    return { ready: false, expired: false, urgent: false, days: 0, hours: 0, minutes: 0, seconds: 0, ratio: 1 };
  }

  const explicitEnd = offerEndTime(offer.expiresAt);
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const end = explicitEnd ?? midnight.getTime();

  const remainingMs = Math.max(0, end - now);
  const remaining = Math.floor(remainingMs / 1000);

  const start = offerStartTime(offer.startsAt);
  const total =
    explicitEnd !== null
      ? start !== null && explicitEnd > start
        ? explicitEnd - start
        : 30 * DAY_MS
      : DAY_MS;

  return {
    ready: true,
    expired: remaining <= 0,
    urgent: remaining < 86_400,
    days: Math.floor(remaining / 86_400),
    hours: Math.floor((remaining % 86_400) / 3600),
    minutes: Math.floor((remaining % 3600) / 60),
    seconds: remaining % 60,
    ratio: Math.min(1, Math.max(0, remainingMs / total)),
  };
}
