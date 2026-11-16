import type { ComponentConfig, ObjectField } from "@puckeditor/core";

import { colorField } from "../fields";
import { mediaImageField } from "../media-image-field";
import {
  IMAGE_MOSAIC_DEFAULTS,
  ImageMosaic,
  MOSAIC_TILE_SPECS,
  type ImageMosaicProps,
  type MosaicTile,
} from "./image-mosaic";

const tileField = (index: number): ObjectField<MosaicTile> => ({
  type: "object",
  label: `Image ${index + 1} (${MOSAIC_TILE_SPECS[index].size}, ratio ${MOSAIC_TILE_SPECS[index].ratio})`,
  objectFields: {
    imageUrl: mediaImageField("Image"),
    altText: { type: "text", label: "Texte alternatif" },
    href: { type: "text", label: "Lien (facultatif)" },
  },
});

/**
 * Puck definition of the home image layout (moved here from Apparence): four
 * images arranged as one large tile, two stacked tiles and one large tile.
 */
export const imageMosaicBlock: ComponentConfig<ImageMosaicProps> = {
  label: "Disposition des images",
  defaultProps: IMAGE_MOSAIC_DEFAULTS,

  fields: {
    // ---- Content
    tile1: tileField(0),
    tile2: tileField(1),
    tile3: tileField(2),
    tile4: tileField(3),

    // ---- Style
    background: colorField("Arrière-plan", "#f2f5fa"),
    maxWidth: { type: "number", label: "Largeur maximale (px)", min: 600, max: 2400 },
    gap: { type: "number", label: "Espacement (px)", min: 0, max: 48 },
    cardRadius: { type: "number", label: "Arrondi des images (px)", min: 0, max: 48 },
  },

  render: ({ puck, ...props }) => <ImageMosaic {...props} isEditing={puck.isEditing} />,
};
