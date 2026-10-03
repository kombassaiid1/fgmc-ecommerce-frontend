import { apiRequest } from "./http-client";
import type { ProductListItem } from "./products";
import { recoAuthHeaders } from "@/lib/reco/auth";
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
