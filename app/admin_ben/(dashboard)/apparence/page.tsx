"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Banner, BlockStack, Button, Card, Select, Text, TextField } from "@shopify/polaris";
import { DeleteIcon, SaveIcon } from "@shopify/polaris-icons";

import { MediaPickerDialog, type MediaItem } from "@/components/admin/media-picker-dialog";
import { getImageUrl } from "@/lib/api";
import { getCategories } from "@/lib/api/categories";
import { getAdminHeaderSettings, updateHomeHeroConfig } from "@/lib/api/header";
import { normalizeHomeHeroConfig, type HomeHeroConfig } from "@/lib/header-config";

const IMAGE_TILE_LAYOUT = [
  "row-span-2 sm:col-start-1 sm:row-span-2",
  "sm:col-start-2 sm:row-start-1",
  "sm:col-start-2 sm:row-start-2",
  "col-span-2 sm:col-span-1 sm:col-start-3 sm:row-span-2",
];

const IMAGE_TILE_SPECS = [
  { size: "1200 × 960 px", ratio: "5:4" },
  { size: "1200 × 600 px", ratio: "2:1" },
  { size: "1200 × 600 px", ratio: "2:1" },
  { size: "800 × 1100 px", ratio: "8:11" },
];

export default function AdminAppearancePage() {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<HomeHeroConfig | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [imagePickerSlot, setImagePickerSlot] = useState<number | null>(null);
  const [imagePickerOpen, setImagePickerOpen] = useState(false);

  const settingsQuery = useQuery({
    queryKey: ["admin-header-settings"],
    queryFn: getAdminHeaderSettings,
  });
  const categoriesQuery = useQuery({
    queryKey: ["admin-hero-categories"],
    queryFn: () => getCategories(),
  });
  // Re-normalize drafts too: a saved config from before section ordering (or a
  // dev HMR state snapshot) may not contain the new arrays yet.
  const config = normalizeHomeHeroConfig(draft ?? settingsQuery.data?.heroConfig ?? null);
  const categories = categoriesQuery.data ?? [];

  const chooseImageForSlot = (media: MediaItem) => {
    if (imagePickerSlot === null) return;
    const imageTiles = config.imageTiles.map((tile, index) => index === imagePickerSlot
      ? { imageUrl: media.url, altText: media.altText ?? media.name }
      : tile);
    setDraft({ ...config, imageTiles });
    setImagePickerOpen(false);
    setImagePickerSlot(null);
  };

  const removeImageFromSlot = (index: number) => {
    setDraft({
      ...config,
      imageTiles: config.imageTiles.map((tile, tileIndex) => tileIndex === index ? null : tile),
    });
  };

  const updateFeaturedSection = (index: number, changes: Partial<HomeHeroConfig["featuredProductSections"][number]>) => {
    setDraft({
      ...config,
      featuredProductSections: config.featuredProductSections.map((section, sectionIndex) =>
        sectionIndex === index ? { ...section, ...changes } : section,
      ),
    });
  };

  const moveHomeSection = (index: number, offset: -1 | 1) => {
    const nextIndex = index + offset;
    if (nextIndex < 0 || nextIndex >= config.homeSectionOrder.length) return;
    const homeSectionOrder = [...config.homeSectionOrder];
    [homeSectionOrder[index], homeSectionOrder[nextIndex]] = [homeSectionOrder[nextIndex], homeSectionOrder[index]];
    setDraft({ ...config, homeSectionOrder });
  };

  const addFeaturedSection = () => {
    const id = `featured-products-${Date.now()}`;
    setDraft({
      ...config,
      featuredProductSections: [...config.featuredProductSections, { id, title: "Meilleures ventes", categoryId: null }],
      homeSectionOrder: [...config.homeSectionOrder, `featured:${id}`],
    });
  };

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
          <Text as="p" tone="subdued">Configure homepage promo images and the featured products carousel.</Text>
        </BlockStack>
        <Button icon={SaveIcon} variant="primary" onClick={() => void save()} loading={saving}>Save and publish</Button>
      </div>

      {notice ? <Banner tone="success" title={notice} onDismiss={() => setNotice(null)} /> : null}
      {error ? <Banner tone="critical" title={error} onDismiss={() => setError(null)} /> : null}
      {settingsQuery.isError || categoriesQuery.isError ? <Banner tone="critical" title="Appearance settings or categories could not be loaded." /> : null}

      <BlockStack gap="300">
        {config.homeSectionOrder.map((sectionId, index) => {
          if (sectionId === "image-layout") {
            return (
              <Card key="image-layout">
                <BlockStack gap="300">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Text as="h2" variant="headingMd">Homepage image layout</Text>
                    <div className="flex gap-2">
                      <Button disabled={index === 0} onClick={() => moveHomeSection(index, -1)}>Move up</Button>
                      <Button disabled={index === config.homeSectionOrder.length - 1} onClick={() => moveHomeSection(index, 1)}>Move down</Button>
                    </div>
                  </div>
                  <Text as="p" tone="subdued">Click a tile to add or replace its image. Recommended pixel dimensions are shown on each tile. Fill all four for the complete layout.</Text>
                  <div className="grid grid-cols-2 grid-rows-[150px_150px_130px] gap-3 sm:h-[clamp(280px,33vw,480px)] sm:grid-cols-[1.25fr_1fr_0.72fr] sm:grid-rows-2">
                    {config.imageTiles.map((tile, tileIndex) => (
                      <div key={tileIndex} className={`group relative overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50 ${IMAGE_TILE_LAYOUT[tileIndex]}`}>
                        <button
                          type="button"
                          onClick={() => { setImagePickerSlot(tileIndex); setImagePickerOpen(true); }}
                          className="absolute inset-0 grid size-full place-items-center text-center text-sm font-semibold text-slate-600 transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-blue-600"
                          aria-label={`${tile ? "Replace" : "Add"} image for tile ${tileIndex + 1}`}>
                          {tile ? (
                            <>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={getImageUrl(tile.imageUrl)} alt={tile.altText} className="absolute inset-0 size-full object-cover" />
                              <span className="absolute inset-x-0 bottom-0 bg-slate-950/60 px-3 py-2 text-white opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">Click to replace image</span>
                            </>
                          ) : <span className="px-3">+ Add image {tileIndex + 1}</span>}
                        </button>
                        <span className="pointer-events-none absolute left-2 top-2 z-10 rounded-md bg-white/95 px-2 py-1 text-left text-[11px] font-semibold leading-tight text-slate-800 shadow-sm">
                          {IMAGE_TILE_SPECS[tileIndex].size}<br />
                          <span className="font-normal text-slate-500">Ratio {IMAGE_TILE_SPECS[tileIndex].ratio}</span>
                        </span>
                        {tile ? <div className="absolute right-2 top-2"><Button icon={DeleteIcon} tone="critical" accessibilityLabel={`Remove image ${tileIndex + 1}`} onClick={() => removeImageFromSlot(tileIndex)} /></div> : null}
                      </div>
                    ))}
                  </div>
                  <Text as="p" tone="subdued">Layout: one large tile, two stacked center tiles, and one large tile.</Text>
                </BlockStack>
              </Card>
            );
          }
          const section = config.featuredProductSections.find((item) => `featured:${item.id}` === sectionId);
          if (!section) return null;
          const sectionIndex = config.featuredProductSections.findIndex((item) => item.id === section.id);
          return (
          <Card key={section.id}>
            <BlockStack gap="300">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Text as="h2" variant="headingMd">Featured products carousel {sectionIndex + 1}</Text>
                <div className="flex gap-2">
                  <Button disabled={index === 0} onClick={() => moveHomeSection(index, -1)}>Move up</Button>
                  <Button disabled={index === config.homeSectionOrder.length - 1} onClick={() => moveHomeSection(index, 1)}>Move down</Button>
                  <Button onClick={() => {
                    const copy = { ...section, id: `featured-products-${Date.now()}`, title: `${section.title} (copy)` };
                    const featuredProductSections = [...config.featuredProductSections];
                    featuredProductSections.splice(sectionIndex + 1, 0, copy);
                    const homeSectionOrder = [...config.homeSectionOrder];
                    homeSectionOrder.splice(index + 1, 0, `featured:${copy.id}`);
                    setDraft({ ...config, featuredProductSections, homeSectionOrder });
                  }}>Duplicate</Button>
                  <Button tone="critical" disabled={config.featuredProductSections.length === 1} onClick={() => setDraft({
                    ...config,
                    featuredProductSections: config.featuredProductSections.filter((_, itemIndex) => itemIndex !== sectionIndex),
                    homeSectionOrder: config.homeSectionOrder.filter((id) => id !== sectionId),
                  })}>Remove</Button>
                </div>
              </div>
              <TextField
                label="Section title"
                value={section.title}
                onChange={(title) => updateFeaturedSection(sectionIndex, { title })}
                autoComplete="off"
              />
              <Select
                label="Product category"
                value={section.categoryId ?? ""}
                options={[
                  { label: "All categories", value: "" },
                  ...categories.map((category) => ({ label: category.title, value: category.id })),
                ]}
                onChange={(categoryId) => updateFeaturedSection(sectionIndex, { categoryId: categoryId || null })}
              />
            </BlockStack>
          </Card>
        );
        })}
        <div>
          <Button onClick={addFeaturedSection}>Add featured products carousel</Button>
        </div>
      </BlockStack>
      <MediaPickerDialog
        open={imagePickerOpen}
        selectedUrl={imagePickerSlot === null ? null : config.imageTiles[imagePickerSlot]?.imageUrl}
        onClose={() => { setImagePickerOpen(false); setImagePickerSlot(null); }}
        onSelect={chooseImageForSlot}
      />
    </BlockStack>
  );
}
