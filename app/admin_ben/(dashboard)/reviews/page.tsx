"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Badge,
  Banner,
  BlockStack,
  Box,
  Button,
  Card,
  Divider,
  IndexTable,
  InlineStack,
  Pagination,
  Select,
  Text,
  TextField,
} from "@shopify/polaris";
import { RefreshIcon } from "@shopify/polaris-icons";

import {
  getReviews,
  getReviewStats,
  updateReviewStatus,
  type ReviewStatus,
} from "@/lib/api/reviews";

const PAGE_SIZE = 20;

const STATUS_OPTIONS = [
  { label: "À approuver", value: "WAITING_TO_REVIEW" },
  { label: "Tous les avis", value: "" },
  { label: "Approuvés", value: "APPROVED" },
  { label: "Indésirables", value: "SPAM" },
];

function statusLabel(status: ReviewStatus) {
  if (status === "APPROVED") return "Approuvé";
  if (status === "SPAM") return "Indésirable";
  return "À approuver";
}

function statusTone(status: ReviewStatus): "success" | "attention" | "critical" {
  if (status === "APPROVED") return "success";
  if (status === "SPAM") return "critical";
  return "attention";
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(date);
}

export default function AdminReviewsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ReviewStatus | "">("WAITING_TO_REVIEW");

  const reviewsQuery = useQuery({
    queryKey: ["admin-reviews", page, search, status],
    queryFn: () => getReviews({ page, limit: PAGE_SIZE, search, status }),
  });
  const statsQuery = useQuery({
    queryKey: ["admin-review-stats"],
    queryFn: getReviewStats,
  });
  const statusMutation = useMutation({
    mutationFn: ({ id, status: nextStatus }: { id: string; status: ReviewStatus }) =>
      updateReviewStatus(id, nextStatus),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-reviews"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-review-stats"] }),
      ]);
    },
  });

  const reviews = reviewsQuery.data?.data ?? [];
  const meta = reviewsQuery.data?.meta ?? {
    total: 0,
    page,
    limit: PAGE_SIZE,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  };
  const errorMessage = reviewsQuery.error instanceof Error
    ? reviewsQuery.error.message
    : "Impossible de charger les avis clients.";
  const mutationError = statusMutation.error instanceof Error
    ? statusMutation.error.message
    : null;

  return (
    <BlockStack gap="500">
      <Card>
        <BlockStack gap="300">
          <InlineStack align="space-between" blockAlign="start" gap="300">
            <BlockStack gap="100">
              <Text as="h1" variant="headingLg">Avis clients</Text>
              <Text as="p" tone="subdued">Modérez les avis soumis sur les produits avant leur publication.</Text>
            </BlockStack>
            <Button
              icon={RefreshIcon}
              accessibilityLabel="Actualiser les avis"
              loading={reviewsQuery.isFetching || statsQuery.isFetching}
              onClick={() => void Promise.all([reviewsQuery.refetch(), statsQuery.refetch()])}
            >
              Actualiser
            </Button>
          </InlineStack>
          <InlineStack gap="200" wrap>
            <Badge tone="attention">{`À approuver : ${statsQuery.data?.waiting ?? 0}`}</Badge>
            <Badge tone="success">{`Approuvés : ${statsQuery.data?.approved ?? 0}`}</Badge>
            <Badge tone="info">{`Total : ${statsQuery.data?.total ?? 0}`}</Badge>
          </InlineStack>
        </BlockStack>
      </Card>

      {reviewsQuery.isError ? <Banner tone="critical" title={errorMessage} /> : null}
      {statsQuery.isError ? <Banner tone="critical" title="Impossible de charger les statistiques des avis." /> : null}
      {mutationError ? <Banner tone="critical" title={mutationError} onDismiss={() => statusMutation.reset()} /> : null}

      <Card>
        <BlockStack gap="300">
          <InlineStack gap="300" wrap>
            <Box minWidth="280px" width="48%">
              <TextField
                label="Recherche"
                placeholder="Produit, client, email ou commentaire..."
                value={search}
                onChange={(value) => { setPage(1); setSearch(value); }}
                autoComplete="off"
                clearButton
                onClearButtonClick={() => { setPage(1); setSearch(""); }}
              />
            </Box>
            <Box minWidth="190px">
              <Select
                label="Statut"
                options={STATUS_OPTIONS}
                value={status}
                onChange={(value) => { setPage(1); setStatus(value as ReviewStatus | ""); }}
              />
            </Box>
          </InlineStack>
          <Divider />

          <IndexTable
            selectable={false}
            loading={reviewsQuery.isLoading}
            resourceName={{ singular: "avis", plural: "avis" }}
            itemCount={reviews.length}
            emptyState={<Box padding="400"><Text as="p" tone="subdued">Aucun avis ne correspond à ces filtres.</Text></Box>}
            headings={[
              { title: "Produit" },
              { title: "Client" },
              { title: "Note" },
              { title: "Commentaire" },
              { title: "Statut" },
              { title: "Date" },
              { title: "Actions" },
            ]}
          >
            {reviews.map((review, index) => (
              <IndexTable.Row id={review.id} key={review.id} position={index}>
                <IndexTable.Cell>
                  <Text as="span" fontWeight="semibold">{review.product?.title ?? "Produit supprimé"}</Text>
                </IndexTable.Cell>
                <IndexTable.Cell>
                  <BlockStack gap="050">
                    <Text as="span" fontWeight="medium">{review.name}</Text>
                    <Text as="span" tone="subdued">{review.email}</Text>
                  </BlockStack>
                </IndexTable.Cell>
                <IndexTable.Cell>{`${Number(review.rating)}/5`}</IndexTable.Cell>
                <IndexTable.Cell>
                  <div className="max-w-[340px] whitespace-pre-wrap break-words">{review.review}</div>
                </IndexTable.Cell>
                <IndexTable.Cell><Badge tone={statusTone(review.status)}>{statusLabel(review.status)}</Badge></IndexTable.Cell>
                <IndexTable.Cell>{formatDate(review.createdAt)}</IndexTable.Cell>
                <IndexTable.Cell>
                  <InlineStack gap="100" wrap>
                    {review.status !== "APPROVED" ? (
                      <Button
                        size="slim"
                        variant="primary"
                        loading={statusMutation.isPending && statusMutation.variables?.id === review.id && statusMutation.variables.status === "APPROVED"}
                        disabled={statusMutation.isPending}
                        onClick={() => statusMutation.mutate({ id: review.id, status: "APPROVED" })}
                      >Approve</Button>
                    ) : null}
                    {review.status !== "SPAM" ? (
                      <Button
                        size="slim"
                        tone="critical"
                        loading={statusMutation.isPending && statusMutation.variables?.id === review.id && statusMutation.variables.status === "SPAM"}
                        disabled={statusMutation.isPending}
                        onClick={() => statusMutation.mutate({ id: review.id, status: "SPAM" })}
                      >Reject</Button>
                    ) : null}
                  </InlineStack>
                </IndexTable.Cell>
              </IndexTable.Row>
            ))}
          </IndexTable>

          <InlineStack align="space-between" blockAlign="center">
            <Text as="span" tone="subdued">{`Page ${meta.page} / ${Math.max(1, meta.totalPages)} · ${meta.total} avis`}</Text>
            <Pagination
              hasPrevious={meta.hasPreviousPage}
              hasNext={meta.hasNextPage}
              onPrevious={() => setPage((current) => Math.max(1, current - 1))}
              onNext={() => setPage((current) => Math.min(meta.totalPages, current + 1))}
            />
          </InlineStack>
        </BlockStack>
      </Card>
    </BlockStack>
  );
}
