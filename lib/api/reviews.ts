import { apiRequest } from "./http-client";

export type ReviewStatus = "APPROVED" | "WAITING_TO_REVIEW" | "SPAM";

export type AdminReview = {
  id: string;
  review: string;
  rating: number | string;
  name: string;
  email: string;
  status: ReviewStatus;
  createdAt: string;
  product: {
    id: string;
    title: string;
    slug: string;
    images: string[];
  };
};

export type ReviewsPage = {
  data: AdminReview[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
};

export type ReviewStats = {
  total: number;
  approved: number;
  waiting: number;
  spam: number;
};

export function getReviews(params: {
  page?: number;
  limit?: number;
  search?: string;
  status?: ReviewStatus | "";
}): Promise<ReviewsPage> {
  const query = new URLSearchParams();
  query.set("page", String(params.page ?? 1));
  query.set("limit", String(params.limit ?? 20));
  if (params.search?.trim()) query.set("search", params.search.trim());
  if (params.status) query.set("status", params.status);
  return apiRequest<ReviewsPage>({ path: `/reviews?${query.toString()}`, method: "GET" });
}

export function getReviewStats(): Promise<ReviewStats> {
  return apiRequest<ReviewStats>({ path: "/reviews/stats", method: "GET" });
}

export function updateReviewStatus(id: string, status: ReviewStatus): Promise<AdminReview> {
  return apiRequest<AdminReview>({
    path: `/reviews/${encodeURIComponent(id)}/status`,
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

