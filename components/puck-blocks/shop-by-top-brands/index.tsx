"use client";

import type { ComponentConfig } from "@measured/puck";

import { ShopByTopBrandsBlock } from "./shop-by-top-brands";

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

type ShopByTopBrandsProps = {
  title: string;
  limit: number;
  backgroundColor?: string;
  cardBackgroundColor?: string;
  titleFontSize?: number;
  titleFontWeight?: string;
};

export const shopByTopBrandsConfig: ComponentConfig<ShopByTopBrandsProps> = {
  label: "Shop by Top Brands",
  fields: {
    title: {
      type: "text",
      label: "Title",
    },
    limit: {
      type: "number",
      label: "Brands to show",
      min: 1,
      max: 24,
    },
    backgroundColor: {
      type: "custom",
      label: "Background color",
      render: ({ value, onChange, readOnly }) => (
        <ColorPickerField
          value={value}
          onChange={onChange}
          readOnly={readOnly}
          fallback="#f6f6f6"
        />
      ),
    },
    cardBackgroundColor: {
      type: "custom",
      label: "Card background color",
      render: ({ value, onChange, readOnly }) => (
        <ColorPickerField
          value={value}
          onChange={onChange}
          readOnly={readOnly}
          fallback="#ffffff"
        />
      ),
    },
    titleFontSize: {
      type: "number",
      label: "Title font size",
      min: 12,
      max: 64,
    },
    titleFontWeight: {
      type: "select",
      label: "Title font weight",
      options: [
        { label: "Normal", value: "400" },
        { label: "Medium", value: "500" },
        { label: "Semi-bold", value: "600" },
        { label: "Bold", value: "700" },
        { label: "Extra-bold", value: "800" },
      ],
    },
  },
  defaultProps: {
    title: "Shop By Top Brands",
    limit: 10,
    backgroundColor: "#f6f6f6",
    cardBackgroundColor: "#ffffff",
    titleFontSize: 24,
    titleFontWeight: "700",
  },
  render: ({
    title,
    limit,
    backgroundColor,
    cardBackgroundColor,
    titleFontSize,
    titleFontWeight,
  }) => (
    <ShopByTopBrandsBlock
      title={title}
      limit={limit}
      backgroundColor={backgroundColor}
      cardBackgroundColor={cardBackgroundColor}
      titleFontSize={titleFontSize}
      titleFontWeight={titleFontWeight}
    />
  ),
};

export { ShopByTopBrandsBlock } from "./shop-by-top-brands";
