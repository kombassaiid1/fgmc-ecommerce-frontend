"use client";

import type { Config } from "@measured/puck";
import { CategoriesMultiSelectField } from "@/components/puck-blocks/categories-multi-select-field";
import { ConfigurableGridBlock } from "@/components/puck-blocks/configurable-grid-block";
import { HeroImageSliderBlock } from "@/components/puck-blocks/hero-image-slider-block";
import { HeroSliderImagePickerField } from "@/components/puck-blocks/hero-slider-image-picker-field";
import { IndividualsSideNavBlock } from "@/components/puck-blocks/individuals-side-nav-block";
import { ProfessionalsSideNavBlock } from "@/components/puck-blocks/professionals-side-nav-block";
import { productGridConfig } from "@/components/puck-blocks/product-grid";
import { shopByTopBrandsConfig } from "@/components/puck-blocks/shop-by-top-brands";

export const puckConfig: Config = {
  components: {
    Hero: {
      fields: {
        title: { type: "text" },
        subtitle: { type: "textarea" },
        ctaLabel: { type: "text" },
        ctaHref: { type: "text" },
        backgroundColor: { type: "text" },
      },
      defaultProps: {
        title: "Titre Hero",
        subtitle: "Ajoutez ici une description engageante.",
        ctaLabel: "Acheter maintenant",
        ctaHref: "/",
        backgroundColor: "#f3f4f6",
      },
      render: ({ title, subtitle, ctaLabel, ctaHref, backgroundColor }) => (
        <section
          style={{
            background: backgroundColor || "#f3f4f6",
            borderRadius: 12,
            padding: "48px 24px",
            textAlign: "center",
          }}
        >
          <h1 style={{ fontSize: 42, margin: 0 }}>{title}</h1>
          <p style={{ fontSize: 18, opacity: 0.85, marginTop: 12 }}>{subtitle}</p>
          {ctaLabel ? (
            <a
              href={ctaHref || "/"}
              style={{
                marginTop: 18,
                display: "inline-block",
                background: "#111827",
                color: "#fff",
                borderRadius: 10,
                padding: "10px 18px",
                textDecoration: "none",
              }}
            >
              {ctaLabel}
            </a>
          ) : null}
        </section>
      ),
    },
    RichText: {
      fields: {
        html: { type: "textarea" },
      },
      defaultProps: {
        html: "<p>Votre contenu riche ici...</p>",
      },
      render: ({ html }) => (
        <section
          style={{ lineHeight: 1.7 }}
          dangerouslySetInnerHTML={{ __html: String(html || "") }}
        />
      ),
    },
    ImageBlock: {
      fields: {
        src: { type: "text" },
        alt: { type: "text" },
        width: { type: "number" },
      },
      defaultProps: {
        src: "https://placehold.co/1200x600",
        alt: "Image",
        width: 100,
      },
      render: ({ src, alt, width }) => (
        <section>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={String(src || "")}
            alt={String(alt || "")}
            style={{
              width: `${String(width ?? 100)}%`,
              display: "block",
              borderRadius: 8,
            }}
          />
        </section>
      ),
    },
    Spacer: {
      fields: {
        height: { type: "number" },
      },
      defaultProps: {
        height: 24,
      },
      render: ({ height }) => <div style={{ height: Number(height ?? 24) }} />,
    },
    Container: {
      fields: {
        maxWidth: { type: "number" },
        padding: { type: "number" },
      },
      defaultProps: {
        maxWidth: 1200,
        padding: 16,
      },
      render: ({ maxWidth, padding, puck }) => (
        <div
          style={{
            maxWidth: Number(maxWidth ?? 1200),
            marginInline: "auto",
            paddingInline: Number(padding ?? 16),
          }}
        >
          {puck?.renderDropZone?.({ zone: "content" })}
        </div>
      ),
    },
    ProfessionalsSideNav: {
      fields: {
        title: { type: "text" },
        subtitle: { type: "text" },
        categoryIds: {
          type: "custom",
          render: ({ value, onChange, readOnly }) => (
            <CategoriesMultiSelectField
              value={String(value ?? "")}
              onChange={onChange}
              readOnly={readOnly}
            />
          ),
        },
      },
      defaultProps: {
        title: "Professionnels",
        subtitle: "Solutions Industrielles",
        categoryIds: "",
      },
      render: ({ title, subtitle, categoryIds }) => (
        <ProfessionalsSideNavBlock
          title={title}
          subtitle={subtitle}
          categoryIds={categoryIds}
        />
      ),
    },
    IndividualsSideNav: {
      fields: {
        title: { type: "text" },
        subtitle: { type: "text" },
        categoryIds: {
          type: "custom",
          render: ({ value, onChange, readOnly }) => (
            <CategoriesMultiSelectField
              value={String(value ?? "")}
              onChange={onChange}
              readOnly={readOnly}
            />
          ),
        },
      },
      defaultProps: {
        title: "Particuliers",
        subtitle: "Espace Créatif",
        categoryIds: "",
      },
      render: ({ title, subtitle, categoryIds }) => (
        <IndividualsSideNavBlock
          title={title}
          subtitle={subtitle}
          categoryIds={categoryIds}
        />
      ),
    },
    Grid: {
      fields: {
        columns: { type: "number" },
        columnTemplate: { type: "text" },
        rows: { type: "number" },
        gap: { type: "number" },
        minCellHeight: { type: "number" },
      },
      defaultProps: {
        columns: 2,
        columnTemplate: "",
        rows: 1,
        gap: 16,
        minCellHeight: 120,
      },
      render: ({ columns, columnTemplate, rows, gap, minCellHeight, puck }) => (
        <ConfigurableGridBlock
          columns={columns}
          columnTemplate={columnTemplate}
          rows={rows}
          gap={gap}
          minCellHeight={minCellHeight}
          puck={puck}
        />
      ),
    },
    HeroImageSlider: {
      fields: {
        imageUrls: {
          type: "custom",
          render: ({ value, onChange, readOnly }) => (
            <HeroSliderImagePickerField
              value={String(value ?? "")}
              onChange={onChange}
              readOnly={readOnly}
            />
          ),
        },
        minHeight: { type: "number" },
      },
      defaultProps: {
        imageUrls:
          "https://images.unsplash.com/photo-1581092160607-ee22731d8b96?q=80&w=2000&auto=format&fit=crop\nhttps://images.unsplash.com/photo-1581092921461-eab62e97a780?q=80&w=2000&auto=format&fit=crop\nhttps://images.unsplash.com/photo-1582719508461-905c673771fd?q=80&w=2000&auto=format&fit=crop",
        minHeight: 400,
      },
      render: ({ imageUrls, minHeight }) => (
        <HeroImageSliderBlock imageUrls={imageUrls} minHeight={minHeight} />
      ),
    },
    ProductGrid: productGridConfig,
    ShopByTopBrands: shopByTopBrandsConfig,
  },
};
