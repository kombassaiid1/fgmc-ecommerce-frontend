"use client";

import { BlockStack, Text } from "@shopify/polaris";

export default function AdminSettingsPage() {
  return (
    <BlockStack gap="200">
      <Text as="h3" variant="headingMd">
        Parametres
      </Text>
      <Text as="p" tone="subdued">
        L'interface des parametres de la boutique sera ajoutee ici.
      </Text>
    </BlockStack>
  );
}
