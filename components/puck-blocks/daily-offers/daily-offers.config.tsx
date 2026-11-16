import type { ComponentConfig } from "@puckeditor/core";

import { colorField, yesNoOptions } from "../fields";
import { DAILY_OFFERS_DEFAULTS, DailyOffers, type DailyOffersProps } from "./daily-offers";

/**
 * Puck definition of the "Offres du jour" carousel. Products come
 * automatically from the catalogue: every public product with an active
 * promotional price.
 */
export const dailyOffersBlock: ComponentConfig<DailyOffersProps> = {
  label: "Offres du jour",
  defaultProps: DAILY_OFFERS_DEFAULTS,

  fields: {
    // ---- Content
    title: { type: "text", label: "Titre", contentEditable: true },
    subtitle: { type: "text", label: "Sous-titre", contentEditable: true },
    maxProducts: { type: "number", label: "Nombre maximum de produits", min: 1, max: 20 },
    columns: {
      type: "select",
      label: "Produits visibles (ordinateur)",
      options: [
        { label: "2", value: 2 },
        { label: "3", value: 3 },
        { label: "4", value: 4 },
        { label: "5", value: 5 },
      ],
    },
    mobileColumns: {
      type: "radio",
      label: "Produits visibles (mobile)",
      options: [
        { label: "1", value: 1 },
        { label: "2", value: 2 },
      ],
    },
    autoplaySeconds: {
      type: "number",
      label: "Défilement auto (secondes, 0 = arrêt)",
      min: 0,
      max: 30,
    },
    showCountdown: { type: "radio", label: "Compte à rebours sur chaque carte", options: yesNoOptions },
    showDots: { type: "radio", label: "Pastilles", options: yesNoOptions },
    showViewAll: { type: "radio", label: "Lien « Voir toutes les offres »", options: yesNoOptions },
    viewAllLabel: { type: "text", label: "Texte du lien" },
    viewAllHref: { type: "text", label: "Adresse du lien" },

    imageFit: {
      type: "radio",
      label: "Photo du produit",
      options: [
        { label: "Remplir", value: "cover" },
        { label: "Entière", value: "contain" },
      ],
    },
    imageRatio: {
      type: "radio",
      label: "Forme de la photo",
      options: [
        { label: "Carrée", value: "1/1" },
        { label: "5:4", value: "5/4" },
        { label: "4:3", value: "4/3" },
      ],
    },

    // ---- Style
    accentColor: colorField("Couleur des prix et remises", "#d6202e"),
    buttonColor: colorField("Couleur des boutons", "#153675"),
    background: colorField("Arrière-plan", "#f2f5fa"),
    maxWidth: { type: "number", label: "Largeur maximale (px)", min: 600, max: 2400 },
    cardRadius: { type: "number", label: "Arrondi des cartes (px)", min: 0, max: 24 },
  },

  render: ({ puck, ...props }) => <DailyOffers {...props} isEditing={puck.isEditing} />,
};
