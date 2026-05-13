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
import {
  DeleteIcon,
  EditIcon,
  QuestionCircleIcon,
  SearchIcon,
  XIcon,
} from "@shopify/polaris-icons";
import { Check, ChevronDown, GripVertical, Plus, X } from "lucide-react";

import { MediaPickerDialog } from "@/components/admin/media-picker-dialog";
import { RichTextEditor } from "@/components/admin/rich-text-editor";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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

type DraftVariantOption = {
  attributeId: string;
  attributeName: string;
  termId: string;
  termName: string;
};

type DraftVariant = {
  id: string;
  sku: string;
  impactPrice: string;
  price: string;
  qty: string;
  stockStatus: string;
  image: string;
  isActive: boolean;
  options: DraftVariantOption[];
};

const NEW_ATTRIBUTE_EDITOR_ID = "__new_attribute_editor__";

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function normalizeSearchValue(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
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
  const [variants, setVariants] = useState<DraftVariant[]>([]);
  const [combinationQuery, setCombinationQuery] = useState("");
  const [combinationAttributeSearch, setCombinationAttributeSearch] =
    useState("");
  const [attributeEditorId, setAttributeEditorId] = useState<string | null>(
    null,
  );
  const [attributePickerOpen, setAttributePickerOpen] = useState(false);
  const [attributePickerSearch, setAttributePickerSearch] = useState("");
  const [termPickerOpen, setTermPickerOpen] = useState(false);
  const [termPickerSearch, setTermPickerSearch] = useState("");
  const [selectedVariantIds, setSelectedVariantIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [bulkAction, setBulkAction] = useState("");
  const [expandedVariantIds, setExpandedVariantIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [defaultVariantId, setDefaultVariantId] = useState<string | null>(null);

  const makeVariantId = () => {
    if (typeof globalThis.crypto?.randomUUID === "function") {
      return globalThis.crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  };

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
        const basePrice = Number(product.price ?? "0");
        const basePriceSafe = Number.isFinite(basePrice) ? basePrice : 0;
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

        const combinaisons = product.combinaisons ?? [];
        if (combinaisons.length > 0) {
          setCombinationMode("with_combinations");
          const defaultCombo =
            combinaisons.find((c) => c.isDefault) ?? combinaisons[0];
          setDefaultVariantId(defaultCombo?.id ?? null);
          setVariants(
            combinaisons.map((combo) => {
              const finalPrice = Number(combo.price ?? product.price ?? "0");
              const finalPriceSafe = Number.isFinite(finalPrice) ? finalPrice : basePriceSafe;
              const impact = finalPriceSafe - basePriceSafe;
              return {
                id: combo.id ?? makeVariantId(),
                sku: combo.sku ?? "",
                impactPrice: impact.toFixed(2),
                price: finalPriceSafe.toFixed(2),
                qty: combo.qty ?? "0",
                stockStatus: combo.stockStatus ?? "instock",
                image: combo.image ?? "",
                isActive: combo.isActive ?? true,
                options: (combo.options ?? []).map((opt) => ({
                  attributeId: opt.attributeId,
                  attributeName: opt.attributeName,
                  termId: opt.termId,
                  termName: opt.termName,
                })),
              };
            }),
          );
        } else {
          setCombinationMode("simple");
          setVariants([]);
        }
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
    () => {
      const base = [{ id: "basic", content: "Parametres de base" }];
      if (combinationMode === "with_combinations") {
        base.push({ id: "combinations", content: "Combinaisons" });
      } else {
        base.push({ id: "qty", content: "Quantites" });
      }

      base.push(
        { id: "shipping", content: "Livraison" },
        { id: "pricing", content: "Tarification" },
        { id: "seo", content: "SEO" },
        { id: "attributes", content: "Attributs" },
        { id: "options", content: "Options" },
      );

      return base;
    },
    [combinationMode],
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

  useEffect(() => {
    const selectedTabId = tabs[selectedTabIndex]?.id ?? "basic";
    if (combinationMode === "simple" && selectedTabId === "combinations") {
      setSelectedTabIndex(0);
    }
  }, [combinationMode, selectedTabIndex, tabs]);

  const attributesById = useMemo(
    () => new Map(attributes.map((item) => [item.id, item])),
    [attributes],
  );

  const termById = useMemo(() => {
    const map = new Map<string, { id: string; name: string; attributeId: string }>();
    for (const attribute of attributes) {
      for (const term of attribute.terms ?? []) {
        map.set(term.id, { id: term.id, name: term.name, attributeId: attribute.id });
      }
    }
    return map;
  }, [attributes]);

  const sortedAttributesForCombinations = useMemo(() => {
    const parseOptionLabel = (name: string) => {
      const trimmed = name.trim();
      const match = /^option(?:\s+(\d+))?$/i.exec(trimmed);
      if (!match) return null;
      const n = match[1] ? Number(match[1]) : 1;
      return Number.isFinite(n) ? n : 1;
    };

    return [...attributes].sort((a, b) => {
      const an = parseOptionLabel(a.name);
      const bn = parseOptionLabel(b.name);
      if (an !== null || bn !== null) {
        if (an === null) return 1;
        if (bn === null) return -1;
        return an - bn;
      }
      return a.name.localeCompare(b.name, "fr", { numeric: true, sensitivity: "base" });
    });
  }, [attributes]);

  const combinationAttributeSearchTerm = normalizeSearchValue(
    combinationAttributeSearch,
  );

  const filteredAttributesForCombinations = useMemo(() => {
    if (!combinationAttributeSearchTerm) {
      return sortedAttributesForCombinations.map((attribute) => ({
        attribute,
        terms: attribute.terms ?? [],
      }));
    }

    return sortedAttributesForCombinations
      .map((attribute) => {
        const terms = attribute.terms ?? [];
        const attributeMatches = normalizeSearchValue(attribute.name).includes(
          combinationAttributeSearchTerm,
        );
        const matchingTerms = attributeMatches
          ? terms
          : terms.filter((term) =>
              normalizeSearchValue(term.name).includes(
                combinationAttributeSearchTerm,
              ),
            );

        return {
          attribute,
          terms: matchingTerms,
        };
      })
      .filter(({ terms }) => terms.length > 0);
  }, [combinationAttributeSearchTerm, sortedAttributesForCombinations]);

  const selectedAttributeRows = useMemo(
    () =>
      sortedAttributesForCombinations.filter(
        (attribute) =>
          (selectedTermIdsByAttribute[attribute.id] ?? []).length > 0,
      ),
    [selectedTermIdsByAttribute, sortedAttributesForCombinations],
  );

  const attributePickerSearchTerm = normalizeSearchValue(attributePickerSearch);
  const selectableAttributes = useMemo(
    () =>
      sortedAttributesForCombinations.filter((attribute) => {
        const hasTerms = (attribute.terms ?? []).length > 0;
        const alreadySelected =
          (selectedTermIdsByAttribute[attribute.id] ?? []).length > 0;
        const isCurrentEditor = attribute.id === attributeEditorId;
        if (alreadySelected && !isCurrentEditor) return false;
        if (!hasTerms) return false;
        if (!attributePickerSearchTerm) return true;
        return normalizeSearchValue(attribute.name).includes(
          attributePickerSearchTerm,
        );
      }),
    [
      attributeEditorId,
      attributePickerSearchTerm,
      selectedTermIdsByAttribute,
      sortedAttributesForCombinations,
    ],
  );

  const editingAttribute =
    attributeEditorId && attributeEditorId !== NEW_ATTRIBUTE_EDITOR_ID
      ? attributesById.get(attributeEditorId) ?? null
      : null;
  const editingAttributeTerms = editingAttribute?.terms ?? [];
  const selectedEditingTermIds = editingAttribute
    ? selectedTermIdsByAttribute[editingAttribute.id] ?? []
    : [];
  const termPickerSearchTerm = normalizeSearchValue(termPickerSearch);
  const visibleEditingTerms = termPickerSearchTerm
    ? editingAttributeTerms.filter((term) =>
        normalizeSearchValue(term.name).includes(termPickerSearchTerm),
      )
    : editingAttributeTerms;

  const parseCombinationQuery = (query: string) => {
    const next: Record<string, string[]> = {};
    const chunks = query
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean);
    if (chunks.length === 0) return null;

    const attributesByName = new Map<string, Attribute>();
    for (const attribute of attributes) {
      attributesByName.set(attribute.name.trim().toLowerCase(), attribute);
    }

    for (const chunk of chunks) {
      const [rawName, rawValues] = chunk.split(":");
      if (!rawName || !rawValues) {
        return { error: `Format invalide: "${chunk}". Exemple: "Taille: all; Couleur: rouge"` };
      }
      const nameKey = rawName.trim().toLowerCase();
      const attribute = attributesByName.get(nameKey);
      if (!attribute) {
        return { error: `Attribut introuvable: "${rawName.trim()}"` };
      }

      const values = rawValues
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
      if (values.length === 0) {
        return { error: `Aucune valeur pour "${rawName.trim()}"` };
      }

      const allTerms = attribute.terms ?? [];
      if (values.some((v) => v.toLowerCase() === "all")) {
        next[attribute.id] = allTerms.map((t) => t.id);
        continue;
      }

      const termIds: string[] = [];
      for (const value of values) {
        const term =
          allTerms.find((t) => t.name.toLowerCase() === value.toLowerCase()) ??
          allTerms.find((t) => t.name.toLowerCase().includes(value.toLowerCase()));
        if (!term) {
          return {
            error: `Valeur "${value}" introuvable pour l'attribut "${attribute.name}"`,
          };
        }
        termIds.push(term.id);
      }
      next[attribute.id] = Array.from(new Set(termIds));
    }

    return { selected: next };
  };

  const generateVariantsFromSelections = () => {
    setError(null);

    const trimmedQuery = combinationQuery.trim();
    if (trimmedQuery) {
      const parsed = parseCombinationQuery(trimmedQuery);
      if (parsed && "error" in parsed) {
        setError(parsed.error);
        return;
      }
      if (parsed && "selected" in parsed) {
        setSelectedTermIdsByAttribute((prev) => ({ ...prev, ...parsed.selected }));
      }
    }

    const attributesForVariants = Object.entries(selectedTermIdsByAttribute)
      .map(([attributeId, termIds]) => ({
        attributeId,
        termIds: termIds.filter(Boolean),
      }))
      .filter((entry) => entry.termIds.length > 0);

    if (attributesForVariants.length === 0) {
      setError(
        "Selectionnez des valeurs dans la colonne de droite (ex: Couleur, Taille), puis cliquez sur Generer.",
      );
      return;
    }

    const optionGroups: DraftVariantOption[][] = attributesForVariants.map(
      ({ attributeId, termIds }) => {
        const attributeName = attributesById.get(attributeId)?.name ?? "Attribut";
        return termIds
          .map((termId) => {
            const term = termById.get(termId);
            if (!term) return null;
            return {
              attributeId,
              attributeName,
              termId,
              termName: term.name,
            } satisfies DraftVariantOption;
          })
          .filter((value): value is DraftVariantOption => Boolean(value));
      },
    );

    const cartesian = (groups: DraftVariantOption[][]): DraftVariantOption[][] =>
      groups.reduce<DraftVariantOption[][]>(
        (acc, group) => {
          const next: DraftVariantOption[][] = [];
          for (const prev of acc) {
            for (const option of group) {
              next.push([...prev, option]);
            }
          }
          return next;
        },
        [[]],
      );

    const combos = cartesian(optionGroups).filter((options) => options.length > 0);

    setVariants(
      combos.map((options) => ({
        id: makeVariantId(),
        sku: "",
        impactPrice: "0",
        price: formState.price || "0",
        qty: "0",
        stockStatus: formState.stockStatus || "instock",
        image: "",
        isActive: true,
        options,
      })),
    );
    setSelectedVariantIds(new Set());
    setExpandedVariantIds(new Set());
    setDefaultVariantId(null);
  };

  const allVariantsSelected =
    variants.length > 0 && selectedVariantIds.size === variants.length;

  const toggleAllVariants = (checked: boolean) => {
    setSelectedVariantIds(() => {
      if (!checked) return new Set();
      return new Set(variants.map((v) => v.id));
    });
  };

  const toggleVariant = (id: string, checked: boolean) => {
    setSelectedVariantIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const applyBulkAction = (action: string) => {
    if (!action) return;
    const selectedIds = new Set(selectedVariantIds);
    if (selectedIds.size === 0) {
      setBulkAction("");
      return;
    }

    if (action === "delete") {
      setVariants((prev) => prev.filter((v) => !selectedIds.has(v.id)));
      setSelectedVariantIds(new Set());
      setExpandedVariantIds((prev) => {
        const next = new Set(prev);
        for (const id of selectedIds) next.delete(id);
        return next;
      });
      setDefaultVariantId((prev) => (prev && selectedIds.has(prev) ? null : prev));
      setBulkAction("");
      return;
    }

    if (action === "activate" || action === "deactivate") {
      const value = action === "activate";
      setVariants((prev) =>
        prev.map((v) => (selectedIds.has(v.id) ? { ...v, isActive: value } : v)),
      );
      setBulkAction("");
      return;
    }

    setBulkAction("");
  };

  useEffect(() => {
    if (variants.length === 0) return;
    setVariants((prev) =>
      prev.map((v) => {
        const impact = Number(v.impactPrice || "0");
        const nextFinal = priceTaxExcluded + (Number.isFinite(impact) ? impact : 0);
        return { ...v, price: nextFinal.toFixed(2) };
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [priceTaxExcluded]);
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
      combinaisons:
        combinationMode === "with_combinations"
          ? variants.map((variant) => ({
              sku: variant.sku.trim() || undefined,
              price: variant.price.trim() || undefined,
              qty: variant.qty.trim() || undefined,
              stockStatus: variant.stockStatus || undefined,
              image: variant.image.trim() || undefined,
              isActive: variant.isActive,
              isDefault: defaultVariantId === variant.id,
              options: variant.options.map((opt) => ({
                attributeId: opt.attributeId,
                attributeName: opt.attributeName,
                termId: opt.termId,
                termName: opt.termName,
              })),
            }))
          : undefined,
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
          {(() => {
            const selectedTabId = tabs[selectedTabIndex]?.id ?? "basic";

          return (
            <>
          {selectedTabId === "basic" ? (
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
                  {combinationMode === "simple" ? (
                    <TextField
                      label="Quantite"
                      value={formState.qty}
                      onChange={(value) =>
                        setFormState((prev) => ({ ...prev, qty: value }))
                      }
                      autoComplete="off"
                    />
                  ) : null}
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
          {selectedTabId === "qty" ? (
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

          {selectedTabId === "shipping" ? (
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

          {selectedTabId === "pricing" ? (
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

          {selectedTabId === "seo" ? (
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

          {selectedTabId === "attributes" ? (
            <BlockStack gap="300">
              <div className="flex items-center justify-between gap-3">
                <Text as="h3" variant="headingMd">
                  Attributes
                </Text>
                <Button url="/admin_ben/products/attributs">+ Create attribute</Button>
              </div>

              {attributes.length === 0 ? (
                <Text as="p" tone="subdued">
                  Aucun attribut disponible.
                </Text>
              ) : (
                <div className="overflow-visible rounded-lg border border-border bg-[#e9e9e9]">
                  <div className="space-y-0">
                    {selectedAttributeRows
                      .filter((attribute) => attribute.id !== attributeEditorId)
                      .map((attribute) => {
                        const selectedTermIds =
                          selectedTermIdsByAttribute[attribute.id] ?? [];
                        const selectedTermNames = selectedTermIds
                          .map((termId) => termById.get(termId)?.name)
                          .filter((value): value is string => Boolean(value));

                        return (
                          <button
                            key={attribute.id}
                            type="button"
                            className="flex w-full items-start gap-4 border-b border-border/60 px-5 py-5 text-left transition hover:bg-black/[0.03]"
                            onClick={() => {
                              setAttributeEditorId(attribute.id);
                              setAttributePickerOpen(false);
                              setTermPickerOpen(false);
                              setAttributePickerSearch("");
                              setTermPickerSearch("");
                            }}
                          >
                            <GripVertical className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                            <div className="min-w-0 space-y-2">
                              <p className="text-sm font-semibold text-foreground">
                                {attribute.name}
                              </p>
                              <span className="inline-flex max-w-full rounded-sm bg-white px-3 py-1 text-sm text-foreground shadow-xs">
                                <span className="truncate">
                                  {selectedTermNames.join(", ")}
                                </span>
                              </span>
                            </div>
                          </button>
                        );
                      })}

                    {attributeEditorId ? (
                      <div className="relative z-30 border-b border-border/60 px-5 py-5">
                        <div className="grid gap-4 md:grid-cols-[18px_1fr]">
                          <GripVertical className="mt-5 size-4 text-muted-foreground" />
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <label className="text-sm font-semibold text-foreground">
                                Option name
                              </label>
                              <div className="relative">
                                <button
                                  type="button"
                                  className="flex h-9 w-full items-center justify-between rounded-md border border-border bg-white px-3 text-left text-sm text-foreground shadow-xs"
                                  onClick={() =>
                                    setAttributePickerOpen((open) => !open)
                                  }
                                >
                                  <span
                                    className={
                                      editingAttribute
                                        ? "truncate"
                                        : "truncate text-muted-foreground"
                                    }
                                  >
                                    {editingAttribute?.name ??
                                      "Select an attribute..."}
                                  </span>
                                  <ChevronDown className="size-4 text-muted-foreground" />
                                </button>

                                {attributePickerOpen ? (
                                  <div className="absolute left-0 right-0 top-full z-80 overflow-hidden rounded-b-md border border-t-0 border-border bg-white shadow-lg">
                                    <input
                                      value={attributePickerSearch}
                                      onChange={(event) =>
                                        setAttributePickerSearch(
                                          event.target.value,
                                        )
                                      }
                                      placeholder="Search..."
                                      className="h-9 w-full border-b border-border px-3 text-sm outline-none"
                                    />
                                    <div className="max-h-56 overflow-y-auto py-2">
                                      {selectableAttributes.length === 0 ? (
                                        <p className="px-4 py-2 text-sm text-muted-foreground">
                                          Aucun attribut trouve.
                                        </p>
                                      ) : (
                                        selectableAttributes.map((attribute) => (
                                          <button
                                            key={attribute.id}
                                            type="button"
                                            className="block w-full px-9 py-2 text-left text-sm transition hover:bg-muted"
                                            onClick={() => {
                                              setAttributeEditorId(attribute.id);
                                              setSelectedTermIdsByAttribute(
                                                (prev) => ({
                                                  ...prev,
                                                  [attribute.id]:
                                                    prev[attribute.id] ?? [],
                                                }),
                                              );
                                              setAttributePickerOpen(false);
                                              setAttributePickerSearch("");
                                              setTermPickerOpen(true);
                                            }}
                                          >
                                            {attribute.name}
                                          </button>
                                        ))
                                      )}
                                    </div>
                                  </div>
                                ) : null}
                              </div>
                            </div>

                            {editingAttribute ? (
                              <div className="space-y-3">
                                <div className="flex items-center justify-between gap-3">
                                  <label className="text-sm font-medium text-foreground">
                                    Option values
                                  </label>
                                  <button
                                    type="button"
                                    className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700"
                                    onClick={() =>
                                      setTermPickerOpen((open) => !open)
                                    }
                                  >
                                    <Plus className="size-4" />
                                    Add value
                                  </button>
                                </div>

                                {selectedEditingTermIds.length > 0 ? (
                                  <div className="flex flex-wrap gap-2">
                                    {selectedEditingTermIds.map((termId) => {
                                      const term = termById.get(termId);
                                      if (!term) return null;
                                      return (
                                        <span
                                          key={termId}
                                          className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-sm text-foreground shadow-xs"
                                        >
                                          {term.name}
                                          <button
                                            type="button"
                                            aria-label={`Remove ${term.name}`}
                                            onClick={() =>
                                              setSelectedTermIdsByAttribute(
                                                (prev) => ({
                                                  ...prev,
                                                  [editingAttribute.id]: (
                                                    prev[editingAttribute.id] ??
                                                    []
                                                  ).filter(
                                                    (id) => id !== termId,
                                                  ),
                                                }),
                                              )
                                            }
                                          >
                                            <X className="size-4" />
                                          </button>
                                        </span>
                                      );
                                    })}
                                  </div>
                                ) : null}

                                <div className="relative">
                                  <button
                                    type="button"
                                    className="flex h-9 w-full items-center justify-between rounded-md border border-border bg-white px-3 text-left text-sm text-foreground shadow-xs"
                                    onClick={() =>
                                      setTermPickerOpen((open) => !open)
                                    }
                                  >
                                    <span
                                      className={
                                        selectedEditingTermIds.length
                                          ? "truncate"
                                          : "truncate text-blue-900"
                                      }
                                    >
                                      {selectedEditingTermIds.length
                                        ? `${selectedEditingTermIds.length} selected`
                                        : "Select values..."}
                                    </span>
                                    <ChevronDown className="size-4 text-muted-foreground" />
                                  </button>

                                  {termPickerOpen ? (
                                    <div className="absolute left-0 right-0 top-full z-70 overflow-hidden rounded-b-md border border-t-0 border-border bg-white shadow-lg">
                                      <input
                                        value={termPickerSearch}
                                        onChange={(event) =>
                                          setTermPickerSearch(event.target.value)
                                        }
                                        placeholder="Search..."
                                        className="h-9 w-full border-b border-border px-3 text-sm outline-none"
                                      />
                                      <div className="max-h-56 overflow-y-auto py-2">
                                        {visibleEditingTerms.length === 0 ? (
                                          <p className="px-4 py-2 text-sm text-muted-foreground">
                                            Aucun terme trouve.
                                          </p>
                                        ) : (
                                          visibleEditingTerms.map((term) => {
                                            const checked =
                                              selectedEditingTermIds.includes(
                                                term.id,
                                              );
                                            return (
                                              <button
                                                key={term.id}
                                                type="button"
                                                className="flex w-full items-center gap-3 px-9 py-2 text-left text-sm transition hover:bg-muted"
                                                onClick={() =>
                                                  setSelectedTermIdsByAttribute(
                                                    (prev) => {
                                                      const current =
                                                        prev[
                                                          editingAttribute.id
                                                        ] ?? [];
                                                      const next = new Set(
                                                        current,
                                                      );
                                                      if (checked) {
                                                        next.delete(term.id);
                                                      } else {
                                                        next.add(term.id);
                                                      }
                                                      return {
                                                        ...prev,
                                                        [editingAttribute.id]:
                                                          Array.from(next),
                                                      };
                                                    },
                                                  )
                                                }
                                              >
                                                <span className="grid size-4 place-items-center rounded border border-border text-[10px]">
                                                  {checked ? (
                                                    <Check className="size-3" />
                                                  ) : null}
                                                </span>
                                                {term.name}
                                              </button>
                                            );
                                          })
                                        )}
                                      </div>
                                    </div>
                                  ) : null}
                                </div>

                                <div className="flex items-center gap-2 pt-1">
                                  <button
                                    type="button"
                                    className="h-8 rounded-md border border-border bg-white px-3 text-sm font-medium text-red-600 shadow-xs"
                                    onClick={() => {
                                      setSelectedTermIdsByAttribute((prev) => {
                                        const next = { ...prev };
                                        delete next[editingAttribute.id];
                                        return next;
                                      });
                                      setAttributeEditorId(null);
                                      setTermPickerOpen(false);
                                    }}
                                  >
                                    Delete
                                  </button>
                                  <button
                                    type="button"
                                    className="h-8 rounded-md bg-neutral-800 px-3 text-sm font-medium text-white shadow-xs"
                                    onClick={() => {
                                      setAttributeEditorId(null);
                                      setTermPickerOpen(false);
                                      setAttributePickerOpen(false);
                                    }}
                                  >
                                    Done
                                  </button>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <button
                    type="button"
                    className="flex min-h-11 w-full items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-blue-600 transition hover:bg-black/[0.03]"
                    onClick={() => {
                      setAttributeEditorId(NEW_ATTRIBUTE_EDITOR_ID);
                      setAttributePickerOpen(true);
                      setTermPickerOpen(false);
                      setAttributePickerSearch("");
                      setTermPickerSearch("");
                    }}
                  >
                    <Plus className="size-4" />
                    Add another option
                  </button>
                </div>
              )}
            </BlockStack>
          ) : null}

          {selectedTabId === "options" ? <div className="min-h-24" /> : null}

          {selectedTabId === "combinations" && combinationMode === "with_combinations" ? (
            <InlineGrid columns={{ xs: 1, md: "2fr 1fr" }} gap="300">
              <BlockStack gap="300">
                <Banner tone="info" title="Manage your product combinations">
                  <p>
                    Pour ajouter des combinaisons, selectionnez des valeurs d'attributs dans la
                    colonne de droite (Taille, Couleur, ...), puis cliquez sur “Generate”.
                  </p>
                  <p>
                    Vous pouvez aussi saisir une requete, ex: <em>Taille: all; Couleur: rouge</em>.
                  </p>
                </Banner>

                <InlineStack gap="200" blockAlign="center" wrap={false}>
                  <Box width="100%">
                    <TextField
                      label=""
                      labelHidden
                      placeholder={`Combine several attributes, e.g.: "Taille: all; Couleur: rouge".`}
                      value={combinationQuery}
                      onChange={setCombinationQuery}
                      autoComplete="off"
                    />
                  </Box>
                  <Button variant="primary" onClick={generateVariantsFromSelections}>
                    Generate
                  </Button>
                </InlineStack>

                <InlineStack gap="200" blockAlign="center" wrap={false}>
                  <Box width="100%">
                    <Select
                      label=""
                      labelHidden
                      options={[
                        { label: `Bulk actions (${selectedVariantIds.size}/${variants.length} selected)`, value: "" },
                        { label: "Activer", value: "activate" },
                        { label: "Desactiver", value: "deactivate" },
                        { label: "Supprimer", value: "delete" },
                      ]}
                      value={bulkAction}
                      onChange={(value) => {
                        setBulkAction(value);
                        applyBulkAction(value);
                      }}
                      disabled={variants.length === 0}
                    />
                  </Box>
                  <Button
                    tone="critical"
                    onClick={() => {
                      setVariants([]);
                      setSelectedVariantIds(new Set());
                    }}
                    disabled={variants.length === 0}>
                    Vider
                  </Button>
                </InlineStack>

                <Card>
                  <BlockStack gap="200">
                    <InlineGrid
                      columns={{ xs: 1, md: "auto auto 2fr 1fr 1fr 1fr auto auto" }}
                      gap="200">
                      <Checkbox
                        label=""
                        checked={allVariantsSelected}
                        onChange={toggleAllVariants}
                      />
                      <Text as="p" fontWeight="semibold">
                        Image
                      </Text>
                      <Text as="p" fontWeight="semibold">
                        Combinaison
                      </Text>
                      <Text as="p" fontWeight="semibold">
                        Impact (HT)
                      </Text>
                      <Text as="p" fontWeight="semibold">
                        Prix final (HT)
                      </Text>
                      <Text as="p" fontWeight="semibold">
                        Qté
                      </Text>
                      <Text as="p" fontWeight="semibold">
                        Actions
                      </Text>
                      <Text as="p" fontWeight="semibold">
                        Defaut
                      </Text>
                    </InlineGrid>

                    <Divider />

                    {variants.length === 0 ? (
                      <Box padding="400">
                        <Text as="p" tone="subdued">
                          Aucune combinaison.
                        </Text>
                      </Box>
                    ) : (
                      <BlockStack gap="200">
                        {variants.map((variant) => (
                          <Box key={variant.id} paddingBlock="100">
                            <InlineGrid
                              columns={{ xs: 1, md: "auto auto 2fr 1fr 1fr 1fr auto auto" }}
                              gap="200">
                              <Checkbox
                                label=""
                                checked={selectedVariantIds.has(variant.id)}
                                onChange={(checked) => toggleVariant(variant.id, checked)}
                              />
                              <div style={{ width: 42, height: 42 }}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={variant.image || coverImageUrl || images[0] || ""}
                                  alt="Variant"
                                  style={{
                                    width: 42,
                                    height: 42,
                                    objectFit: "cover",
                                    borderRadius: 4,
                                    border: "1px solid #e1e3e5",
                                    background: "#f6f6f7",
                                  }}
                                />
                              </div>
                              <Text as="p" variant="bodySm">
                                {variant.options
                                  .map((opt) => `${opt.attributeName} - ${opt.termName}`)
                                  .join(", ")}
                              </Text>

                              <TextField
                                label=""
                                labelHidden
                                value={variant.impactPrice}
                                onChange={(value) => {
                                  const impact = Number(value || "0");
                                  const final =
                                    priceTaxExcluded + (Number.isFinite(impact) ? impact : 0);
                                  setVariants((prev) =>
                                    prev.map((item) =>
                                      item.id === variant.id
                                        ? {
                                            ...item,
                                            impactPrice: value,
                                            price: final.toFixed(2),
                                          }
                                        : item,
                                    ),
                                  );
                                }}
                                prefix="€"
                                autoComplete="off"
                              />
                              <TextField
                                label=""
                                labelHidden
                                value={(() => {
                                  const parsed = Number(variant.price || "0");
                                  return Number.isFinite(parsed) ? parsed.toFixed(2) : "0.00";
                                })()}
                                readOnly
                                prefix="€"
                                autoComplete="off"
                              />
                              <TextField
                                label=""
                                labelHidden
                                value={variant.qty}
                                onChange={(value) =>
                                  setVariants((prev) =>
                                    prev.map((item) =>
                                      item.id === variant.id ? { ...item, qty: value } : item,
                                    ),
                                  )
                                }
                                autoComplete="off"
                              />
                              <InlineStack gap="100" blockAlign="center" wrap={false}>
                                <Button
                                  variant="plain"
                                  icon={EditIcon}
                                  accessibilityLabel="Editer"
                                  onClick={() =>
                                    setExpandedVariantIds((prev) => {
                                      const next = new Set(prev);
                                      if (next.has(variant.id)) next.delete(variant.id);
                                      else next.add(variant.id);
                                      return next;
                                    })
                                  }
                                />
                                <Button
                                  variant="plain"
                                  icon={DeleteIcon}
                                  tone="critical"
                                  accessibilityLabel="Supprimer"
                                  onClick={() => {
                                    setVariants((prev) =>
                                      prev.filter((item) => item.id !== variant.id),
                                    );
                                    setSelectedVariantIds((prev) => {
                                      const next = new Set(prev);
                                      next.delete(variant.id);
                                      return next;
                                    });
                                    setExpandedVariantIds((prev) => {
                                      const next = new Set(prev);
                                      next.delete(variant.id);
                                      return next;
                                    });
                                    setDefaultVariantId((prev) =>
                                      prev === variant.id ? null : prev,
                                    );
                                  }}
                                />
                              </InlineStack>
                              <div style={{ display: "flex", justifyContent: "center" }}>
                                <input
                                  type="radio"
                                  name="defaultVariant"
                                  checked={defaultVariantId === variant.id}
                                  onChange={() => setDefaultVariantId(variant.id)}
                                  aria-label="Default combination"
                                />
                              </div>
                            </InlineGrid>

                            {expandedVariantIds.has(variant.id) ? (
                              <Box paddingBlockStart="200">
                                <InlineGrid columns={{ xs: 1, md: "2fr 1fr 1fr" }} gap="200">
                                  <TextField
                                    label="SKU"
                                    value={variant.sku}
                                    onChange={(value) =>
                                      setVariants((prev) =>
                                        prev.map((item) =>
                                          item.id === variant.id
                                            ? { ...item, sku: value }
                                            : item,
                                        ),
                                      )
                                    }
                                    autoComplete="off"
                                  />
                                  <Select
                                    label="Statut stock"
                                    options={[
                                      { label: "En stock", value: "instock" },
                                      { label: "Rupture", value: "outofstock" },
                                    ]}
                                    value={variant.stockStatus}
                                    onChange={(value) =>
                                      setVariants((prev) =>
                                        prev.map((item) =>
                                          item.id === variant.id
                                            ? { ...item, stockStatus: value }
                                            : item,
                                        ),
                                      )
                                    }
                                  />
                                  <Checkbox
                                    label="Actif"
                                    checked={variant.isActive}
                                    onChange={(checked) =>
                                      setVariants((prev) =>
                                        prev.map((item) =>
                                          item.id === variant.id
                                            ? { ...item, isActive: checked }
                                            : item,
                                        ),
                                      )
                                    }
                                  />
                                </InlineGrid>
                              </Box>
                            ) : null}

                            <Divider />
                          </Box>
                        ))}
                      </BlockStack>
                    )}
                  </BlockStack>
                </Card>
              </BlockStack>

              <Card>
                <BlockStack gap="300">
                  {attributes.length === 0 ? (
                    <Text as="p" tone="subdued">
                      Aucun attribut disponible.
                    </Text>
                  ) : (
                    <>
                      <TextField
                        label=""
                        labelHidden
                        placeholder="Search attributes or terms"
                        value={combinationAttributeSearch}
                        onChange={setCombinationAttributeSearch}
                        autoComplete="off"
                      />

                      {filteredAttributesForCombinations.length === 0 ? (
                        <Box
                          padding="400"
                          borderColor="border"
                          borderWidth="025"
                          borderRadius="300">
                          <Text as="p" tone="subdued">
                            Aucun attribut ou terme ne correspond a cette recherche.
                          </Text>
                        </Box>
                      ) : (
                        <div style={{ maxHeight: 520, overflow: "auto", paddingRight: 8 }}>
                          <Accordion
                            key={combinationAttributeSearchTerm || "all-combination-attributes"}
                            type="multiple"
                            defaultValue={filteredAttributesForCombinations.map(
                              ({ attribute }) => attribute.id,
                            )}
                            className="rounded-xl border border-border bg-background"
                          >
                            {filteredAttributesForCombinations.map(({ attribute, terms }) => {
                              const allTerms = attribute.terms ?? [];
                              const selected = selectedTermIdsByAttribute[attribute.id] ?? [];
                              return (
                                <AccordionItem
                                  key={attribute.id}
                                  value={attribute.id}
                                  className="border-border px-4 last:border-b-0"
                                >
                                  <AccordionTrigger className="min-h-12 py-3 text-sm font-semibold hover:no-underline">
                                    <span className="flex min-w-0 flex-1 items-center justify-between gap-3 pr-2">
                                      <span className="truncate">{attribute.name}</span>
                                      <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                                        {selected.length}/{allTerms.length}
                                      </span>
                                    </span>
                                  </AccordionTrigger>
                                  <AccordionContent className="pb-4">
                                    <BlockStack gap="200">
                                      {terms.map((term) => (
                                        <Checkbox
                                          key={term.id}
                                          label={term.name}
                                          checked={selected.includes(term.id)}
                                          onChange={(checked) =>
                                            setSelectedTermIdsByAttribute((prev) => {
                                              const current = prev[attribute.id] ?? [];
                                              const next = new Set(current);
                                              if (checked) next.add(term.id);
                                              else next.delete(term.id);
                                              return {
                                                ...prev,
                                                [attribute.id]: Array.from(next),
                                              };
                                            })
                                          }
                                        />
                                      ))}
                                    </BlockStack>
                                  </AccordionContent>
                                </AccordionItem>
                              );
                            })}
                          </Accordion>
                        </div>
                      )}
                    </>
                  )}
                </BlockStack>
              </Card>
            </InlineGrid>
          ) : null}
            </>
          );
          })()}
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
