"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Banner,
  BlockStack,
  Box,
  Button,
  Checkbox,
  Card,
  ChoiceList,
  Divider,
  InlineGrid,
  InlineStack,
  Modal,
  Select,
  Tabs,
  Text,
  TextField,
  UnstyledButton,
} from "@shopify/polaris";
import { QuestionCircleIcon, SearchIcon, XIcon } from "@shopify/polaris-icons";

import { MediaPickerDialog } from "@/components/admin/media-picker-dialog";
import { RichTextEditor } from "@/components/admin/rich-text-editor";
import { getCategories, type Category } from "@/lib/api/categories";
import { getBrands, type Brand } from "@/lib/api/brands";
import { getAttributes, type Attribute } from "@/lib/api/attributes";
import { getTaxes, type Tax } from "@/lib/api/taxes";
import { createProduct, getProductById, updateProduct } from "@/lib/api/products";

type ProductFormState = {
  title: string;
  slug: string;
  description: string;
  shortDescription: string;
  price: string;
  discount: string;
  discountType: string;
  tag: string;
  sku: string;
  qty: string;
  stockStatus: string;
  allowBackorders: string;
  lowStockThreshold: string;
  brandId: string;
  taxId: string;
  status: "DRAFT" | "PUBLIC";
  reference: string;
  metaTitle: string;
  metaDescription: string;
  metaKeywords: string;
};

const EMPTY_FORM: ProductFormState = {
  title: "",
  slug: "",
  description: "",
  shortDescription: "",
  price: "0",
  discount: "0",
  discountType: "fixed",
  tag: "-",
  sku: "",
  qty: "0",
  stockStatus: "instock",
  allowBackorders: "no",
  lowStockThreshold: "0",
  brandId: "",
  taxId: "",
  status: "DRAFT",
  reference: "",
  metaTitle: "",
  metaDescription: "",
  metaKeywords: "",
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function buildCategoryChildrenMap(items: Category[]) {
  const map = new Map<string, Category[]>();
  for (const item of items) {
    const parentKey = item.parentCategoryId ?? "__root__";
    const group = map.get(parentKey) ?? [];
    group.push(item);
    map.set(parentKey, group);
  }
  map.forEach((group, key) => {
    map.set(
      key,
      [...group].sort((a, b) => a.title.localeCompare(b.title, "fr")),
    );
  });
  return map;
}

export default function AdminProductsPage() {
  const searchParams = useSearchParams();
  const productId = searchParams.get("id");
  const [formState, setFormState] = useState<ProductFormState>(EMPTY_FORM);
  const [slugWasEdited, setSlugWasEdited] = useState(false);

  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [attributes, setAttributes] = useState<Attribute[]>([]);
  const [taxes, setTaxes] = useState<Tax[]>([]);

  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [selectedTermIdsByAttribute, setSelectedTermIdsByAttribute] = useState<
    Record<string, string[]>
  >({});
  const [categorySearch, setCategorySearch] = useState("");
  const [expandedCategoryIds, setExpandedCategoryIds] = useState<Set<string>>(
    new Set(),
  );
  const [images, setImages] = useState<string[]>([]);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const [draftIsCoverChecked, setDraftIsCoverChecked] = useState(false);
  const [zoomImageUrl, setZoomImageUrl] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(false);

  const [loadingRefs, setLoadingRefs] = useState(true);
  const [loadingProduct, setLoadingProduct] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isMediaPickerOpen, setIsMediaPickerOpen] = useState(false);
  const [selectedTabIndex, setSelectedTabIndex] = useState(0);
  const [selectedBasicEditorTab, setSelectedBasicEditorTab] = useState(0);
  const [combinationMode, setCombinationMode] = useState<
    "simple" | "with_combinations"
  >("simple");

  useEffect(() => {
    const loadRefs = async () => {
      setLoadingRefs(true);
      setError(null);
      try {
        const [cats, brandsRes, attributesRes, taxesRes] = await Promise.all([
          getCategories(),
          getBrands({ limit: 200 }),
          getAttributes({ includeTerms: true, limit: 200 }),
          getTaxes({ limit: 500 }),
        ]);
        setCategories(cats);
        setBrands(brandsRes.data);
        setAttributes(attributesRes.data);
        setTaxes(taxesRes.data);
        setFormState((prev) => ({
          ...prev,
          brandId: prev.brandId || brandsRes.data[0]?.id || "",
          taxId:
            prev.taxId ||
            taxesRes.data.find((tax) => tax.isDefault)?.id ||
            taxesRes.data[0]?.id ||
            "",
        }));
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Impossible de charger les donnees de reference.",
        );
      } finally {
        setLoadingRefs(false);
      }
    };

    void loadRefs();
  }, []);

  useEffect(() => {
    if (!productId) {
      return;
    }

    const loadProduct = async () => {
      setLoadingProduct(true);
      setError(null);
      try {
        const product = await getProductById(productId);
        const termMap: Record<string, string[]> = {};
        for (const item of product.attributes ?? []) {
          if (!termMap[item.attributeId]) {
            termMap[item.attributeId] = [];
          }
          if (!termMap[item.attributeId].includes(item.termId)) {
            termMap[item.attributeId].push(item.termId);
          }
        }

        setFormState((prev) => ({
          ...prev,
          title: product.title ?? "",
          slug: product.slug ?? "",
          description: product.description ?? "",
          shortDescription: product.shortDescription ?? "",
          price: product.price ?? "0",
          discount: product.discount ?? "0",
          discountType: product.discountType ?? "fixed",
          tag: product.tag ?? "-",
          sku: product.sku ?? "",
          qty: product.qty ?? "0",
          stockStatus: product.stockStatus ?? "instock",
          allowBackorders: product.allowBackorders ?? "no",
          lowStockThreshold: product.lowStockThreshold ?? "0",
          brandId: product.brandId ?? prev.brandId,
          taxId: product.taxId ?? prev.taxId,
          status: product.status ?? "DRAFT",
          reference: product.reference ?? "",
          metaTitle: product.metaTitle ?? "",
          metaDescription: product.metaDescription ?? "",
          metaKeywords: product.metaKeywords ?? "",
        }));
        setSlugWasEdited(true);
        setSelectedCategoryIds(
          (product.categories ?? [])
            .map((item) => item.categoryId ?? item.category?.id ?? "")
            .filter((value): value is string => Boolean(value)),
        );
        setSelectedTermIdsByAttribute(termMap);
        setImages(product.images ?? []);
        setSelectedImageUrl(null);
        setCoverImageUrl(product.images?.[0] ?? null);
        setDraftIsCoverChecked(false);
        setZoomImageUrl(null);
        setIsOnline(product.status === "PUBLIC");
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Impossible de charger le produit.",
        );
      } finally {
        setLoadingProduct(false);
      }
    };

    void loadProduct();
  }, [productId]);

  const categoriesById = useMemo(
    () => new Map(categories.map((item) => [item.id, item])),
    [categories],
  );
  const childrenByCategory = useMemo(
    () => buildCategoryChildrenMap(categories),
    [categories],
  );

  const brandOptions = useMemo(
    () => brands.map((item) => ({ label: item.title, value: item.id })),
    [brands],
  );
  const taxOptions = useMemo(
    () =>
      taxes.map((tax) => ({
        label: `${tax.name} (${tax.rate}%)`,
        value: tax.id,
      })),
    [taxes],
  );
  const selectedTaxRate = useMemo(
    () => taxes.find((tax) => tax.id === formState.taxId)?.rate ?? 0,
    [formState.taxId, taxes],
  );
  const priceTaxExcluded = useMemo(() => {
    const parsed = Number(formState.price || "0");
    return Number.isFinite(parsed) ? parsed : 0;
  }, [formState.price]);
  const priceTaxIncluded = useMemo(
    () => priceTaxExcluded + priceTaxExcluded * (selectedTaxRate / 100),
    [priceTaxExcluded, selectedTaxRate],
  );
  const tabs = useMemo(
    () => [
      { id: "basic", content: "Parametres de base" },
      { id: "qty", content: "Quantites" },
      { id: "shipping", content: "Livraison" },
      { id: "pricing", content: "Tarification" },
      { id: "seo", content: "SEO" },
      { id: "options", content: "Options" },
    ],
    [],
  );
  const basicEditorTabs = useMemo(
    () => [
      { id: "summary", content: "Resume" },
      { id: "description", content: "Description" },
    ],
    [],
  );

  useEffect(() => {
    if (images.length === 0) {
      setSelectedImageUrl(null);
      setCoverImageUrl(null);
      return;
    }
    setCoverImageUrl((prev) => (prev && images.includes(prev) ? prev : images[0]));
    setSelectedImageUrl((prev) => (prev && images.includes(prev) ? prev : null));
  }, [images]);

  useEffect(() => {
    if (!selectedImageUrl) {
      setDraftIsCoverChecked(false);
      return;
    }
    setDraftIsCoverChecked(coverImageUrl === selectedImageUrl);
  }, [coverImageUrl, selectedImageUrl]);
  const categorySearchTerm = categorySearch.trim().toLowerCase();
  const categoryBranchMatches = useMemo(() => {
    const memo = new Map<string, boolean>();
    const visit = (id: string): boolean => {
      if (memo.has(id)) {
        return memo.get(id) ?? false;
      }
      const current = categoriesById.get(id);
      if (!current) {
        memo.set(id, false);
        return false;
      }
      const ownMatch =
        categorySearchTerm.length === 0 ||
        current.title.toLowerCase().includes(categorySearchTerm) ||
        current.slug.toLowerCase().includes(categorySearchTerm);
      const children = childrenByCategory.get(id) ?? [];
      const childMatch = children.some((child) => visit(child.id));
      const value = ownMatch || childMatch;
      memo.set(id, value);
      return value;
    };
    for (const item of categories) {
      visit(item.id);
    }
    return memo;
  }, [categories, categoriesById, childrenByCategory, categorySearchTerm]);

  const categoryRows = useMemo(() => {
    const rows: Array<{ item: Category; depth: number; hasChildren: boolean }> =
      [];
    const walk = (parentId: string | null, depth: number) => {
      const key = parentId ?? "__root__";
      const nodes = childrenByCategory.get(key) ?? [];
      for (const node of nodes) {
        if (!(categoryBranchMatches.get(node.id) ?? false)) {
          continue;
        }
        const hasChildren = (childrenByCategory.get(node.id)?.length ?? 0) > 0;
        rows.push({ item: node, depth, hasChildren });
        const shouldExpand =
          categorySearchTerm.length > 0 || expandedCategoryIds.has(node.id);
        if (hasChildren && shouldExpand) {
          walk(node.id, depth + 1);
        }
      }
    };
    walk(null, 0);
    return rows;
  }, [
    categoryBranchMatches,
    categorySearchTerm.length,
    childrenByCategory,
    expandedCategoryIds,
  ]);

  const onTitleChange = (value: string) => {
    setFormState((prev) => {
      const next = { ...prev, title: value };
      if (!slugWasEdited) {
        next.slug = slugify(value);
      }
      return next;
    });
  };

  const onSave = async () => {
    setError(null);
    setSuccess(null);

    if (!formState.title.trim() || !formState.slug.trim()) {
      setError("Le titre et le slug sont obligatoires.");
      return;
    }
    if (!formState.description.trim() || !formState.shortDescription.trim()) {
      setError("La description complete et courte sont obligatoires.");
      return;
    }
    if (!formState.brandId) {
      setError("Veuillez choisir une marque.");
      return;
    }
    if (!formState.sku.trim()) {
      setError("Le SKU est obligatoire.");
      return;
    }

    const attributeTerms = Object.entries(selectedTermIdsByAttribute).flatMap(
      ([attributeId, termIds]) =>
        termIds.map((termId) => ({ attributeId, termId })),
    );

    const payload = {
      title: formState.title.trim(),
      slug: formState.slug.trim(),
      description: formState.description.trim(),
      shortDescription: formState.shortDescription.trim(),
      images,
      price: formState.price.trim() || "0",
      discount: formState.discount.trim() || "0",
      discountType: formState.discountType,
      tag: formState.tag.trim() || "-",
      sku: formState.sku.trim(),
      qty: formState.qty.trim() || "0",
      stockStatus: formState.stockStatus,
      allowBackorders: formState.allowBackorders,
      lowStockThreshold: formState.lowStockThreshold.trim() || "0",
      brandId: formState.brandId,
      taxId: formState.taxId || undefined,
      status: (isOnline ? "PUBLIC" : "DRAFT") as "PUBLIC" | "DRAFT",
      reference: formState.reference.trim() || null,
      metaTitle: formState.metaTitle.trim() || null,
      metaDescription: formState.metaDescription.trim() || null,
      metaKeywords: formState.metaKeywords.trim() || null,
      categoryIds: selectedCategoryIds,
      attributeTerms,
    };

    setSaving(true);
    try {
      if (productId) {
        await updateProduct(productId, payload);
        setSuccess("Produit mis a jour avec succes.");
        return;
      }

      await createProduct(payload);
      setSuccess("Produit cree avec succes.");
      setFormState({
        ...EMPTY_FORM,
        brandId: brands[0]?.id || "",
        taxId: taxes.find((tax) => tax.isDefault)?.id || taxes[0]?.id || "",
      });
      setSlugWasEdited(false);
      setSelectedCategoryIds([]);
      setSelectedTermIdsByAttribute({});
      setImages([]);
      setSelectedImageUrl(null);
      setCoverImageUrl(null);
      setDraftIsCoverChecked(false);
      setZoomImageUrl(null);
      setIsOnline(false);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Impossible de creer le produit.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <BlockStack gap="500">
      <Card>
        <InlineStack gap="300" blockAlign="center" wrap={false}>
          <Box width="100%">
            <TextField
              label=""
              labelHidden
              placeholder="Entrez le nom du produit"
              value={formState.title}
              onChange={onTitleChange}
              autoComplete="off"
            />
          </Box>
          <Box minWidth="180px">
            <Select
              label=""
              labelHidden
              options={[{ label: "Standard product", value: "standard" }]}
              value="standard"
              onChange={() => {}}
            />
          </Box>
          <Button
            icon={QuestionCircleIcon}
            accessibilityLabel="Aide sur le type de produit"
          />
          <Box minWidth="80px">
            <Select
              label=""
              labelHidden
              options={[{ label: "fr", value: "fr" }]}
              value="fr"
              onChange={() => {}}
            />
          </Box>
        </InlineStack>
      </Card>

      {error ? <Banner tone="critical" title={error} /> : null}
      {success ? <Banner tone="success" title={success} /> : null}

      <Card>
        <BlockStack gap="300">
          <Tabs
            tabs={tabs}
            selected={selectedTabIndex}
            onSelect={setSelectedTabIndex}
          />

          {selectedTabIndex === 0 ? (
            <BlockStack gap="300">
              <InlineGrid columns={{ xs: 1, md: "2fr 1fr" }} gap="400">
                <BlockStack gap="200">
                  {images.length === 0 ? (
                    <UnstyledButton onClick={() => setIsMediaPickerOpen(true)}>
                      <div
                        style={{
                          minHeight: "220px",
                          border: "1px dashed #b8c1cc",
                          borderRadius: "8px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: "#f6f6f7",
                          textAlign: "center",
                          padding: "18px",
                        }}>
                        <BlockStack gap="100">
                          <Text as="p" variant="bodyMd">
                            Deposez les images ici
                          </Text>
                          <Text as="p" variant="bodyMd" fontWeight="semibold">
                            ou selectionnez des fichiers
                          </Text>
                          <Text as="p" tone="subdued">
                            Format JPG, GIF ou PNG
                          </Text>
                        </BlockStack>
                      </div>
                    </UnstyledButton>
                  ) : (
                    <Box borderColor="border" borderRadius="200" padding="300">
                      <InlineGrid columns={{ xs: 1, md: "2fr 1fr" }} gap="300">
                        <InlineStack gap="300" wrap>
                          <UnstyledButton onClick={() => setIsMediaPickerOpen(true)}>
                            <div
                              style={{
                                width: 128,
                                height: 128,
                                border: "1px solid #b8c1cc",
                                borderRadius: "2px",
                                display: "grid",
                                placeItems: "center",
                                color: "#b8c1cc",
                                fontSize: "48px",
                                lineHeight: 1,
                                background: "#f6f6f7",
                              }}>
                              +
                            </div>
                          </UnstyledButton>
                          {images.map((url) => (
                            <button
                              key={url}
                              type="button"
                              onClick={() => setSelectedImageUrl(url)}
                              style={{
                                width: 128,
                                height: 128,
                                border:
                                  selectedImageUrl === url
                                    ? "2px solid #00a0d2"
                                    : "1px solid transparent",
                                padding: 0,
                                background: "transparent",
                                cursor: "pointer",
                                textAlign: "left",
                              }}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={url}
                                alt="Produit"
                                style={{
                                  width: 128,
                                  height: 98,
                                  objectFit: "contain",
                                  border: "1px solid #b8c1cc",
                                  borderBottom: "none",
                                  borderTopLeftRadius: 2,
                                  borderTopRightRadius: 2,
                                  display: "block",
                                }}
                              />
                              <div
                                style={{
                                  height: 30,
                                  background:
                                    coverImageUrl === url ? "#627b86" : "transparent",
                                  color: "white",
                                  textAlign: "center",
                                  fontSize: 14,
                                  padding: "6px 4px",
                                  border: "1px solid #b8c1cc",
                                  borderTop: "none",
                                  boxSizing: "border-box",
                                }}>
                                {coverImageUrl === url ? "Cover" : ""}
                              </div>
                            </button>
                          ))}
                        </InlineStack>

                        {selectedImageUrl ? (
                          <Box borderColor="border" borderRadius="200" padding="200">
                            <BlockStack gap="200">
                              <InlineStack align="space-between" blockAlign="center">
                                <Checkbox
                                  label="Image de couverture"
                                  checked={draftIsCoverChecked}
                                  onChange={setDraftIsCoverChecked}
                                />
                                <InlineStack gap="200">
                                  <Button
                                    variant="plain"
                                    icon={SearchIcon}
                                    onClick={() => setZoomImageUrl(selectedImageUrl)}>
                                    Zoomer
                                  </Button>
                                  <Button
                                    variant="plain"
                                    icon={XIcon}
                                    onClick={() => setSelectedImageUrl(null)}
                                    accessibilityLabel="Fermer"
                                  />
                                </InlineStack>
                              </InlineStack>
                              <InlineStack gap="200">
                                <Button
                                  variant="primary"
                                  onClick={() => {
                                    if (draftIsCoverChecked) {
                                      setCoverImageUrl(selectedImageUrl);
                                    } else if (coverImageUrl === selectedImageUrl) {
                                      const fallback =
                                        images.find((img) => img !== selectedImageUrl) ?? null;
                                      setCoverImageUrl(fallback);
                                    }
                                  }}>
                                  Enregistrer les parametres image
                                </Button>
                                <Button
                                  tone="critical"
                                  onClick={() => {
                                    setImages((prev) =>
                                      prev.filter((img) => img !== selectedImageUrl),
                                    );
                                    setSelectedImageUrl(null);
                                  }}>
                                  Supprimer
                                </Button>
                              </InlineStack>
                            </BlockStack>
                          </Box>
                        ) : null}
                      </InlineGrid>
                    </Box>
                  )}
                </BlockStack>

                <BlockStack gap="300">
                  <ChoiceList
                    title="Combinaisons"
                    selected={[combinationMode]}
                    choices={[
                      { label: "Produit simple", value: "simple" },
                      {
                        label: "Produit avec combinaisons",
                        value: "with_combinations",
                      },
                    ]}
                    onChange={(values) =>
                      setCombinationMode(
                        (values[0] as "simple" | "with_combinations") ?? "simple",
                      )
                    }
                  />
                  <TextField
                    label="Reference"
                    value={formState.reference}
                    onChange={(value) =>
                      setFormState((prev) => ({ ...prev, reference: value }))
                    }
                    autoComplete="off"
                  />
                  <TextField
                    label="Quantite"
                    value={formState.qty}
                    onChange={(value) => setFormState((prev) => ({ ...prev, qty: value }))}
                    autoComplete="off"
                  />
                  <InlineGrid columns={2} gap="200">
                    <TextField
                      label="Tax excluded"
                      value={formState.price}
                      onChange={(value) =>
                        setFormState((prev) => ({ ...prev, price: value }))
                      }
                      prefix="€"
                      autoComplete="off"
                    />
                    <TextField
                      label="Tax included"
                      value={priceTaxIncluded.toFixed(3)}
                      prefix="€"
                      disabled
                      autoComplete="off"
                    />
                  </InlineGrid>
                  <Select
                    label="Tax rule"
                    options={
                      taxOptions.length
                        ? taxOptions
                        : [{ label: "Aucune regle de taxe", value: "" }]
                    }
                    value={formState.taxId}
                    onChange={(value) =>
                      setFormState((prev) => ({ ...prev, taxId: value }))
                    }
                  />
                </BlockStack>
              </InlineGrid>

              <Divider />

              <InlineGrid columns={{ xs: 1, md: "2fr 1fr" }} gap="300">
                <BlockStack gap="200">
                  <Tabs
                    tabs={basicEditorTabs}
                    selected={selectedBasicEditorTab}
                    onSelect={setSelectedBasicEditorTab}
                  />
                  {selectedBasicEditorTab === 0 ? (
                    <RichTextEditor
                      label="Resume"
                      value={formState.shortDescription}
                      onChange={(value) =>
                        setFormState((prev) => ({ ...prev, shortDescription: value }))
                      }
                      placeholder="Le resume apparait en haut de la fiche produit et dans les listes."
                      minHeight={150}
                    />
                  ) : (
                    <RichTextEditor
                      label="Description"
                      value={formState.description}
                      onChange={(value) =>
                        setFormState((prev) => ({ ...prev, description: value }))
                      }
                      placeholder="Ajoutez une description detaillee de votre produit."
                      minHeight={220}
                    />
                  )}
                </BlockStack>

                <BlockStack gap="200">
                  <TextField
                    label="Slug"
                    value={formState.slug}
                    onChange={(value) => {
                      setSlugWasEdited(true);
                      setFormState((prev) => ({ ...prev, slug: slugify(value) }));
                    }}
                    autoComplete="off"
                  />
                  <TextField
                    label="SKU"
                    value={formState.sku}
                    onChange={(value) => setFormState((prev) => ({ ...prev, sku: value }))}
                    autoComplete="off"
                  />
                  <Select
                    label="Marque"
                    options={
                      brandOptions.length
                        ? brandOptions
                        : [{ label: "Aucune marque", value: "" }]
                    }
                    value={formState.brandId}
                    onChange={(value) =>
                      setFormState((prev) => ({ ...prev, brandId: value }))
                    }
                    disabled={loadingRefs || brandOptions.length === 0}
                  />
                  <BlockStack gap="150">
                    <Text as="p" variant="bodyMd" fontWeight="medium">
                      Categories
                    </Text>
                    <Box borderColor="border" borderRadius="200" padding="200">
                      <BlockStack gap="200">
                        <TextField
                          label=""
                          labelHidden
                          placeholder="Search categories"
                          value={categorySearch}
                          onChange={setCategorySearch}
                          autoComplete="off"
                        />
                        <Text as="p" variant="bodySm" fontWeight="medium">
                          ASSOCIATED CATEGORIES
                        </Text>
                        <InlineStack gap="100" wrap>
                          {selectedCategoryIds.length === 0 ? (
                            <Text as="span" tone="subdued">
                              Aucune categorie
                            </Text>
                          ) : (
                            selectedCategoryIds.map((id) => {
                              const category = categoriesById.get(id);
                              if (!category) return null;
                              return (
                                <Button
                                  key={id}
                                  size="slim"
                                  onClick={() =>
                                    setSelectedCategoryIds((prev) =>
                                      prev.filter((value) => value !== id),
                                    )
                                  }>
                                  {`${category.title} x`}
                                </Button>
                              );
                            })
                          )}
                        </InlineStack>
                        <InlineStack align="space-between">
                          <Button
                            size="micro"
                            onClick={() =>
                              setExpandedCategoryIds(new Set(categories.map((item) => item.id)))
                            }>
                            Deplier
                          </Button>
                          <Button size="micro" onClick={() => setExpandedCategoryIds(new Set())}>
                            Reduire
                          </Button>
                        </InlineStack>
                        <BlockStack gap="100">
                          {categoryRows.map(({ item, depth, hasChildren }) => {
                            const checked = selectedCategoryIds.includes(item.id);
                            return (
                              <div
                                key={item.id}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "8px",
                                  marginInlineStart: `${String(depth * 18)}px`,
                                }}>
                                {hasChildren ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setExpandedCategoryIds((prev) => {
                                        const next = new Set(prev);
                                        if (next.has(item.id)) next.delete(item.id);
                                        else next.add(item.id);
                                        return next;
                                      })
                                    }
                                    style={{
                                      border: "none",
                                      background: "transparent",
                                      cursor: "pointer",
                                      color: "#6d7175",
                                      padding: 0,
                                    }}
                                    aria-label="Expand category">
                                    {expandedCategoryIds.has(item.id) || categorySearchTerm
                                      ? "⌄"
                                      : "›"}
                                  </button>
                                ) : (
                                  <span style={{ color: "#c9cccf" }}>•</span>
                                )}
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(event) =>
                                    setSelectedCategoryIds((prev) => {
                                      if (event.target.checked) {
                                        return prev.includes(item.id)
                                          ? prev
                                          : [...prev, item.id];
                                      }
                                      return prev.filter((value) => value !== item.id);
                                    })
                                  }
                                />
                                <Text as="span">{item.title}</Text>
                              </div>
                            );
                          })}
                        </BlockStack>
                      </BlockStack>
                    </Box>
                  </BlockStack>
                </BlockStack>
              </InlineGrid>
            </BlockStack>
          ) : null}
          {selectedTabIndex === 1 ? (
            <BlockStack gap="300">
              <InlineGrid columns={2} gap="200">
                <TextField
                  label="Quantite"
                  value={formState.qty}
                  onChange={(value) =>
                    setFormState((prev) => ({ ...prev, qty: value }))
                  }
                  autoComplete="off"
                />
                <TextField
                  label="Seuil stock bas"
                  value={formState.lowStockThreshold}
                  onChange={(value) =>
                    setFormState((prev) => ({
                      ...prev,
                      lowStockThreshold: value,
                    }))
                  }
                  autoComplete="off"
                />
              </InlineGrid>
              <Select
                label="Statut stock"
                options={[
                  { label: "En stock", value: "instock" },
                  { label: "Rupture", value: "outofstock" },
                ]}
                value={formState.stockStatus}
                onChange={(value) =>
                  setFormState((prev) => ({ ...prev, stockStatus: value }))
                }
              />
              <Select
                label="Backorders"
                options={[
                  { label: "Non", value: "no" },
                  { label: "Oui", value: "yes" },
                ]}
                value={formState.allowBackorders}
                onChange={(value) =>
                  setFormState((prev) => ({ ...prev, allowBackorders: value }))
                }
              />
            </BlockStack>
          ) : null}

          {selectedTabIndex === 2 ? (
            <BlockStack gap="200">
              <Text as="h3" variant="headingMd">
                Livraison
              </Text>
              <Text as="p" tone="subdued">
                Le module livraison sera branche ici (poids, dimensions, classes
                de livraison...).
              </Text>
            </BlockStack>
          ) : null}

          {selectedTabIndex === 3 ? (
            <BlockStack gap="300">
              <Text as="h3" variant="headingMd">
                Price
              </Text>
              <InlineGrid columns={2} gap="200">
                <TextField
                  label="Tax excluded"
                  value={formState.price}
                  onChange={(value) =>
                    setFormState((prev) => ({ ...prev, price: value }))
                  }
                  prefix="€"
                  autoComplete="off"
                />
                <TextField
                  label="Tax included"
                  value={priceTaxIncluded.toFixed(3)}
                  prefix="€"
                  disabled
                  autoComplete="off"
                />
              </InlineGrid>
              <Select
                label="Tax rule"
                options={
                  taxOptions.length
                    ? taxOptions
                    : [{ label: "Aucune regle de taxe", value: "" }]
                }
                value={formState.taxId}
                onChange={(value) =>
                  setFormState((prev) => ({ ...prev, taxId: value }))
                }
              />
              <Text as="p" tone="subdued">
                Advanced settings in Pricing
              </Text>

              <Divider />

              <InlineGrid columns={2} gap="200">
                <TextField
                  label="Remise"
                  value={formState.discount}
                  onChange={(value) =>
                    setFormState((prev) => ({ ...prev, discount: value }))
                  }
                  autoComplete="off"
                />
              </InlineGrid>
              <Select
                label="Type remise"
                options={[
                  { label: "Fixe", value: "fixed" },
                  { label: "Pourcentage", value: "percent" },
                ]}
                value={formState.discountType}
                onChange={(value) =>
                  setFormState((prev) => ({ ...prev, discountType: value }))
                }
              />
              <TextField
                label="Tag"
                value={formState.tag}
                onChange={(value) =>
                  setFormState((prev) => ({ ...prev, tag: value }))
                }
                autoComplete="off"
              />
            </BlockStack>
          ) : null}

          {selectedTabIndex === 4 ? (
            <BlockStack gap="300">
              <TextField
                label="Meta titre"
                value={formState.metaTitle}
                onChange={(value) =>
                  setFormState((prev) => ({ ...prev, metaTitle: value }))
                }
                autoComplete="off"
              />
              <TextField
                label="Meta description"
                value={formState.metaDescription}
                onChange={(value) =>
                  setFormState((prev) => ({ ...prev, metaDescription: value }))
                }
                multiline={2}
                autoComplete="off"
              />
              <TextField
                label="Meta keywords"
                value={formState.metaKeywords}
                onChange={(value) =>
                  setFormState((prev) => ({ ...prev, metaKeywords: value }))
                }
                autoComplete="off"
              />
            </BlockStack>
          ) : null}

          {selectedTabIndex === 5 ? (
            <BlockStack gap="300">
              <Text as="h3" variant="headingMd">
                Attributs et termes
              </Text>
              {attributes.length === 0 ? (
                <Text as="p" tone="subdued">
                  Aucun attribut disponible.
                </Text>
              ) : (
                attributes.map((attribute) => {
                  const termChoices =
                    attribute.terms?.map((term) => ({
                      label: term.name,
                      value: term.id,
                    })) ?? [];
                  if (termChoices.length === 0) {
                    return null;
                  }
                  return (
                    <Box key={attribute.id}>
                      <ChoiceList
                        title={attribute.name}
                        allowMultiple
                        choices={termChoices}
                        selected={
                          selectedTermIdsByAttribute[attribute.id] ?? []
                        }
                        onChange={(selected) =>
                          setSelectedTermIdsByAttribute((prev) => ({
                            ...prev,
                            [attribute.id]: selected,
                          }))
                        }
                      />
                    </Box>
                  );
                })
              )}
            </BlockStack>
          ) : null}
        </BlockStack>
      </Card>

      <Box paddingBlockEnd="2000" />

      <MediaPickerDialog
        open={isMediaPickerOpen}
        multiple
        selectedUrls={images}
        onClose={() => setIsMediaPickerOpen(false)}
        onSelect={(item) => {
          setImages((prev) =>
            prev.includes(item.url) ? prev : [...prev, item.url],
          );
          setIsMediaPickerOpen(false);
        }}
        onSelectMany={(items) => {
          setImages((prev) => {
            const next = new Set(prev);
            for (const item of items) {
              next.add(item.url);
            }
            return Array.from(next);
          });
          setIsMediaPickerOpen(false);
        }}
      />

      <Modal
        open={Boolean(zoomImageUrl)}
        onClose={() => setZoomImageUrl(null)}
        title="Apercu image"
        size="large">
        <Modal.Section>
          <div
            style={{
              minHeight: 420,
              display: "grid",
              placeItems: "center",
              background: "#ffffff",
            }}>
            {zoomImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={zoomImageUrl}
                alt="Zoom produit"
                style={{
                  maxWidth: "100%",
                  maxHeight: "72vh",
                  objectFit: "contain",
                }}
              />
            ) : null}
          </div>
        </Modal.Section>
      </Modal>

      <div
        className="product-footer-bar"
        style={{
          position: "fixed",
          left: "var(--pc-frame-offset, 0px)",
          width: "calc(100% - var(--pc-frame-offset, 0px))",
          bottom: 0,
          zIndex: 50,
          background: "#f1f2f3",
          borderTop: "1px solid #c3c7cc",
          padding: "10px 22px",
        }}>
        <InlineStack align="space-between" blockAlign="center">
          <InlineStack gap="400" blockAlign="center">
            <Button variant="plain" icon={XIcon} accessibilityLabel="Supprimer" />
            <Button variant="primary">Preview</Button>
            <button
              type="button"
              onClick={() => setIsOnline((prev) => !prev)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                border: "none",
                background: "transparent",
                padding: 0,
                cursor: "pointer",
              }}>
              <Text as="span" variant="bodyMd" fontWeight="medium">
                {isOnline ? "En ligne" : "Hors ligne"}
              </Text>
              <div
                style={{
                  width: 52,
                  height: 30,
                  borderRadius: 999,
                  border: "2px solid #8fb2c3",
                  background: isOnline ? "#2bb2c8" : "#ecd9a9",
                  position: "relative",
                }}>
                <div
                  style={{
                    position: "absolute",
                    left: isOnline ? 22 : -2,
                    top: -2,
                    width: 30,
                    height: 30,
                    borderRadius: "50%",
                    border: "2px solid #8fb2c3",
                    background: "#eef4f7",
                    color: isOnline ? "#2bb2c8" : "#7f8b93",
                    display: "grid",
                    placeItems: "center",
                    fontSize: 20,
                    lineHeight: 1,
                    transition: "left 180ms ease",
                  }}>
                  {isOnline ? "✓" : "×"}
                </div>
              </div>
            </button>
          </InlineStack>
          <InlineStack gap="200">
            <Button
              variant="primary"
              onClick={onSave}
              loading={saving}
              disabled={loadingRefs || loadingProduct || saving}>
              Save
            </Button>
            <Button>Duplicate</Button>
            <Button>Go to catalog</Button>
            <Button>Add new product</Button>
          </InlineStack>
        </InlineStack>
      </div>
      <style jsx>{`
        @media (min-width: 48em) {
          .product-footer-bar {
            left: calc(
              var(--pg-layout-width-nav-base, 0px) + var(--pc-frame-offset, 0px)
            ) !important;
            width: calc(
              100% - var(--pg-layout-width-nav-base, 0px) -
                var(--pc-frame-offset, 0px)
            ) !important;
          }
        }
      `}</style>
    </BlockStack>
  );
}
