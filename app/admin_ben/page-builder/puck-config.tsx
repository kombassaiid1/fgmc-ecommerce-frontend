import type { Config, Data, Fields, Slot } from "@puckeditor/core";

import { contactFormBlock, contactInfoBlock, dailyOffersBlock, faqBlock, featuredProductsBlock, headingBlock, heroBlock, hoursBlock, imageBlock, imageMosaicBlock, mapBlock, spacerBlock, textBlock } from "@/components/puck-blocks";
import type { ContactFormProps, ContactInfoProps, HoursProps, MapProps } from "@/components/puck-blocks/contact/contact-blocks";
import type { FaqProps, HeadingProps, ImageBlockProps, SpacerProps, TextProps } from "@/components/puck-blocks/content/content-blocks";
import { colorField, yesNoOptions as yesNo } from "@/components/puck-blocks/fields";
import type { DailyOffersProps } from "@/components/puck-blocks/daily-offers/daily-offers";
import type { FeaturedProductsProps } from "@/components/puck-blocks/featured-products/featured-products";
import type { ImageMosaicProps } from "@/components/puck-blocks/image-mosaic/image-mosaic";
import type { HeroProps } from "@/components/puck-blocks/hero/hero";

type Props = {
  Hero: HeroProps;
  DailyOffers: DailyOffersProps;
  FeaturedProducts: FeaturedProductsProps;
  ImageMosaic: ImageMosaicProps;
  Heading: HeadingProps;
  Text: TextProps;
  Image: ImageBlockProps;
  Faq: FaqProps;
  Spacer: SpacerProps;
  ContactForm: ContactFormProps;
  ContactInfo: ContactInfoProps;
  Map: MapProps;
  Hours: HoursProps;
  Container: {
    content: Slot;
    width: "boxed" | "full";
    direction: "row" | "column";
    justify: "flex-start" | "center" | "flex-end" | "space-between";
    alignItems: "stretch" | "flex-start" | "center" | "flex-end";
    gap: number;
    wrap: boolean;
    background: string;
    padding: number;
    minHeight: number;
    radius: number;
  };
  Grid: {
    content: Slot;
    /** Side by side in columns (default), or stacked one under the other. Grids placed before it existed are horizontal. */
    direction?: "horizontal" | "vertical";
    columns: 1 | 2 | 3 | 4 | 5 | 6;
    mobileColumns: 1 | 2;
    gap: number;
    background: string;
    padding: number;
  };
  Input: {
    label: string;
    placeholder: string;
    inputType: "text" | "email" | "tel" | "number" | "password" | "url";
    name: string;
    required: boolean;
    helpText: string;
    fullWidth: boolean;
  };
  Button: {
    label: string;
    href: string;
    variant: "solid" | "outline" | "ghost";
    size: "sm" | "md" | "lg";
    align: "left" | "center" | "right";
    fullWidth: boolean;
  };
};

const gridFields = {
  content: { type: "slot" },
  direction: {
    type: "radio",
    label: "Sens",
    options: [
      { label: "Horizontal (côte à côte)", value: "horizontal" },
      { label: "Vertical (empilés)", value: "vertical" },
    ],
  },
  columns: {
    type: "select",
    label: "Colonnes (ordinateur)",
    options: [1, 2, 3, 4, 5, 6].map((n) => ({ label: String(n), value: n })),
  },
  mobileColumns: {
    type: "radio",
    label: "Colonnes (mobile)",
    options: [
      { label: "1", value: 1 },
      { label: "2", value: 2 },
    ],
  },
  gap: { type: "number", label: "Espacement (px)", min: 0, max: 200 },
  background: colorField("Arrière-plan"),
  padding: { type: "number", label: "Marge intérieure (px)", min: 0, max: 300 },
} satisfies Fields<Props["Grid"]>;

export const puckConfig: Config<Props> = {
  categories: {
    content: { title: "Contenu", components: ["Heading", "Text", "Image", "Faq", "Spacer"] },
    contact: { title: "Contact", components: ["ContactForm", "ContactInfo", "Map", "Hours"] },
    home: { title: "Accueil", components: ["Hero", "DailyOffers", "FeaturedProducts", "ImageMosaic"] },
    layout: { title: "Mise en page", components: ["Container", "Grid"] },
    basic: { title: "Basique", components: ["Button", "Input"] },
  },
  root: {
    render: ({ children }) => (
      // data-pb-page marks the end of the built page: pinned blocks stop there.
      <div data-pb-page className="min-h-screen bg-white text-slate-900" style={{ fontFamily: "Oswald, system-ui, sans-serif" }}>
        {children}
      </div>
    ),
  },
  components: {
    Hero: heroBlock,
    DailyOffers: dailyOffersBlock,
    FeaturedProducts: featuredProductsBlock,
    ImageMosaic: imageMosaicBlock,
    Heading: headingBlock,
    Text: textBlock,
    Image: imageBlock,
    Faq: faqBlock,
    Spacer: spacerBlock,
    ContactForm: contactFormBlock,
    ContactInfo: contactInfoBlock,
    Map: mapBlock,
    Hours: hoursBlock,

    /* ------------------------------------------------------------ Container */
    Container: {
      label: "Conteneur",
      defaultProps: {
        content: [],
        width: "boxed",
        direction: "column",
        justify: "flex-start",
        alignItems: "stretch",
        gap: 16,
        wrap: true,
        background: "",
        padding: 24,
        minHeight: 0,
        radius: 0,
      },
      fields: {
        content: { type: "slot" },
        width: {
          type: "radio",
          label: "Largeur du contenu",
          options: [
            { label: "Centrée", value: "boxed" },
            { label: "Pleine", value: "full" },
          ],
        },
        direction: {
          type: "radio",
          label: "Direction",
          options: [
            { label: "Colonne", value: "column" },
            { label: "Ligne", value: "row" },
          ],
        },
        justify: {
          type: "select",
          label: "Justification",
          options: [
            { label: "Début", value: "flex-start" },
            { label: "Centre", value: "center" },
            { label: "Fin", value: "flex-end" },
            { label: "Espacé", value: "space-between" },
          ],
        },
        alignItems: {
          type: "select",
          label: "Alignement des éléments",
          options: [
            { label: "Étirer", value: "stretch" },
            { label: "Début", value: "flex-start" },
            { label: "Centre", value: "center" },
            { label: "Fin", value: "flex-end" },
          ],
        },
        gap: { type: "number", label: "Espacement (px)", min: 0, max: 200 },
        wrap: { type: "radio", label: "Retour à la ligne", options: yesNo },
        background: colorField("Arrière-plan"),
        padding: { type: "number", label: "Marge intérieure (px)", min: 0, max: 300 },
        minHeight: { type: "number", label: "Hauteur minimale (px)", min: 0, max: 1200 },
        radius: { type: "number", label: "Arrondi (px)", min: 0, max: 80 },
      },
      render: ({ content: Content, width, direction, justify, alignItems, gap, wrap, background, padding, minHeight, radius }) => (
        <div
          style={{
            background: background || undefined,
            padding,
            minHeight: minHeight || undefined,
            borderRadius: radius || undefined,
          }}
        >
          <Content
            minEmptyHeight={72}
            style={{
              display: "flex",
              flexDirection: direction,
              flexWrap: wrap ? "wrap" : "nowrap",
              justifyContent: justify,
              alignItems,
              gap,
              maxWidth: width === "boxed" ? 1200 : undefined,
              margin: "0 auto",
              width: "100%",
            }}
          />
        </div>
      ),
    },

    /* ---------------------------------------------------------------- Grid */
    Grid: {
      label: "Grille",
      defaultProps: { content: [], direction: "horizontal", columns: 3, mobileColumns: 1, gap: 16, background: "", padding: 24 },
      fields: gridFields,
      // Stacked blocks have no columns to choose.
      resolveFields: (data) => {
        if (data.props.direction !== "vertical") return gridFields;
        const { columns: _columns, mobileColumns: _mobileColumns, ...stacked } = gridFields;
        void _columns;
        void _mobileColumns;
        return stacked as typeof gridFields;
      },
      render: ({ content: Content, direction = "horizontal", columns, mobileColumns, gap, background, padding }) => {
        const vertical = direction === "vertical";
        return (
          <div style={{ background: background || undefined, padding }}>
            <Content
              minEmptyHeight={96}
              className="mx-auto grid w-full max-w-[1200px] [grid-template-columns:repeat(var(--cols-sm),minmax(0,1fr))] md:[grid-template-columns:repeat(var(--cols),minmax(0,1fr))]"
              style={
                {
                  gap,
                  "--cols": vertical ? 1 : columns,
                  "--cols-sm": vertical ? 1 : mobileColumns,
                } as React.CSSProperties
              }
            />
          </div>
        );
      },
    },

    /* -------------------------------------------------------------- Button */
    Button: {
      label: "Bouton",
      defaultProps: { label: "Cliquez ici", href: "#", variant: "solid", size: "md", align: "left", fullWidth: false },
      fields: {
        label: { type: "text", label: "Texte", contentEditable: true },
        href: { type: "text", label: "Lien" },
        variant: {
          type: "radio",
          label: "Type",
          options: [
            { label: "Plein", value: "solid" },
            { label: "Contour", value: "outline" },
            { label: "Texte", value: "ghost" },
          ],
        },
        size: {
          type: "radio",
          label: "Taille",
          options: [
            { label: "S", value: "sm" },
            { label: "M", value: "md" },
            { label: "L", value: "lg" },
          ],
        },
        align: {
          type: "radio",
          label: "Alignement",
          options: [
            { label: "Gauche", value: "left" },
            { label: "Centre", value: "center" },
            { label: "Droite", value: "right" },
          ],
        },
        fullWidth: { type: "radio", label: "Pleine largeur", options: yesNo },
      },
      render: ({ label, href, variant, size, align, fullWidth }) => {
        const sizing = { sm: "min-h-9 px-4 text-sm", md: "min-h-11 px-6 text-base", lg: "min-h-14 px-8 text-lg" }[size];
        const look = {
          solid: "bg-[#0858b1] text-white hover:bg-[#064a96]",
          outline: "border border-[#0858b1] text-[#0858b1] hover:bg-[#eaf2fb]",
          ghost: "text-[#0858b1] hover:bg-[#eaf2fb]",
        }[variant];
        const justify = { left: "justify-start", center: "justify-center", right: "justify-end" }[align];
        return (
          <div className={`flex w-full ${justify}`}>
            <a
              href={href}
              className={`inline-flex items-center justify-center rounded-lg font-medium transition-colors ${sizing} ${look} ${fullWidth ? "w-full" : ""}`}
            >
              {label}
            </a>
          </div>
        );
      },
    },

    /* --------------------------------------------------------------- Input */
    Input: {
      label: "Champ de saisie",
      defaultProps: { label: "Email", placeholder: "votre@email.com", inputType: "email", name: "email", required: false, helpText: "", fullWidth: true },
      fields: {
        label: { type: "text", label: "Libellé", contentEditable: true },
        placeholder: { type: "text", label: "Texte indicatif" },
        inputType: {
          type: "select",
          label: "Type de champ",
          options: [
            { label: "Texte", value: "text" },
            { label: "Email", value: "email" },
            { label: "Téléphone", value: "tel" },
            { label: "Nombre", value: "number" },
            { label: "Mot de passe", value: "password" },
            { label: "URL", value: "url" },
          ],
        },
        name: { type: "text", label: "Nom du champ" },
        helpText: { type: "text", label: "Texte d'aide", contentEditable: true },
        required: { type: "radio", label: "Obligatoire", options: yesNo },
        fullWidth: { type: "radio", label: "Pleine largeur", options: yesNo },
      },
      render: ({ id, label, placeholder, inputType, name, required, helpText, fullWidth }) => (
        <div className={`flex flex-col gap-1.5 ${fullWidth ? "w-full" : "w-72 max-w-full"}`}>
          {label && (
            <div id={`${id}-label`} className="text-sm font-medium text-slate-700">
              {label}
              {required && <span className="ml-0.5 text-red-600" aria-hidden="true">*</span>}
            </div>
          )}
          <input
            type={inputType}
            name={name}
            placeholder={placeholder}
            required={required}
            aria-labelledby={label ? `${id}-label` : undefined}
            className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900 placeholder:text-slate-400 focus:border-[#0858b1] focus:outline-none focus:ring-2 focus:ring-[#0858b1]/20"
          />
          {helpText && <div className="text-xs text-slate-500">{helpText}</div>}
        </div>
      ),
    },
  },
};

export const initialData: Data = {
  root: { props: {} },
  content: [],
};

/** Display name of a block, falling back to its key. */
export function blockLabel(name: string): string {
  const components = puckConfig.components as Record<string, { label?: string } | undefined>;
  return components[name]?.label ?? name;
}
