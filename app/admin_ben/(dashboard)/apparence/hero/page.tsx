"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Banner, BlockStack, Button, Card, Checkbox, InlineStack, Select, Text, TextField } from "@shopify/polaris";
import { ArrowDownIcon, ArrowUpIcon, DeleteIcon, PlusIcon, SaveIcon } from "@shopify/polaris-icons";

import { MediaPickerDialog, type MediaItem } from "@/components/admin/media-picker-dialog";
import { getCategories, type Category } from "@/lib/api/categories";
import { getAdminHeaderSettings, updateHomeHeroConfig } from "@/lib/api/header";
import { getImageUrl } from "@/lib/api";
import { normalizeHomeHeroConfig, type HomeHeroConfig } from "@/lib/header-config";

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function groupCategories(categories: Category[], audience: "professionnels" | "particuliers") {
  const names = audience === "professionnels"
    ? ["professionnel", "professionnels", "pro"]
    : ["particulier", "particuliers"];
  const root = categories.find((category) => names.includes(normalize(category.title)) || names.includes(normalize(category.slug)));
  return {
    title: root?.title ?? (audience === "professionnels" ? "Professionnels" : "Particuliers"),
    categories: root
      ? categories.filter((category) => category.parentCategoryId === root.id)
      : categories.filter((category) => !category.parentCategoryId),
  };
}

function moveItem(ids: string[], index: number, step: number) {
  const target = index + step;
  if (target < 0 || target >= ids.length) return ids;
  const next = [...ids];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export default function AdminHomeHeroPage() {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<HomeHeroConfig | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const settingsQuery = useQuery({
    queryKey: ["admin-header-settings"],
    queryFn: getAdminHeaderSettings,
  });
  const categoriesQuery = useQuery({
    queryKey: ["admin-hero-categories"],
    queryFn: () => getCategories(),
  });
  const config = draft ?? settingsQuery.data?.heroConfig ?? normalizeHomeHeroConfig(null);
  const allCategories = categoriesQuery.data ?? [];
  const professionalsGroup = useMemo(() => groupCategories(allCategories, "professionnels"), [allCategories]);
  const individualsGroup = useMemo(() => groupCategories(allCategories, "particuliers"), [allCategories]);

  const update = (next: HomeHeroConfig) => setDraft(next);

  const save = async () => {
    setSaving(true);
    setNotice(null);
    setError(null);
    try {
      const saved = await updateHomeHeroConfig(config);
      update(saved.heroConfig);
      queryClient.setQueryData(["admin-header-settings"], saved);
      queryClient.setQueryData(["storefront-header-settings"], saved);
      setNotice("Hero settings saved and published on the storefront.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save hero settings.");
    } finally {
      setSaving(false);
    }
  };

  const addSlide = (media: MediaItem) => {
    update({
      ...config,
      slides: [...config.slides, {
        id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
        imageUrl: media.url,
        altText: media.altText ?? media.name,
        href: "/categorie-produit",
      }],
    });
    setPickerOpen(false);
  };

  const updateCategorySelection = (
    field: "professionalsCategoryIds" | "individualsCategoryIds",
    categoryId: string,
    checked: boolean,
    sourceIds: string[],
  ) => {
    const current = config[field] ?? sourceIds;
    update({
      ...config,
      [field]: checked
        ? [...current, categoryId].filter((id, index, all) => all.indexOf(id) === index)
        : current.filter((id) => id !== categoryId),
    });
  };

  return (
    <BlockStack gap="400">
      <InlineStack align="space-between" blockAlign="center">
        <BlockStack gap="100">
          <Text as="h1" variant="headingLg">Homepage hero</Text>
          <Text as="p" tone="subdued">Manage the image slider and the two category panels on the home page.</Text>
        </BlockStack>
        <Button icon={SaveIcon} variant="primary" onClick={() => void save()} loading={saving}>Save and publish</Button>
      </InlineStack>

      {notice ? <Banner tone="success" title={notice} onDismiss={() => setNotice(null)} /> : null}
      {error ? <Banner tone="critical" title={error} onDismiss={() => setError(null)} /> : null}
      {settingsQuery.isError || categoriesQuery.isError ? <Banner tone="critical" title="Hero settings or categories could not be loaded." /> : null}

      <Card>
        <BlockStack gap="400">
          <InlineStack align="space-between" blockAlign="center">
            <BlockStack gap="100">
              <Text as="h2" variant="headingMd">Image slider</Text>
              <Text as="p" tone="subdued">Add as many slides as you need. Use the arrows to choose their display order.</Text>
            </BlockStack>
            <Button icon={PlusIcon} onClick={() => setPickerOpen(true)}>Add image</Button>
          </InlineStack>

          {config.slides.length === 0 ? (
            <Banner tone="info" title="No images added yet. The storefront will show a branded placeholder until you add a slide." />
          ) : config.slides.map((slide, index) => (
            <div key={slide.id} className="grid gap-4 rounded-lg border border-slate-200 p-3 md:grid-cols-[180px_minmax(0,1fr)_auto] md:items-center">
              <img src={getImageUrl(slide.imageUrl)} alt={slide.altText} className="h-24 w-full rounded-md object-cover md:w-[180px]" />
              <BlockStack gap="200">
                <TextField label="Image description" value={slide.altText} onChange={(value) => update({ ...config, slides: config.slides.map((item, itemIndex) => itemIndex === index ? { ...item, altText: value } : item) })} autoComplete="off" />
                <TextField label="Link when clicked" value={slide.href} onChange={(value) => update({ ...config, slides: config.slides.map((item, itemIndex) => itemIndex === index ? { ...item, href: value } : item) })} autoComplete="off" />
              </BlockStack>
              <InlineStack gap="100">
                <Button icon={ArrowUpIcon} accessibilityLabel="Move slide up" disabled={index === 0} onClick={() => update({ ...config, slides: moveItem(config.slides, index, -1) })} />
                <Button icon={ArrowDownIcon} accessibilityLabel="Move slide down" disabled={index === config.slides.length - 1} onClick={() => update({ ...config, slides: moveItem(config.slides, index, 1) })} />
                <Button icon={DeleteIcon} tone="critical" accessibilityLabel="Remove slide" onClick={() => update({ ...config, slides: config.slides.filter((_, itemIndex) => itemIndex !== index) })} />
              </InlineStack>
            </div>
          ))}
        </BlockStack>
      </Card>

      <Card>
        <BlockStack gap="300">
          <BlockStack gap="100">
            <Text as="h2" variant="headingMd">Featured products carousel</Text>
            <Text as="p" tone="subdued">Show six products at a time from the selected category. Visitors can scroll through the carousel.</Text>
          </BlockStack>
          <TextField
            label="Section title"
            value={config.featuredProducts.title}
            onChange={(title) => update({
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
              ...allCategories.map((category) => ({
                label: category.title,
                value: category.id,
              })),
            ]}
            onChange={(categoryId) => update({
              ...config,
              featuredProducts: {
                ...config.featuredProducts,
                categoryId: categoryId || null,
              },
            })}
          />
        </BlockStack>
      </Card>

      <CategorySettingsCard
        title={professionalsGroup.title}
        description="Choose which professional categories are visible and set their order."
        categories={professionalsGroup.categories}
        selectedIds={config.professionalsCategoryIds ?? professionalsGroup.categories.map((category) => category.id)}
        onToggle={(id, checked) => updateCategorySelection("professionalsCategoryIds", id, checked, professionalsGroup.categories.map((category) => category.id))}
        onMove={(ids) => update({ ...config, professionalsCategoryIds: ids })}
      />
      <CategorySettingsCard
        title={individualsGroup.title}
        description="Choose which individual categories are visible and set their order."
        categories={individualsGroup.categories}
        selectedIds={config.individualsCategoryIds ?? individualsGroup.categories.map((category) => category.id)}
        onToggle={(id, checked) => updateCategorySelection("individualsCategoryIds", id, checked, individualsGroup.categories.map((category) => category.id))}
        onMove={(ids) => update({ ...config, individualsCategoryIds: ids })}
      />

      <MediaPickerDialog open={pickerOpen} onClose={() => setPickerOpen(false)} onSelect={addSlide} />
    </BlockStack>
  );
}

function CategorySettingsCard({
  title,
  description,
  categories,
  selectedIds,
  onToggle,
  onMove,
}: {
  title: string;
  description: string;
  categories: Category[];
  selectedIds: string[];
  onToggle: (id: string, checked: boolean) => void;
  onMove: (ids: string[]) => void;
}) {
  const orderedSelected = selectedIds.map((id) => categories.find((category) => category.id === id)).filter((category): category is Category => Boolean(category));
  return (
    <Card>
      <BlockStack gap="400">
        <BlockStack gap="100">
          <Text as="h2" variant="headingMd">{title} category panel</Text>
          <Text as="p" tone="subdued">{description}</Text>
        </BlockStack>
        <div className="grid gap-6 lg:grid-cols-2">
          <BlockStack gap="200">
            <Text as="h3" variant="headingSm">Available categories</Text>
            {categories.length === 0 ? <Text as="p" tone="subdued">No categories found in this group.</Text> : categories.map((category) => (
              <Checkbox key={category.id} label={category.title} checked={selectedIds.includes(category.id)} onChange={(checked) => onToggle(category.id, checked)} />
            ))}
          </BlockStack>
          <BlockStack gap="200">
            <Text as="h3" variant="headingSm">Visible order</Text>
            {orderedSelected.length === 0 ? <Text as="p" tone="subdued">All categories are hidden.</Text> : orderedSelected.map((category, index) => (
              <InlineStack key={category.id} align="space-between" blockAlign="center">
                <Text as="span">{index + 1}. {category.title}</Text>
                <InlineStack gap="100">
                  <Button icon={ArrowUpIcon} accessibilityLabel={`Move ${category.title} up`} disabled={index === 0} onClick={() => onMove(moveItem(selectedIds, index, -1))} />
                  <Button icon={ArrowDownIcon} accessibilityLabel={`Move ${category.title} down`} disabled={index === orderedSelected.length - 1} onClick={() => onMove(moveItem(selectedIds, index, 1))} />
                </InlineStack>
              </InlineStack>
            ))}
          </BlockStack>
        </div>
      </BlockStack>
    </Card>
  );
}
