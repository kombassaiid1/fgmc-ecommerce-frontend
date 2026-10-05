"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  isAttributionValid,
  pruneAttributions,
  type RecoAttribution,
} from "@/lib/reco/utils";

type RecoAttributionState = {
  /** productId -> block click that led to it (valid 24 hours). */
  attributions: Record<string, RecoAttribution>;
  remember: (productId: string, requestId: string, position: number) => void;
  getValid: (productId: string) => RecoAttribution | null;
  forget: (productIds: string[]) => void;
};

export const useRecoAttributionStore = create<RecoAttributionState>()(
  persist(
    (set, get) => ({
      attributions: {},

      remember: (productId, requestId, position) => {
        const now = Date.now();
        set((state) => ({
          attributions: {
            ...pruneAttributions(state.attributions, now),
            [productId]: { requestId, position, at: now },
          },
        }));
      },

      getValid: (productId) => {
        const attribution = get().attributions[productId];
        return isAttributionValid(attribution, Date.now()) ? attribution : null;
      },

      forget: (productIds) => {
        if (productIds.length === 0) return;
        set((state) => {
          const rest = { ...state.attributions };
          for (const productId of productIds) delete rest[productId];
          return { attributions: pruneAttributions(rest, Date.now()) };
        });
      },
    }),
    {
      name: "fgmc-reco-attributions",
      version: 1,
      partialize: (state) => ({ attributions: state.attributions }),
      merge: (persisted, current) => ({
        ...current,
        attributions: pruneAttributions(
          (persisted as Partial<RecoAttributionState> | undefined)
            ?.attributions ?? {},
          Date.now(),
        ),
      }),
    },
  ),
);
