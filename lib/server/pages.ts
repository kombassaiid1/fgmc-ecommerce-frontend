import { getBackendBaseUrl } from "@/lib/backend-url";

const API_BASE_URL = getBackendBaseUrl();

export async function getPublishedPageDataBySlug(slug: string) {
  const query = new URLSearchParams({
    slug,
    _ts: String(Date.now()),
  });
  const response = await fetch(`${API_BASE_URL}/pages?${query.toString()}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    return { data: { content: [], root: { props: {} }, zones: {} } as Record<string, unknown> };
  }

  const payload = (await response.json()) as {
    data?: Record<string, unknown>;
  };
  return {
    data: payload.data ?? ({ content: [], root: { props: {} }, zones: {} } as Record<
      string,
      unknown
    >),
  };
}
