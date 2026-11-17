"use client";

import type { ReactNode } from "react";
import { BlockStack, Box, Button, InlineStack, Text } from "@shopify/polaris";

/** Breadcrumb, title and optional description shared by the International pages. */
export function PageHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <BlockStack gap="200">
      <InlineStack gap="100" blockAlign="center">
        <Button variant="plain" url="/admin_ben/international">International</Button>
        <Text as="span" variant="bodySm" tone="subdued">/</Text>
        <Text as="span" variant="bodySm" tone="subdued">{title}</Text>
      </InlineStack>
      <InlineStack align="space-between" blockAlign="start" gap="400">
        <BlockStack gap="100">
          <Text as="h1" variant="headingXl">{title}</Text>
          {description ? (
            <Box maxWidth="720px">
              <Text as="p" variant="bodyMd" tone="subdued">{description}</Text>
            </Box>
          ) : null}
        </BlockStack>
        {action}
      </InlineStack>
    </BlockStack>
  );
}
