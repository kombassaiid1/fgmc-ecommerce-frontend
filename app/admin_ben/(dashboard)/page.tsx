"use client";

import { Badge, BlockStack, Text } from "@shopify/polaris";

export default function AdminDashboardPage() {
  return (
    <BlockStack gap="300">
      <Text as="p" variant="bodyMd">
        Votre espace administration est pret. Ensuite, nous pouvons construire
        les pages produits, commandes et parametres dans{" "}
        <code>app/admin_ben</code>.
      </Text>
      <Badge tone="info">Phase 1 : Connexion + mise en page terminee</Badge>
    </BlockStack>
  );
}
