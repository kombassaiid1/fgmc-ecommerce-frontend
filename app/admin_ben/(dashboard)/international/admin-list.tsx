"use client";

import { useState, type ReactNode } from "react";
import { ActionList, Badge, Box, Button, ButtonGroup, Card, Checkbox, Icon, InlineStack, Pagination, Popover, Select, Spinner, Text, TextField } from "@shopify/polaris";
import type { IconSource } from "@shopify/polaris";
import { ChevronDownIcon, ChevronUpIcon, SearchIcon, XIcon } from "@shopify/polaris-icons";

/**
 * A back-office list laid out like PrestaShop's: icon, title and count pill with a
 * toolbar, sortable headings, a filter row under the headings with a Search button,
 * a checkbox column, a split "Modifier ▾" button on each row, and bulk actions.
 * Built only from Shopify Polaris components; it is purely presentational.
 */

export type ListFilter =
  | { kind: "text"; placeholder?: string; width?: number }
  | { kind: "select"; options: Array<{ label: string; value: string }> };

export type ListColumn<T> = {
  key: string;
  header: string;
  align?: "start" | "center" | "end";
  width?: string;
  sortable?: boolean;
  filter?: ListFilter;
  cell: (row: T) => ReactNode;
};

export type RowAction = {
  content: string;
  onAction: () => void;
  menu: Array<{ content: string; destructive?: boolean; onAction: () => void }>;
};

export type AdminListProps<T> = {
  title: string;
  icon: IconSource;
  count: number | string;
  toolbar?: ReactNode;
  columns: Array<ListColumn<T>>;
  rows: T[];
  rowId: (row: T) => string;
  filters: Record<string, string>;
  onApplyFilters: (filters: Record<string, string>) => void;
  sort: { key: string; dir: "asc" | "desc" };
  onSort: (key: string, dir: "asc" | "desc") => void;
  selectable?: boolean;
  selected?: Set<string>;
  onSelect?: (ids: Set<string>) => void;
  bulkActions?: Array<{ content: string; destructive?: boolean; onAction: () => void }>;
  rowAction?: (row: T) => RowAction | null;
  page: number;
  pages: number;
  onPage: (page: number) => void;
  pageSize: number;
  pageSizes?: number[];
  onPageSize?: (size: number) => void;
  loading?: boolean;
  emptyText: string;
};

const cell = { padding: "var(--p-space-200) var(--p-space-300)" } as const;
const ALIGN = { start: "left", center: "center", end: "right" } as const;

function SortArrows({ label, active, dir, onSort }: { label: string; active: boolean; dir: "asc" | "desc"; onSort: (dir: "asc" | "desc") => void }) {
  return (
    <InlineStack gap="0" blockAlign="center" wrap={false}>
      <Button variant="monochromePlain" size="micro" icon={ChevronDownIcon} pressed={active && dir === "desc"} accessibilityLabel={`Trier par ${label}, décroissant`} onClick={() => onSort("desc")} />
      <Button variant="monochromePlain" size="micro" icon={ChevronUpIcon} pressed={active && dir === "asc"} accessibilityLabel={`Trier par ${label}, croissant`} onClick={() => onSort("asc")} />
    </InlineStack>
  );
}

function RowActions({ action }: { action: RowAction }) {
  const [open, setOpen] = useState(false);
  return (
    <InlineStack align="end">
      <ButtonGroup variant="segmented">
        <Button size="slim" onClick={action.onAction}>{action.content}</Button>
        <Popover
          active={open}
          onClose={() => setOpen(false)}
          activator={<Button size="slim" icon={ChevronDownIcon} accessibilityLabel="Autres actions" onClick={() => setOpen((value) => !value)} />}>
          <ActionList
            actionRole="menuitem"
            items={action.menu.map((item) => ({ content: item.content, destructive: item.destructive, onAction: () => { setOpen(false); item.onAction(); } }))}
          />
        </Popover>
      </ButtonGroup>
    </InlineStack>
  );
}

export function AdminList<T>(props: AdminListProps<T>) {
  const { title, icon, count, toolbar, columns, rows, rowId, filters, onApplyFilters, sort, onSort, selectable, selected, onSelect, bulkActions, rowAction, page, pages, onPage, pageSize, pageSizes, onPageSize, loading, emptyText } = props;
  const [draft, setDraft] = useState<Record<string, string>>(filters);
  const [bulkOpen, setBulkOpen] = useState(false);

  const hasFilters = columns.some((column) => column.filter);
  const applied = Object.values(filters).some(Boolean);
  const selectedIds = selected ?? new Set<string>();
  const visibleIds = rows.map(rowId);
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
  const someSelected = visibleIds.some((id) => selectedIds.has(id));
  const hasActions = Boolean(rowAction);
  const columnCount = columns.length + (selectable ? 1 : 0) + (hasActions || hasFilters ? 1 : 0);

  const apply = () => onApplyFilters(draft);
  const reset = () => {
    setDraft({});
    onApplyFilters({});
  };
  const toggleAll = () => onSelect?.(allSelected ? new Set([...selectedIds].filter((id) => !visibleIds.includes(id))) : new Set([...selectedIds, ...visibleIds]));
  const toggleOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelect?.(next);
  };

  return (
    <Card padding="0">
      <Box padding="300" borderBlockEndWidth="025" borderColor="border">
        <InlineStack align="space-between" blockAlign="center" gap="300">
          <InlineStack gap="200" blockAlign="center">
            <Icon source={icon} tone="subdued" />
            <Text as="h2" variant="headingMd">{title}</Text>
            <Badge tone="info">{String(count)}</Badge>
            {loading ? <Spinner size="small" accessibilityLabel="Chargement" /> : null}
          </InlineStack>
          {toolbar ? <InlineStack gap="100" blockAlign="center">{toolbar}</InlineStack> : null}
        </InlineStack>
      </Box>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {selectable ? (
                <th style={{ ...cell, width: 44 }}>
                  <Checkbox label="Tout sélectionner" labelHidden checked={allSelected ? true : someSelected ? "indeterminate" : false} onChange={toggleAll} />
                </th>
              ) : null}
              {columns.map((column) => (
                <th key={column.key} style={{ ...cell, textAlign: ALIGN[column.align ?? "start"], width: column.width, whiteSpace: "nowrap" }}>
                  <InlineStack gap="100" blockAlign="center" wrap={false} align={column.align === "center" ? "center" : column.align === "end" ? "end" : "start"}>
                    <Text as="span" variant="headingSm">{column.header}</Text>
                    {column.sortable ? <SortArrows label={column.header} active={sort.key === column.key} dir={sort.dir} onSort={(dir) => onSort(column.key, dir)} /> : null}
                  </InlineStack>
                </th>
              ))}
              {hasActions || hasFilters ? <th style={cell}><Text as="span" visuallyHidden>Actions</Text></th> : null}
            </tr>
            {hasFilters ? (
              <tr
                style={{ background: "var(--p-color-bg-surface-info)", borderBlock: "1px solid var(--p-color-border-info)" }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    apply();
                  }
                }}>
                {selectable ? <td style={cell}>{applied ? <Button variant="tertiary" icon={XIcon} accessibilityLabel="Réinitialiser les filtres" onClick={reset} /> : null}</td> : null}
                {columns.map((column) => (
                  <td key={column.key} style={{ ...cell, textAlign: ALIGN[column.align ?? "start"] }}>
                    {column.filter?.kind === "text" ? (
                      <div style={{ maxWidth: column.filter.width }}>
                        <TextField label={`Filtrer : ${column.header}`} labelHidden autoComplete="off" placeholder={column.filter.placeholder} value={draft[column.key] ?? ""} onChange={(value) => setDraft({ ...draft, [column.key]: value })} />
                      </div>
                    ) : column.filter?.kind === "select" ? (
                      <Select label={`Filtrer : ${column.header}`} labelHidden options={column.filter.options} value={draft[column.key] ?? ""} onChange={(value) => setDraft({ ...draft, [column.key]: value })} />
                    ) : null}
                  </td>
                ))}
                <td style={cell}>
                  <InlineStack align="end" gap="100" wrap={false}>
                    {applied && !selectable ? <Button variant="tertiary" icon={XIcon} accessibilityLabel="Réinitialiser les filtres" onClick={reset} /> : null}
                    <Button icon={SearchIcon} onClick={apply}>Rechercher</Button>
                  </InlineStack>
                </td>
              </tr>
            ) : null}
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const id = rowId(row);
              const action = rowAction?.(row) ?? null;
              return (
                <tr key={id} style={{ borderBottom: "1px solid var(--p-color-border)", background: selectedIds.has(id) ? "var(--p-color-bg-surface-selected)" : index % 2 ? "var(--p-color-bg-surface-secondary)" : "transparent" }}>
                  {selectable ? (
                    <td style={cell}><Checkbox label={`Sélectionner la ligne ${id}`} labelHidden checked={selectedIds.has(id)} onChange={() => toggleOne(id)} /></td>
                  ) : null}
                  {columns.map((column) => (
                    <td key={column.key} style={{ ...cell, textAlign: ALIGN[column.align ?? "start"] }}>{column.cell(row)}</td>
                  ))}
                  {hasActions || hasFilters ? <td style={cell}>{action ? <RowActions action={action} /> : null}</td> : null}
                </tr>
              );
            })}
            {rows.length === 0 ? (
              <tr><td colSpan={columnCount} style={{ padding: "var(--p-space-600)", textAlign: "center" }}><Text as="span" variant="bodyMd" tone="subdued">{loading ? "Chargement…" : emptyText}</Text></td></tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <Box padding="300" borderBlockStartWidth="025" borderColor="border">
        <InlineStack align="space-between" blockAlign="center" gap="300">
          {bulkActions?.length ? (
            <Popover
              active={bulkOpen}
              onClose={() => setBulkOpen(false)}
              activator={
                <Button disclosure="up" disabled={selectedIds.size === 0} onClick={() => setBulkOpen((value) => !value)}>
                  {selectedIds.size ? `Actions groupées (${selectedIds.size})` : "Actions groupées"}
                </Button>
              }>
              <ActionList actionRole="menuitem" items={bulkActions.map((item) => ({ content: item.content, destructive: item.destructive, onAction: () => { setBulkOpen(false); item.onAction(); } }))} />
            </Popover>
          ) : <span />}
          <InlineStack gap="300" blockAlign="center">
            {pageSizes && onPageSize ? (
              <InlineStack gap="200" blockAlign="center">
                <Text as="span" variant="bodySm" tone="subdued">Afficher</Text>
                <Select label="Lignes par page" labelHidden options={pageSizes.map((size) => ({ label: `${size} / page`, value: String(size) }))} value={String(pageSize)} onChange={(value) => onPageSize(Number(value))} />
              </InlineStack>
            ) : null}
            <Text as="span" variant="bodySm" tone="subdued">Page {Math.min(page, pages)} sur {pages}</Text>
            <Pagination label={`Page ${page} sur ${pages}`} hasPrevious={page > 1} onPrevious={() => onPage(page - 1)} hasNext={page < pages} onNext={() => onPage(page + 1)} />
          </InlineStack>
        </InlineStack>
      </Box>
    </Card>
  );
}
