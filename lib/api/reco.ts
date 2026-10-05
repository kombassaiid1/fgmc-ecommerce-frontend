import { apiRequest } from "./http-client";
import { getBackendBaseUrl } from "@/lib/backend-url";
import type { ProductListItem } from "./products";
import { recoAuthHeaders } from "@/lib/reco/auth";
import { getRecoSessionId } from "@/lib/reco/session";
import type { RecoHistoryItem } from "@/lib/reco/utils";

export type RecoHomeProduct = {
  product: ProductListItem;
  source: string;
  position: number;
};

export type RecoHomeResponse = {
  /** null for the backend fallback block: no event must be sent. */
  requestId: string | null;
  show: boolean;
  context: string;
  recipe: string;
  products: RecoHomeProduct[];
};

export async function getHomeRecommendations(
  history: RecoHistoryItem[],
): Promise<RecoHomeResponse> {
  return apiRequest<RecoHomeResponse>({
    path: "/reco/home",
    method: "POST",
    headers: recoAuthHeaders(),
    body: JSON.stringify({ history }),
  });
}

/**
 * Records a viewed product (POST /reco/views). Fire-and-forget: never throws,
 * never awaited, and the empty 204 response is not read.
 */
export function sendProductView(productId: string): void {
  try {
    if (typeof window === "undefined" || !productId) return;
    fetch(`${getBackendBaseUrl()}/reco/views`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...recoAuthHeaders() },
      body: JSON.stringify({ sessionId: getRecoSessionId(), productId }),
      keepalive: true,
      cache: "no-store",
    }).catch(() => undefined);
  } catch {
    // Tracking must never break the product page.
  }
}
