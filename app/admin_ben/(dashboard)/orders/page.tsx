"use client";

import { BlockStack, Text } from "@shopify/polaris";

export default function AdminOrdersPage() {
  return (
    <BlockStack gap="200">
      <Text as="h3" variant="headingMd">
        Commandes
      </Text>
      <Text as="p" tone="subdued">
        L'interface de gestion des commandes sera ajoutee ici.
      </Text>
    </BlockStack>
  );
}
