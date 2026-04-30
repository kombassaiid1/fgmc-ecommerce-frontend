function getBaseUrl(): string {
  // Prefer the backend API base explicitly. `NEXT_PUBLIC_API_URL` is often used
  // for other purposes (assets/proxy) and can accidentally point to the frontend.
  const urlRaw =
    process.env.NEXT_PUBLIC_BACKEND_API_URL ??
    process.env.BACKEND_API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    "http://localhost:3001";
  const url = urlRaw.replace(/\/$/, "");

  // Dev safety: if the base points at the frontend origin, API fetches will 404.
  // Force the backend port even if an env var was set incorrectly.
  try {
    const u = new URL(url);
    if (
      (u.hostname === "localhost" || u.hostname === "127.0.0.1") &&
      u.port === "3000"
    ) {
      u.port = "3001";
      return u.origin;
    }
  } catch {
    // ignore parse errors and fall back to the raw value
  }

  return url;
}

/** Resolve image path to backend URL (e.g. /api/upload/images/xxx.webp → BASE/upload/images/xxx.webp). */
export function getImageUrl(image: string | null | undefined): string {
  if (!image) return "";
  if (image.startsWith("http://") || image.startsWith("https://")) return image;
  const base = getBaseUrl();
  const prefix = "/api/upload/images/";
  const id = image.startsWith(prefix) ? image.slice(prefix.length) : image;
  return `${base}/upload/images/${id}`;
}

export async function apiFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const base = getBaseUrl();
  const res = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `HTTP ${res.status}`);
  }

  return res.json() as Promise<T>;
}

export { getBaseUrl };

