/* eslint-disable @next/next/no-img-element */
import type { ComponentConfig, RichText } from "@puckeditor/core";
import type { CSSProperties } from "react";

import { getImageUrl } from "@/lib/api";

import { colorField } from "../fields";
import { mediaImageField } from "../media-image-field";

import "./content.css";

/* -------------------------------------------------------------------------- */
/* Shared                                                                     */
/* -------------------------------------------------------------------------- */

type Align = "left" | "center" | "right";

const alignOptions = [
  { label: "Gauche", value: "left" },
  { label: "Centré", value: "center" },
  { label: "Droite", value: "right" },
];

const widthStyle = (width: number): CSSProperties => ({ "--pc-width": width > 0 ? `${width}px` : "100%" }) as CSSProperties;

/** Where the block sits on the page: a column of the given width, with the page's breathing space above and below. */
export function Wrap({ width, children, top, bottom }: { width: number; children: React.ReactNode; top?: number; bottom?: number }) {
  return (
    <div className="pc-wrap" style={{ ...widthStyle(width), paddingTop: top, paddingBottom: bottom }}>
      {children}
    </div>
  );
}

export const widthField = { type: "number", label: "Largeur maximale (px, 0 = toute la largeur)", min: 0, max: 2000 } as const;
export const spaceFields = {
  spaceTop: { type: "number", label: "Espace au-dessus (px)", min: 0, max: 300 },
  spaceBottom: { type: "number", label: "Espace en dessous (px)", min: 0, max: 300 },
} as const;

/* -------------------------------------------------------------------------- */
/* Heading                                                                    */
/* -------------------------------------------------------------------------- */

export type HeadingProps = {
  text: string;
  level: "h1" | "h2" | "h3";
  align: Align;
  color: string;
  maxWidth: number;
  spaceTop: number;
  spaceBottom: number;
};

export const headingBlock: ComponentConfig<HeadingProps> = {
  label: "Titre",
  defaultProps: { text: "Titre de la section", level: "h2", align: "left", color: "", maxWidth: 800, spaceTop: 32, spaceBottom: 8 },
  fields: {
    text: { type: "text", label: "Texte", contentEditable: true },
    level: {
      type: "radio",
      label: "Niveau",
      options: [
        { label: "Grand (H1)", value: "h1" },
        { label: "Moyen (H2)", value: "h2" },
        { label: "Petit (H3)", value: "h3" },
      ],
    },
    align: { type: "radio", label: "Alignement", options: alignOptions },
    color: colorField("Couleur du texte", "Par défaut"),
    maxWidth: widthField,
    ...spaceFields,
  },
  render: ({ text, level, align, color, maxWidth, spaceTop, spaceBottom }) => {
    const Tag = level;
    return (
      <Wrap width={maxWidth} top={spaceTop} bottom={spaceBottom}>
        <Tag className="pc-heading" style={{ textAlign: align, color: color || undefined }}>{text}</Tag>
      </Wrap>
    );
  },
};

/* -------------------------------------------------------------------------- */
/* Rich text                                                                  */
/* -------------------------------------------------------------------------- */

export type TextProps = {
  text: RichText;
  size: "normal" | "large";
  align: Align;
  color: string;
  maxWidth: number;
  spaceTop: number;
  spaceBottom: number;
};

export const textBlock: ComponentConfig<TextProps> = {
  label: "Texte",
  defaultProps: {
    text: "<p>Écrivez votre texte ici. Vous pouvez le mettre en gras, ajouter des titres, des listes et des liens.</p>",
    size: "normal",
    align: "left",
    color: "",
    maxWidth: 800,
    spaceTop: 8,
    spaceBottom: 24,
  },
  fields: {
    text: { type: "richtext", label: "Texte", contentEditable: true },
    size: {
      type: "radio",
      label: "Taille",
      options: [
        { label: "Normale", value: "normal" },
        { label: "Grande", value: "large" },
      ],
    },
    align: { type: "radio", label: "Alignement", options: alignOptions },
    color: colorField("Couleur du texte", "Par défaut"),
    maxWidth: widthField,
    ...spaceFields,
  },
  render: ({ text, size, align, color, maxWidth, spaceTop, spaceBottom }) => (
    <Wrap width={maxWidth} top={spaceTop} bottom={spaceBottom}>
      <div className={`pc-prose ${size === "large" ? "is-large" : ""}`} style={{ textAlign: align, color: color || undefined }}>{text}</div>
    </Wrap>
  ),
};

/* -------------------------------------------------------------------------- */
/* Image                                                                      */
/* -------------------------------------------------------------------------- */

export type ImageBlockProps = {
  image: string;
  alt: string;
  caption: string;
  href: string;
  width: "narrow" | "normal" | "wide" | "full";
  radius: number;
  spaceTop: number;
  spaceBottom: number;
};

const IMAGE_WIDTHS = { narrow: 640, normal: 960, wide: 1240, full: 0 };

export const imageBlock: ComponentConfig<ImageBlockProps> = {
  label: "Image",
  defaultProps: { image: "", alt: "", caption: "", href: "", width: "normal", radius: 16, spaceTop: 16, spaceBottom: 16 },
  fields: {
    image: mediaImageField("Image"),
    alt: { type: "text", label: "Texte alternatif (pour les lecteurs d’écran)" },
    caption: { type: "text", label: "Légende (facultatif)" },
    href: { type: "text", label: "Lien (facultatif)" },
    width: {
      type: "radio",
      label: "Largeur",
      options: [
        { label: "Étroite", value: "narrow" },
        { label: "Normale", value: "normal" },
        { label: "Large", value: "wide" },
        { label: "Pleine", value: "full" },
      ],
    },
    radius: { type: "number", label: "Arrondi (px)", min: 0, max: 48 },
    ...spaceFields,
  },
  render: ({ image, alt, caption, href, width, radius, spaceTop, spaceBottom, puck }) => {
    if (!image) {
      return puck.isEditing ? (
        <Wrap width={IMAGE_WIDTHS[width]} top={spaceTop} bottom={spaceBottom}>
          <div className="grid h-40 place-items-center rounded-2xl border-2 border-dashed border-[#c5d0e3] bg-[#f4f7fb] text-sm text-[#5b6b86]">Choisissez une image dans la médiathèque</div>
        </Wrap>
      ) : (
        <></>
      );
    }
    const picture = <img src={getImageUrl(image)} alt={alt} style={{ borderRadius: radius }} loading="lazy" decoding="async" />;
    return (
      <Wrap width={IMAGE_WIDTHS[width]} top={spaceTop} bottom={spaceBottom}>
        <figure className="pc-figure">
          {href && !puck.isEditing ? <a href={href}>{picture}</a> : picture}
          {caption ? <figcaption>{caption}</figcaption> : null}
        </figure>
      </Wrap>
    );
  },
};

/* -------------------------------------------------------------------------- */
/* Questions and answers                                                      */
/* -------------------------------------------------------------------------- */

export type FaqProps = {
  title: string;
  items: Array<{ question: string; answer: string }>;
  maxWidth: number;
  spaceTop: number;
  spaceBottom: number;
};

export const faqBlock: ComponentConfig<FaqProps> = {
  label: "Questions fréquentes",
  defaultProps: {
    title: "Questions fréquentes",
    items: [
      { question: "Comment demander un devis ?", answer: "Écrivez-nous depuis la page Informations : nous répondons avec une proposition claire." },
      { question: "Réparez-vous toutes les marques ?", answer: "Nous réparons la plupart des marques de machines à coudre industrielles et domestiques." },
    ],
    maxWidth: 800,
    spaceTop: 24,
    spaceBottom: 24,
  },
  fields: {
    title: { type: "text", label: "Titre (vide = aucun)" },
    items: {
      type: "array",
      label: "Questions",
      getItemSummary: (item) => item.question || "Question",
      defaultItemProps: { question: "Nouvelle question", answer: "" },
      arrayFields: {
        question: { type: "text", label: "Question" },
        answer: { type: "textarea", label: "Réponse" },
      },
    },
    maxWidth: widthField,
    ...spaceFields,
  },
  render: ({ title, items, maxWidth, spaceTop, spaceBottom, puck }) => {
    const filled = items.filter((item) => item.question.trim());
    // The questions are also given to search engines, which can show them under the page's result.
    const schema = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: filled.map((item) => ({ "@type": "Question", name: item.question, acceptedAnswer: { "@type": "Answer", text: item.answer } })),
    };
    return (
      <Wrap width={maxWidth} top={spaceTop} bottom={spaceBottom}>
        {title ? <h2 className="pc-heading pc-faq-title">{title}</h2> : null}
        <div className="pc-faq">
          {filled.map((item, index) => (
            <details key={index}>
              <summary>{item.question}</summary>
              <div className="pc-faq-answer">{item.answer}</div>
            </details>
          ))}
        </div>
        {!puck.isEditing && filled.length > 0 ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, "\\u003c") }} /> : null}
      </Wrap>
    );
  },
};

/* -------------------------------------------------------------------------- */
/* Space                                                                      */
/* -------------------------------------------------------------------------- */

export type SpacerProps = { height: number };

export const spacerBlock: ComponentConfig<SpacerProps> = {
  label: "Espace",
  defaultProps: { height: 48 },
  fields: { height: { type: "number", label: "Hauteur (px)", min: 4, max: 400 } },
  render: ({ height }) => <div aria-hidden="true" style={{ height }} />,
};
