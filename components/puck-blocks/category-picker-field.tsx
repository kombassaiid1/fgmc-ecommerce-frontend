"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FieldLabel, type CustomField } from "@puckeditor/core";
import { useQuery } from "@tanstack/react-query";
import { AppProvider } from "@shopify/polaris";
import en from "@shopify/polaris/locales/en.json";
import { ArrowDown, ArrowUp, ChevronRight, ImageIcon, ListChecks, ListFilter, Search, X } from "lucide-react";

import { MediaPickerDialog } from "@/components/admin/media-picker-dialog";
import { getImageUrl } from "@/lib/api";
import { getCategories, type Category } from "@/lib/api/categories";

import { normalizeSelection, type CategorySelection } from "./category-selection";

const BORDER = "1px solid #d5dadf";
const ACCENT = "#0858b1";

/* -------------------------------------------------------------------------- */
/* Data helpers                                                               */
/* -------------------------------------------------------------------------- */

type TreeNode = Category & { children: TreeNode[] };
type CategoryLabel = { title: string; parents: string };

const collator = new Intl.Collator("fr", { sensitivity: "base" });

function normalize(value: string) {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function buildTree(categories: Category[]): TreeNode[] {
  const nodes = new Map<string, TreeNode>();
  categories.forEach((category) => nodes.set(category.id, { ...category, children: [] }));
  const roots: TreeNode[] = [];
  categories.forEach((category) => {
    const node = nodes.get(category.id);
    if (!node) return;
    const parent = category.parentCategoryId ? nodes.get(category.parentCategoryId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  });
  const sort = (list: TreeNode[]) => {
    list.sort((a, b) => collator.compare(a.title, b.title));
    list.forEach((node) => sort(node.children));
  };
  sort(roots);
  return roots;
}

/** Name + "Grandparent › Parent" path for every category id. */
function buildLabels(categories: Category[]): Map<string, CategoryLabel> {
  const byId = new Map(categories.map((category) => [category.id, category]));
  const labels = new Map<string, CategoryLabel>();
  for (const category of categories) {
    const parents: string[] = [];
    const seen = new Set([category.id]);
    let parent = category.parentCategoryId ? byId.get(category.parentCategoryId) : undefined;
    while (parent && !seen.has(parent.id)) {
      parents.unshift(parent.title);
      seen.add(parent.id);
      parent = parent.parentCategoryId ? byId.get(parent.parentCategoryId) : undefined;
    }
    labels.set(category.id, { title: category.title, parents: parents.join(" › ") });
  }
  return labels;
}

/** Keeps matching nodes and the ancestors needed to reach them. */
function filterTree(nodes: TreeNode[], needle: string): TreeNode[] {
  return nodes.flatMap((node) => {
    const matchingChildren = filterTree(node.children, needle);
    const selfMatches = normalize(node.title).includes(needle);
    if (matchingChildren.length > 0) return [{ ...node, children: matchingChildren }];
    if (selfMatches) return [node];
    return [];
  });
}

/** Category name, with its parent path in small grey text below. */
function CategoryName({ label }: { label: CategoryLabel | undefined }) {
  if (!label) return <span style={{ color: "#6d7882" }}>Catégorie supprimée</span>;
  return (
    <span style={{ display: "flex", flexDirection: "column", minWidth: 0, lineHeight: 1.3 }}>
      <span style={{ fontWeight: 500, overflowWrap: "anywhere" }}>{label.title}</span>
      {label.parents ? (
        <span style={{ fontSize: 11, color: "#6d7882", overflowWrap: "anywhere" }}>{label.parents}</span>
      ) : null}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Styles                                                                     */
/* -------------------------------------------------------------------------- */

const iconButton: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 28,
  height: 28,
  border: 0,
  borderRadius: 3,
  background: "transparent",
  color: "#6d7882",
  cursor: "pointer",
};

const textButton: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  height: 36,
  padding: "0 14px",
  border: BORDER,
  borderRadius: 4,
  background: "#fff",
  color: "#1f2124",
  font: "inherit",
  fontSize: 13,
  fontWeight: 500,
  cursor: "pointer",
};

const primaryButton: React.CSSProperties = {
  ...textButton,
  border: `1px solid ${ACCENT}`,
  background: ACCENT,
  color: "#fff",
};

const smallButton: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  height: 28,
  padding: "0 8px",
  border: BORDER,
  borderRadius: 3,
  background: "#f8f9fa",
  color: "#1f2124",
  font: "inherit",
  fontSize: 12,
  cursor: "pointer",
};

const linkButton: React.CSSProperties = {
  ...iconButton,
  width: "auto",
  padding: "0 6px",
  fontSize: 13,
  color: ACCENT,
};

/* -------------------------------------------------------------------------- */
/* Shared dialog frame                                                        */
/* -------------------------------------------------------------------------- */

function DialogFrame({
  title,
  subtitle,
  onCancel,
  toolbar,
  footer,
  children,
}: {
  title: string;
  subtitle?: string;
  onCancel: () => void;
  toolbar: React.ReactNode;
  footer: React.ReactNode;
  children: React.ReactNode;
}) {
  // Escape closes the dialog. The latest onCancel is kept in a ref so the
  // listener is only attached once.
  const cancelRef = useRef(onCancel);
  useEffect(() => {
    cancelRef.current = onCancel;
  });
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") cancelRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return createPortal(
    <div
      style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: "rgba(15, 23, 42, 0.55)" }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{
          display: "flex",
          flexDirection: "column",
          width: "min(720px, 100%)",
          height: "min(680px, 100%)",
          background: "#fff",
          borderRadius: 10,
          boxShadow: "0 24px 64px rgba(0, 0, 0, 0.35)",
          color: "#1f2124",
          fontFamily: "Inter, 'Segoe UI', Roboto, system-ui, sans-serif",
          fontSize: 14,
          overflow: "hidden",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px 14px 20px", borderBottom: BORDER }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{title}</h2>
            {subtitle ? <p style={{ margin: "2px 0 0", fontSize: 12, color: "#6d7882" }}>{subtitle}</p> : null}
          </div>
          <button type="button" style={{ ...iconButton, width: 34, height: 34 }} aria-label="Fermer" onClick={onCancel}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, padding: "12px 20px", borderBottom: BORDER, background: "#f8f9fa" }}>
          {toolbar}
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "6px 8px" }}>{children}</div>

        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, padding: "12px 20px", borderTop: BORDER, background: "#f8f9fa" }}>
          {footer}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function SearchBox({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  // Focus the search box once, when the dialog opens.
  useEffect(() => {
    ref.current?.focus();
  }, []);

  return (
    <div style={{ display: "flex", flex: "1 1 240px", alignItems: "center", gap: 8, padding: "0 12px", height: 40, border: BORDER, borderRadius: 4, background: "#fff", color: "#6d7882" }}>
      <Search size={16} aria-hidden="true" />
      <input
        ref={ref}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        style={{ flex: 1, minWidth: 0, border: 0, outline: 0, background: "transparent", font: "inherit", fontSize: 14, color: "#1f2124" }}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Dialog 1: which categories appear in the panel                             */
/* -------------------------------------------------------------------------- */

function CategoryDialog({
  title,
  categories,
  initial,
  onCancel,
  onConfirm,
}: {
  title: string;
  categories: Category[];
  initial: string[];
  onCancel: () => void;
  onConfirm: (ids: string[]) => void;
}) {
  const [draft, setDraft] = useState<string[]>(initial);
  const [search, setSearch] = useState("");
  const tree = useMemo(() => buildTree(categories), [categories]);
  const labels = useMemo(() => buildLabels(categories), [categories]);

  // Open the ancestors of already-selected categories so they are visible.
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const byId = new Map(categories.map((category) => [category.id, category]));
    const open = new Set<string>();
    for (const id of initial) {
      let parent = byId.get(id)?.parentCategoryId;
      while (parent && !open.has(parent)) {
        open.add(parent);
        parent = byId.get(parent)?.parentCategoryId;
      }
    }
    return open;
  });

  const needle = normalize(search.trim());
  const searching = needle.length > 0;
  const visibleTree = searching ? filterTree(tree, needle) : tree;

  const toggleSelected = (id: string) =>
    setDraft((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));

  const toggleExpanded = (id: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const rows: { node: TreeNode; depth: number }[] = [];
  const walk = (nodes: TreeNode[], depth: number) => {
    for (const node of nodes) {
      rows.push({ node, depth });
      // While searching, everything that leads to a match is open.
      const isOpen = searching ? node.children.length > 0 : expanded.has(node.id);
      if (isOpen) walk(node.children, depth + 1);
    }
  };
  walk(visibleTree, 0);

  return (
    <DialogFrame
      title={title}
      subtitle="Cochez les catégories à afficher dans ce panneau."
      onCancel={onCancel}
      toolbar={
        <>
          <SearchBox value={search} onChange={setSearch} placeholder="Rechercher une catégorie ou sous-catégorie…" />
          {!searching && (
            <>
              <button type="button" style={{ ...textButton, height: 40 }} onClick={() => setExpanded(new Set(categories.map((category) => category.id)))}>
                Tout déplier
              </button>
              <button type="button" style={{ ...textButton, height: 40 }} onClick={() => setExpanded(new Set())}>
                Tout replier
              </button>
            </>
          )}
        </>
      }
      footer={
        <>
          <span style={{ fontSize: 13, color: "#495157" }} aria-live="polite">
            {draft.length === 0 ? "Aucune catégorie sélectionnée" : `${draft.length} sélectionnée${draft.length > 1 ? "s" : ""}`}
          </span>
          {draft.length > 0 && (
            <button type="button" style={linkButton} onClick={() => setDraft([])}>
              Tout désélectionner
            </button>
          )}
          <span style={{ flex: 1 }} />
          <button type="button" style={textButton} onClick={onCancel}>
            Annuler
          </button>
          <button type="button" style={primaryButton} onClick={() => onConfirm(draft)}>
            Valider
          </button>
        </>
      }
    >
      {rows.length === 0 ? (
        <p style={{ margin: 0, padding: 24, textAlign: "center", color: "#6d7882" }}>
          {searching ? "Aucune catégorie ne correspond à cette recherche." : "Aucune catégorie."}
        </p>
      ) : (
        rows.map(({ node, depth }) => {
          const checked = draft.includes(node.id);
          const hasChildren = node.children.length > 0;
          const isOpen = searching ? hasChildren : expanded.has(node.id);
          return (
            <div
              key={node.id}
              style={{ display: "flex", alignItems: "center", gap: 4, minHeight: 40, paddingLeft: depth * 24, borderRadius: 4, background: checked ? "#eaf2fb" : "transparent" }}
            >
              {hasChildren && !searching ? (
                <button
                  type="button"
                  style={iconButton}
                  aria-label={isOpen ? `Replier ${node.title}` : `Déplier ${node.title}`}
                  aria-expanded={isOpen}
                  onClick={() => toggleExpanded(node.id)}
                >
                  <ChevronRight size={16} aria-hidden="true" style={{ transform: isOpen ? "rotate(90deg)" : "none", transition: "transform 120ms" }} />
                </button>
              ) : (
                <span style={{ width: 28, flex: "none" }} aria-hidden="true" />
              )}
              <label style={{ display: "flex", flex: 1, alignItems: "center", gap: 10, minWidth: 0, padding: "6px 8px 6px 2px", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleSelected(node.id)}
                  style={{ width: 18, height: 18, flex: "none", accentColor: ACCENT, cursor: "pointer" }}
                />
                <span style={{ display: "flex", flexDirection: "column", minWidth: 0, lineHeight: 1.3 }}>
                  <span
                    style={{
                      fontWeight: depth === 0 ? 600 : 500,
                      overflowWrap: "anywhere",
                      // While searching, parents shown only to reach a match are greyed out.
                      color: searching && !normalize(node.title).includes(needle) ? "#6d7882" : undefined,
                    }}
                  >
                    {node.title}
                  </span>
                  {searching && labels.get(node.id)?.parents ? (
                    <span style={{ fontSize: 11, color: "#6d7882", overflowWrap: "anywhere" }}>{labels.get(node.id)?.parents}</span>
                  ) : null}
                </span>
                {hasChildren && !searching ? (
                  <span style={{ flex: "none", marginLeft: "auto", fontSize: 12, color: "#6d7882" }}>
                    {node.children.length} sous-catégorie{node.children.length > 1 ? "s" : ""}
                  </span>
                ) : null}
              </label>
            </div>
          );
        })
      )}
    </DialogFrame>
  );
}

/* -------------------------------------------------------------------------- */
/* Dialog 2: which sub-categories appear in a category's hover menu           */
/* -------------------------------------------------------------------------- */

function SubcategoriesDialog({
  parentTitle,
  options,
  initial,
  onCancel,
  onConfirm,
}: {
  parentTitle: string;
  options: Category[];
  /** null = all of them. */
  initial: string[] | null;
  onCancel: () => void;
  /** null = all of them. */
  onConfirm: (ids: string[] | null) => void;
}) {
  const [draft, setDraft] = useState<Set<string>>(
    () => new Set(initial === null ? options.map((option) => option.id) : initial),
  );
  const [search, setSearch] = useState("");
  const needle = normalize(search.trim());
  const visible = options.filter((option) => !needle || normalize(option.title).includes(needle));

  const toggle = (id: string) =>
    setDraft((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const confirm = () => {
    // Everything ticked = "all", so sub-categories added later appear on their own.
    if (options.every((option) => draft.has(option.id))) onConfirm(null);
    else onConfirm(options.filter((option) => draft.has(option.id)).map((option) => option.id));
  };

  return (
    <DialogFrame
      title={`Sous-catégories de « ${parentTitle} »`}
      subtitle="Cochez celles qui apparaissent dans le menu au survol de cette catégorie."
      onCancel={onCancel}
      toolbar={
        <>
          <SearchBox value={search} onChange={setSearch} placeholder="Rechercher une sous-catégorie…" />
          <button type="button" style={{ ...textButton, height: 40 }} onClick={() => setDraft(new Set(options.map((option) => option.id)))}>
            Tout sélectionner
          </button>
          <button type="button" style={{ ...textButton, height: 40 }} onClick={() => setDraft(new Set())}>
            Tout désélectionner
          </button>
        </>
      }
      footer={
        <>
          <span style={{ fontSize: 13, color: "#495157" }} aria-live="polite">
            {draft.size} sur {options.length} affichée{draft.size > 1 ? "s" : ""}
          </span>
          <span style={{ flex: 1 }} />
          <button type="button" style={textButton} onClick={onCancel}>
            Annuler
          </button>
          <button type="button" style={primaryButton} onClick={confirm}>
            Valider
          </button>
        </>
      }
    >
      {visible.length === 0 ? (
        <p style={{ margin: 0, padding: 24, textAlign: "center", color: "#6d7882" }}>
          Aucune sous-catégorie ne correspond à cette recherche.
        </p>
      ) : (
        visible.map((option) => {
          const checked = draft.has(option.id);
          return (
            <label
              key={option.id}
              style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 40, padding: "6px 12px", borderRadius: 4, background: checked ? "#eaf2fb" : "transparent", cursor: "pointer" }}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(option.id)}
                style={{ width: 18, height: 18, flex: "none", accentColor: ACCENT, cursor: "pointer" }}
              />
              <span style={{ fontWeight: 500, overflowWrap: "anywhere" }}>{option.title}</span>
            </label>
          );
        })
      )}
    </DialogFrame>
  );
}

/* -------------------------------------------------------------------------- */
/* Field (shown in the settings panel)                                        */
/* -------------------------------------------------------------------------- */

function CategoryPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: unknown;
  onChange: (next: CategorySelection[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [editingChildrenOf, setEditingChildrenOf] = useState<string | null>(null);
  const [pickingImageFor, setPickingImageFor] = useState<string | null>(null);
  // Same query key as the Hero block, so the list is shared and cached.
  const categoriesQuery = useQuery({
    queryKey: ["navbar-categories"],
    queryFn: () => getCategories(),
    staleTime: 60_000,
  });

  const categories = categoriesQuery.data;
  const labels = useMemo(() => buildLabels(categories ?? []), [categories]);
  const childrenByParent = useMemo(() => {
    const map = new Map<string, Category[]>();
    for (const category of categories ?? []) {
      if (!category.parentCategoryId) continue;
      const list = map.get(category.parentCategoryId) ?? [];
      list.push(category);
      map.set(category.parentCategoryId, list);
    }
    map.forEach((list) => list.sort((a, b) => collator.compare(a.title, b.title)));
    return map;
  }, [categories]);

  const selected = normalizeSelection(value);

  const move = (index: number, step: -1 | 1) => {
    const target = index + step;
    if (target < 0 || target >= selected.length) return;
    const next = [...selected];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  const editing = editingChildrenOf ? selected.find((item) => item.id === editingChildrenOf) : undefined;
  const editingOptions = editingChildrenOf ? (childrenByParent.get(editingChildrenOf) ?? []) : [];

  return (
    <FieldLabel label={label}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13 }}>
        <p style={{ margin: 0, fontSize: 12, color: "#6d7882" }}>
          {selected.length === 0
            ? "Aucune sélection : les catégories du groupe sont affichées automatiquement."
            : `${selected.length} catégorie${selected.length > 1 ? "s" : ""} affichée${selected.length > 1 ? "s" : ""}, dans cet ordre.`}
        </p>

        {selected.length > 0 && (
          <ul style={{ margin: 0, padding: 0, listStyle: "none", border: BORDER, borderRadius: 3, background: "#fff" }}>
            {selected.map((item, index) => {
              const options = childrenByParent.get(item.id) ?? [];
              const visibleCount = item.childIds === null ? options.length : item.childIds.filter((id) => options.some((option) => option.id === id)).length;
              return (
                <li key={item.id} style={{ padding: "2px 4px 6px 10px", borderTop: index === 0 ? 0 : BORDER }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <span style={{ flex: 1, minWidth: 0, padding: "4px 0" }}>
                      <CategoryName label={labels.get(item.id)} />
                    </span>
                    <button type="button" style={{ ...iconButton, opacity: index === 0 ? 0.3 : 1 }} aria-label="Monter" disabled={index === 0} onClick={() => move(index, -1)}>
                      <ArrowUp size={15} aria-hidden="true" />
                    </button>
                    <button type="button" style={{ ...iconButton, opacity: index === selected.length - 1 ? 0.3 : 1 }} aria-label="Descendre" disabled={index === selected.length - 1} onClick={() => move(index, 1)}>
                      <ArrowDown size={15} aria-hidden="true" />
                    </button>
                    <button type="button" style={iconButton} aria-label="Retirer" onClick={() => onChange(selected.filter((other) => other.id !== item.id))}>
                      <X size={15} aria-hidden="true" />
                    </button>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
                    {options.length > 0 && (
                      <button type="button" onClick={() => setEditingChildrenOf(item.id)} style={smallButton}>
                        <ListFilter size={13} aria-hidden="true" />
                        {item.childIds === null
                          ? `Sous-catégories : toutes (${options.length})`
                          : `Sous-catégories : ${visibleCount} sur ${options.length}`}
                      </button>
                    )}
                    <button type="button" onClick={() => setPickingImageFor(item.id)} style={smallButton}>
                      {item.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={getImageUrl(item.imageUrl)} alt="" style={{ width: 18, height: 18, borderRadius: 2, objectFit: "cover" }} />
                      ) : (
                        <ImageIcon size={13} aria-hidden="true" />
                      )}
                      {item.imageUrl ? "Image du menu : changer" : "Ajouter une image au menu"}
                    </button>
                    {item.imageUrl && (
                      <button
                        type="button"
                        aria-label="Retirer l'image du menu"
                        title="Retirer l'image du menu"
                        style={iconButton}
                        onClick={() => onChange(selected.map((other) => (other.id === item.id ? { id: other.id, childIds: other.childIds } : other)))}
                      >
                        <X size={14} aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button
            type="button"
            style={{ ...primaryButton, opacity: categoriesQuery.isLoading ? 0.6 : 1 }}
            disabled={categoriesQuery.isLoading || categoriesQuery.isError}
            onClick={() => setOpen(true)}
          >
            <ListChecks size={16} aria-hidden="true" />
            {selected.length === 0 ? "Choisir des catégories" : "Modifier la sélection"}
          </button>
          {selected.length > 0 && (
            <button type="button" style={textButton} onClick={() => onChange([])}>
              Retour à l&apos;automatique
            </button>
          )}
        </div>
        {categoriesQuery.isError && (
          <p style={{ margin: 0, fontSize: 12, color: "#b91c1c" }}>Impossible de charger les catégories.</p>
        )}
      </div>

      {open && categories ? (
        <CategoryDialog
          title={label}
          categories={categories}
          initial={selected.map((item) => item.id)}
          onCancel={() => setOpen(false)}
          onConfirm={(ids) => {
            // Keep each kept category's sub-category choice.
            onChange(ids.map((id) => selected.find((item) => item.id === id) ?? { id, childIds: null }));
            setOpen(false);
          }}
        />
      ) : null}

      {editing && editingOptions.length > 0 ? (
        <SubcategoriesDialog
          parentTitle={labels.get(editing.id)?.title ?? "catégorie"}
          options={editingOptions}
          initial={editing.childIds}
          onCancel={() => setEditingChildrenOf(null)}
          onConfirm={(childIds) => {
            onChange(selected.map((item) => (item.id === editing.id ? { ...item, childIds } : item)));
            setEditingChildrenOf(null);
          }}
        />
      ) : null}

      {pickingImageFor ? (
        // The page builder lives outside the admin shell, so the Polaris-based
        // media library needs its own provider.
        <AppProvider i18n={en}>
          <MediaPickerDialog
            open
            imagesOnly
            selectedUrl={selected.find((item) => item.id === pickingImageFor)?.imageUrl ?? null}
            onClose={() => setPickingImageFor(null)}
            onSelect={(media) => {
              onChange(selected.map((item) => (item.id === pickingImageFor ? { ...item, imageUrl: media.url } : item)));
              setPickingImageFor(null);
            }}
          />
        </AppProvider>
      ) : null}
    </FieldLabel>
  );
}

/**
 * Field that stores an ordered list of categories (with the sub-categories to
 * show for each), chosen in popups.
 */
export function categoryPickerField(label: string): CustomField<CategorySelection[]> {
  return {
    type: "custom",
    label,
    render: ({ value, onChange, field }) => (
      <CategoryPicker label={field.label ?? label} value={value} onChange={onChange} />
    ),
  };
}
