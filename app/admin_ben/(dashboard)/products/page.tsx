"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Banner, BlockStack, Button, Card, Icon, Pagination, Text } from "@shopify/polaris";
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
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [categorySearch, setCategorySearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState<"" | "PUBLIC" | "DRAFT">("");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
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
    const timeout = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await getProducts({
          page,
          limit: PAGE_SIZE,
          search: filters.name.trim() || undefined,
          categoryId: filters.category || undefined,
          status: filters.status || undefined,
        });
        setItems(response.data);
        setMeta(response.meta);
        setSelectedIds([]);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Impossible de charger les produits.",
        );
      } finally {
        setLoading(false);
      }
    }, 220);

    return () => clearTimeout(timeout);
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
    setPage(1);
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((selected) => selected !== id) : [...current, id],
    );
  };

  const allVisibleSelected = visibleItems.length > 0 && visibleItems.every((item) => selectedIds.includes(item.id));
  const toggleAllVisible = () => {
    setSelectedIds((current) =>
      allVisibleSelected
        ? current.filter((id) => !visibleItems.some((item) => item.id === id))
        : Array.from(new Set([...current, ...visibleItems.map((item) => item.id)])),
    );
  };

  const applyBulkAction = async () => {
    if (!bulkAction || selectedIds.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      await Promise.all(
        selectedIds.map((id) => updateProduct(id, { status: bulkAction })),
      );
      setSelectedIds([]);
      setRefreshKey((key) => key + 1);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "La mise à jour a échoué.");
    } finally {
      setSaving(false);
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
      setRefreshKey((key) => key + 1);
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
      <Card padding="0">
        <div className="admin-products-toolbar">
          <label className="products-category-filter">
            <span className="visually-hidden">Filtrer par catégorie</span>
            <select
              value={filters.category}
              onChange={(event) => updateFilter("category", event.target.value)}
              aria-label="Filtrer par catégorie"
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
              disabled={!bulkAction || selectedIds.length === 0 || saving}
            >
              {saving ? "Enregistrement…" : "Appliquer"}
            </button>
          </div>
          <button
            className="products-settings-button"
            type="button"
            aria-label="Actualiser la liste"
            title="Actualiser"
            onClick={() => setRefreshKey((key) => key + 1)}
          >
            ↻
          </button>
        </div>
        <label className="products-select-all">
          <input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} />
          <span>Tout sélectionner</span>
        </label>

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
                <th><input value={categorySearch} onChange={(event) => setCategorySearch(event.target.value)} placeholder="Rechercher catégorie" /></th>
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
                <th><button className="products-search-button" type="button" onClick={() => setRefreshKey((key) => key + 1)}>⌕ <span>Rechercher</span></button></th>
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
                    <td className="products-check-column"><input type="checkbox" aria-label={`Sélectionner ${product.title}`} checked={selectedIds.includes(product.id)} onChange={() => toggleSelected(product.id)} /></td>
                    <td className="products-image-column">
                      {product.images?.[0] ? <img className="products-thumbnail" src={product.images[0]} alt="" /> : <span className="products-no-image">—</span>}
                    </td>
                    <td className="products-name-cell"><a href={`/admin_ben/products/add_product?id=${product.id}`}>{product.title}</a></td>
                    <td>{product.reference || product.sku || "—"}</td>
                    <td className="products-category-cell">{productCategories.join(", ") || "—"}</td>
                    <td className="products-price-cell">{money(Number(product.price) || 0)}</td>
                    <td className="products-price-cell">{money(priceWithTax(product))}</td>
                    <td className="products-quantity-cell">{stockFor(product)}</td>
                    <td><span className={`products-status ${product.status === "PUBLIC" ? "is-online" : "is-offline"}`} aria-label={product.status === "PUBLIC" ? "En ligne" : "Hors ligne"}>{product.status === "PUBLIC" ? "✓" : "×"}</span></td>
                    <td className="products-actions-cell">
                      <a href={`/admin_ben/products/add_product?id=${product.id}`} aria-label={`Modifier ${product.title}`} title="Modifier">✎</a>
                      <div className="products-row-menu-wrap">
                        <button
                          type="button"
                          aria-label={`Plus d’actions pour ${product.title}`}
                          aria-haspopup="menu"
                          aria-expanded={openMenuId === product.id}
                          title="Plus d’actions"
                          onClick={() => setOpenMenuId((current) => current === product.id ? null : product.id)}
                        >
                          ⋮
                        </button>
                        {openMenuId === product.id ? (
                          <div className="products-row-menu" role="menu">
                            <a href={productPreviewUrl(product)} target="_blank" rel="noreferrer" role="menuitem" onClick={() => setOpenMenuId(null)}>
                              <Icon source={ViewIcon} /> Aperçu
                            </a>
                            <button type="button" role="menuitem" disabled={actionBusyId === product.id} onClick={() => duplicateProduct(product.id)}>
                              <Icon source={DuplicateIcon} /> {actionBusyId === product.id ? "Duplication…" : "Dupliquer"}
                            </button>
                            <button className="products-delete-action" type="button" role="menuitem" disabled={actionBusyId === product.id} onClick={() => removeProduct(product)}>
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
            hasPrevious={meta.hasPreviousPage}
            hasNext={meta.hasNextPage}
            onPrevious={() => setPage((current) => Math.max(1, current - 1))}
            onNext={() => setPage((current) => Math.min(Math.max(1, meta.totalPages), current + 1))}
          />
        </div>
      </Card>
      <div className="products-add-button"><Button url="/admin_ben/products/add_product" variant="primary">Ajouter un produit</Button></div>
    </BlockStack>
  );
}
