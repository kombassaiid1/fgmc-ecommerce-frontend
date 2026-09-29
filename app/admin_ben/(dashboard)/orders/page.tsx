"use client";

import { useEffect, useMemo, useState } from "react";
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
  getOrders,
  type OrderListItem,
  type StoredOrderProduct,
} from "@/lib/api/orders";

const PAGE_SIZE = 20;

const ETAT_OPTIONS = [
  { label: "Tous les etats", value: "" },
  { label: "En cours", value: "En_cours" },
  { label: "Confirmees", value: "Confirmées" },
  { label: "Expediees", value: "Expédiées" },
  { label: "Annulees", value: "Annulées" },
  { label: "Retour", value: "Retour" },
];

const PAYMENT_OPTIONS = [
  { label: "Tous les paiements", value: "" },
  { label: "Payees", value: "paid" },
];

function formatEuro(value: number | null | undefined) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value ?? NaN) ? Number(value) : 0);
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function readableStatus(value: string) {
  return value
    .replace(/_/g, " ")
    .replace("En attente", "En attente")
    .trim();
}

function getEtatTone(etat: string): "success" | "attention" | "critical" | "info" {
  if (etat.includes("Confirm") || etat.includes("Exp")) return "success";
  if (etat.includes("Annul") || etat.includes("Retour")) return "critical";
  if (etat.includes("cours")) return "attention";
  return "info";
}

function getPaymentTone(
  paymentStatus: string,
): "success" | "attention" | "critical" | "info" {
  if (paymentStatus.includes("Pay")) return "success";
  if (paymentStatus.includes("chou")) return "critical";
  if (paymentStatus.includes("attente")) return "attention";
  return "info";
}

function getCustomerName(order: OrderListItem) {
  if (order.Client) {
    return (
      `${order.Client.firstName ?? ""} ${order.Client.lastName ?? ""}`.trim() ||
      order.Client.email
    );
  }

  return order.guestName?.trim() || "Invite";
}

function getCustomerDetail(order: OrderListItem) {
  return order.Client?.email || order.guestEmail || order.guestPhone || "-";
}

function getProducts(order: OrderListItem): StoredOrderProduct[] {
  return Array.isArray(order.products)
    ? (order.products as StoredOrderProduct[])
    : [];
}

function getProductsSummary(order: OrderListItem) {
  const products = getProducts(order);
  if (products.length === 0) return "-";

  const firstTitle = products[0]?.title ?? "Produit";
  const restCount = products.length - 1;
  const totalQty = products.reduce(
    (sum, item) => sum + Math.max(0, Number(item.quantity ?? 0)),
    0,
  );

  return restCount > 0
    ? `${firstTitle} +${String(restCount)} (${String(totalQty)} pcs)`
    : `${firstTitle} (${String(totalQty)} pcs)`;
}

function getDeliveryAddress(order: OrderListItem) {
  if (order.Address) {
    return [order.Address.City, order.Address.state].filter(Boolean).join(", ");
  }

  return order.guestAddress || "-";
}

export default function AdminOrdersPage() {
  const [items, setItems] = useState<OrderListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [etat, setEtat] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({
    total: 0,
    page: 1,
    limit: PAGE_SIZE,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  });

  useEffect(() => {
    const timeout = setTimeout(async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await getOrders({
          page,
          limit: PAGE_SIZE,
          search: search.trim() || undefined,
          etat: etat || undefined,
          paymentStatus: paymentStatus || undefined,
        });
        setItems(response.data);
        setMeta(response.meta);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Impossible de charger les commandes.",
        );
      } finally {
        setLoading(false);
      }
    }, 220);

    return () => clearTimeout(timeout);
  }, [etat, page, paymentStatus, search]);

  const heading = useMemo(
    () => `Commandes (${String(meta.total)})`,
    [meta.total],
  );

  const paidCount = useMemo(
    () => items.filter((item) => item.paymentStatus.includes("Pay")).length,
    [items],
  );

  const currentPageRevenue = useMemo(
    () => items.reduce((sum, item) => sum + (item.total ?? 0), 0),
    [items],
  );

  const reload = () => {
    setLoading(true);
    void getOrders({
      page,
      limit: PAGE_SIZE,
      search: search.trim() || undefined,
      etat: etat || undefined,
      paymentStatus: paymentStatus || undefined,
    })
      .then((response) => {
        setItems(response.data);
        setMeta(response.meta);
        setError(null);
      })
      .catch((loadError) => {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Impossible de charger les commandes.",
        );
      })
      .finally(() => setLoading(false));
  };

  return (
    <BlockStack gap="500">
      <Card>
        <BlockStack gap="300">
          <InlineStack align="space-between" blockAlign="start" gap="300">
            <BlockStack gap="100">
              <Text as="h2" variant="headingLg">
                {heading}
              </Text>
              <Text as="p" tone="subdued">
                Liste des commandes clients et invites de la boutique.
              </Text>
            </BlockStack>
            <Button
              icon={RefreshIcon}
              accessibilityLabel="Actualiser les commandes"
              loading={loading}
              onClick={reload}
            >
              Actualiser
            </Button>
          </InlineStack>

          <InlineStack gap="200">
            <Badge tone="info">{`Page: ${String(items.length)}`}</Badge>
            <Badge tone="success">{`Payees: ${String(paidCount)}`}</Badge>
            <Badge tone="attention">{`CA page: ${formatEuro(currentPageRevenue)}`}</Badge>
          </InlineStack>
        </BlockStack>
      </Card>

      {error ? <Banner tone="critical" title={error} /> : null}

      <Card>
        <BlockStack gap="300">
          <InlineStack gap="300" wrap>
            <Box minWidth="280px" width="38%">
              <TextField
                label="Recherche"
                placeholder="Reference, client, email, telephone..."
                value={search}
                onChange={(value) => {
                  setPage(1);
                  setSearch(value);
                }}
                autoComplete="off"
                clearButton
                onClearButtonClick={() => {
                  setPage(1);
                  setSearch("");
                }}
              />
            </Box>
            <Box minWidth="180px">
              <Select
                label="Etat"
                options={ETAT_OPTIONS}
                value={etat}
                onChange={(value) => {
                  setPage(1);
                  setEtat(value);
                }}
              />
            </Box>
            <Box minWidth="190px">
              <Select
                label="Paiement"
                options={PAYMENT_OPTIONS}
                value={paymentStatus}
                onChange={(value) => {
                  setPage(1);
                  setPaymentStatus(value);
                }}
              />
            </Box>
          </InlineStack>

          <Divider />

          <IndexTable
            selectable={false}
            loading={loading}
            resourceName={{ singular: "commande", plural: "commandes" }}
            itemCount={items.length}
            emptyState={
              <Box padding="400">
                <Text as="p" tone="subdued">
                  Aucune commande trouvee.
                </Text>
              </Box>
            }
            headings={[
              { title: "Reference" },
              { title: "Client" },
              { title: "Produits" },
              { title: "Total", alignment: "end" },
              { title: "Etat" },
              { title: "Paiement" },
              { title: "Livraison" },
              { title: "Date" },
            ]}
          >
            {items.map((item, index) => (
              <IndexTable.Row id={item.id} key={item.id} position={index}>
                <IndexTable.Cell>
                  <BlockStack gap="050">
                    <Text as="span" fontWeight="semibold">
                      {item.id.slice(0, 10)}
                    </Text>
                    <Text as="span" tone="subdued">
                      {item.Client ? "Client" : "Invite"}
                    </Text>
                  </BlockStack>
                </IndexTable.Cell>
                <IndexTable.Cell>
                  <BlockStack gap="050">
                    <Text as="span" fontWeight="medium">
                      {getCustomerName(item)}
                    </Text>
                    <Text as="span" tone="subdued">
                      {getCustomerDetail(item)}
                    </Text>
                  </BlockStack>
                </IndexTable.Cell>
                <IndexTable.Cell>{getProductsSummary(item)}</IndexTable.Cell>
                <IndexTable.Cell>
                  <InlineStack align="end">
                    <Text as="span" fontWeight="semibold">
                      {formatEuro(item.total)}
                    </Text>
                  </InlineStack>
                </IndexTable.Cell>
                <IndexTable.Cell>
                  <Badge tone={getEtatTone(item.etat)}>
                    {readableStatus(item.etat)}
                  </Badge>
                </IndexTable.Cell>
                <IndexTable.Cell>
                  <Badge tone={getPaymentTone(item.paymentStatus)}>
                    {readableStatus(item.paymentStatus)}
                  </Badge>
                </IndexTable.Cell>
                <IndexTable.Cell>{getDeliveryAddress(item)}</IndexTable.Cell>
                <IndexTable.Cell>{formatDate(item.createdAt)}</IndexTable.Cell>
              </IndexTable.Row>
            ))}
          </IndexTable>

          <InlineStack align="space-between" blockAlign="center">
            <Text as="span" tone="subdued">
              {`Page ${String(meta.page)} / ${String(Math.max(1, meta.totalPages))}`}
            </Text>
            <Pagination
              hasPrevious={meta.hasPreviousPage}
              hasNext={meta.hasNextPage}
              onPrevious={() => setPage((prev) => Math.max(1, prev - 1))}
              onNext={() =>
                setPage((prev) =>
                  Math.min(Math.max(1, meta.totalPages), prev + 1),
                )
              }
            />
          </InlineStack>
        </BlockStack>
      </Card>
    </BlockStack>
  );
}
