"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Banner, BlockStack, Button, Card, Select, Text, TextField } from "@shopify/polaris";
import { SaveIcon } from "@shopify/polaris-icons";

import { getCategories } from "@/lib/api/categories";
import { getAdminHeaderSettings, updateHomeHeroConfig } from "@/lib/api/header";
import { normalizeHomeHeroConfig, type HomeHeroConfig } from "@/lib/header-config";

export default function AdminAppearancePage() {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<HomeHeroConfig | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const settingsQuery = useQuery({
    queryKey: ["admin-header-settings"],
    queryFn: getAdminHeaderSettings,
  });
  const categoriesQuery = useQuery({
    queryKey: ["admin-hero-categories"],
    queryFn: () => getCategories(),
  });
  const config = draft ?? settingsQuery.data?.heroConfig ?? normalizeHomeHeroConfig(null);
  const categories = categoriesQuery.data ?? [];

  const save = async () => {
    setSaving(true);
    setNotice(null);
    setError(null);
    try {
      const saved = await updateHomeHeroConfig(config);
      setDraft(saved.heroConfig);
      queryClient.setQueryData(["admin-header-settings"], saved);
      queryClient.setQueryData(["storefront-header-settings"], saved);
      setNotice("Featured products settings saved and published on the storefront.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save featured products settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <BlockStack gap="400">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <BlockStack gap="100">
          <Text as="h1" variant="headingLg">Appearance</Text>
          <Text as="p" tone="subdued">Configure the featured products carousel shown on the homepage.</Text>
        </BlockStack>
        <Button icon={SaveIcon} variant="primary" onClick={() => void save()} loading={saving}>Save and publish</Button>
      </div>

      {notice ? <Banner tone="success" title={notice} onDismiss={() => setNotice(null)} /> : null}
      {error ? <Banner tone="critical" title={error} onDismiss={() => setError(null)} /> : null}
      {settingsQuery.isError || categoriesQuery.isError ? <Banner tone="critical" title="Appearance settings or categories could not be loaded." /> : null}

      <Card>
        <BlockStack gap="300">
          <BlockStack gap="100">
            <Text as="h2" variant="headingMd">Featured products carousel</Text>
            <Text as="p" tone="subdued">Show six products at a time from the selected category. Visitors can scroll through the carousel.</Text>
          </BlockStack>
          <TextField
            label="Section title"
            value={config.featuredProducts.title}
            onChange={(title) => setDraft({
              ...config,
              featuredProducts: { ...config.featuredProducts, title },
            })}
            autoComplete="off"
          />
          <Select
            label="Product category"
            value={config.featuredProducts.categoryId ?? ""}
            options={[
              { label: "All categories", value: "" },
              ...categories.map((category) => ({ label: category.title, value: category.id })),
            ]}
            onChange={(categoryId) => setDraft({
              ...config,
              featuredProducts: {
                ...config.featuredProducts,
                categoryId: categoryId || null,
              },
            })}
          />
        </BlockStack>
      </Card>
    </BlockStack>
  );
}
