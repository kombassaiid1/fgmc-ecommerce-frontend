"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Banner,
  BlockStack,
  Box,
  Button,
  Card,
  Checkbox,
  Divider,
  IndexTable,
  InlineStack,
  Modal,
  Text,
  TextField,
  useIndexResourceState,
} from "@shopify/polaris";
import { DeleteIcon, EditIcon, PlusCircleIcon } from "@shopify/polaris-icons";

import { createTax, deleteTax, getTaxes, updateTax, type Tax } from "@/lib/api/taxes";

type TaxFormState = {
  id?: string;
  name: string;
  rate: string;
  isDefault: boolean;
};

const EMPTY_FORM: TaxFormState = {
  name: "",
  rate: "0",
  isDefault: false,
};

export default function AdminSettingsTaxesPage() {
  const [taxes, setTaxes] = useState<Tax[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState("Nouvelle taxe");
  const [formState, setFormState] = useState<TaxFormState>(EMPTY_FORM);

  const loadTaxes = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getTaxes({ limit: 500 });
      setTaxes(response.data);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Impossible de charger les taxes."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadTaxes();
  }, []);

  const filteredTaxes = useMemo(() => {
    const query = search.trim().toLowerCase();
    const sorted = [...taxes].sort((a, b) => a.name.localeCompare(b.name, "fr"));
    if (!query) {
      return sorted;
    }
    return sorted.filter((item) => item.name.toLowerCase().includes(query));
  }, [search, taxes]);

  const {
    selectedResources,
    allResourcesSelected,
    handleSelectionChange,
  } = useIndexResourceState(filteredTaxes, {
    resourceIDResolver: (item) => item.id,
  });

  const openCreateModal = () => {
    setFormState(EMPTY_FORM);
    setModalTitle("Nouvelle taxe");
    setIsModalOpen(true);
  };

  const openEditModal = (item: Tax) => {
    setFormState({
      id: item.id,
      name: item.name,
      rate: String(item.rate),
      isDefault: item.isDefault,
    });
    setModalTitle("Modifier la taxe");
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setFormState(EMPTY_FORM);
  };

  const onSave = async () => {
    if (!formState.name.trim()) {
      setError("Le nom de la taxe est obligatoire.");
      return;
    }
    const rate = Number(formState.rate);
    if (Number.isNaN(rate) || rate < 0) {
      setError("Le taux doit etre un nombre superieur ou egal a 0.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: formState.name.trim(),
        rate,
        isDefault: formState.isDefault,
      };
      if (formState.id) {
        await updateTax(formState.id, payload);
      } else {
        await createTax(payload);
      }
      closeModal();
      await loadTaxes();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Impossible d'enregistrer la taxe."
      );
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (item: Tax) => {
    const confirmed = window.confirm(
      `Supprimer la taxe "${item.name}" ? Cette action est irreversible.`
    );
    if (!confirmed) return;

    setError(null);
    try {
      await deleteTax(item.id);
      await loadTaxes();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Impossible de supprimer la taxe."
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
                Gestion des taxes
              </Text>
              <Text as="p" tone="subdued">
                Creez et gerez vos taux de taxes (TVA, etc.).
              </Text>
            </BlockStack>
            <Button icon={PlusCircleIcon} variant="primary" onClick={openCreateModal}>
              Ajouter taxe
            </Button>
          </InlineStack>
          <InlineStack gap="200">
            <Badge tone="info">{`Total: ${String(taxes.length)}`}</Badge>
            <Badge tone="success">{`Par defaut: ${String(taxes.filter((t) => t.isDefault).length)}`}</Badge>
          </InlineStack>
        </BlockStack>
      </Card>

      {error ? <Banner tone="critical" title={error} /> : null}

      <Card>
        <BlockStack gap="300">
          <Box minWidth="280px" width="45%">
            <TextField
              label="Recherche"
              placeholder="Nom de la taxe..."
              value={search}
              onChange={setSearch}
              autoComplete="off"
            />
          </Box>

          <Divider />

          <IndexTable
            selectable
            loading={loading}
            resourceName={{ singular: "taxe", plural: "taxes" }}
            itemCount={filteredTaxes.length}
            selectedItemsCount={allResourcesSelected ? "All" : selectedResources.length}
            onSelectionChange={handleSelectionChange}
            emptyState={
              <Box padding="400">
                <Text as="p" tone="subdued">
                  Aucune taxe trouvee.
                </Text>
              </Box>
            }
            headings={[
              { title: "Nom" },
              { title: "Taux (%)" },
              { title: "Par defaut" },
              { title: "Produits" },
              { title: "Actions", alignment: "end" },
            ]}
          >
            {filteredTaxes.map((item, index) => (
              <IndexTable.Row
                id={item.id}
                key={item.id}
                position={index}
                selected={selectedResources.includes(item.id)}
                onClick={() => {}}
              >
                <IndexTable.Cell>
                  <InlineStack gap="200" blockAlign="center">
                    <Text as="span">{item.name}</Text>
                    {item.isDefault ? <Badge tone="success">Defaut</Badge> : null}
                  </InlineStack>
                </IndexTable.Cell>
                <IndexTable.Cell>{item.rate}</IndexTable.Cell>
                <IndexTable.Cell>{item.isDefault ? "Oui" : "Non"}</IndexTable.Cell>
                <IndexTable.Cell>{item._count?.products ?? 0}</IndexTable.Cell>
                <IndexTable.Cell>
                  <InlineStack gap="100" align="end">
                    <Button
                      icon={EditIcon}
                      accessibilityLabel="Modifier la taxe"
                      onClick={() => openEditModal(item)}
                    />
                    <Button
                      icon={DeleteIcon}
                      tone="critical"
                      accessibilityLabel="Supprimer la taxe"
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
        secondaryActions={[{ content: "Annuler", onAction: closeModal }]}
      >
        <Modal.Section>
          <BlockStack gap="300">
            <TextField
              label="Nom"
              value={formState.name}
              onChange={(value) => setFormState((prev) => ({ ...prev, name: value }))}
              autoComplete="off"
            />
            <TextField
              label="Taux (%)"
              value={formState.rate}
              onChange={(value) => setFormState((prev) => ({ ...prev, rate: value }))}
              autoComplete="off"
            />
            <Checkbox
              label="Definir comme taxe par defaut"
              checked={formState.isDefault}
              onChange={(checked) =>
                setFormState((prev) => ({ ...prev, isDefault: checked }))
              }
            />
          </BlockStack>
        </Modal.Section>
      </Modal>
    </BlockStack>
  );
}
