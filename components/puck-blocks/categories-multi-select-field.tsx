"use client";

import { useEffect, useMemo, useState } from "react";
import { BlockStack, Checkbox, InlineStack, Spinner, Text } from "@shopify/polaris";

import { getCategories, type Category } from "@/lib/api/categories";

type CategoriesMultiSelectFieldProps = {
  value: string;
  onChange: (next: string) => void;
  readOnly?: boolean;
};

function parseIds(raw: string) {
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export function CategoriesMultiSelectField({
  value,
  onChange,
  readOnly = false,
}: CategoriesMultiSelectFieldProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const selectedIds = useMemo(() => new Set(parseIds(value || "")), [value]);

  const childrenByParent = useMemo(() => {
    const map = new Map<string, Category[]>();
    for (const category of categories) {
      const parentKey = category.parentCategoryId ?? "__root__";
      const group = map.get(parentKey) ?? [];
      group.push(category);
      map.set(parentKey, group);
    }
    for (const [key, group] of map.entries()) {
      map.set(
        key,
        [...group].sort((a, b) => a.title.localeCompare(b.title, "fr")),
      );
    }
    return map;
  }, [categories]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getCategories();
        setCategories(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Impossible de charger les catégories.");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const toggle = (id: string, checked: boolean) => {
    const next = new Set(selectedIds);
    if (checked) next.add(id);
    else next.delete(id);
    onChange(Array.from(next).join(","));
  };

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const rows = useMemo(() => {
    const output: Array<{ item: Category; depth: number; hasChildren: boolean }> = [];
    const walk = (parentId: string | null, depth: number) => {
      const key = parentId ?? "__root__";
      const list = childrenByParent.get(key) ?? [];
      for (const item of list) {
        const hasChildren = (childrenByParent.get(item.id)?.length ?? 0) > 0;
        output.push({ item, depth, hasChildren });
        if (hasChildren && expandedIds.has(item.id)) {
          walk(item.id, depth + 1);
        }
      }
    };
    walk(null, 0);
    return output;
  }, [childrenByParent, expandedIds]);

  if (loading) {
    return (
      <InlineStack align="center">
        <Spinner accessibilityLabel="Chargement des catégories" />
      </InlineStack>
    );
  }

  if (error) {
    return (
      <Text as="p" tone="critical">
        {error}
      </Text>
    );
  }

  return (
    <BlockStack gap="100">
      {rows.map(({ item, depth, hasChildren }) => (
        <div
          key={item.id}
          style={{
            marginInlineStart: `${String(depth * 14)}px`,
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          {hasChildren ? (
            <button
              type="button"
              onClick={() => toggleExpand(item.id)}
              disabled={readOnly}
              style={{
                border: "none",
                background: "transparent",
                color: "#6b7280",
                cursor: "pointer",
                width: 18,
                padding: 0,
              }}
              aria-label="Expand category"
            >
              {expandedIds.has(item.id) ? "⌄" : "›"}
            </button>
          ) : (
            <span style={{ width: 18, color: "#c0c4c9", textAlign: "center" }}>•</span>
          )}

          <Checkbox
            label={item.title}
            checked={selectedIds.has(item.id)}
            onChange={(checked) => toggle(item.id, checked)}
            disabled={readOnly}
          />
        </div>
      ))}
    </BlockStack>
  );
}
