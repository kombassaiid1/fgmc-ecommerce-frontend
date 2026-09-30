"use client";

import { useQuery } from "@tanstack/react-query";

import { getImageUrl } from "@/lib/api";
import { getPublicHeaderSettings } from "@/lib/api/header";
import type { HomeImageTile } from "@/lib/header-config";

const TILE_LAYOUT = [
  "row-span-2 sm:col-start-1 sm:row-span-2",
  "sm:col-start-2 sm:row-start-1",
  "sm:col-start-2 sm:row-start-2",
  "sm:col-start-3 sm:row-span-2",
];

function ImageTile({
  tile,
  className,
}: {
  tile: HomeImageTile;
  className?: string;
}) {
  return (
    <div
      className={`relative min-h-0 overflow-hidden rounded-2xl bg-[slate-100] ${className ?? ""}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={getImageUrl(tile.imageUrl)}
        alt={tile.altText}
        loading="lazy"
        className="absolute inset-0 size-full object-cover transition-transform duration-300 hover:scale-[1.02]"
      />
    </div>
  );
}

export function HomeImageMosaic() {
  const settingsQuery = useQuery({
    queryKey: ["storefront-header-settings"],
    queryFn: getPublicHeaderSettings,
    staleTime: 30_000,
  });

  const tiles = settingsQuery.data?.heroConfig?.imageTiles ?? [];
  const configuredTiles = tiles
    .map((tile, index) => (tile ? { tile, index } : null))
    .filter(
      (item): item is { tile: HomeImageTile; index: number } => item !== null,
    );

  if (configuredTiles.length === 0) return null;

  return (
    <section
      className="bg-[#F2F5FA] px-4 py-7 sm:px-6 lg:py-9"
      aria-label="Sélection à découvrir">
      <div className="mx-auto max-w-[1450px]">
        {configuredTiles.length === 4 ? (
          <div className="grid grid-cols-2 grid-rows-[190px_190px_auto] gap-3 sm:h-[clamp(280px,33vw,480px)] sm:grid-cols-[1.25fr_1fr_0.72fr] sm:grid-rows-2 sm:gap-4">
            {configuredTiles.map(({ tile, index }) => (
              <ImageTile
                key={index}
                tile={tile}
                className={`${TILE_LAYOUT[index]} ${index === 3 ? "col-span-2 sm:col-span-1" : ""} ${index === 3 ? "h-[190px] sm:h-auto" : ""}`}
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
            {configuredTiles.map(({ tile, index }) => (
              <ImageTile key={index} tile={tile} className="aspect-[4/3]" />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
