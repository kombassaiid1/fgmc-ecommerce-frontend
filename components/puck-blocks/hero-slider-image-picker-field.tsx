"use client";

import { useMemo, useState } from "react";
import { BlockStack, Button, InlineStack, Text } from "@shopify/polaris";

import { MediaPickerDialog, type MediaItem } from "@/components/admin/media-picker-dialog";

type HeroSliderImagePickerFieldProps = {
  value: string;
  onChange: (next: string) => void;
  readOnly?: boolean;
};

function parseUrls(raw: string) {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export function HeroSliderImagePickerField({
  value,
  onChange,
  readOnly = false,
}: HeroSliderImagePickerFieldProps) {
  const [open, setOpen] = useState(false);
  const urls = useMemo(() => parseUrls(value || ""), [value]);

  const writeUrls = (nextUrls: string[]) => {
    onChange(nextUrls.join("\n"));
  };

  const removeUrl = (url: string) => {
    writeUrls(urls.filter((item) => item !== url));
  };

  const mergeItems = (items: MediaItem[]) => {
    const merged = new Set(urls);
    for (const item of items) {
      if (item.url?.trim()) {
        merged.add(item.url.trim());
      }
    }
    writeUrls(Array.from(merged));
  };

  return (
    <BlockStack gap="200">
      <InlineStack align="space-between" blockAlign="center">
        <Text as="span" variant="bodySm" tone="subdued">
          {`${String(urls.length)} image(s) sélectionnée(s)`}
        </Text>
        <Button size="slim" onClick={() => setOpen(true)} disabled={readOnly}>
          Choisir images
        </Button>
      </InlineStack>

      {urls.length > 0 ? (
        <BlockStack gap="100">
          {urls.map((url) => (
            <InlineStack key={url} align="space-between" blockAlign="center" wrap={false}>
              <Text as="span" tone="subdued" truncate>
                {url}
              </Text>
              <Button size="micro" tone="critical" onClick={() => removeUrl(url)} disabled={readOnly}>
                Retirer
              </Button>
            </InlineStack>
          ))}
        </BlockStack>
      ) : null}

      <MediaPickerDialog
        open={open}
        multiple
        selectedUrls={urls}
        onClose={() => setOpen(false)}
        onSelect={(item) => {
          mergeItems([item]);
          setOpen(false);
        }}
        onSelectMany={(items) => {
          mergeItems(items);
          setOpen(false);
        }}
      />
    </BlockStack>
  );
}
