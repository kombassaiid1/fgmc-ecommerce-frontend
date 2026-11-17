"use client";

import { BlockStack, Box, Button, Card, InlineStack, Text } from "@shopify/polaris";
import { PageHeader } from "./page-header";

/** A section that is in the menu but not built yet: says so plainly and points to what already works. */
export function ComingSoon({ title, description, planned }: { title: string; description: string; planned: string }) {
  return (
    <BlockStack gap="400">
      <PageHeader title={title} description={description} />
      <Card>
        <Box paddingBlock="400">
          <BlockStack gap="300" inlineAlign="center">
            <Text as="h2" variant="headingMd">Cette section n’est pas encore disponible</Text>
            <Box maxWidth="520px">
              <Text as="p" variant="bodyMd" tone="subdued" alignment="center">{planned}</Text>
            </Box>
            <InlineStack gap="200">
              <Button url="/admin_ben/international/zones">Zones géographiques</Button>
              <Button url="/admin_ben/international/taxes">Taxes</Button>
            </InlineStack>
          </BlockStack>
        </Box>
      </Card>
    </BlockStack>
  );
}
