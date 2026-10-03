"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { pushRecentlyViewed, type RecentlyViewedItem } from "@/lib/reco/utils";

type RecentlyViewedState = {
  /** Last 10 viewed products, most recent first. */
  items: RecentlyViewedItem[];
  addView: (productId: string) => void;
};

export const useRecentlyViewedStore = create<RecentlyViewedState>()(
  persist(
    (set) => ({
      items: [],

      addView: (productId) =>
        set((state) => ({
          items: pushRecentlyViewed(
            state.items,
            productId,
            new Date().toISOString(),
          ),
        })),
    }),
    {
      name: "fgmc-recently-viewed",
      version: 1,
      partialize: (state) => ({ items: state.items }),
    },
  ),
);
