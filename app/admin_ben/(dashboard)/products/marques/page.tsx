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
  Modal,
  Text,
  TextField,
  UnstyledButton,
  useIndexResourceState,
} from "@shopify/polaris";
import { DeleteIcon, EditIcon } from "@shopify/polaris-icons";

import {
  createBrand,
  deleteBrand,
  getBrands,
  updateBrand,
  type Brand,
} from "@/lib/api/brands";
import { MediaPickerDialog } from "@/components/admin/media-picker-dialog";

type BrandFormState = {
  id?: string;
  title: string;
  slug: string;
  description: string;
  image: string;
};

const EMPTY_FORM: BrandFormState = {
  title: "",
  slug: "",
  description: "",
  image: "",
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export default function AdminProductBrandsPage() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMediaPickerOpen, setIsMediaPickerOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState("Nouvelle marque");
  const [formState, setFormState] = useState<BrandFormState>(EMPTY_FORM);
  const [slugWasEdited, setSlugWasEdited] = useState(false);

  const loadBrands = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getBrands({ limit: 200 });
      setBrands(response.data);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Impossible de charger les marques."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadBrands();
  }, []);

  const filteredBrands = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return [...brands].sort((a, b) => a.title.localeCompare(b.title));
    }
    return [...brands]
      .filter(
        (item) =>
          item.title.toLowerCase().includes(query) ||
          item.slug.toLowerCase().includes(query) ||
          item.description.toLowerCase().includes(query)
      )
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [brands, search]);

  const {
    selectedResources,
    allResourcesSelected,
    handleSelectionChange,
  } = useIndexResourceState(filteredBrands, {
    resourceIDResolver: (item) => item.id,
  });

  const resetForm = () => {
    setFormState(EMPTY_FORM);
    setSlugWasEdited(false);
  };

  const openCreateModal = () => {
    resetForm();
    setModalTitle("Nouvelle marque");
    setIsModalOpen(true);
  };

  const openEditModal = (item: Brand) => {
    setFormState({
      id: item.id,
      title: item.title,
      slug: item.slug,
      description: item.description,
      image: item.image,
    });
    setSlugWasEdited(true);
    setModalTitle("Modifier la marque");
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

  const onSave = async () => {
    if (!formState.title.trim() || !formState.slug.trim()) {
      setError("Le titre et le slug sont obligatoires.");
      return;
    }

    if (!formState.image.trim()) {
      setError("L'image de la marque est obligatoire.");
      return;
    }

    setSaving(true);
    setError(null);

    const payload = {
      title: formState.title.trim(),
      slug: formState.slug.trim(),
      description: formState.description.trim() || "-",
      image: formState.image.trim(),
    };

    try {
      if (formState.id) {
        await updateBrand(formState.id, payload);
      } else {
        await createBrand(payload);
      }
      closeModal();
      await loadBrands();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Impossible d'enregistrer la marque."
      );
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (item: Brand) => {
    const confirmed = window.confirm(
      `Supprimer la marque "${item.title}" ? Cette action est irreversible.`
    );
    if (!confirmed) {
      return;
    }

    setError(null);
    try {
      await deleteBrand(item.id);
      await loadBrands();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Impossible de supprimer la marque."
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
                Gestion des marques
              </Text>
              <Text as="p" tone="subdued">
                Creez et gerez les marques utilisees par vos produits.
              </Text>
            </BlockStack>
            <Button onClick={openCreateModal} variant="primary">
              Ajouter marque
            </Button>
          </InlineStack>

          <InlineStack gap="200">
            <Badge tone="info">{`Total: ${String(brands.length)}`}</Badge>
          </InlineStack>
        </BlockStack>
      </Card>

      {error ? <Banner tone="critical" title={error} /> : null}

      <Card>
        <BlockStack gap="300">
          <Box minWidth="280px" width="45%">
            <TextField
              label="Recherche"
              placeholder="Titre, slug, description..."
              value={search}
              onChange={setSearch}
              autoComplete="off"
            />
          </Box>

          <Divider />

          <IndexTable
            selectable
            loading={loading}
            resourceName={{ singular: "marque", plural: "marques" }}
            itemCount={filteredBrands.length}
            selectedItemsCount={allResourcesSelected ? "All" : selectedResources.length}
            onSelectionChange={handleSelectionChange}
            emptyState={
              <Box padding="400">
                <Text as="p" tone="subdued">
                  Aucune marque avec les filtres actuels.
                </Text>
              </Box>
            }
            headings={[
              { title: "Marque" },
              { title: "Slug" },
              { title: "Produits" },
              { title: "Description" },
              { title: "Actions", alignment: "end" },
            ]}
          >
            {filteredBrands.map((item, index) => (
              <IndexTable.Row
                id={item.id}
                key={item.id}
                position={index}
                selected={selectedResources.includes(item.id)}
                onClick={() => {}}
              >
                <IndexTable.Cell>
                  <InlineStack gap="200" blockAlign="center">
                    <Avatar
                      size="xs"
                      name={item.title}
                      initials={item.title.slice(0, 2).toUpperCase()}
                      source={item.image || undefined}
                      accessibilityLabel={`Logo ${item.title}`}
                    />
                    <Text as="span">{item.title}</Text>
                  </InlineStack>
                </IndexTable.Cell>
                <IndexTable.Cell>{item.slug}</IndexTable.Cell>
                <IndexTable.Cell>{item._count?.products ?? 0}</IndexTable.Cell>
                <IndexTable.Cell>
                  <Text as="span" tone="subdued">
                    {item.description || "-"}
                  </Text>
                </IndexTable.Cell>
                <IndexTable.Cell>
                  <InlineStack gap="100" align="end" blockAlign="center">
                    <Button
                      icon={EditIcon}
                      accessibilityLabel="Modifier"
                      onClick={() => openEditModal(item)}
                    />
                    <Button
                      icon={DeleteIcon}
                      tone="critical"
                      accessibilityLabel="Supprimer"
                      onClick={() => onDelete(item)}
                    />
                  </InlineStack>
                </IndexTable.Cell>
              </IndexTable.Row>
            ))}
          </IndexTable>
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
              onChange={(value) => {
                setSlugWasEdited(true);
                setFormState((prev) => ({ ...prev, slug: slugify(value) }));
              }}
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
                Logo / image de marque
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
                      alt="Apercu marque"
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
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
