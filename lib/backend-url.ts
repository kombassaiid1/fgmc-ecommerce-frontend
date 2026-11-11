const LOCAL_BACKEND_API_URL = "http://localhost:3001";

export function normalizeBackendUrl(url: string | undefined | null): string {
  const trimmed = url?.trim().replace(/\/+$/, "");

  if (!trimmed) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "URL du backend absente : configurez BACKEND_API_URL (interne) côté serveur et NEXT_PUBLIC_BACKEND_API_URL côté navigateur.",
      );
    }
    return LOCAL_BACKEND_API_URL;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return ensureApiPrefix(trimmed);
  }

  return ensureApiPrefix(`http://${trimmed}`);
}

function ensureApiPrefix(url: string): string {
  return url.endsWith("/api") ? url : `${url}/api`;
}

export function getBackendBaseUrl(): string {
  const browserUrl =
    process.env.NEXT_PUBLIC_BACKEND_API_URL ?? process.env.NEXT_PUBLIC_API_URL;
  const serverUrl =
    process.env.BACKEND_API_URL ?? browserUrl;

  return normalizeBackendUrl(
    typeof window === "undefined" ? serverUrl : browserUrl,
  );
}
