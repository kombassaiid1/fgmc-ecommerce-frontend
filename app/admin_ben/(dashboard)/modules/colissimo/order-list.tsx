"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Badge, BlockStack, Button, Card, EmptyState, IndexTable, InlineGrid, InlineStack, Pagination, Select, SkeletonBodyText, Text, TextField, useIndexResourceState } from "@shopify/polaris";
import { orderStatesApi } from "@/lib/api/order-states";
import { Alert } from "./cm-kit";
import { EMPTY_FILTERS, colissimoCall, filtersQuery, type OrderFilters, type OrdersPage } from "./colissimo-api";

const date = (value: string) => new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
const SORT_KEYS: Array<string | null> = ["reference", null, "customer", "etat", "createdAt", null, null, null];

/** The filtered, sorted and paged list used by the Orders and Postage screens. */
export function useOrderList(endpoint: "/orders" | "/postage/orders") {
  const [filters, setFilters] = useState<OrderFilters>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<OrderFilters>(EMPTY_FILTERS);
  const [pageNumber, setPageNumber] = useState(1);
  const [sort, setSortKey] = useState("createdAt");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState<OrdersPage | null>(null);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);

  const query = useMemo(() => filtersQuery(applied, pageNumber, sort, dir), [applied, pageNumber, sort, dir]);
  useEffect(() => {
    let cancelled = false;
    colissimoCall<OrdersPage>(`${endpoint}?${query}`)
      .then((loaded) => {
        if (cancelled) return;
        setPage(loaded);
        setError("");
      })
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : "Chargement impossible."));
    return () => {
      cancelled = true;
    };
  }, [endpoint, query, tick]);

  const rows = page?.rows ?? [];
  const selection = useIndexResourceState(rows);

  return {
    page,
    error,
    reload: () => setTick((n) => n + 1),
    selected: selection.selectedResources,
    allSelected: selection.allResourcesSelected,
    handleSelectionChange: selection.handleSelectionChange,
    setSelected: (ids: string[]) => {
      if (ids.length === 0) selection.clearSelection();
    },
    filters,
    setFilters,
    apply: () => {
      setApplied(filters);
      setPageNumber(1);
      selection.clearSelection();
    },
    reset: () => {
      setFilters(EMPTY_FILTERS);
      setApplied(EMPTY_FILTERS);
      setPageNumber(1);
      selection.clearSelection();
    },
    pageNumber,
    setPageNumber,
    sort,
    dir,
    setSort: (key: string, direction: "asc" | "desc") => {
      setSortKey(key);
      setDir(direction);
    },
  };
}

export type OrderListApi = ReturnType<typeof useOrderList>;

/** The list itself: a filter bar, then a selectable IndexTable with sorting and pagination. */
export function OrderTable({ list, showLabel }: { list: OrderListApi; showLabel?: boolean }) {
  const { page, filters, setFilters } = list;
  const [states, setStates] = useState<Array<{ key: string; name: string }>>([]);
  useEffect(() => {
    let cancelled = false;
    orderStatesApi.list().then((rows) => !cancelled && setStates(rows.map((row) => ({ key: row.key, name: row.name })))).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  if (list.error) return <Alert tone="danger">{list.error}</Alert>;
  if (!page) return <Card><SkeletonBodyText lines={8} /></Card>;

  const pages = Math.max(1, Math.ceil(page.total / page.limit));
  const set = (key: keyof OrderFilters) => (value: string) => setFilters({ ...filters, [key]: value });
  const headings = [{ title: "Référence" }, { title: "ID" }, { title: "Client" }, { title: "Statut" }, { title: "Date" }, { title: "Service" }, { title: "Pays" }, ...(showLabel ? [{ title: "Étiquette" }] : [])] as [{ title: string }, ...Array<{ title: string }>];
  const sortColumn = Math.max(0, SORT_KEYS.indexOf(list.sort));

  return (
    <BlockStack gap="300">
      <Card>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            list.apply();
          }}>
          <BlockStack gap="300">
            <InlineGrid columns={{ xs: 1, sm: 2, lg: 4 }} gap="300">
              <TextField label="Référence" value={filters.reference} onChange={set("reference")} autoComplete="off" clearButton onClearButtonClick={() => set("reference")("")} />
              <TextField label="ID de commande" value={filters.id} onChange={set("id")} autoComplete="off" />
              <TextField label="Client" value={filters.customer} onChange={set("customer")} autoComplete="off" />
              <Select label="Statut" value={filters.state} onChange={set("state")} options={[{ label: "Tous", value: "" }, ...states.map((state) => ({ label: state.name, value: state.key }))]} />
              <TextField label="Du" type="date" value={filters.from} onChange={set("from")} autoComplete="off" />
              <TextField label="Au" type="date" value={filters.to} onChange={set("to")} autoComplete="off" />
              <Select label="Service Colissimo" value={filters.service} onChange={set("service")} options={[{ label: "Tous", value: "" }, ...page.services.map((service) => ({ label: service, value: service }))]} />
              <Select label="Pays de livraison" value={filters.country} onChange={set("country")} options={[{ label: "Tous", value: "" }, ...page.countries.map((country) => ({ label: country, value: country }))]} />
            </InlineGrid>
            <InlineStack gap="200" align="end">
              <Button onClick={list.reset}>Réinitialiser</Button>
              <Button variant="primary" submit>Filtrer</Button>
            </InlineStack>
          </BlockStack>
        </form>
      </Card>

      <Card padding="0">
        {page.rows.length === 0 ? (
          <EmptyState heading="Aucune commande" image="">
            <p>Aucune commande livrée par Colissimo ne correspond à ces filtres.</p>
          </EmptyState>
        ) : (
          <IndexTable
            resourceName={{ singular: "commande", plural: "commandes" }}
            itemCount={page.rows.length}
            selectedItemsCount={list.allSelected ? "All" : list.selected.length}
            onSelectionChange={list.handleSelectionChange}
            headings={headings}
            sortable={SORT_KEYS.slice(0, headings.length).map((key) => key !== null)}
            sortColumnIndex={sortColumn}
            sortDirection={list.dir === "asc" ? "ascending" : "descending"}
            onSort={(index, direction) => {
              const key = SORT_KEYS[index];
              if (key) list.setSort(key, direction === "ascending" ? "asc" : "desc");
            }}>
            {page.rows.map((row, index) => (
              <IndexTable.Row id={row.id} key={row.id} position={index} selected={list.selected.includes(row.id)}>
                <IndexTable.Cell><Link href={`/admin_ben/orders/${row.id}`} onClick={(event) => event.stopPropagation()}><Text as="span" fontWeight="semibold">{row.reference ?? "—"}</Text></Link></IndexTable.Cell>
                <IndexTable.Cell><span className="cm-mono">…{row.id.slice(-8)}</span></IndexTable.Cell>
                <IndexTable.Cell>{row.customer || "—"}</IndexTable.Cell>
                <IndexTable.Cell><Badge tone="info">{row.etatLabel}</Badge></IndexTable.Cell>
                <IndexTable.Cell><span className="cm-num">{date(row.createdAt)}</span></IndexTable.Cell>
                <IndexTable.Cell>{row.service}</IndexTable.Cell>
                <IndexTable.Cell>{row.country}</IndexTable.Cell>
                {showLabel ? (
                  <IndexTable.Cell>
                    {row.hasLabel ? <a href={`/frontend-api/admin/colissimo-integration/shipments/${row.shipmentId}/label`} target="_blank" rel="noopener noreferrer" onClick={(event) => event.stopPropagation()}><span className="cm-mono">{row.trackId}</span></a> : <Badge>Aucune</Badge>}
                  </IndexTable.Cell>
                ) : null}
              </IndexTable.Row>
            ))}
          </IndexTable>
        )}
      </Card>

      <InlineStack align="space-between" blockAlign="center" gap="300">
        <Text as="p" variant="bodySm" tone="subdued">{page.total} commande{page.total > 1 ? "s" : ""} · page {list.pageNumber} sur {pages}</Text>
        <Pagination hasPrevious={list.pageNumber > 1} onPrevious={() => list.setPageNumber(list.pageNumber - 1)} hasNext={list.pageNumber < pages} onNext={() => list.setPageNumber(list.pageNumber + 1)} />
      </InlineStack>
    </BlockStack>
  );
}
