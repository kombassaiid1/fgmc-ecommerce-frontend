"use client";

import { useState } from "react";
import { BlockStack, Button, Icon, InlineStack, Text, UnstyledButton } from "@shopify/polaris";
import { ImageIcon } from "@shopify/polaris-icons";
import { MediaPickerDialog } from "@/components/admin/media-picker-dialog";
import { getImageUrl } from "@/lib/api";

/** Logo chosen from the media library (images only; new files can be uploaded from the dialog). */
export function LogoField({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <BlockStack gap="200">
      <Text as="span" variant="bodyMd">Logo</Text>
      <InlineStack gap="300" blockAlign="center" wrap={false}>
        <UnstyledButton onClick={() => setOpen(true)} accessibilityLabel="Choisir le logo dans la médiathèque">
          <div
            style={{
              width: 112,
              height: 72,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              border: "1px solid var(--p-color-border)",
              borderRadius: "var(--p-border-radius-200)",
              background: "var(--p-color-bg-surface-secondary)",
            }}>
            {value ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={getImageUrl(value)} alt="Logo du transporteur" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
            ) : (
              <Icon source={ImageIcon} tone="subdued" />
            )}
          </div>
        </UnstyledButton>
        <BlockStack gap="100" inlineAlign="start">
          <Button onClick={() => setOpen(true)}>{value ? "Changer le logo" : "Choisir dans la médiathèque"}</Button>
          {value ? <Button variant="tertiary" tone="critical" onClick={() => onChange("")}>Retirer le logo</Button> : null}
        </BlockStack>
      </InlineStack>
      <Text as="span" variant="bodySm" tone="subdued">Facultatif. Affiché au paiement à côté du nom du transporteur.</Text>

      <MediaPickerDialog
        open={open}
        imagesOnly
        selectedUrl={value || null}
        onClose={() => setOpen(false)}
        onSelect={(item) => {
          onChange(item.url);
          setOpen(false);
        }}
      />
    </BlockStack>
  );
}
