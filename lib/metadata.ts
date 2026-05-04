import type { Metadata } from "next";
import { getBackendBaseUrl } from "@/lib/backend-url";

export function getSiteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "http://localhost:3000"
  );
}

/** Fallback OG image when settings have none. Must exist in public/ folder. */
function getDefaultOgImageFallback(): string {
  return `${getSiteUrl()}/opengraph-image`;
}

/**
 * Wrap an image URL through /api/og-image so WebP is converted to JPEG
 * for crawlers that don't support WebP previews.
 */
export function toOgSafeImageUrl(imageUrl: string): {
  url: string;
  type: "image/jpeg" | "image/png";
} {
  if (!imageUrl) return { url: imageUrl, type: "image/jpeg" };

  const lower = imageUrl.toLowerCase();
  const isWebp = lower.endsWith(".webp");
  const isPng = lower.endsWith(".png");

  if (!isWebp) {
    return { url: imageUrl, type: isPng ? "image/png" : "image/jpeg" };
  }

  return {
    url: `${getSiteUrl()}/api/og-image?url=${encodeURIComponent(imageUrl)}`,
    type: "image/jpeg",
  };
}

interface SiteSettingsResponse {
  ogImage?: string | null;
}

function getImageUrl(image: string | null | undefined, baseUrl: string): string {
  if (!image || typeof image !== "string") return "";
  const trimmed = image.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://"))
    return trimmed;
  return `${baseUrl.replace(/\/$/, "")}/upload/images/${
    trimmed.startsWith("/api/upload/images/")
      ? trimmed.slice("/api/upload/images/".length)
      : trimmed
  }`;
}

/** Returns the default OG image URL from site settings, or fallback (for product/category pages). */
export async function getDefaultOgImageUrl(): Promise<string> {
  const baseUrl = getBackendBaseUrl();

  try {
    const res = await fetch(`${baseUrl}/settings`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return getDefaultOgImageFallback();
    const data = (await res.json()) as SiteSettingsResponse;
    return data.ogImage
      ? getImageUrl(data.ogImage, baseUrl)
      : getDefaultOgImageFallback();
  } catch {
    return getDefaultOgImageFallback();
  }
}

export async function getSiteMetadata(): Promise<Metadata> {
  return {
    title: "FGMC",
    description: "E-commerce",
  };
}

