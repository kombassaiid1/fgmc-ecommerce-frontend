/**
 * The hosts whose images Next.js may resize and convert (WebP/AVIF). Keep in step with `images.remotePatterns`
 * in next.config.ts, which reads the same environment variables.
 *
 *  - the backend (NEXT_PUBLIC_BACKEND_API_URL / NEXT_PUBLIC_API_URL), which serves /upload/images/…
 *  - the media storage (Supabase) used for imported product photos
 *  - any other host listed, comma separated, in NEXT_PUBLIC_IMAGE_HOSTS
 *
 * An image from any other host (or from localhost in development) is still shown, just as it is, without optimization.
 */
const DEFAULT_HOSTS = ["supabase.cliniquemachineacoudre.fr"];

function hostOf(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  try {
    return new URL(/^https?:\/\//i.test(value.trim()) ? value.trim() : `https://${value.trim()}`).hostname;
  } catch {
    return null;
  }
}

const isLocalHost = (host: string) =>
  host === "localhost" || host.endsWith(".localhost") || /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":");

const OPTIMIZED_HOSTS = new Set(
  [
    ...DEFAULT_HOSTS,
    hostOf(process.env.NEXT_PUBLIC_BACKEND_API_URL),
    hostOf(process.env.NEXT_PUBLIC_API_URL),
    ...(process.env.NEXT_PUBLIC_IMAGE_HOSTS ?? "").split(",").map((host) => hostOf(host)),
  ].filter((host): host is string => !!host && !isLocalHost(host)),
);

/** True when `src` can go through the Next.js image optimizer. */
export function canOptimizeImage(src: string | null | undefined): boolean {
  if (!src) return false;
  if (src.startsWith("/") && !src.startsWith("//")) return true; // a file of /public
  try {
    const url = new URL(src);
    return url.protocol === "https:" && OPTIMIZED_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}
