"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Avatar,
  Badge,
  Banner,
  BlockStack,
  Box,
  Button,
  Card,
  Divider,
  IndexTable,
  InlineStack,
  Icon,
  Modal,
  Select,
  Spinner,
  Text,
  TextField,
  Tooltip,
  UnstyledButton,
  useIndexResourceState,
} from "@shopify/polaris";
import {
  CategoriesIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  DeleteIcon,
  EditIcon,
  PlusCircleIcon,
} from "@shopify/polaris-icons";

import {
  createCategory,
  deleteCategory,
  getCategories,
  updateCategory,
  type Category,
} from "@/lib/api/categories";
import { MediaPickerDialog } from "@/components/admin/media-picker-dialog";

type CategoryFormState = {
  id?: string;
  title: string;
  slug: string;
  description: string;
  image: string;
  parentCategoryId: string;
};

type ViewMode = "all" | "main" | "sub";

type TreeRow = {
  item: Category;
  depth: number;
  hasChildren: boolean;
  isExpanded: boolean;
  isContextRoot: boolean;
  parentTitle: string;
};

const EMPTY_FORM: CategoryFormState = {
  title: "",
  slug: "",
  description: "",
  image: "",
  parentCategoryId: "",
};

const VIEW_OPTIONS = [
  { label: "Tout", value: "all" },
  { label: "Categories", value: "main" },
  { label: "Sous-categories", value: "sub" },
];

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function sortByTitle(items: Category[]) {
  return [...items].sort((a, b) => a.title.localeCompare(b.title));
}

function buildChildrenMap(items: Category[]) {
  const map = new Map<string, Category[]>();
  for (const item of items) {
    if (!item.parentCategoryId) {
      continue;
    }
    const current = map.get(item.parentCategoryId) ?? [];
    current.push(item);
    map.set(item.parentCategoryId, current);
  }
  map.forEach((group, key) => {
    map.set(key, sortByTitle(group));
  });
  return map;
}

function collectDescendantIds(
  rootId: string,
  childrenByParent: Map<string, Category[]>
) {
  const descendants = new Set<string>();
  const stack = [...(childrenByParent.get(rootId) ?? [])];

  while (stack.length > 0) {
    const node = stack.pop();
    if (!node || descendants.has(node.id)) {
      continue;
    }
    descendants.add(node.id);
    const children = childrenByParent.get(node.id) ?? [];
    for (const child of children) {
      stack.push(child);
    }
  }

  return descendants;
}

export default function AdminProductCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("all");
  const [parentFilter, setParentFilter] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMediaPickerOpen, setIsMediaPickerOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState("Nouvelle categorie");
  const [formState, setFormState] = useState<CategoryFormState>(EMPTY_FORM);
  const [slugWasEdited, setSlugWasEdited] = useState(false);

  const loadCategories = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getCategories();
      setCategories(data);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Impossible de charger les categories."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCategories();
  }, []);

  const allCategoriesSorted = useMemo(() => sortByTitle(categories), [categories]);

  const mainCategories = useMemo(
    () => allCategoriesSorted.filter((item) => !item.parentCategoryId),
    [allCategoriesSorted]
  );

  const subcategories = useMemo(
    () => allCategoriesSorted.filter((item) => Boolean(item.parentCategoryId)),
    [allCategoriesSorted]
  );

  const byId = useMemo(
    () => new Map(categories.map((item) => [item.id, item])),
    [categories]
  );

  const childrenByParent = useMemo(() => buildChildrenMap(categories), [categories]);

  useEffect(() => {
    if (mainCategories.length === 0) {
      return;
    }
    setExpandedIds((prev) => {
      if (prev.size > 0) {
        return prev;
      }
      return new Set(mainCategories.map((item) => item.id));
    });
  }, [mainCategories]);

  const searchTerm = search.trim().toLowerCase();

  const parentFilterOptions = useMemo(
    () => [
      { label: "Tous les parents", value: "" },
      ...mainCategories.map((item) => ({ label: item.title, value: item.id })),
    ],
    [mainCategories]
  );

  const parentOptions = useMemo(() => {
    const blockedIds = formState.id
      ? collectDescendantIds(formState.id, childrenByParent)
      : new Set<string>();

    if (formState.id) {
      blockedIds.add(formState.id);
    }

    const selectableParents = allCategoriesSorted
      .filter((item) => !blockedIds.has(item.id))
      .map((item) => {
        let depth = 0;
        let cursor = item.parentCategoryId;
        const visited = new Set<string>();

        while (cursor && !visited.has(cursor)) {
          visited.add(cursor);
          depth += 1;
          cursor = byId.get(cursor)?.parentCategoryId ?? null;
        }

        const prefix = depth > 0 ? `${"  ".repeat(depth)}- ` : "";
        return { label: `${prefix}${item.title}`, value: item.id };
      });

    return [
      { label: "Aucune (categorie racine)", value: "" },
      ...selectableParents,
    ];
  }, [allCategoriesSorted, byId, childrenByParent, formState.id]);

  const matchesNode = useMemo(() => {
    const matcher = new Map<string, boolean>();
    for (const item of categories) {
      const parentTitle = item.parentCategoryId
        ? byId.get(item.parentCategoryId)?.title ?? ""
        : "";
      const ownMatch =
        searchTerm.length === 0 ||
        item.title.toLowerCase().includes(searchTerm) ||
        item.slug.toLowerCase().includes(searchTerm) ||
        (item.description ?? "").toLowerCase().includes(searchTerm) ||
        parentTitle.toLowerCase().includes(searchTerm);
      matcher.set(item.id, ownMatch);
    }
    return matcher;
  }, [byId, categories, searchTerm]);

  const branchMatches = useMemo(() => {
    const memo = new Map<string, boolean>();

    const visit = (id: string): boolean => {
      const cached = memo.get(id);
      if (cached !== undefined) {
        return cached;
      }

      const current = byId.get(id);
      if (!current) {
        memo.set(id, false);
        return false;
      }

      const ownMatch = matchesNode.get(id) ?? false;
      const children = childrenByParent.get(id) ?? [];
      const childMatch = children.some((child) => visit(child.id));
      const value = ownMatch || childMatch;
      memo.set(id, value);
      return value;
    };

    for (const item of categories) {
      visit(item.id);
    }

    return memo;
  }, [byId, categories, childrenByParent, matchesNode]);

  const treeRows = useMemo(() => {
    const rows: TreeRow[] = [];

    const walk = (node: Category, depth: number, ancestors: string[]) => {
      const hasChildren = (childrenByParent.get(node.id)?.length ?? 0) > 0;
      const parentTitle = node.parentCategoryId
        ? byId.get(node.parentCategoryId)?.title ?? "-"
        : "-";

      const searchAllowed = searchTerm.length === 0 || (branchMatches.get(node.id) ?? false);
      const filterAllowed =
        !parentFilter ||
        node.id === parentFilter ||
        ancestors.includes(parentFilter);

      if (!searchAllowed || !filterAllowed) {
        return;
      }

      const isRoot = depth === 0;
      const modeAllowed =
        viewMode === "all" ||
        (viewMode === "main" && isRoot) ||
        (viewMode === "sub" && !isRoot);
      const isContextRoot =
        viewMode === "sub" && isRoot && (childrenByParent.get(node.id)?.length ?? 0) > 0;

      if (modeAllowed || isContextRoot) {
        rows.push({
          item: node,
          depth,
          hasChildren,
          isExpanded: expandedIds.has(node.id),
          isContextRoot,
          parentTitle,
        });
      }

      const shouldExpand = expandedIds.has(node.id) || searchTerm.length > 0 || Boolean(parentFilter);
      if (!hasChildren || !shouldExpand) {
        return;
      }

      const children = childrenByParent.get(node.id) ?? [];
      for (const child of children) {
        walk(child, depth + 1, [...ancestors, node.id]);
      }
    };

    for (const root of mainCategories) {
      walk(root, 0, []);
    }

    return rows;
  }, [
    branchMatches,
    byId,
    childrenByParent,
    expandedIds,
    mainCategories,
    parentFilter,
    searchTerm,
    viewMode,
  ]);

  const {
    selectedResources,
    allResourcesSelected,
    handleSelectionChange,
  } = useIndexResourceState(treeRows, {
    resourceIDResolver: (row) => row.item.id,
  });

  const resetForm = () => {
    setFormState(EMPTY_FORM);
    setSlugWasEdited(false);
  };

  const openCreateMainModal = () => {
    resetForm();
    setModalTitle("Nouvelle categorie");
    setIsModalOpen(true);
  };

  const openCreateSubModal = (parentId?: string) => {
    resetForm();
    setFormState((prev) => ({
      ...prev,
      parentCategoryId: parentId ?? allCategoriesSorted[0]?.id ?? "",
    }));
    setModalTitle("Nouvelle sous-categorie");
    setIsModalOpen(true);
  };

  const openEditModal = (item: Category) => {
    setFormState({
      id: item.id,
      title: item.title,
      slug: item.slug,
      description: item.description ?? "",
      image: item.image ?? "",
      parentCategoryId: item.parentCategoryId ?? "",
    });
    setSlugWasEdited(true);
    setModalTitle("Modifier la categorie");
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setIsMediaPickerOpen(false);
    resetForm();
  };

  const onTitleChange = (value: string) => {
    setFormState((prev) => {
      const next = { ...prev, title: value };
      if (!slugWasEdited) {
        next.slug = slugify(value);
      }
      return next;
    });
  };

  const onSlugChange = (value: string) => {
    setSlugWasEdited(true);
    setFormState((prev) => ({ ...prev, slug: slugify(value) }));
  };

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const onSave = async () => {
    if (!formState.title.trim() || !formState.slug.trim()) {
      setError("Le titre et le slug sont obligatoires.");
      return;
    }

    setSaving(true);
    setError(null);

    const payload = {
      title: formState.title.trim(),
      slug: formState.slug.trim(),
      description: formState.description.trim() || null,
      image: formState.image.trim() || null,
      parentCategoryId: formState.parentCategoryId || null,
    };

    try {
      if (formState.id) {
        await updateCategory(formState.id, payload);
      } else {
        await createCategory(payload);
      }
      closeModal();
      await loadCategories();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Impossible d'enregistrer la categorie."
      );
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (item: Category) => {
    const itemType = item.parentCategoryId ? "sous-categorie" : "categorie";
    const confirmed = window.confirm(
      `Supprimer la ${itemType} "${item.title}" ? Cette action est irreversible.`
    );
    if (!confirmed) {
      return;
    }

    setError(null);
    try {
      await deleteCategory(item.id);
      await loadCategories();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Impossible de supprimer la categorie."
      );
    }
  };

  return (
    <BlockStack gap="500">
      <Card>
        <BlockStack gap="300">
          <InlineStack align="space-between" blockAlign="start" gap="300">
            <BlockStack gap="100">
              <Text as="h2" variant="headingLg">
                Gestion des categories
              </Text>
              <Text as="p" tone="subdued">
                Vue arborescente du catalogue avec edition rapide par icones.
              </Text>
            </BlockStack>
            <InlineStack gap="200">
              <Button onClick={openCreateMainModal} variant="primary">
                Ajouter categorie
              </Button>
              <Button onClick={() => openCreateSubModal()}>
                Ajouter sous-categorie
              </Button>
            </InlineStack>
          </InlineStack>

          <InlineStack gap="200">
            <Badge tone="info">{`Total: ${String(categories.length)}`}</Badge>
            <Badge tone="success">{`Categories: ${String(mainCategories.length)}`}</Badge>
            <Badge tone="attention">{`Sous-categories: ${String(subcategories.length)}`}</Badge>
          </InlineStack>
        </BlockStack>
      </Card>

      {error ? <Banner tone="critical" title={error} /> : null}

      <Card>
        <BlockStack gap="300">
          <InlineStack gap="300" blockAlign="end" align="space-between">
            <Box minWidth="280px" width="45%">
              <TextField
                label="Recherche"
                placeholder="Titre, slug, description..."
                value={search}
                onChange={setSearch}
                autoComplete="off"
              />
            </Box>

            <InlineStack gap="200">
              <Box minWidth="170px">
                <Select
                  label="Vue"
                  options={VIEW_OPTIONS}
                  value={viewMode}
                  onChange={(value) => setViewMode(value as ViewMode)}
                />
              </Box>
              <Box minWidth="220px">
                <Select
                  label="Filtre parent"
                  options={parentFilterOptions}
                  value={parentFilter}
                  onChange={setParentFilter}
                />
              </Box>
            </InlineStack>
          </InlineStack>

          <Divider />

          {loading ? (
            <Box padding="600">
              <InlineStack align="center">
                <Spinner accessibilityLabel="Chargement des categories" size="large" />
              </InlineStack>
            </Box>
          ) : treeRows.length === 0 ? (
            <Box padding="400">
              <Text as="p" tone="subdued">
                Aucun resultat avec les filtres actuels.
              </Text>
            </Box>
          ) : (
            <IndexTable
              selectable
              resourceName={{ singular: "categorie", plural: "categories" }}
              itemCount={treeRows.length}
              selectedItemsCount={
                allResourcesSelected ? "All" : selectedResources.length
              }
              onSelectionChange={handleSelectionChange}
              headings={[
                { title: "Nom" },
                { title: "Type" },
                { title: "Parent" },
                { title: "Produits" },
                { title: "Sous-categories" },
                { title: "Actions" },
              ]}
            >
              {treeRows.map((row, index) => {
                const { item, depth, hasChildren, isExpanded, isContextRoot, parentTitle } = row;
                const indentPx = depth * 22;

                return (
                  <IndexTable.Row
                    id={item.id}
                    key={item.id}
                    position={index}
                    selected={selectedResources.includes(item.id)}
                    onClick={() => {}}
                  >
                    <IndexTable.Cell>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          marginInlineStart: `${indentPx}px`,
                        }}
                      >
                        {hasChildren ? (
                          <UnstyledButton
                            onClick={() => toggleExpand(item.id)}
                            accessibilityLabel={
                              isExpanded ? "Reduire la branche" : "Deplier la branche"
                            }
                          >
                            <div
                              style={{
                                width: "18px",
                                height: "18px",
                                display: "grid",
                                placeItems: "center",
                              }}
                            >
                              <Icon
                                source={isExpanded ? ChevronDownIcon : ChevronRightIcon}
                                tone="subdued"
                              />
                            </div>
                          </UnstyledButton>
                        ) : (
                          <span
                            style={{
                              width: "18px",
                              height: "18px",
                              display: "grid",
                              placeItems: "center",
                              opacity: 0.35,
                            }}
                            aria-hidden
                          >
                            <Icon source={ChevronRightIcon} tone="subdued" />
                          </span>
                        )}
                        <Avatar
                          size="xs"
                          name={item.title}
                          initials={item.title.slice(0, 2).toUpperCase()}
                          source={item.image ?? undefined}
                          accessibilityLabel={`Avatar ${item.title}`}
                        />
                        <Icon source={CategoriesIcon} tone="subdued" />
                        <Text as="span" tone={isContextRoot ? "subdued" : undefined}>
                          {item.title}
                        </Text>
                      </div>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <Badge tone={item.parentCategoryId ? "attention" : "success"}>
                        {item.parentCategoryId ? "Sous-categorie" : "Categorie"}
                      </Badge>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <Text as="span" tone="subdued">
                        {parentTitle}
                      </Text>
                    </IndexTable.Cell>
                    <IndexTable.Cell>{item._count?.products ?? 0}</IndexTable.Cell>
                    <IndexTable.Cell>{item._count?.subcategories ?? 0}</IndexTable.Cell>
                    <IndexTable.Cell>
                      <InlineStack gap="100" align="end" blockAlign="center">
                        <Tooltip content="Ajouter une sous-categorie">
                          <Button
                            icon={PlusCircleIcon}
                            accessibilityLabel="Ajouter une sous-categorie"
                            onClick={() => openCreateSubModal(item.id)}
                          />
                        </Tooltip>
                        <Tooltip content="Modifier">
                          <Button
                            icon={EditIcon}
                            accessibilityLabel="Modifier"
                            onClick={() => openEditModal(item)}
                          />
                        </Tooltip>
                        <Tooltip content="Supprimer">
                          <Button
                            icon={DeleteIcon}
                            tone="critical"
                            accessibilityLabel="Supprimer"
                            onClick={() => onDelete(item)}
                          />
                        </Tooltip>
                      </InlineStack>
                    </IndexTable.Cell>
                  </IndexTable.Row>
                );
              })}
            </IndexTable>
          )}
        </BlockStack>
      </Card>

      <Modal
        open={isModalOpen}
        onClose={closeModal}
        title={modalTitle}
        primaryAction={{
          content: saving ? "Enregistrement..." : "Enregistrer",
          onAction: onSave,
          loading: saving,
        }}
        secondaryActions={[
          {
            content: "Annuler",
            onAction: closeModal,
          },
        ]}
      >
        <Modal.Section>
          <BlockStack gap="300">
            <TextField
              label="Titre"
              value={formState.title}
              onChange={onTitleChange}
              autoComplete="off"
            />
            <TextField
              label="Slug"
              value={formState.slug}
              onChange={onSlugChange}
              autoComplete="off"
            />
            <TextField
              label="Description"
              value={formState.description}
              onChange={(value) =>
                setFormState((prev) => ({ ...prev, description: value }))
              }
              multiline={3}
              autoComplete="off"
            />
            <BlockStack gap="200">
              <Text as="p" variant="bodyMd" fontWeight="medium">
                Image de la categorie
              </Text>
              <UnstyledButton
                onClick={() => setIsMediaPickerOpen(true)}
                accessibilityLabel="Choisir une image depuis la mediatheque"
              >
                <div
                  style={{
                    width: "180px",
                    height: "110px",
                    borderRadius: "10px",
                    border: "1px dashed #aeb4b9",
                    overflow: "hidden",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "#f6f6f7",
                    cursor: "pointer",
                  }}
                >
                  {formState.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={formState.image}
                      alt="Apercu categorie"
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                  ) : (
                    <Text as="p" tone="subdued">
                      Cliquer pour choisir
                    </Text>
                  )}
                </div>
              </UnstyledButton>
              {formState.image ? (
                <InlineStack>
                  <Button
                    tone="critical"
                    size="slim"
                    onClick={() => setFormState((prev) => ({ ...prev, image: "" }))}
                  >
                    Retirer l'image
                  </Button>
                </InlineStack>
              ) : null}
            </BlockStack>
            <Select
              label="Categorie parent"
              options={parentOptions}
              value={formState.parentCategoryId}
              onChange={(value) =>
                setFormState((prev) => ({ ...prev, parentCategoryId: value }))
              }
            />
          </BlockStack>
        </Modal.Section>
      </Modal>

      <MediaPickerDialog
        open={isMediaPickerOpen}
        selectedUrl={formState.image || null}
        onClose={() => setIsMediaPickerOpen(false)}
        onSelect={(item) => {
          setFormState((prev) => ({ ...prev, image: item.url }));
          setIsMediaPickerOpen(false);
        }}
      />
    </BlockStack>
  );
}
