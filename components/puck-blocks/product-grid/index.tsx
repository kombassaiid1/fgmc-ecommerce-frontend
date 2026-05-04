"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { ComponentConfig } from "@measured/puck";

import { getCategories, type Category } from "@/lib/api/categories";
import { ProductGrid, type CardsToShow } from "./product-grid";

const PALETTE = [
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#84cc16",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
];

function randomColor() {
  return PALETTE[Math.floor(Math.random() * PALETTE.length)];
}

function normalizeHexColor(value: string | undefined, fallback: string) {
  const color = (value ?? "").trim();
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : fallback;
}

type ColorPickerFieldProps = {
  value: string | undefined;
  onChange: (next: string | undefined) => void;
  readOnly?: boolean;
  fallback: string;
};

function ColorPickerField({
  value,
  onChange,
  readOnly = false,
  fallback,
}: ColorPickerFieldProps) {
  const color = normalizeHexColor(value, fallback);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <input
        type="color"
        value={color}
        onChange={(event) => onChange(event.target.value)}
        disabled={readOnly}
        aria-label="Choose color"
        style={{
          width: 44,
          height: 36,
          border: "1px solid #d1d5db",
          borderRadius: 6,
          padding: 2,
          background: "#fff",
        }}
      />
      <span style={{ fontFamily: "monospace", fontSize: 13 }}>{color}</span>
    </div>
  );
}

type CategorySelectFieldProps = {
  value: string | undefined;
  onChange: (next: string | undefined) => void;
  readOnly?: boolean;
};

function CategorySelectField({
  value,
  onChange,
  readOnly = false,
}: CategorySelectFieldProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        setCategories(await getCategories());
      } catch (e) {
        setError(e instanceof Error ? e.message : "Impossible de charger les categories.");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => a.title.localeCompare(b.title, "fr")),
    [categories],
  );

  if (loading) return <p>Chargement des categories...</p>;
  if (error) return <p style={{ color: "#b91c1c" }}>{error}</p>;

  return (
    <select
      value={value ?? "__none__"}
      onChange={(event) => {
        const next = event.target.value;
        onChange(next === "__none__" ? undefined : next);
      }}
      disabled={readOnly}
      style={{
        width: "100%",
        border: "1px solid #d1d5db",
        borderRadius: 6,
        padding: "8px 10px",
      }}
    >
      <option value="__none__">Selectionner une categorie</option>
      {sortedCategories.map((category) => (
        <option key={category.id} value={category.id}>
          {category.title}
        </option>
      ))}
    </select>
  );
}

export type ProductGridProps = {
  title: string;
  cardsToShow: CardsToShow;
  categoryId: string | undefined;
  headerColor?: string;
  headerBgColor?: string;
  headerBorderRadius?: string;
  headerMargin?: string;
  headerPadding?: string;
  width?: string;
  height?: string;
};

export const productGridConfig: ComponentConfig<ProductGridProps> = {
  label: "Product grid",
  fields: {
    title: { type: "text", label: "Section title" },
    categoryId: {
      type: "custom",
      label: "Category",
      render: ({ value, onChange, readOnly }) => (
        <CategorySelectField
          value={value}
          onChange={onChange}
          readOnly={readOnly}
        />
      ),
    },
    cardsToShow: {
      type: "select",
      label: "Cards to show",
      options: [
        { label: "4 cards", value: 4 },
        { label: "6 cards", value: 6 },
        { label: "8 cards", value: 8 },
      ],
    },
    headerColor: {
      type: "custom",
      label: "Header text color",
      render: ({ value, onChange, readOnly }) => (
        <ColorPickerField
          value={value}
          onChange={onChange}
          readOnly={readOnly}
          fallback="#ffffff"
        />
      ),
    },
    headerBgColor: {
      type: "custom",
      label: "Header background color",
      render: ({ value, onChange, readOnly }) => (
        <ColorPickerField
          value={value}
          onChange={onChange}
          readOnly={readOnly}
          fallback="#0858B1"
        />
      ),
    },
    headerBorderRadius: {
      type: "text",
      label: "Header border radius",
      placeholder: "8px",
    },
    headerMargin: {
      type: "text",
      label: "Header margin",
      placeholder: "0 0 24px 0",
    },
    headerPadding: {
      type: "text",
      label: "Header padding",
      placeholder: "12px 16px",
    },
    width: {
      type: "text",
      label: "Width",
      placeholder: "100%",
    },
    height: {
      type: "text",
      label: "Height",
      placeholder: "auto",
    },
  },
  defaultProps: {
    title: "Featured products",
    categoryId: undefined,
    cardsToShow: 4,
    headerColor: "#ffffff",
    headerBgColor: randomColor(),
    headerBorderRadius: "8px",
    headerMargin: undefined,
    headerPadding: "10px",
    width: undefined,
    height: undefined,
  },
  resolveData: async ({ props }) => {
    if (!props.headerBgColor) {
      return {
        props: {
          ...props,
          headerBgColor: randomColor(),
          headerPadding: props.headerPadding || "10px",
        },
      };
    }

    return { props };
  },
  render: (props) => {
    const style: CSSProperties = {};
    if (props.width) style.width = props.width;
    if (props.height) style.height = props.height;

    return (
      <div style={Object.keys(style).length > 0 ? style : undefined}>
        <ProductGrid
          title={props.title ?? "Featured products"}
          cardsToShow={props.cardsToShow ?? 4}
          categoryId={props.categoryId}
          headerStyle={{
            color: props.headerColor,
            backgroundColor: props.headerBgColor,
            borderRadius: props.headerBorderRadius,
            margin: props.headerMargin,
            padding: props.headerPadding,
          }}
        />
      </div>
    );
  },
};

export { ProductGrid } from "./product-grid";
