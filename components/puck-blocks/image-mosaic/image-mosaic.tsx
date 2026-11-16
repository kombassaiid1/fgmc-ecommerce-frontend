/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { ImageIcon } from "lucide-react";

import { getImageUrl } from "@/lib/api";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* Props                                                                      */
/* -------------------------------------------------------------------------- */

export type MosaicTile = {
  imageUrl: string;
  altText: string;
  /** Optional link opened when the tile is clicked. */
  href: string;
};

export type ImageMosaicProps = {
  tile1: MosaicTile;
  tile2: MosaicTile;
  tile3: MosaicTile;
  tile4: MosaicTile;
  background: string;
  maxWidth: number;
  gap: number;
  cardRadius: number;
};

const EMPTY_TILE: MosaicTile = { imageUrl: "", altText: "", href: "" };

export const IMAGE_MOSAIC_DEFAULTS: ImageMosaicProps = {
  tile1: EMPTY_TILE,
  tile2: EMPTY_TILE,
  tile3: EMPTY_TILE,
  tile4: EMPTY_TILE,
  background: "#f2f5fa",
  maxWidth: 1450,
  gap: 16,
  cardRadius: 16,
};

/** Recommended image size per tile, shown in the editor. */
export const MOSAIC_TILE_SPECS = [
  { size: "1200 × 960 px", ratio: "5:4" },
  { size: "1200 × 600 px", ratio: "2:1" },
  { size: "1200 × 600 px", ratio: "2:1" },
  { size: "800 × 1100 px", ratio: "8:11" },
];

// Literal class names so Tailwind can see them: one large tile, two stacked
// tiles in the middle, one large tile.
const TILE_LAYOUT = [
  "row-span-2 sm:col-start-1 sm:row-span-2",
  "sm:col-start-2 sm:row-start-1",
  "sm:col-start-2 sm:row-start-2",
  "col-span-2 h-[190px] sm:col-span-1 sm:col-start-3 sm:row-span-2 sm:h-auto",
];

/* -------------------------------------------------------------------------- */
/* Block                                                                      */
/* -------------------------------------------------------------------------- */

export function ImageMosaic(props: Partial<ImageMosaicProps> & { isEditing?: boolean }) {
  const merged = { ...IMAGE_MOSAIC_DEFAULTS, ...props };
  const { background, maxWidth, gap, cardRadius } = merged;
  const isEditing = Boolean(props.isEditing);
  const tiles = [merged.tile1, merged.tile2, merged.tile3, merged.tile4].map((tile) => ({
    ...EMPTY_TILE,
    ...(tile ?? {}),
  }));
  const filled = tiles.filter((tile) => tile.imageUrl);

  // Nothing configured: invisible on the storefront, a guide in the editor.
  if (filled.length === 0 && !isEditing) return null;

  const guardClick = (event: React.MouseEvent) => {
    if (isEditing) event.preventDefault();
  };

  const renderTile = (tile: MosaicTile, index: number, className: string) => {
    const content = tile.imageUrl ? (
      <img
        src={getImageUrl(tile.imageUrl)}
        alt={tile.altText}
        loading="lazy"
        className="absolute inset-0 size-full object-cover transition-transform duration-300 group-hover:scale-[1.02] motion-reduce:transition-none"
      />
    ) : (
      <span className="absolute inset-0 grid place-items-center border-2 border-dashed border-slate-300 bg-slate-50 px-3 text-center text-sm text-slate-500" style={{ borderRadius: cardRadius }}>
        <span className="flex flex-col items-center gap-1">
          <ImageIcon className="size-6" aria-hidden="true" />
          Image {index + 1}
          <span className="text-xs">{MOSAIC_TILE_SPECS[index].size} · ratio {MOSAIC_TILE_SPECS[index].ratio}</span>
        </span>
      </span>
    );
    const classes = cn("group relative min-h-0 overflow-hidden bg-slate-100", className);
    const style = { borderRadius: cardRadius };
    return tile.href && tile.imageUrl ? (
      <Link key={index} href={tile.href} onClick={guardClick} className={classes} style={style} aria-label={tile.altText || `Image ${index + 1}`}>
        {content}
      </Link>
    ) : (
      <div key={index} className={classes} style={style}>
        {content}
      </div>
    );
  };

  // The full 4-tile layout is used when all four images are set (or while editing).
  const fullLayout = filled.length === 4 || isEditing;

  return (
    <section className="px-4 py-7 sm:px-6 lg:py-9" style={{ background }} aria-label="Sélection à découvrir">
      <div className="mx-auto" style={{ maxWidth }}>
        {fullLayout ? (
          <div
            className="grid grid-cols-2 grid-rows-[190px_190px_auto] sm:h-[clamp(280px,33vw,480px)] sm:grid-cols-[1.25fr_1fr_0.72fr] sm:grid-rows-2"
            style={{ gap }}>
            {tiles.map((tile, index) => renderTile(tile, index, TILE_LAYOUT[index]))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3" style={{ gap }}>
            {tiles
              .map((tile, index) => ({ tile, index }))
              .filter(({ tile }) => tile.imageUrl)
              .map(({ tile, index }) => renderTile(tile, index, "aspect-[4/3]"))}
          </div>
        )}
      </div>
    </section>
  );
}
