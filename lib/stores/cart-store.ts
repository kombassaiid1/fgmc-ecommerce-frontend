"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type CartItem = {
  key: string;
  productId: string;
  productSlug: string;
  title: string;
  image?: string | null;
  categorySlug?: string | null;
  /** Selected variant/combinaison id (if any). */
  variantId?: string | null;
  /**
   * Unit price before tax. This is what the shop showed when the product was added, and a display aid only:
   * the server prices every order itself, and replaces this with its own price when the cart is opened.
   */
  price: string;
  /** Product tax rate, either as percent (20) or fraction (0.2). */
  taxRate?: number | null;
  /** The server's price of one unit, tax included, for the quantity in the cart. Set by the cart's price check. */
  unitTtc?: number;
  qty: number;
};

/** The most of one product a single order line may hold (the server enforces the same limit). */
export const MAX_QTY_PER_LINE = 9999;

type AddToCartPayload = Omit<CartItem, "key" | "qty">;

type CartState = {
  items: Record<string, CartItem>;
  addItem: (payload: AddToCartPayload, qty?: number) => void;
  setItemQty: (key: string, qty: number) => void;
  removeItem: (key: string) => void;
  /** Replaces the prices of the lines with the ones the server worked out. */
  applyServerPrices: (lines: Array<{ id: string; variantId: string | null; unitHt: number; unitTtc: number; taxRate: number; title?: string }>) => void;
  clear: () => void;
  totalQty: () => number;
  totalItems: () => number;
};

function clampQty(qty: number): number {
  if (!Number.isFinite(qty)) return 0;
  return Math.min(MAX_QTY_PER_LINE, Math.max(0, Math.floor(qty)));
}

function makeKey(productId: string, variantId?: string | null) {
  return `${productId}:${variantId ?? ""}`;
}

export function cartItemKey(productId: string, variantId?: string | null) {
  return makeKey(productId, variantId);
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: {},

      addItem: (payload, qty = 1) => {
        const safeQty = clampQty(qty);
        if (safeQty <= 0) return;

        const key = makeKey(payload.productId, payload.variantId);
        set((state) => {
          const existing = state.items[key];
          const nextQty = clampQty((existing?.qty ?? 0) + safeQty);
          return {
            items: {
              ...state.items,
              [key]: {
                key,
                ...payload,
                qty: nextQty,
              },
            },
          };
        });
      },

      setItemQty: (key, qty) => {
        const safeQty = clampQty(qty);
        set((state) => {
          if (!state.items[key]) return state;
          if (safeQty <= 0) {
            const rest = { ...state.items };
            delete rest[key];
            return { items: rest };
          }
          return {
            items: {
              ...state.items,
              [key]: { ...state.items[key], qty: safeQty },
            },
          };
        });
      },

      removeItem: (key) => {
        set((state) => {
          if (!state.items[key]) return state;
          const rest = { ...state.items };
          delete rest[key];
          return { items: rest };
        });
      },

      applyServerPrices: (lines) =>
        set((state) => {
          let changed = false;
          const items = { ...state.items };
          for (const line of lines) {
            const key = makeKey(line.id, line.variantId);
            const item = items[key];
            if (!item) continue;
            const price = String(line.unitHt);
            if (item.price === price && item.unitTtc === line.unitTtc && item.taxRate === line.taxRate) continue;
            items[key] = { ...item, price, unitTtc: line.unitTtc, taxRate: line.taxRate };
            changed = true;
          }
          return changed ? { items } : state;
        }),

      clear: () => set({ items: {} }),

      totalQty: () =>
        Object.values(get().items).reduce((sum, item) => sum + (item.qty ?? 0), 0),

      totalItems: () => Object.keys(get().items).length,
    }),
    {
      name: "fgmc-cart",
      version: 1,
      partialize: (state) => ({ items: state.items }),
    },
  ),
);

const roundCents = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

/** Rate as a fraction: 20 and 0.2 both mean 20%. */
function fractionOf(rate: number | null | undefined) {
  if (rate == null || !Number.isFinite(rate) || rate < 0) return 0;
  return rate > 1 ? rate / 100 : rate;
}

/**
 * What one unit costs, tax included. The server's price when the cart has been checked; before that, the price the
 * shop showed when the product was added (only a preview: the server decides the real one).
 */
export function cartUnitTtc(item: Pick<CartItem, "price" | "taxRate" | "unitTtc">): number {
  if (typeof item.unitTtc === "number" && Number.isFinite(item.unitTtc)) return item.unitTtc;
  const ht = Number.parseFloat(String(item.price).replace(/[^0-9.,-]/g, "").replace(",", "."));
  return roundCents((Number.isFinite(ht) ? ht : 0) * (1 + fractionOf(item.taxRate)));
}

/** The line's total, tax included, rounded to the cent like the server does. */
export function cartLineTtc(item: Pick<CartItem, "price" | "taxRate" | "unitTtc" | "qty">): number {
  return roundCents(cartUnitTtc(item) * Math.max(0, item.qty ?? 0));
}

/** The line's total before tax, rounded to the cent like the server does. */
export function cartLineHt(item: Pick<CartItem, "price" | "taxRate" | "unitTtc" | "qty">): number {
  const unitTtc = cartUnitTtc(item);
  const unitHt = roundCents(unitTtc / (1 + fractionOf(item.taxRate)));
  return roundCents(unitHt * Math.max(0, item.qty ?? 0));
}
