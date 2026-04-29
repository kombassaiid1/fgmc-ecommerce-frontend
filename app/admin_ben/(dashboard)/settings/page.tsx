"use client";

import { BlockStack, Button, Card, Text } from "@shopify/polaris";

export default function AdminSettingsPage() {
  return (
    <Card>
      <BlockStack gap="300">
        <Text as="h3" variant="headingMd">
          Parametres
        </Text>
        <Text as="p" tone="subdued">
          Gerer les configurations globales de la boutique.
        </Text>
        <Button url="/admin_ben/settings/taxes" variant="primary">
          Gerer les taxes
        </Button>
      </BlockStack>
    </Card>
  );
}
