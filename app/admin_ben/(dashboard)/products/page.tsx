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
  Text,
  TextField,
} from "@shopify/polaris";

import { getProducts, type ProductListItem } from "@/lib/api/products";

const PAGE_SIZE = 20;

function formatPrice(value: string) {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return value;
  }
  return num.toFixed(3);
}

export default function AdminProductsListPage() {
  const [items, setItems] = useState<ProductListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
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
        const response = await getProducts({
          page,
          limit: PAGE_SIZE,
          search: search.trim() || undefined,
        });
        setItems(response.data);
        setMeta(response.meta);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Impossible de charger les produits."
        );
      } finally {
        setLoading(false);
      }
    }, 220);

    return () => clearTimeout(timeout);
  }, [page, search]);

  const heading = useMemo(
    () => `Produits (${String(meta.total)})`,
    [meta.total]
  );

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
                Liste de tous les produits avec pagination.
              </Text>
            </BlockStack>
            <Button url="/admin_ben/products/add_product" variant="primary">
              Ajouter un produit
            </Button>
          </InlineStack>
        </BlockStack>
      </Card>

      {error ? <Banner tone="critical" title={error} /> : null}

      <Card>
        <BlockStack gap="300">
          <Box minWidth="280px" width="45%">
            <TextField
              label="Recherche"
              placeholder="Nom, SKU, marque..."
              value={search}
              onChange={(value) => {
                setPage(1);
                setSearch(value);
              }}
              autoComplete="off"
            />
          </Box>

          <Divider />

          <IndexTable
            selectable={false}
            loading={loading}
            resourceName={{ singular: "produit", plural: "produits" }}
            itemCount={items.length}
            emptyState={
              <Box padding="400">
                <Text as="p" tone="subdued">
                  Aucun produit trouve.
                </Text>
              </Box>
            }
            headings={[
              { title: "Produit" },
              { title: "SKU" },
              { title: "Marque" },
              { title: "Prix" },
              { title: "Stock" },
              { title: "Statut" },
              { title: "Action", alignment: "end" },
            ]}
          >
            {items.map((item, index) => (
              <IndexTable.Row id={item.id} key={item.id} position={index}>
                <IndexTable.Cell>
                  <InlineStack gap="200" blockAlign="center">
                    <Text as="span" fontWeight="medium">
                      {item.title}
                    </Text>
                  </InlineStack>
                </IndexTable.Cell>
                <IndexTable.Cell>{item.sku || "-"}</IndexTable.Cell>
                <IndexTable.Cell>{item.brand?.title ?? "-"}</IndexTable.Cell>
                <IndexTable.Cell>{`${formatPrice(item.price)} €`}</IndexTable.Cell>
                <IndexTable.Cell>{item.qty || "0"}</IndexTable.Cell>
                <IndexTable.Cell>
                  <Badge tone={item.status === "PUBLIC" ? "success" : "attention"}>
                    {item.status === "PUBLIC" ? "En ligne" : "Hors ligne"}
                  </Badge>
                </IndexTable.Cell>
                <IndexTable.Cell>
                  <InlineStack align="end">
                    <Button url={`/admin_ben/products/add_product?id=${item.id}`}>
                      Modifier
                    </Button>
                  </InlineStack>
                </IndexTable.Cell>
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
                setPage((prev) => Math.min(Math.max(1, meta.totalPages), prev + 1))
              }
            />
          </InlineStack>
        </BlockStack>
      </Card>
    </BlockStack>
  );
}
