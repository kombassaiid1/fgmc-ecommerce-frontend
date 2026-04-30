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
  /** Unit price (as received from API, string). */
  price: string;
  qty: number;
};

type AddToCartPayload = Omit<CartItem, "key" | "qty">;

type CartState = {
  items: Record<string, CartItem>;
  addItem: (payload: AddToCartPayload, qty?: number) => void;
  setItemQty: (key: string, qty: number) => void;
  removeItem: (key: string) => void;
  clear: () => void;
  totalQty: () => number;
  totalItems: () => number;
};

function clampQty(qty: number): number {
  if (!Number.isFinite(qty)) return 0;
  return Math.max(0, Math.floor(qty));
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
            const { [key]: _, ...rest } = state.items;
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
          const { [key]: _, ...rest } = state.items;
          return { items: rest };
        });
      },

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

