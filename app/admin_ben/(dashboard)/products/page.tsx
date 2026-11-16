"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ActionList,
  Banner,
  BlockStack,
  Button,
  Card,
  Checkbox,
  DataTable,
  InlineStack,
  Link,
  Modal,
  Pagination,
  Popover,
  Select,
  Spinner,
  Text,
  TextField,
  Thumbnail,
  Tooltip,
} from "@shopify/polaris";
import {
  CheckIcon,
  DeleteIcon,
  DuplicateIcon,
  EditIcon,
  ImageIcon,
  MenuHorizontalIcon,
  RefreshIcon,
  SearchIcon,
  ViewIcon,
  XIcon,
} from "@shopify/polaris-icons";
import { getCategories, type Category } from "@/lib/api/categories";
import {
  createProduct,
  deleteProduct,
  getProducts,
  getProductById,
  getProductForAdmin,
  updateProduct,
  type ProductListItem,
} from "@/lib/api/products";
import { SparePartsPicker } from "@/components/admin/spare-parts-picker";
import "./products-table.css";

const PAGE_SIZE = 20;

type Filters = {
  name: string;
  reference: string;
  category: string;
  minPrice: string;
  maxPrice: string;
  minQuantity: string;
  maxQuantity: string;
  status: "" | "PUBLIC" | "DRAFT";
};

function stockFor(product: ProductListItem) {
  const variants = product.combinaisons ?? [];
  if (variants.length) {
    return variants.reduce(
      (sum, variant) => sum + (variant.isActive === false ? 0 : Number(variant.qty) || 0),
      0,
    );
  }
  return Number(product.qty) || 0;
}

function priceWithTax(product: ProductListItem) {
  const price = Number(product.price) || 0;
  const rate = Number(product.taxRelation?.rate) || 0;
  return price * (1 + rate / 100);
}

function money(value: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(value);
}

/** Unique suffix for the slug and SKU of a duplicated product. */
function copySuffix() {
  return `copie-${Date.now().toString(36)}`;
}

function matchesRange(value: number, min: string, max: string) {
  return (!min || value >= Number(min)) && (!max || value <= Number(max));
}

// Same ten columns as before. Polaris can only align a column left or right, so the
// five columns from "Prix (HT)" on are centred in products-table.css instead
// (heading, filter, values), as in the reference layout.
const COLUMN_TYPES: Array<"text" | "numeric"> = [
  "text", // selection
  "text", // image
  "text", // name
  "text", // reference
  "text", // category
  "text", // price excl. tax
  "text", // price incl. tax
  "text", // quantity
  "text", // status
  "text", // actions
];

const HEADINGS = [
  <span key="select" className="visually-hidden">Sélection</span>,
  "Image",
  "Nom",
  "Référence",
  "Catégorie",
  "Prix (HT)",
  "Prix (TTC)",
  "Quantité",
  "Statut",
  "Actions",
];

/* -------------------------------------------------------------------------- */
/* Filters in the URL                                                         */
/* -------------------------------------------------------------------------- */

// The list's filters and page live in the query string, so a reload (or a shared
// link) shows the same results. Only non-empty values are written.
type ListState = { filters: Filters; categorySearch: string; page: number };

const PARAM = {
  name: "q",
  reference: "ref",
  category: "category",
  minPrice: "minPrice",
  maxPrice: "maxPrice",
  minQuantity: "minQty",
  maxQuantity: "maxQty",
  status: "status",
  categorySearch: "catq",
  page: "page",
} as const;

/** Keeps what a number field can hold (digits, a decimal separator, a minus). */
function cleanNumber(value: string | null) {
  return (value ?? "").replace(/[^\d.,-]/g, "");
}

function parseListState(params: URLSearchParams): ListState {
  const status = params.get(PARAM.status);
  const page = Number.parseInt(params.get(PARAM.page) ?? "", 10);
  return {
    filters: {
      name: params.get(PARAM.name) ?? "",
      reference: params.get(PARAM.reference) ?? "",
      category: params.get(PARAM.category) ?? "",
      minPrice: cleanNumber(params.get(PARAM.minPrice)),
      maxPrice: cleanNumber(params.get(PARAM.maxPrice)),
      minQuantity: cleanNumber(params.get(PARAM.minQuantity)),
      maxQuantity: cleanNumber(params.get(PARAM.maxQuantity)),
      status: status === "PUBLIC" || status === "DRAFT" ? status : "",
    },
    categorySearch: params.get(PARAM.categorySearch) ?? "",
    page: Number.isFinite(page) && page > 1 ? page : 1,
  };
}

function buildQuery({ filters, categorySearch, page }: ListState) {
  const params = new URLSearchParams();
  const set = (key: string, value: string) => {
    if (value.trim()) params.set(key, value);
  };
  set(PARAM.name, filters.name);
  set(PARAM.reference, filters.reference);
  set(PARAM.category, filters.category);
  set(PARAM.minPrice, filters.minPrice);
  set(PARAM.maxPrice, filters.maxPrice);
  set(PARAM.minQuantity, filters.minQuantity);
  set(PARAM.maxQuantity, filters.maxQuantity);
  set(PARAM.status, filters.status);
  set(PARAM.categorySearch, categorySearch);
  if (page > 1) params.set(PARAM.page, String(page));
  return params.toString();
}

function ProductsRoute() {
  const searchParams = useSearchParams();
  const query = searchParams.toString();

  // Every query string the list has written itself. Next.js reports a change to the
  // URL a little after the list makes it, and quick typing can leave a couple in
  // flight, so a query is "ours" if it is any of these.
  const written = useRef(new Set<string>([query]));
  const [epoch, setEpoch] = useState(0);
  const handleQueryWritten = useCallback((next: string) => {
    written.current.add(next);
  }, []);

  // Any other query comes from outside (a menu link back to /admin_ben/products, the
  // browser's back button): restart the list from the new URL.
  useEffect(() => {
    if (written.current.has(query)) return;
    written.current = new Set([query]);
    setEpoch((current) => current + 1);
  }, [query]);

  return (
    <AdminProductsList
      key={epoch}
      initial={parseListState(new URLSearchParams(query))}
      onQueryWritten={handleQueryWritten}
    />
  );
}

export default function AdminProductsListPage() {
  return (
    <Suspense fallback={null}>
      <ProductsRoute />
    </Suspense>
  );
}

function AdminProductsList({
  initial,
  onQueryWritten,
}: {
  initial: ListState;
  onQueryWritten: (query: string) => void;
}) {
  const [items, setItems] = useState<ProductListItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [productsToDelete, setProductsToDelete] = useState<ProductListItem[]>([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [page, setPage] = useState(initial.page);
  const [filters, setFilters] = useState<Filters>(initial.filters);
  const [categorySearch, setCategorySearch] = useState(initial.categorySearch);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState<"" | "PUBLIC" | "DRAFT">("");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [sparePartsTarget, setSparePartsTarget] = useState<ProductListItem | null>(null);
  const [sparePartsIds, setSparePartsIds] = useState<string[]>([]);
  const [sparePartsLoading, setSparePartsLoading] = useState(false);
  const [sparePartsSaving, setSparePartsSaving] = useState(false);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);
  const [statusBusyId, setStatusBusyId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const mutationBusy = saving || bulkDeleting || actionBusyId !== null || statusBusyId !== null;
  const [meta, setMeta] = useState({
    total: 0,
    page: 1,
    limit: PAGE_SIZE,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  });

  useEffect(() => {
    getCategories()
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    let active = true;
    const timeout = setTimeout(async () => {
      setLoading(true);
      setSelectedIds([]);
      setError(null);
      try {
        const response = await getProducts({
          page,
          limit: PAGE_SIZE,
          search: filters.name.trim() || undefined,
          categoryId: filters.category || undefined,
          status: filters.status || undefined,
        });
        if (!active) return;
        setItems(response.data);
        setMeta(response.meta);
        setSelectedIds([]);
      } catch (loadError) {
        if (!active) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Impossible de charger les produits.",
        );
      } finally {
        if (active) setLoading(false);
      }
    }, 220);

    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [page, filters.name, filters.category, filters.status, refreshKey]);

  // Keep the URL in step with the filters. replaceState (not router.replace) updates
  // the address without a server round trip or a new history entry, and Next.js
  // still sees it through useSearchParams.
  useEffect(() => {
    const query = buildQuery({ filters, categorySearch, page });
    if (query === window.location.search.replace(/^\?/, "")) return;
    onQueryWritten(query);
    window.history.replaceState(null, "", query ? `?${query}` : window.location.pathname);
  }, [filters, categorySearch, page, onQueryWritten]);

  const visibleItems = useMemo(() => {
    const referenceQuery = filters.reference.trim().toLocaleLowerCase("fr");
    const categoryQuery = categorySearch.trim().toLocaleLowerCase("fr");
    return items.filter((product) => {
      const categoriesText = (product.categories ?? [])
        .map((item) => item.category?.title ?? "")
        .join(" ")
        .toLocaleLowerCase("fr");
      const reference = (product.reference || product.sku || "").toLocaleLowerCase("fr");
      return (
        (!referenceQuery || reference.includes(referenceQuery)) &&
        (!categoryQuery || categoriesText.includes(categoryQuery)) &&
        matchesRange(Number(product.price) || 0, filters.minPrice, filters.maxPrice) &&
        matchesRange(stockFor(product), filters.minQuantity, filters.maxQuantity)
      );
    });
  }, [items, filters.reference, filters.minPrice, filters.maxPrice, filters.minQuantity, filters.maxQuantity, categorySearch]);

  const updateFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setSelectedIds([]);
    if (page !== 1 || key === "name" || key === "category" || key === "status") {
      setLoading(true);
    }
    setPage(1);
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const refreshProducts = () => {
    setLoading(true);
    setSelectedIds([]);
    setRefreshKey((key) => key + 1);
  };

  const changePage = (nextPage: number) => {
    setLoading(true);
    setSelectedIds([]);
    setPage(nextPage);
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((selected) => selected !== id) : [...current, id],
    );
  };

  const allVisibleSelected = visibleItems.length > 0 && visibleItems.every((item) => selectedIds.includes(item.id));
  const someVisibleSelected = visibleItems.some((item) => selectedIds.includes(item.id));

  const toggleAllVisible = () => {
    setSelectedIds((current) =>
      allVisibleSelected
        ? current.filter((id) => !visibleItems.some((item) => item.id === id))
        : Array.from(new Set([...current, ...visibleItems.map((item) => item.id)])),
    );
  };

  const applyBulkAction = async () => {
    if (!bulkAction || selectedIds.length === 0 || mutationBusy || loading) return;
    setSaving(true);
    setError(null);
    try {
      await Promise.all(
        selectedIds.map((id) => updateProduct(id, { status: bulkAction })),
      );
      setSelectedIds([]);
      refreshProducts();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "La mise à jour a échoué.");
    } finally {
      setSaving(false);
    }
  };

  const toggleProductStatus = async (product: ProductListItem) => {
    const status = product.status === "PUBLIC" ? "DRAFT" : "PUBLIC";
    setStatusBusyId(product.id);
    setError(null);
    try {
      await updateProduct(product.id, { status });
      setItems((current) => current.map((item) => item.id === product.id ? { ...item, status } : item));
      refreshProducts();
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : "La mise a jour du statut a echoue.");
    } finally {
      setStatusBusyId(null);
    }
  };

  const duplicateProduct = async (id: string) => {
    setActionBusyId(id);
    setError(null);
    try {
      const product = await getProductForAdmin(id);
      const suffix = copySuffix();
      const categoryIds = (product.categories ?? [])
        .map((item) => item.categoryId ?? item.category?.id ?? "")
        .filter(Boolean);
      await createProduct({
        title: `${product.title} (copie)`,
        slug: `${product.slug}-${suffix}`,
        description: product.description ?? "",
        shortDescription: product.shortDescription ?? "",
        images: product.images ?? [],
        price: product.price ?? "0",
        taxId: product.taxId ?? undefined,
        tag: product.tag ?? "-",
        sku: product.sku ? `${product.sku}-${suffix}` : suffix,
        qty: product.qty ?? "0",
        stockStatus: product.stockStatus ?? "instock",
        allowBackorders: product.allowBackorders ?? "no",
        lowStockThreshold: product.lowStockThreshold ?? "0",
        brandId: product.brandId,
        status: "DRAFT",
        reference: product.reference ?? null,
        metaTitle: product.metaTitle ?? null,
        metaDescription: product.metaDescription ?? null,
        metaKeywords: product.metaKeywords ?? null,
        sparePartIds: product.sparePartIds ?? [],
        associatedIds: product.associatedIds ?? [],
        attachments: product.attachments ?? [],
        categoryIds,
        mainCategoryId: product.mainCategoryId ?? categoryIds[0] ?? null,
        attributeTerms: product.attributes ?? [],
        specificPrices: product.specificPrices ?? [],
        combinaisons: (product.combinaisons ?? []).map((variant, index) => ({
          ...variant,
          id: undefined,
          sku: variant.sku ? `${variant.sku}-${suffix}-${index + 1}` : undefined,
        })),
      });
      setOpenMenuId(null);
      refreshProducts();
    } catch (duplicateError) {
      setError(duplicateError instanceof Error ? duplicateError.message : "La duplication a échoué.");
    } finally {
      setActionBusyId(null);
    }
  };

  const openSpareParts = async (product: ProductListItem) => {
    setOpenMenuId(null);
    setSparePartsTarget(product);
    setSparePartsIds([]);
    setSparePartsLoading(true);
    setError(null);
    try {
      const details = await getProductById(product.id);
      setSparePartsIds(details.sparePartIds ?? []);
    } catch (loadError) {
      setSparePartsTarget(null);
      setError(loadError instanceof Error ? loadError.message : "Impossible de charger les pièces.");
    } finally {
      setSparePartsLoading(false);
    }
  };

  const saveSpareParts = async () => {
    if (!sparePartsTarget) return;
    setSparePartsSaving(true);
    setError(null);
    try {
      await updateProduct(sparePartsTarget.id, { sparePartIds: sparePartsIds });
      setNotice(`Pièces de rechange de « ${sparePartsTarget.title} » enregistrées.`);
      setSparePartsTarget(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "L'enregistrement a échoué.");
    } finally {
      setSparePartsSaving(false);
    }
  };

  const removeProduct = async (product: ProductListItem) => {
    const confirmed = window.confirm(`Supprimer définitivement « ${product.title} » ?`);
    if (!confirmed) return;
    setActionBusyId(product.id);
    setError(null);
    try {
      await deleteProduct(product.id);
      setItems((current) => current.filter((item) => item.id !== product.id));
      setSelectedIds((current) => current.filter((id) => id !== product.id));
      setMeta((current) => ({ ...current, total: Math.max(0, current.total - 1) }));
      setOpenMenuId(null);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "La suppression a échoué.");
    } finally {
      setActionBusyId(null);
    }
  };

  const removeSelectedProducts = async () => {
    if (productsToDelete.length === 0 || mutationBusy) return;
    setBulkDeleting(true);
    setError(null);
    setNotice(null);
    setOpenMenuId(null);

    try {
      const results = await Promise.allSettled(
        productsToDelete.map((product) => deleteProduct(product.id)),
      );
      const deletedIds = new Set(
        productsToDelete
          .filter((_, index) => results[index].status === "fulfilled")
          .map((product) => product.id),
      );
      const failures = results.filter((result) => result.status === "rejected");
      const total = Math.max(0, meta.total - deletedIds.size);
      const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
      const nextPage = Math.min(page, totalPages);

      setItems((current) => current.filter((product) => !deletedIds.has(product.id)));
      setSelectedIds((current) => current.filter((id) => !deletedIds.has(id)));
      setMeta((current) => ({
        ...current,
        total,
        totalPages,
        page: nextPage,
        hasPreviousPage: nextPage > 1,
        hasNextPage: nextPage < totalPages,
      }));
      if (deletedIds.size > 0) {
        setNotice(`${deletedIds.size} produit${deletedIds.size > 1 ? "s" : ""} supprimé${deletedIds.size > 1 ? "s" : ""}.`);
      }
      if (failures.length > 0) {
        const reason = failures[0].reason;
        const detail = reason instanceof Error ? ` ${reason.message}` : "";
        setError(`${failures.length} produit${failures.length > 1 ? "s n’ont" : " n’a"} pas pu être supprimé${failures.length > 1 ? "s" : ""}. Les produits concernés restent sélectionnés pour réessayer.${detail}`);
      } else {
        setSelectedIds([]);
        if (nextPage !== page) {
          changePage(nextPage);
        } else {
          refreshProducts();
        }
      }
    } finally {
      setBulkDeleting(false);
      setProductsToDelete([]);
    }
  };

  const productPreviewUrl = (product: ProductListItem) => {
    const mainCategory = product.categories?.find(
      (entry) => (entry.categoryId ?? entry.category?.id) === product.mainCategoryId,
    )?.category;
    const category = mainCategory ?? product.categories?.[0]?.category;
    return category?.slug ? `/${category.slug}/${product.slug}` : `/${product.slug}`;
  };

  /* ---------------------------------------------------------------------- */
  /* Table content                                                          */
  /* ---------------------------------------------------------------------- */

  // The filter row sits right under the headings, in the table's "totals" slot.
  const filterRow = [
    "",
    "",
    <div key="name" className="products-filter products-filter-name">
      <TextField
        label="Rechercher un nom"
        labelHidden
        autoComplete="off"
        placeholder="Rechercher nom"
        value={filters.name}
        onChange={(value) => updateFilter("name", value)}
      />
    </div>,
    <div key="reference" className="products-filter products-filter-reference">
      <TextField
        label="Rechercher une référence"
        labelHidden
        autoComplete="off"
        placeholder="Rechercher réf."
        value={filters.reference}
        onChange={(value) => updateFilter("reference", value)}
      />
    </div>,
    <div key="category" className="products-filter products-filter-category">
      <TextField
        label="Rechercher une catégorie"
        labelHidden
        autoComplete="off"
        placeholder="Rechercher catégorie"
        value={categorySearch}
        onChange={(value) => {
          setSelectedIds([]);
          setCategorySearch(value);
        }}
      />
    </div>,
    <div key="price" className="products-filter products-filter-range">
      <TextField
        label="Prix (HT) minimum"
        labelHidden
        autoComplete="off"
        inputMode="decimal"
        placeholder="Min"
        value={filters.minPrice}
        onChange={(value) => updateFilter("minPrice", value)}
      />
      <TextField
        label="Prix (HT) maximum"
        labelHidden
        autoComplete="off"
        inputMode="decimal"
        placeholder="Max"
        value={filters.maxPrice}
        onChange={(value) => updateFilter("maxPrice", value)}
      />
    </div>,
    "",
    <div key="quantity" className="products-filter products-filter-range">
      <TextField
        label="Quantité minimum"
        labelHidden
        autoComplete="off"
        inputMode="numeric"
        placeholder="Min"
        value={filters.minQuantity}
        onChange={(value) => updateFilter("minQuantity", value)}
      />
      <TextField
        label="Quantité maximum"
        labelHidden
        autoComplete="off"
        inputMode="numeric"
        placeholder="Max"
        value={filters.maxQuantity}
        onChange={(value) => updateFilter("maxQuantity", value)}
      />
    </div>,
    <div key="status" className="products-filter products-filter-status">
      <Select
        label="Filtrer par statut"
        labelHidden
        options={[
          { label: "Tous", value: "" },
          { label: "En ligne", value: "PUBLIC" },
          { label: "Hors ligne", value: "DRAFT" },
        ]}
        value={filters.status}
        onChange={(value) => updateFilter("status", value as Filters["status"])}
      />
    </div>,
    <Button key="search" icon={SearchIcon} onClick={refreshProducts} disabled={mutationBusy || loading}>
      Rechercher
    </Button>,
  ];

  const rows = visibleItems.map((product) => {
    const productCategories = (product.categories ?? [])
      .map((item) => item.category?.title)
      .filter((title): title is string => Boolean(title));
    const online = product.status === "PUBLIC";
    const editUrl = `/admin_ben/products/add_product?id=${product.id}`;

    return [
      <Checkbox
        key="select"
        label={`Sélectionner ${product.title}`}
        labelHidden
        checked={selectedIds.includes(product.id)}
        onChange={() => toggleSelected(product.id)}
        disabled={loading || mutationBusy}
      />,
      <Thumbnail key="image" source={product.images?.[0] || ImageIcon} alt="" size="small" />,
      <div key="name" className="products-cell-text products-cell-name">
        <Link url={editUrl} removeUnderline>
          {product.title}
        </Link>
      </div>,
      product.reference || product.sku || "—",
      <div key="category" className="products-cell-text products-cell-category">
        {productCategories.join(", ") || "—"}
      </div>,
      money(Number(product.price) || 0),
      money(priceWithTax(product)),
      stockFor(product),
      <Tooltip key="status" content={online ? "Cliquer pour mettre hors ligne" : "Cliquer pour mettre en ligne"}>
        {/* The wrapper colours the icon: green tick when online, red cross when offline. */}
        <span className={online ? "products-status is-online" : "products-status is-offline"}>
          <Button
            variant="tertiary"
            icon={online ? CheckIcon : XIcon}
            accessibilityLabel={`Passer ${product.title} ${online ? "hors ligne" : "en ligne"}`}
            disabled={mutationBusy}
            onClick={() => void toggleProductStatus(product)}
          />
        </span>
      </Tooltip>,
      <InlineStack key="actions" gap="100" wrap={false} align="center" blockAlign="center">
        <Button
          variant="tertiary"
          icon={EditIcon}
          url={editUrl}
          accessibilityLabel={`Modifier ${product.title}`}
        />
        <Popover
          active={openMenuId === product.id}
          onClose={() => setOpenMenuId((current) => (current === product.id ? null : current))}
          activator={
            <Button
              variant="tertiary"
              icon={MenuHorizontalIcon}
              accessibilityLabel={`Plus d’actions pour ${product.title}`}
              disabled={mutationBusy}
              onClick={() => setOpenMenuId((current) => (current === product.id ? null : product.id))}
            />
          }
        >
          <ActionList
            actionRole="menuitem"
            items={[
              {
                content: "Aperçu",
                icon: ViewIcon,
                url: productPreviewUrl(product),
                external: true,
                onAction: () => setOpenMenuId(null),
              },
              {
                content: actionBusyId === product.id ? "Duplication…" : "Dupliquer",
                icon: DuplicateIcon,
                disabled: mutationBusy,
                onAction: () => void duplicateProduct(product.id),
              },
              {
                content: "Pièces de rechange",
                icon: EditIcon,
                disabled: mutationBusy,
                onAction: () => void openSpareParts(product),
              },
              {
                content: "Supprimer",
                icon: DeleteIcon,
                destructive: true,
                disabled: mutationBusy,
                onAction: () => void removeProduct(product),
              },
            ]}
          />
        </Popover>
      </InlineStack>,
    ];
  });

  return (
    <BlockStack gap="400">
      {error ? <Banner tone="critical" title={error} /> : null}
      {notice ? <Banner tone="success" title={notice} onDismiss={() => setNotice(null)} /> : null}
      <Card padding="0">
        <div className="admin-products-toolbar">
          <div className="products-category-filter">
            <Select
              label="Filtrer par catégorie"
              labelHidden
              disabled={bulkDeleting}
              options={[
                { label: "Filtrer par catégories", value: "" },
                ...categories.map((category) => ({ label: category.title, value: category.id })),
              ]}
              value={filters.category}
              onChange={(value) => updateFilter("category", value)}
            />
          </div>
          <div className="products-bulk-controls">
            <Select
              label="Actions groupées"
              labelHidden
              disabled={mutationBusy}
              options={[
                { label: "Actions groupées", value: "" },
                { label: "Mettre en ligne", value: "PUBLIC" },
                { label: "Mettre hors ligne", value: "DRAFT" },
              ]}
              value={bulkAction}
              onChange={(value) => setBulkAction(value as "" | "PUBLIC" | "DRAFT")}
            />
            <Button
              variant="primary"
              onClick={applyBulkAction}
              loading={saving}
              disabled={!bulkAction || selectedIds.length === 0 || mutationBusy || loading}
            >
              Appliquer
            </Button>
          </div>
          <div className="products-settings-button">
            <Button
              variant="tertiary"
              icon={RefreshIcon}
              accessibilityLabel="Actualiser la liste"
              onClick={refreshProducts}
              disabled={mutationBusy || loading}
            />
          </div>
        </div>
        <div className="products-selection-bar">
          <Checkbox
            label="Tout sélectionner sur cette page"
            checked={allVisibleSelected ? true : someVisibleSelected ? "indeterminate" : false}
            onChange={toggleAllVisible}
            disabled={loading || mutationBusy || visibleItems.length === 0}
          />
          <span className="products-selection-count" role="status">
            {selectedIds.length} produit{selectedIds.length > 1 ? "s" : ""} sélectionné{selectedIds.length > 1 ? "s" : ""}
          </span>
          <div className="products-page-actions">
            <Button
              tone="critical"
              icon={DeleteIcon}
              disabled={selectedIds.length === 0 || loading || mutationBusy}
              loading={bulkDeleting}
              onClick={() => setProductsToDelete(items.filter((product) => selectedIds.includes(product.id)))}
            >
              Supprimer la sélection
            </Button>
            <Button url="/admin_ben/products/add_product" variant="primary">Ajouter un produit</Button>
          </div>
        </div>

        <div className="products-datatable">
          <DataTable
            columnContentTypes={COLUMN_TYPES}
            headings={HEADINGS}
            totals={filterRow}
            totalsName={{ singular: null, plural: null }}
            rows={rows}
            truncate={false}
            verticalAlign="middle"
          />
          {visibleItems.length === 0 ? (
            <div className="products-empty" role="status">
              {loading ? (
                <InlineStack gap="200" align="center" blockAlign="center">
                  <Spinner size="small" accessibilityLabel="Chargement des produits" />
                  <Text as="span" tone="subdued">Chargement des produits…</Text>
                </InlineStack>
              ) : (
                <Text as="span" tone="subdued">Aucun produit trouvé.</Text>
              )}
            </div>
          ) : null}
        </div>

        <div className="products-pagination">
          <Text as="span" tone="subdued">
            {`Page ${meta.page} / ${Math.max(1, meta.totalPages)} · ${meta.total} produits`}
          </Text>
          <Pagination
            hasPrevious={meta.hasPreviousPage && !loading && !mutationBusy}
            hasNext={meta.hasNextPage && !loading && !mutationBusy}
            onPrevious={() => changePage(Math.max(1, page - 1))}
            onNext={() => changePage(Math.min(Math.max(1, meta.totalPages), page + 1))}
          />
        </div>
      </Card>
      <Modal
        open={productsToDelete.length > 0}
        title={`Supprimer ${productsToDelete.length} produit${productsToDelete.length > 1 ? "s" : ""} ?`}
        onClose={() => { if (!bulkDeleting) setProductsToDelete([]); }}
        primaryAction={{
          content: `Supprimer ${productsToDelete.length} produit${productsToDelete.length > 1 ? "s" : ""}`,
          destructive: true,
          loading: bulkDeleting,
          onAction: () => { void removeSelectedProducts(); },
        }}
        secondaryActions={[{
          content: "Annuler",
          disabled: bulkDeleting,
          onAction: () => setProductsToDelete([]),
        }]}
      >
        <Modal.Section>
          <Text as="p">
            {productsToDelete.length === 1
              ? "Le produit sélectionné sera supprimé définitivement. Cette action est irréversible."
              : `Les ${productsToDelete.length} produits sélectionnés seront supprimés définitivement. Cette action est irréversible.`}
          </Text>
        </Modal.Section>
      </Modal>
      <Modal
        open={sparePartsTarget !== null}
        size="large"
        title={`Pièces de rechange — ${sparePartsTarget?.title ?? ""}`}
        onClose={() => { if (!sparePartsSaving) setSparePartsTarget(null); }}
        primaryAction={{
          content: "Enregistrer",
          loading: sparePartsSaving,
          disabled: sparePartsLoading,
          onAction: () => { void saveSpareParts(); },
        }}
        secondaryActions={[{
          content: "Annuler",
          disabled: sparePartsSaving,
          onAction: () => setSparePartsTarget(null),
        }]}
      >
        <Modal.Section>
          {sparePartsLoading ? (
            <Spinner accessibilityLabel="Chargement" />
          ) : (
            <SparePartsPicker
              value={sparePartsIds}
              onChange={setSparePartsIds}
              excludeId={sparePartsTarget?.id}
            />
          )}
        </Modal.Section>
      </Modal>
    </BlockStack>
  );
}
