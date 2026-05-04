const DEFAULT_BACKEND_API_URL = "http://localhost:3001";

export function normalizeBackendUrl(url: string | undefined | null): string {
  const trimmed = url?.trim().replace(/\/$/, "");

  if (!trimmed) return DEFAULT_BACKEND_API_URL;

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return `http://${trimmed}`;
}

export function getBackendBaseUrl(): string {
  return normalizeBackendUrl(
    process.env.BACKEND_API_URL ??
      process.env.NEXT_PUBLIC_BACKEND_API_URL ??
      process.env.NEXT_PUBLIC_API_URL,
  );
}
