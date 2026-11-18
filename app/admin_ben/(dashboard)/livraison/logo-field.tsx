"use client";

import { useState } from "react";
import { BlockStack, Button, Icon, InlineStack, Text, UnstyledButton } from "@shopify/polaris";
import { ImageIcon } from "@shopify/polaris-icons";
import { MediaPickerDialog } from "@/components/admin/media-picker-dialog";
import { getImageUrl } from "@/lib/api";

/** An image chosen from the media library (images only; new files can be uploaded from the dialog). Says "logo" unless told otherwise. */
export function LogoField({ value, onChange, noun = "Logo du transporteur", change = "Changer le logo", remove = "Retirer le logo", hint = "Facultatif. Affiché au paiement à côté du nom du transporteur.", showLabel = true }: { value: string; onChange: (url: string) => void; noun?: string; change?: string; remove?: string; hint?: string; showLabel?: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <BlockStack gap="200">
      {showLabel ? <Text as="span" variant="bodyMd">Logo</Text> : null}
      <InlineStack gap="300" blockAlign="center" wrap={false}>
        <UnstyledButton onClick={() => setOpen(true)} accessibilityLabel={`Choisir : ${noun}`}>
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
              <img src={getImageUrl(value)} alt={noun} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
            ) : (
              <Icon source={ImageIcon} tone="subdued" />
            )}
          </div>
        </UnstyledButton>
        <BlockStack gap="100" inlineAlign="start">
          <Button onClick={() => setOpen(true)}>{value ? change : "Choisir dans la médiathèque"}</Button>
          {value ? <Button variant="tertiary" tone="critical" onClick={() => onChange("")}>{remove}</Button> : null}
        </BlockStack>
      </InlineStack>
      <Text as="span" variant="bodySm" tone="subdued">{hint}</Text>

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
