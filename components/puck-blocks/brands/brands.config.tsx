import type { ComponentConfig } from "@puckeditor/core";

import { colorField, yesNoOptions } from "../fields";
import { BRANDS_DEFAULTS, Brands, type BrandsProps } from "./brands";

/**
 * Puck definition of « Nos marques »: the shop's brand logos in a strip that slides by on its own.
 * Brands, logos and names come from Produits > Marques.
 */
export const brandsBlock: ComponentConfig<BrandsProps> = {
  label: "Nos marques",
  defaultProps: BRANDS_DEFAULTS,

  fields: {
    // ---- Content
    title: { type: "text", label: "Titre de la section (vide = aucun)" },
    captionPrefix: { type: "text", label: "Texte avant le nom de la marque (vide = le nom seul)" },
    maxBrands: { type: "number", label: "Nombre maximum de marques", min: 1, max: 100 },
    sort: {
      type: "radio",
      label: "Ordre",
      options: [
        { label: "A à Z", value: "alpha" },
        { label: "Les plus fournies", value: "products" },
      ],
    },
    hideWithoutLogo: { type: "radio", label: "Masquer les marques sans logo", options: yesNoOptions },
    columns: {
      type: "select",
      label: "Logos visibles (ordinateur)",
      options: [4, 5, 6, 8].map((n) => ({ label: String(n), value: n })),
    },
    mobileColumns: {
      type: "radio",
      label: "Logos visibles (mobile)",
      options: [
        { label: "2", value: 2 },
        { label: "3", value: 3 },
      ],
    },
    autoplaySeconds: { type: "number", label: "Défilement auto (secondes entre deux marques, 0 = arrêt)", min: 0, max: 30 },
    showArrows: { type: "radio", label: "Flèches", options: yesNoOptions },
    showProgress: { type: "radio", label: "Ligne de progression", options: yesNoOptions },

    // ---- Style
    greyLogos: {
      type: "radio",
      label: "Logos en gris jusqu’au survol",
      options: [
        { label: "Non", value: false },
        { label: "Oui", value: true },
      ],
    },
    accentColor: colorField("Couleur de la progression", "#d6202e"),
    background: colorField("Arrière-plan", "#ffffff"),
    maxWidth: { type: "number", label: "Largeur maximale (px)", min: 600, max: 2400 },
  },

  render: ({ puck, ...props }) => <Brands {...props} isEditing={puck.isEditing} />,
};
