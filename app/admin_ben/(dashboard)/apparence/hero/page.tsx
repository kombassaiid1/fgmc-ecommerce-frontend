"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Banner, BlockStack, Button, Card, Checkbox, InlineStack, Text, TextField } from "@shopify/polaris";
import { ArrowDownIcon, ArrowUpIcon, DeleteIcon, PlusIcon, SaveIcon } from "@shopify/polaris-icons";

import { MediaPickerDialog, type MediaItem } from "@/components/admin/media-picker-dialog";
import { getCategories, type Category } from "@/lib/api/categories";
import { getAdminHeaderSettings, updateHomeHeroConfig } from "@/lib/api/header";
import { getImageUrl } from "@/lib/api";
import { normalizeHomeHeroConfig, type HomeHeroConfig } from "@/lib/header-config";
import { getDefaultPopularCategoryIds } from "@/lib/popular-category-defaults";

function getCategoryPath(category: Category, categories: Category[]) {
  const path = [category.title];
  const visited = new Set([category.id]);
  let parentId = category.parentCategoryId;
  while (parentId && !visited.has(parentId)) {
    visited.add(parentId);
    const parent = categories.find((item) => item.id === parentId);
    if (!parent) break;
    path.unshift(parent.title);
    parentId = parent.parentCategoryId;
  }
  return path.join(" › ");
}

function moveItem<T>(ids: T[], index: number, step: number) {
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
  const sourceConfig = draft ?? settingsQuery.data?.heroConfig ?? normalizeHomeHeroConfig(null);
  const config: Omit<HomeHeroConfig, "professionalsCategoryIds" | "individualsCategoryIds"> & {
    professionalsCategoryIds: string[];
    individualsCategoryIds: string[];
  } = {
    ...sourceConfig,
    professionalsCategoryIds: sourceConfig.professionalsCategoryIds ?? [],
    individualsCategoryIds: sourceConfig.individualsCategoryIds ?? [],
  };
  const allCategories = categoriesQuery.data ?? [];
  const defaultPopularIds = useMemo(() => getDefaultPopularCategoryIds(allCategories), [allCategories]);
  const popularCategoryIds = config.popularCategories.categoryIds ?? defaultPopularIds;

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
  ) => {
    const current = config[field] ?? [];
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
          <Text as="h1" variant="headingLg">Homepage sections</Text>
          <Text as="p" tone="subdued">Manage the home page slider, category panels, popular categories, and product carousel.</Text>
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
        <BlockStack gap="400">
          <BlockStack gap="100">
            <Text as="h2" variant="headingMd">Popular categories</Text>
            <Text as="p" tone="subdued">Choose which categories appear in the circular carousel on the storefront, and set their order.</Text>
          </BlockStack>
          <TextField
            label="Section title"
            value={config.popularCategories.title}
            onChange={(title) => update({ ...config, popularCategories: { ...config.popularCategories, title } })}
            autoComplete="off"
          />
          <div className="grid gap-6 lg:grid-cols-2">
            <BlockStack gap="200">
              <Text as="h3" variant="headingSm">Available categories</Text>
              {allCategories.length === 0 ? <Text as="p" tone="subdued">No categories found.</Text> : allCategories.map((category) => (
                <Checkbox
                  key={category.id}
                  label={category.title}
                  checked={popularCategoryIds.includes(category.id)}
                  onChange={(checked) => {
                    const ids = checked
                      ? [...popularCategoryIds, category.id].filter((id, index, values) => values.indexOf(id) === index)
                      : popularCategoryIds.filter((id) => id !== category.id);
                    update({ ...config, popularCategories: { ...config.popularCategories, categoryIds: ids } });
                  }}
                />
              ))}
            </BlockStack>
            <BlockStack gap="200">
              <Text as="h3" variant="headingSm">Visible order</Text>
              {popularCategoryIds.length === 0 ? <Text as="p" tone="subdued">No popular categories selected.</Text> : popularCategoryIds.map((id, index) => {
                const category = allCategories.find((item) => item.id === id);
                if (!category) return null;
                return <InlineStack key={id} align="space-between" blockAlign="center">
                  <Text as="span">{index + 1}. {category.title}</Text>
                  <InlineStack gap="100">
                    <Button icon={ArrowUpIcon} accessibilityLabel={`Move ${category.title} up`} disabled={index === 0} onClick={() => update({ ...config, popularCategories: { ...config.popularCategories, categoryIds: moveItem(popularCategoryIds, index, -1) } })} />
                    <Button icon={ArrowDownIcon} accessibilityLabel={`Move ${category.title} down`} disabled={index === popularCategoryIds.length - 1} onClick={() => update({ ...config, popularCategories: { ...config.popularCategories, categoryIds: moveItem(popularCategoryIds, index, 1) } })} />
                  </InlineStack>
                </InlineStack>;
              })}
            </BlockStack>
          </div>
        </BlockStack>
      </Card>

      <CategorySettingsCard
        title="Professionnels"
        description="Select any categories from your catalog for this panel, then choose the display order."
        categories={allCategories}
        selectedIds={config.professionalsCategoryIds}
        onToggle={(id, checked) => updateCategorySelection("professionalsCategoryIds", id, checked)}
        onMove={(ids) => update({ ...config, professionalsCategoryIds: ids })}
      />
      <CategorySettingsCard
        title="Particuliers"
        description="Select any categories from your catalog for this panel, then choose the display order."
        categories={allCategories}
        selectedIds={config.individualsCategoryIds}
        onToggle={(id, checked) => updateCategorySelection("individualsCategoryIds", id, checked)}
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
            {categories.length === 0 ? <Text as="p" tone="subdued">No categories found in your catalog.</Text> : categories.map((category) => (
              <Checkbox key={category.id} label={getCategoryPath(category, categories)} checked={selectedIds.includes(category.id)} onChange={(checked) => onToggle(category.id, checked)} />
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
