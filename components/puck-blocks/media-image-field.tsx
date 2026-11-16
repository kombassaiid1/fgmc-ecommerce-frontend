"use client";

import { useState } from "react";
import { FieldLabel, type CustomField } from "@puckeditor/core";
import { AppProvider } from "@shopify/polaris";
import fr from "@shopify/polaris/locales/fr.json";
import { ImageIcon } from "lucide-react";

import { MediaPickerDialog } from "@/components/admin/media-picker-dialog";
import { getImageUrl } from "@/lib/api";
import styles from "./media-image-field.module.css";

type MediaImageInputProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
};

function MediaImageInput({ label, value, onChange, readOnly }: MediaImageInputProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <FieldLabel label={label} el="div" readOnly={readOnly}>
        <div className={styles.field}>
          <button
            type="button"
            className={styles.picker}
            disabled={readOnly}
            onClick={() => setOpen(true)}
            aria-label={value ? `Remplacer ${label.toLowerCase()} depuis la médiathèque` : `Choisir ${label.toLowerCase()} dans la médiathèque`}
            aria-haspopup="dialog"
          >
            {value ? (
              // The media library supports arbitrary storage hosts.
              // eslint-disable-next-line @next/next/no-img-element
              <img className={styles.preview} src={getImageUrl(value)} alt="Image sélectionnée" />
            ) : (
              <ImageIcon size={28} strokeWidth={1.5} aria-hidden="true" />
            )}
            <span>{value ? "Changer l’image" : "Choisir dans la médiathèque"}</span>
          </button>
          {value ? (
            <button type="button" className={styles.remove} disabled={readOnly} onClick={() => onChange("")}>
              Retirer l’image
            </button>
          ) : null}
        </div>
      </FieldLabel>
      {open ? (
        <AppProvider i18n={fr}>
          <MediaPickerDialog
            open
            imagesOnly
            selectedUrl={value || null}
            onClose={() => setOpen(false)}
            onSelect={(item) => {
              if (readOnly) return;
              onChange(item.url);
              setOpen(false);
            }}
          />
        </AppProvider>
      ) : null}
    </>
  );
}

export function mediaImageField(label = "Image"): CustomField<string> {
  return {
    type: "custom",
    label,
    render: ({ value, onChange, field, readOnly }) => (
      <MediaImageInput label={field.label ?? label} value={value ?? ""} onChange={onChange} readOnly={readOnly} />
    ),
  };
}
