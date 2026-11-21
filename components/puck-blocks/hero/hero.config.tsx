import type { ComponentConfig } from "@puckeditor/core";

import { categoryPickerField } from "../category-picker-field";
import { colorField, switchField, yesNoOptions } from "../fields";
import { mediaImageField } from "../media-image-field";
import { HERO_DEFAULTS, Hero, type HeroProps } from "./hero";

/**
 * Puck definition of the home hero: two category panels around a slider.
 * The category panels use the live categories; slides are edited in the block.
 */
export const heroBlock: ComponentConfig<HeroProps> = {
  label: "Hero accueil",
  defaultProps: HERO_DEFAULTS,

  fields: {
    // ---- Content
    slides: {
      type: "array",
      label: "Images du slider",
      getItemSummary: (item) => item.altText || item.imageUrl || "Image",
      defaultItemProps: { imageUrl: "", altText: "", href: "" },
      arrayFields: {
        imageUrl: mediaImageField(),
        altText: { type: "text", label: "Texte alternatif" },
        href: { type: "text", label: "Lien" },
      },
    },
    autoplaySeconds: {
      type: "number",
      label: "Défilement auto (secondes, 0 = arrêt)",
      min: 0,
      max: 30,
    },
    showArrows: { type: "radio", label: "Flèches", options: yesNoOptions },
    showDots: { type: "radio", label: "Pastilles", options: yesNoOptions },
    showPanels: { type: "radio", label: "Panneaux de catégories", options: yesNoOptions },
    showOnCatalogPages: switchField("Afficher les panneaux sur les pages produit, catégorie et marque", "Les panneaux gauche et droit encadrent alors le contenu des pages catégorie, marque et produit (écrans larges)."),
    followScroll: {
      type: "radio",
      label: "Suivre le défilement",
      options: [
        { label: "Non", value: "none" },
        { label: "Dans la section", value: "section" },
        { label: "Fin de la page", value: "page" },
      ],
    },
    followOffset: { type: "number", label: "Distance du haut (px)", min: 0, max: 400 },
    leftTitle: {
      type: "text",
      label: "Titre panneau gauche (vide = auto)",
    },
    leftCategoryIds: categoryPickerField("Catégories du panneau gauche"),
    leftFooter: { type: "textarea", label: "Texte sous le panneau gauche", contentEditable: true },
    rightTitle: {
      type: "text",
      label: "Titre panneau droit (vide = auto)",
    },
    rightCategoryIds: categoryPickerField("Catégories du panneau droit"),

    // ---- Style
    leftColor: colorField("Couleur panneau gauche", "#153675"),
    rightColor: colorField("Couleur panneau droit", "#d6202e"),
    background: colorField("Arrière-plan", "#f2f5fa"),
    maxWidth: { type: "number", label: "Largeur maximale (px)", min: 600, max: 2400 },
    panelGap: { type: "number", label: "Espacement (px)", min: 0, max: 80 },
    sliderRadius: { type: "number", label: "Arrondi du slider (px)", min: 0, max: 48 },
  },

  render: ({ puck, ...props }) => <Hero {...props} isEditing={puck.isEditing} />,
};
