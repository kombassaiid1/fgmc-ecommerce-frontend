"use client";

import { useEffect, useMemo, useRef, type MouseEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { ProductCard } from "@/components/product-card";
import { getHomeRecommendations } from "@/lib/api/reco";
import {
  rememberRecoAttribution,
  trackRecoClick,
  trackRecoImpressions,
} from "@/lib/reco/events";
import { buildRecoHistory } from "@/lib/reco/utils";
import { useCartStore } from "@/lib/stores/cart-store";
import { useRecentlyViewedStore } from "@/lib/stores/recently-viewed-store";

/** requestIds whose impressions were already sent (once per requestId). */
const impressionsSent = new Set<string>();

function fetchHomeRecommendations() {
  // History is read once, when the block is requested: cart or history
  // changes must not trigger a new call (each call is a new display).
  const viewed = useRecentlyViewedStore.getState().items;
  const cartProductIds = Object.values(useCartStore.getState().items).map(
    (item) => item.productId,
  );
  return getHomeRecommendations(buildRecoHistory(viewed, cartProductIds));
}

export function DiscoverProducts() {
  const sectionRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const recoQuery = useQuery({
    queryKey: ["home-reco"],
    queryFn: fetchHomeRecommendations,
    // One call per page display: no automatic refetch, no retry, and the
    // result is dropped as soon as the block is unmounted.
    staleTime: Infinity,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const data = recoQuery.data;
  const requestId = data?.requestId ?? null;
  const items = useMemo(
    () => (data?.show ? data.products : []),
    [data],
  );
  const isVisible = items.length > 0;

  useEffect(() => {
    const section = sectionRef.current;
    if (!isVisible || !section || !requestId) return;
    if (impressionsSent.has(requestId)) return;
    if (typeof IntersectionObserver === "undefined") return;

    const products = items.map((item) => ({
      productId: item.product.id,
      position: item.position,
    }));
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.intersectionRatio >= 0.5)) return;
        observer.disconnect();
        if (impressionsSent.has(requestId)) return;
        impressionsSent.add(requestId);
        trackRecoImpressions(requestId, products);
      },
      { threshold: 0.5 },
    );
    observer.observe(section);
    return () => observer.disconnect();
  }, [isVisible, requestId, items]);

  if (!isVisible) return null;

  function handleProductClickCapture(
    event: MouseEvent<HTMLDivElement>,
    productId: string,
    position: number,
  ) {
    // Capture phase: runs before the card's own handlers, so the attribution
    // exists before addItem() and before the link navigation.
    if (!requestId) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest("a")) {
      trackRecoClick(requestId, productId, position);
    } else if (target.closest("button")) {
      rememberRecoAttribution(requestId, productId, position);
    }
  }

  function moveCarousel(direction: -1 | 1) {
    const track = trackRef.current;
    if (!track) return;
    track.scrollBy({
      left: direction * Math.max(track.clientWidth * 0.85, 280),
      behavior: "smooth",
    });
  }

  return (
    <section
      ref={sectionRef}
      className="bg-[#f2f5fa] px-4 py-7 sm:px-6 lg:py-9"
      aria-labelledby="discover-products-title">
      <div className="mx-auto max-w-387.5!">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <h2
              id="discover-products-title"
              className="text-2xl! font-extrabold uppercase tracking-wide text-[#0a224f] sm:text-3xl!">
              À découvrir
            </h2>
            <div
              className="mt-2 flex h-1 w-16 overflow-hidden rounded-full"
              aria-hidden="true">
              <span className="w-1/2 bg-[#0a224f]" />
              <span className="w-1/2 bg-[#d6202e]" />
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => moveCarousel(-1)}
              aria-label="Produits precedents"
              className="grid size-11 place-items-center rounded-full border border-[#d8e0ed] bg-white text-[#0a224f] transition hover:border-[#153675] hover:bg-[#153675] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#153675]">
              <ChevronLeft className="size-5" />
            </button>
            <button
              type="button"
              onClick={() => moveCarousel(1)}
              aria-label="Produits suivants"
              className="grid size-11 place-items-center rounded-full border border-[#d8e0ed] bg-white text-[#0a224f] transition hover:border-[#153675] hover:bg-[#153675] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#153675]">
              <ChevronRight className="size-5" />
            </button>
          </div>
        </div>

        <div
          ref={trackRef}
          className="flex snap-x snap-mandatory items-stretch gap-4 overflow-x-auto scroll-smooth pb-3 [scrollbar-width:thin]">
          {items.map((item) => (
            <div
              key={item.product.id}
              onClickCapture={(event) =>
                handleProductClickCapture(event, item.product.id, item.position)
              }
              className="flex w-[78%] shrink-0 snap-start sm:w-[calc((100%-1rem)/2)]! lg:w-[calc((100%-3rem)/4)]! xl:w-[calc((100%-5rem)/6)]!">
              <ProductCard product={item.product} variant="featured" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
