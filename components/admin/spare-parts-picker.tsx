"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BlockStack,
  Button,
  Checkbox,
  InlineStack,
  Select,
  Spinner,
  Tag,
  Text,
  TextField,
} from "@shopify/polaris";
import { getCategories, type Category } from "@/lib/api/categories";
import {
  getProductById,
  getProducts,
  type ProductListItem,
} from "@/lib/api/products";

type KnownProduct = { id: string; title: string; sku: string; status?: string };

type Props = {
  value: string[];
  onChange: (ids: string[]) => void;
  /** Product being edited: never selectable as its own spare part. */
  excludeId?: string | null;
};

const PAGE_SIZE = 30;

function categoryOptions(categories: Category[]) {
  const byParent = new Map<string, Category[]>();
  for (const category of categories) {
    const key = category.parentCategoryId ?? "__root__";
    byParent.set(key, [...(byParent.get(key) ?? []), category]);
  }
  const options: { label: string; value: string }[] = [
    { label: "Toutes les catégories", value: "" },
  ];
  const walk = (parentKey: string, depth: number, seen: Set<string>) => {
    const children = [...(byParent.get(parentKey) ?? [])].sort((a, b) =>
      a.title.localeCompare(b.title, "fr"),
    );
    for (const child of children) {
      if (seen.has(child.id)) continue;
      options.push({
        label: `${"— ".repeat(depth)}${child.title}`,
        value: child.id,
      });
      walk(child.id, depth + 1, new Set(seen).add(child.id));
    }
  };
  walk("__root__", 0, new Set());
  return options;
}

export function SparePartsPicker({ value, onChange, excludeId }: Props) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [results, setResults] = useState<ProductListItem[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [known, setKnown] = useState<Map<string, KnownProduct>>(new Map());

  const remember = (items: KnownProduct[]) =>
    setKnown((current) => {
      const next = new Map(current);
      for (const item of items) next.set(item.id, item);
      return next;
    });

  useEffect(() => {
    getCategories()
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  // Reset to first page whenever the filters change.
  useEffect(() => {
    setPage(1);
  }, [categoryId, search]);

  useEffect(() => {
    let active = true;
    const timeout = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await getProducts({
          page,
          limit: PAGE_SIZE,
          search: search.trim() || undefined,
          categoryId: categoryId || undefined,
          includeDescendants: Boolean(categoryId),
        });
        if (!active) return;
        setResults(response.data);
        setTotalPages(Math.max(1, response.meta.totalPages));
        remember(
          response.data.map((item) => ({
            id: item.id,
            title: item.title,
            sku: item.sku,
            status: item.status,
          })),
        );
      } catch (loadError) {
        if (!active) return;
        setResults([]);
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Impossible de charger les produits.",
        );
      } finally {
        if (active) setLoading(false);
      }
    }, 250);
    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [categoryId, search, page]);

  // Resolve labels for already-selected ids we have not seen in a result page.
  useEffect(() => {
    const missing = value.filter((id) => !known.has(id));
    if (missing.length === 0) return;
    let active = true;
    Promise.allSettled(missing.map((id) => getProductById(id))).then((settled) => {
      if (!active) return;
      const found: KnownProduct[] = [];
      settled.forEach((entry, index) => {
        found.push(
          entry.status === "fulfilled"
            ? {
                id: entry.value.id,
                title: entry.value.title,
                sku: entry.value.sku,
                status: entry.value.status,
              }
            : { id: missing[index], title: "Produit introuvable", sku: "" },
        );
      });
      remember(found);
    });
    return () => {
      active = false;
    };
  }, [value, known]);

  const options = useMemo(() => categoryOptions(categories), [categories]);
  const selectable = results.filter((item) => item.id !== excludeId);
  const selected = new Set(value);

  const toggle = (id: string, checked: boolean) =>
    onChange(checked ? [...value.filter((x) => x !== id), id] : value.filter((x) => x !== id));

  const allVisibleSelected =
    selectable.length > 0 && selectable.every((item) => selected.has(item.id));

  const toggleAllVisible = () => {
    const visibleIds = selectable.map((item) => item.id);
    onChange(
      allVisibleSelected
        ? value.filter((id) => !visibleIds.includes(id))
        : [...value, ...visibleIds.filter((id) => !selected.has(id))],
    );
  };

  return (
    <BlockStack gap="300">
      <InlineStack gap="300" wrap blockAlign="end">
        <div style={{ minWidth: 220, flex: "1 1 220px" }}>
          <Select
            label="Catégorie"
            options={options}
            value={categoryId}
            onChange={setCategoryId}
          />
        </div>
        <div style={{ minWidth: 220, flex: "2 1 280px" }}>
          <TextField
            label="Rechercher un produit"
            value={search}
            onChange={setSearch}
            placeholder="Nom ou référence"
            autoComplete="off"
            clearButton
            onClearButtonClick={() => setSearch("")}
          />
        </div>
      </InlineStack>

      <div className="rounded-lg border border-slate-200">
        <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
          <Checkbox
            label="Tout sélectionner (liste affichée)"
            checked={allVisibleSelected}
            disabled={selectable.length === 0}
            onChange={toggleAllVisible}
          />
          {loading ? <Spinner size="small" accessibilityLabel="Chargement" /> : null}
        </div>
        <div className="max-h-[420px] space-y-1 overflow-y-auto p-3">
          {error ? (
            <Text as="p" tone="critical">{error}</Text>
          ) : selectable.length ? (
            selectable.map((item) => (
              <div key={item.id} className="rounded-md px-3 py-1.5 hover:bg-slate-50">
                <Checkbox
                  label={`${item.title} (${item.sku})${item.status === "DRAFT" ? " — Brouillon" : ""}`}
                  checked={selected.has(item.id)}
                  onChange={(checked) => toggle(item.id, checked)}
                />
              </div>
            ))
          ) : loading ? null : (
            <Text as="p" variant="bodySm" tone="subdued">
              Aucun produit pour cette catégorie / recherche.
            </Text>
          )}
        </div>
        {totalPages > 1 ? (
          <div className="flex items-center justify-between border-t border-slate-200 px-3 py-2">
            <Button size="slim" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>
              Précédent
            </Button>
            <Text as="span" variant="bodySm" tone="subdued">
              Page {page} / {totalPages}
            </Text>
            <Button size="slim" disabled={page >= totalPages || loading} onClick={() => setPage((p) => p + 1)}>
              Suivant
            </Button>
          </div>
        ) : null}
      </div>

      <BlockStack gap="150">
        <Text as="p" variant="bodySm" fontWeight="semibold">
          {value.length} pièce{value.length > 1 ? "s" : ""} sélectionnée{value.length > 1 ? "s" : ""}
        </Text>
        {value.length ? (
          <InlineStack gap="150" wrap>
            {value.map((id) => {
              const info = known.get(id);
              return (
                <Tag key={id} onRemove={() => toggle(id, false)}>
                  {info ? `${info.title}${info.sku ? ` (${info.sku})` : ""}` : "Chargement…"}
                </Tag>
              );
            })}
          </InlineStack>
        ) : null}
      </BlockStack>
    </BlockStack>
  );
}
