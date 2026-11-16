"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Banner, BlockStack, Button, Card, Icon, Modal, Pagination, Text } from "@shopify/polaris";
import { DeleteIcon, DuplicateIcon, ViewIcon } from "@shopify/polaris-icons";
import { getCategories, type Category } from "@/lib/api/categories";
import {
  createProduct,
  deleteProduct,
  getProducts,
  getProductById,
  updateProduct,
  type ProductListItem,
} from "@/lib/api/products";
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

const emptyFilters: Filters = {
  name: "",
  reference: "",
  category: "",
  minPrice: "",
  maxPrice: "",
  minQuantity: "",
  maxQuantity: "",
  status: "",
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

function matchesRange(value: number, min: string, max: string) {
  return (!min || value >= Number(min)) && (!max || value <= Number(max));
}

export default function AdminProductsListPage() {
  const [items, setItems] = useState<ProductListItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [productsToDelete, setProductsToDelete] = useState<ProductListItem[]>([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const selectAllRef = useRef<HTMLInputElement>(null);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [categorySearch, setCategorySearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState<"" | "PUBLIC" | "DRAFT">("");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
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

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someVisibleSelected && !allVisibleSelected;
    }
  }, [allVisibleSelected, someVisibleSelected]);

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
      const product = await getProductById(id);
      const suffix = `copie-${Date.now().toString(36)}`;
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

  return (
    <BlockStack gap="400">
      {error ? <Banner tone="critical" title={error} /> : null}
      {notice ? <Banner tone="success" title={notice} onDismiss={() => setNotice(null)} /> : null}
      <Card padding="0">
        <div className="admin-products-toolbar">
          <label className="products-category-filter">
            <span className="visually-hidden">Filtrer par catégorie</span>
            <select
              value={filters.category}
              onChange={(event) => updateFilter("category", event.target.value)}
              aria-label="Filtrer par catégorie"
              disabled={bulkDeleting}
            >
              <option value="">Filtrer par catégories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>{category.title}</option>
              ))}
            </select>
          </label>
          <div className="products-bulk-controls">
            <select
              aria-label="Actions groupées"
              value={bulkAction}
              disabled={mutationBusy}
              onChange={(event) => setBulkAction(event.target.value as "" | "PUBLIC" | "DRAFT")}
            >
              <option value="">Actions groupées</option>
              <option value="PUBLIC">Mettre en ligne</option>
              <option value="DRAFT">Mettre hors ligne</option>
            </select>
            <button
              className="products-toolbar-button"
              type="button"
              onClick={applyBulkAction}
              disabled={!bulkAction || selectedIds.length === 0 || mutationBusy || loading}
            >
              {saving ? "Enregistrement…" : "Appliquer"}
            </button>
          </div>
          <button
            className="products-settings-button"
            type="button"
            aria-label="Actualiser la liste"
            title="Actualiser"
            onClick={refreshProducts}
            disabled={mutationBusy || loading}
          >
            ↻
          </button>
        </div>
        <div className="products-selection-bar">
          <label className="products-select-all">
            <input ref={selectAllRef} type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} disabled={loading || mutationBusy || visibleItems.length === 0} />
            <span>Tout sélectionner sur cette page</span>
          </label>
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

        <div className="products-table-scroll">
          <table className="admin-products-table">
            <thead>
              <tr className="products-heading-row">
                <th className="products-check-column" aria-label="Sélection" />
                <th className="products-image-column">Image</th>
                <th>Nom</th>
                <th>Référence</th>
                <th>Catégorie</th>
                <th>Prix (HT)</th>
                <th>Prix (TTC)</th>
                <th>Quantité</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
              <tr className="products-filter-row">
                <th />
                <th />
                <th><input value={filters.name} onChange={(event) => updateFilter("name", event.target.value)} placeholder="Rechercher nom" /></th>
                <th><input value={filters.reference} onChange={(event) => updateFilter("reference", event.target.value)} placeholder="Rechercher réf." /></th>
                <th><input value={categorySearch} onChange={(event) => { setSelectedIds([]); setCategorySearch(event.target.value); }} placeholder="Rechercher catégorie" /></th>
                <th className="range-filter"><input inputMode="decimal" value={filters.minPrice} onChange={(event) => updateFilter("minPrice", event.target.value)} placeholder="Min" /><input inputMode="decimal" value={filters.maxPrice} onChange={(event) => updateFilter("maxPrice", event.target.value)} placeholder="Max" /></th>
                <th />
                <th className="range-filter"><input inputMode="numeric" value={filters.minQuantity} onChange={(event) => updateFilter("minQuantity", event.target.value)} placeholder="Min" /><input inputMode="numeric" value={filters.maxQuantity} onChange={(event) => updateFilter("maxQuantity", event.target.value)} placeholder="Max" /></th>
                <th>
                  <select aria-label="Filtrer par statut" value={filters.status} onChange={(event) => updateFilter("status", event.target.value as Filters["status"])}>
                    <option value="">Tous</option>
                    <option value="PUBLIC">En ligne</option>
                    <option value="DRAFT">Hors ligne</option>
                  </select>
                </th>
                <th><button className="products-search-button" type="button" onClick={refreshProducts} disabled={mutationBusy || loading}>⌕ <span>Rechercher</span></button></th>
              </tr>
            </thead>
            <tbody>
              {loading && items.length === 0 ? (
                <tr><td className="products-empty" colSpan={10}>Chargement des produits…</td></tr>
              ) : visibleItems.length === 0 ? (
                <tr><td className="products-empty" colSpan={10}>Aucun produit trouvé.</td></tr>
              ) : visibleItems.map((product) => {
                const productCategories = (product.categories ?? [])
                  .map((item) => item.category?.title)
                  .filter((title): title is string => Boolean(title));
                return (
                  <tr key={product.id}>
                    <td className="products-check-column"><input type="checkbox" aria-label={`Sélectionner ${product.title}`} checked={selectedIds.includes(product.id)} onChange={() => toggleSelected(product.id)} disabled={loading || mutationBusy} /></td>
                    <td className="products-image-column">
                      {product.images?.[0] ? <img className="products-thumbnail" src={product.images[0]} alt="" /> : <span className="products-no-image">—</span>}
                    </td>
                    <td className="products-name-cell"><a href={`/admin_ben/products/add_product?id=${product.id}`}>{product.title}</a></td>
                    <td>{product.reference || product.sku || "—"}</td>
                    <td className="products-category-cell">{productCategories.join(", ") || "—"}</td>
                    <td className="products-price-cell">{money(Number(product.price) || 0)}</td>
                    <td className="products-price-cell">{money(priceWithTax(product))}</td>
                    <td className="products-quantity-cell">{stockFor(product)}</td>
                    <td><button type="button" className={`products-status ${product.status === "PUBLIC" ? "is-online" : "is-offline"}`} aria-label={`Passer ${product.title} ${product.status === "PUBLIC" ? "hors ligne" : "en ligne"}`} title={product.status === "PUBLIC" ? "Cliquer pour mettre hors ligne" : "Cliquer pour mettre en ligne"} aria-pressed={product.status === "PUBLIC"} disabled={mutationBusy} onClick={() => void toggleProductStatus(product)}>{product.status === "PUBLIC" ? "✓" : "×"}</button></td>
                    <td className="products-actions-cell">
                      <a href={`/admin_ben/products/add_product?id=${product.id}`} aria-label={`Modifier ${product.title}`} title="Modifier">✎</a>
                      <div className="products-row-menu-wrap">
                        <button
                          type="button"
                          aria-label={`Plus d’actions pour ${product.title}`}
                          aria-haspopup="menu"
                          aria-expanded={openMenuId === product.id}
                          title="Plus d’actions"
                          disabled={mutationBusy}
                          onClick={() => setOpenMenuId((current) => current === product.id ? null : product.id)}
                        >
                          ⋮
                        </button>
                        {openMenuId === product.id ? (
                          <div className="products-row-menu" role="menu">
                            <a href={productPreviewUrl(product)} target="_blank" rel="noreferrer" role="menuitem" onClick={() => setOpenMenuId(null)}>
                              <Icon source={ViewIcon} /> Aperçu
                            </a>
                            <button type="button" role="menuitem" disabled={mutationBusy} onClick={() => duplicateProduct(product.id)}>
                              <Icon source={DuplicateIcon} /> {actionBusyId === product.id ? "Duplication…" : "Dupliquer"}
                            </button>
                            <button className="products-delete-action" type="button" role="menuitem" disabled={mutationBusy} onClick={() => removeProduct(product)}>
                              <Icon source={DeleteIcon} /> Supprimer
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
    </BlockStack>
  );
}
