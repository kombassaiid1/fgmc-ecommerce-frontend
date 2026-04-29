"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Banner,
  BlockStack,
  Box,
  Button,
  Card,
  Divider,
  IndexTable,
  InlineGrid,
  InlineStack,
  Modal,
  Select,
  Text,
  TextField,
  useIndexResourceState,
} from "@shopify/polaris";
import { DeleteIcon, EditIcon, PlusCircleIcon } from "@shopify/polaris-icons";

import {
  createAttribute,
  createTerm,
  deleteAttribute,
  deleteTerm,
  getAttributes,
  getTerms,
  updateAttribute,
  updateTerm,
  type Attribute,
  type AttributeTerm,
} from "@/lib/api/attributes";

type AttributeFormState = {
  id?: string;
  name: string;
  slug: string;
  description: string;
};

type TermFormState = {
  id?: string;
  name: string;
  slug: string;
  description: string;
  attributeId: string;
};

const EMPTY_ATTRIBUTE_FORM: AttributeFormState = {
  name: "",
  slug: "",
  description: "",
};

const EMPTY_TERM_FORM: TermFormState = {
  name: "",
  slug: "",
  description: "",
  attributeId: "",
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export default function AdminProductAttributesPage() {
  const [attributes, setAttributes] = useState<Attribute[]>([]);
  const [terms, setTerms] = useState<AttributeTerm[]>([]);

  const [loading, setLoading] = useState(true);
  const [savingAttribute, setSavingAttribute] = useState(false);
  const [savingTerm, setSavingTerm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [selectedAttributeId, setSelectedAttributeId] = useState<string>("");

  const [isAttributeModalOpen, setIsAttributeModalOpen] = useState(false);
  const [isTermModalOpen, setIsTermModalOpen] = useState(false);
  const [attributeModalTitle, setAttributeModalTitle] = useState("Nouvel attribut");
  const [termModalTitle, setTermModalTitle] = useState("Nouveau terme");

  const [attributeFormState, setAttributeFormState] =
    useState<AttributeFormState>(EMPTY_ATTRIBUTE_FORM);
  const [attributeSlugWasEdited, setAttributeSlugWasEdited] = useState(false);

  const [termFormState, setTermFormState] = useState<TermFormState>(EMPTY_TERM_FORM);
  const [termSlugWasEdited, setTermSlugWasEdited] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [attributesResponse, termsData] = await Promise.all([
        getAttributes({ includeTerms: false, limit: 200 }),
        getTerms(),
      ]);

      setAttributes(attributesResponse.data);
      setTerms(termsData);

      setSelectedAttributeId((prev) => {
        if (prev && attributesResponse.data.some((item) => item.id === prev)) {
          return prev;
        }
        return attributesResponse.data[0]?.id ?? "";
      });
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Impossible de charger les attributs et termes."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const attributesSorted = useMemo(
    () => [...attributes].sort((a, b) => a.name.localeCompare(b.name)),
    [attributes]
  );

  const filteredAttributes = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return attributesSorted;
    }
    return attributesSorted.filter(
      (item) =>
        item.name.toLowerCase().includes(query) ||
        item.slug.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query)
    );
  }, [attributesSorted, search]);

  const selectedAttribute = useMemo(
    () => attributes.find((item) => item.id === selectedAttributeId) ?? null,
    [attributes, selectedAttributeId]
  );

  const termsForSelectedAttribute = useMemo(() => {
    if (!selectedAttributeId) {
      return [];
    }
    return terms
      .filter((term) => term.attributeId === selectedAttributeId)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [selectedAttributeId, terms]);

  const attributeOptions = useMemo(
    () => attributesSorted.map((item) => ({ label: item.name, value: item.id })),
    [attributesSorted]
  );

  const {
    selectedResources: selectedAttributeResources,
    allResourcesSelected: allAttributesSelected,
    handleSelectionChange: handleAttributeSelection,
  } = useIndexResourceState(filteredAttributes, {
    resourceIDResolver: (item) => item.id,
  });

  const {
    selectedResources: selectedTermResources,
    allResourcesSelected: allTermsSelected,
    handleSelectionChange: handleTermSelection,
  } = useIndexResourceState(termsForSelectedAttribute, {
    resourceIDResolver: (item) => item.id,
  });

  const resetAttributeForm = () => {
    setAttributeFormState(EMPTY_ATTRIBUTE_FORM);
    setAttributeSlugWasEdited(false);
  };

  const resetTermForm = () => {
    setTermFormState((prev) => ({ ...EMPTY_TERM_FORM, attributeId: prev.attributeId }));
    setTermSlugWasEdited(false);
  };

  const openCreateAttributeModal = () => {
    resetAttributeForm();
    setAttributeModalTitle("Nouvel attribut");
    setIsAttributeModalOpen(true);
  };

  const openEditAttributeModal = (item: Attribute) => {
    setAttributeFormState({
      id: item.id,
      name: item.name,
      slug: item.slug,
      description: item.description,
    });
    setAttributeSlugWasEdited(true);
    setAttributeModalTitle("Modifier l'attribut");
    setIsAttributeModalOpen(true);
  };

  const openCreateTermModal = () => {
    resetTermForm();
    setTermFormState((prev) => ({
      ...prev,
      attributeId: selectedAttributeId || attributesSorted[0]?.id || "",
    }));
    setTermModalTitle("Nouveau terme");
    setIsTermModalOpen(true);
  };

  const openEditTermModal = (item: AttributeTerm) => {
    setTermFormState({
      id: item.id,
      name: item.name,
      slug: item.slug,
      description: item.description,
      attributeId: item.attributeId,
    });
    setTermSlugWasEdited(true);
    setTermModalTitle("Modifier le terme");
    setIsTermModalOpen(true);
  };

  const closeAttributeModal = () => {
    setIsAttributeModalOpen(false);
    resetAttributeForm();
  };

  const closeTermModal = () => {
    setIsTermModalOpen(false);
    resetTermForm();
  };

  const onAttributeNameChange = (value: string) => {
    setAttributeFormState((prev) => {
      const next = { ...prev, name: value };
      if (!attributeSlugWasEdited) {
        next.slug = slugify(value);
      }
      return next;
    });
  };

  const onTermNameChange = (value: string) => {
    setTermFormState((prev) => {
      const next = { ...prev, name: value };
      if (!termSlugWasEdited) {
        next.slug = slugify(value);
      }
      return next;
    });
  };

  const onSaveAttribute = async () => {
    if (!attributeFormState.name.trim() || !attributeFormState.slug.trim()) {
      setError("Le nom et le slug de l'attribut sont obligatoires.");
      return;
    }

    setSavingAttribute(true);
    setError(null);

    const payload = {
      name: attributeFormState.name.trim(),
      slug: attributeFormState.slug.trim(),
      description: attributeFormState.description.trim() || "-",
    };

    try {
      if (attributeFormState.id) {
        await updateAttribute(attributeFormState.id, payload);
      } else {
        await createAttribute(payload);
      }
      closeAttributeModal();
      await loadData();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Impossible d'enregistrer l'attribut."
      );
    } finally {
      setSavingAttribute(false);
    }
  };

  const onSaveTerm = async () => {
    if (!termFormState.attributeId) {
      setError("Veuillez choisir un attribut pour ce terme.");
      return;
    }

    if (!termFormState.name.trim() || !termFormState.slug.trim()) {
      setError("Le nom et le slug du terme sont obligatoires.");
      return;
    }

    setSavingTerm(true);
    setError(null);

    const payload = {
      name: termFormState.name.trim(),
      slug: termFormState.slug.trim(),
      description: termFormState.description.trim() || "-",
      attributeId: termFormState.attributeId,
    };

    try {
      if (termFormState.id) {
        await updateTerm(termFormState.id, payload);
      } else {
        await createTerm(payload);
      }
      closeTermModal();
      await loadData();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Impossible d'enregistrer le terme."
      );
    } finally {
      setSavingTerm(false);
    }
  };

  const onDeleteAttribute = async (item: Attribute) => {
    const confirmed = window.confirm(
      `Supprimer l'attribut "${item.name}" ? Les termes associes seront aussi supprimes.`
    );
    if (!confirmed) {
      return;
    }

    setError(null);
    try {
      await deleteAttribute(item.id);
      await loadData();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Impossible de supprimer l'attribut."
      );
    }
  };

  const onDeleteTerm = async (item: AttributeTerm) => {
    const confirmed = window.confirm(
      `Supprimer le terme "${item.name}" ? Cette action est irreversible.`
    );
    if (!confirmed) {
      return;
    }

    setError(null);
    try {
      await deleteTerm(item.id);
      await loadData();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Impossible de supprimer le terme."
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
                Gestion des attributs et termes
              </Text>
              <Text as="p" tone="subdued">
                Créez vos attributs produit puis gérez leurs termes de variation.
              </Text>
            </BlockStack>
            <InlineStack gap="200">
              <Button variant="primary" onClick={openCreateAttributeModal}>
                Ajouter attribut
              </Button>
              <Button onClick={openCreateTermModal} disabled={!attributes.length}>
                Ajouter terme
              </Button>
            </InlineStack>
          </InlineStack>

          <InlineStack gap="200">
            <Badge tone="info">{`Attributs: ${String(attributes.length)}`}</Badge>
            <Badge tone="success">{`Termes: ${String(terms.length)}`}</Badge>
            {selectedAttribute ? (
              <Badge tone="attention">{`Selection: ${selectedAttribute.name}`}</Badge>
            ) : null}
          </InlineStack>
        </BlockStack>
      </Card>

      {error ? <Banner tone="critical" title={error} /> : null}

      <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
        <Card>
          <BlockStack gap="300">
            <Text as="h3" variant="headingMd">
              Attributs
            </Text>
            <TextField
              label="Recherche"
              placeholder="Nom, slug, description..."
              value={search}
              onChange={setSearch}
              autoComplete="off"
            />

            <Divider />

            <IndexTable
              selectable
              loading={loading}
              resourceName={{ singular: "attribut", plural: "attributs" }}
              itemCount={filteredAttributes.length}
              selectedItemsCount={
                allAttributesSelected ? "All" : selectedAttributeResources.length
              }
              onSelectionChange={handleAttributeSelection}
              headings={[
                { title: "Nom" },
                { title: "Slug" },
                { title: "Termes" },
                { title: "Actions", alignment: "end" },
              ]}
            >
              {filteredAttributes.map((item, index) => (
                <IndexTable.Row
                  id={item.id}
                  key={item.id}
                  position={index}
                  selected={selectedAttributeResources.includes(item.id)}
                  onClick={() => setSelectedAttributeId(item.id)}
                >
                  <IndexTable.Cell>
                    <Text as="span" fontWeight={selectedAttributeId === item.id ? "semibold" : "regular"}>
                      {item.name}
                    </Text>
                  </IndexTable.Cell>
                  <IndexTable.Cell>{item.slug}</IndexTable.Cell>
                  <IndexTable.Cell>{item._count?.terms ?? terms.filter((t) => t.attributeId === item.id).length}</IndexTable.Cell>
                  <IndexTable.Cell>
                    <InlineStack align="end" gap="100">
                      <Button
                        icon={PlusCircleIcon}
                        accessibilityLabel="Ajouter terme"
                        onClick={() => {
                          setSelectedAttributeId(item.id);
                          openCreateTermModal();
                        }}
                      />
                      <Button
                        icon={EditIcon}
                        accessibilityLabel="Modifier attribut"
                        onClick={() => openEditAttributeModal(item)}
                      />
                      <Button
                        icon={DeleteIcon}
                        tone="critical"
                        accessibilityLabel="Supprimer attribut"
                        onClick={() => onDeleteAttribute(item)}
                      />
                    </InlineStack>
                  </IndexTable.Cell>
                </IndexTable.Row>
              ))}
            </IndexTable>
          </BlockStack>
        </Card>

        <Card>
          <BlockStack gap="300">
            <InlineStack align="space-between">
              <Text as="h3" variant="headingMd">
                Termes
              </Text>
              <Box minWidth="220px">
                <Select
                  label="Attribut actif"
                  options={
                    attributeOptions.length > 0
                      ? attributeOptions
                      : [{ label: "Aucun attribut", value: "" }]
                  }
                  value={selectedAttributeId}
                  onChange={setSelectedAttributeId}
                  disabled={attributeOptions.length === 0}
                />
              </Box>
            </InlineStack>

            <Divider />

            <IndexTable
              selectable
              loading={loading}
              resourceName={{ singular: "terme", plural: "termes" }}
              itemCount={termsForSelectedAttribute.length}
              selectedItemsCount={allTermsSelected ? "All" : selectedTermResources.length}
              onSelectionChange={handleTermSelection}
              headings={[
                { title: "Nom" },
                { title: "Slug" },
                { title: "Description" },
                { title: "Actions", alignment: "end" },
              ]}
            >
              {termsForSelectedAttribute.map((item, index) => (
                <IndexTable.Row
                  id={item.id}
                  key={item.id}
                  position={index}
                  selected={selectedTermResources.includes(item.id)}
                  onClick={() => {}}
                >
                  <IndexTable.Cell>{item.name}</IndexTable.Cell>
                  <IndexTable.Cell>{item.slug}</IndexTable.Cell>
                  <IndexTable.Cell>
                    <Text as="span" tone="subdued">
                      {item.description || "-"}
                    </Text>
                  </IndexTable.Cell>
                  <IndexTable.Cell>
                    <InlineStack align="end" gap="100">
                      <Button
                        icon={EditIcon}
                        accessibilityLabel="Modifier terme"
                        onClick={() => openEditTermModal(item)}
                      />
                      <Button
                        icon={DeleteIcon}
                        tone="critical"
                        accessibilityLabel="Supprimer terme"
                        onClick={() => onDeleteTerm(item)}
                      />
                    </InlineStack>
                  </IndexTable.Cell>
                </IndexTable.Row>
              ))}
            </IndexTable>
          </BlockStack>
        </Card>
      </InlineGrid>

      <Modal
        open={isAttributeModalOpen}
        onClose={closeAttributeModal}
        title={attributeModalTitle}
        primaryAction={{
          content: savingAttribute ? "Enregistrement..." : "Enregistrer",
          onAction: onSaveAttribute,
          loading: savingAttribute,
        }}
        secondaryActions={[
          {
            content: "Annuler",
            onAction: closeAttributeModal,
          },
        ]}
      >
        <Modal.Section>
          <BlockStack gap="300">
            <TextField
              label="Nom"
              value={attributeFormState.name}
              onChange={onAttributeNameChange}
              autoComplete="off"
            />
            <TextField
              label="Slug"
              value={attributeFormState.slug}
              onChange={(value) => {
                setAttributeSlugWasEdited(true);
                setAttributeFormState((prev) => ({ ...prev, slug: slugify(value) }));
              }}
              autoComplete="off"
            />
            <TextField
              label="Description"
              value={attributeFormState.description}
              onChange={(value) =>
                setAttributeFormState((prev) => ({ ...prev, description: value }))
              }
              multiline={3}
              autoComplete="off"
            />
          </BlockStack>
        </Modal.Section>
      </Modal>

      <Modal
        open={isTermModalOpen}
        onClose={closeTermModal}
        title={termModalTitle}
        primaryAction={{
          content: savingTerm ? "Enregistrement..." : "Enregistrer",
          onAction: onSaveTerm,
          loading: savingTerm,
        }}
        secondaryActions={[
          {
            content: "Annuler",
            onAction: closeTermModal,
          },
        ]}
      >
        <Modal.Section>
          <BlockStack gap="300">
            <Select
              label="Attribut"
              options={attributeOptions}
              value={termFormState.attributeId}
              onChange={(value) =>
                setTermFormState((prev) => ({ ...prev, attributeId: value }))
              }
            />
            <TextField
              label="Nom"
              value={termFormState.name}
              onChange={onTermNameChange}
              autoComplete="off"
            />
            <TextField
              label="Slug"
              value={termFormState.slug}
              onChange={(value) => {
                setTermSlugWasEdited(true);
                setTermFormState((prev) => ({ ...prev, slug: slugify(value) }));
              }}
              autoComplete="off"
            />
            <TextField
              label="Description"
              value={termFormState.description}
              onChange={(value) =>
                setTermFormState((prev) => ({ ...prev, description: value }))
              }
              multiline={3}
              autoComplete="off"
            />
          </BlockStack>
        </Modal.Section>
      </Modal>
    </BlockStack>
  );
}
