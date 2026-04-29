"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

type HeroImageSliderBlockProps = {
  imageUrls?: string;
  minHeight?: number;
};

function parseImageUrls(raw: string | undefined) {
  return (raw ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export function HeroImageSliderBlock({
  imageUrls = "",
  minHeight = 400,
}: HeroImageSliderBlockProps) {
  const images = useMemo(() => parseImageUrls(imageUrls), [imageUrls]);
  const [index, setIndex] = useState(0);

  const hasImages = images.length > 0;
  const activeIndex = hasImages ? Math.min(index, images.length - 1) : 0;
  const activeImage = hasImages ? images[activeIndex] : "";

  const goPrev = () => {
    if (!hasImages) return;
    setIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  const goNext = () => {
    if (!hasImages) return;
    setIndex((prev) => (prev + 1) % images.length);
  };

  return (
    <section
      className="group relative flex items-center overflow-hidden rounded-xl bg-slate-100 shadow-sm"
      style={{ minHeight: Math.max(220, Number(minHeight) || 400) }}
    >
      {hasImages ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={activeImage}
          alt={`slide-${String(activeIndex + 1)}`}
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
      ) : (
        <div className="absolute inset-0 grid place-items-center text-slate-500">
          Ajoutez des URLs d&apos;images (une par ligne)
        </div>
      )}

      {images.length > 1 ? (
        <>
          <button
            type="button"
            onClick={goPrev}
            className="absolute left-3 z-20 grid h-10 w-10 place-items-center rounded-full bg-black/45 text-white transition hover:bg-black/60"
            aria-label="Image precedente"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            onClick={goNext}
            className="absolute right-3 z-20 grid h-10 w-10 place-items-center rounded-full bg-black/45 text-white transition hover:bg-black/60"
            aria-label="Image suivante"
          >
            <ChevronRight size={18} />
          </button>

          <div className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/35 px-3 py-2">
            {images.map((_, dotIndex) => (
              <button
                key={`dot-${String(dotIndex)}`}
                type="button"
                onClick={() => setIndex(dotIndex)}
                className={`h-2.5 w-2.5 rounded-full ${
                  dotIndex === activeIndex ? "bg-white" : "bg-white/45"
                }`}
                aria-label={`Aller au slide ${String(dotIndex + 1)}`}
              />
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}
