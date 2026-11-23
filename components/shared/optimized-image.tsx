"use client";

import { useState, type Ref } from "react";
import Image, { type ImageProps } from "next/image";

import { canOptimizeImage } from "@/lib/image-hosts";

type Props = Omit<ImageProps, "src"> & { src: string; ref?: Ref<HTMLImageElement> };

/**
 * next/image for pictures that come from the shop's own storage: resized to the screen and served as WebP/AVIF.
 *
 * It never leaves a picture blank: a host that is not configured (see lib/image-hosts.ts) is shown unchanged, and so is
 * a picture the optimizer failed on (for instance when the storage answers too slowly: Next.js gives up after 7 s).
 * The browser then loads the original file directly.
 */
export function OptimizedImage({ src, alt, onError, ...props }: Props) {
  const [optimizerFailed, setOptimizerFailed] = useState(false);
  const [failedSrc, setFailedSrc] = useState(src);

  // A different picture gets a fresh try with the optimizer.
  if (failedSrc !== src) {
    setFailedSrc(src);
    setOptimizerFailed(false);
  }

  const unoptimized = optimizerFailed || !canOptimizeImage(src);
  return (
    <Image
      src={src}
      alt={alt}
      unoptimized={unoptimized}
      onError={(event) => {
        if (!unoptimized) setOptimizerFailed(true);
        onError?.(event);
      }}
      {...props}
    />
  );
}
