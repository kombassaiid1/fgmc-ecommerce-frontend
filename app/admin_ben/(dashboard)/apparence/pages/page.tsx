"use client";

import { useEffect, useMemo, useState } from "react";
import {
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
} from "@shopify/polaris";

import { listPages, upsertPage, type PageListItem } from "@/lib/api/pages";

const EMPTY_PAGE_DATA: Record<string, unknown> = {
  content: [],
  root: { props: {} },
  zones: {},
};

function normalizeSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export default function AdminAppearancePagesPage() {
  const [items, setItems] = useState<PageListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);

  const loadPages = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await listPages();
      const sorted = [...response.pages].sort((a, b) =>
        a.slug.localeCompare(b.slug, "fr"),
      );
      setItems(sorted);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Impossible de charger les pages.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPages();
  }, []);

  const onOpenCreate = () => {
    setIsModalOpen(true);
    setNewTitle("");
    setNewSlug("");
    setSlugEdited(false);
  };

  const onCreate = async () => {
    const slug = normalizeSlug(newSlug || newTitle);
    if (!slug) {
      setError("Le slug est obligatoire.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await upsertPage({
        slug,
        title: newTitle.trim() || slug,
        data: EMPTY_PAGE_DATA,
      });
      setSuccess("Page creee avec succes.");
      setIsModalOpen(false);
      await loadPages();
      window.location.assign(`/admin_ben/apparence/builder?slug=${encodeURIComponent(slug)}`);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Impossible de creer la page.",
      );
    } finally {
      setSaving(false);
    }
  };

  const heading = useMemo(
    () => `Pages (${String(items.length)})`,
    [items.length],
  );

  return (
    <BlockStack gap="500">
      <Card>
        <InlineStack align="space-between" blockAlign="center">
          <BlockStack gap="100">
            <Text as="h2" variant="headingLg">
              {heading}
            </Text>
            <Text as="p" tone="subdued">
              Liste de toutes les pages creees depuis le builder.
            </Text>
          </BlockStack>
          <Button variant="primary" onClick={onOpenCreate}>
            Creer une page
          </Button>
        </InlineStack>
      </Card>

      {error ? <Banner tone="critical" title={error} /> : null}
      {success ? <Banner tone="success" title={success} /> : null}

      <Card>
        <BlockStack gap="300">
          <Divider />
          <IndexTable
            selectable={false}
            loading={loading}
            resourceName={{ singular: "page", plural: "pages" }}
            itemCount={items.length}
            emptyState={
              <Box padding="400">
                <Text as="p" tone="subdued">
                  Aucune page trouvee.
                </Text>
              </Box>
            }
            headings={[
              { title: "Titre" },
              { title: "Slug" },
              { title: "Derniere mise a jour" },
              { title: "Actions", alignment: "end" },
            ]}>
            {items.map((item, index) => (
              <IndexTable.Row id={item.id} key={item.id} position={index}>
                <IndexTable.Cell>{item.title || "-"}</IndexTable.Cell>
                <IndexTable.Cell>{item.slug}</IndexTable.Cell>
                <IndexTable.Cell>
                  {new Date(item.updatedAt).toLocaleString("fr-FR")}
                </IndexTable.Cell>
                <IndexTable.Cell>
                  <InlineStack align="end">
                    <Button url={`/admin_ben/apparence/builder?slug=${encodeURIComponent(item.slug)}`}>
                      Modifier
                    </Button>
                  </InlineStack>
                </IndexTable.Cell>
              </IndexTable.Row>
            ))}
          </IndexTable>
        </BlockStack>
      </Card>

      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Nouvelle page"
        primaryAction={{
          content: saving ? "Creation..." : "Creer",
          onAction: onCreate,
          loading: saving,
        }}
        secondaryActions={[{ content: "Annuler", onAction: () => setIsModalOpen(false) }]}>
        <Modal.Section>
          <BlockStack gap="300">
            <TextField
              label="Titre"
              value={newTitle}
              onChange={(value) => {
                setNewTitle(value);
                if (!slugEdited) {
                  setNewSlug(normalizeSlug(value));
                }
              }}
              autoComplete="off"
            />
            <TextField
              label="Slug"
              value={newSlug}
              onChange={(value) => {
                setSlugEdited(true);
                setNewSlug(normalizeSlug(value));
              }}
              autoComplete="off"
            />
          </BlockStack>
        </Modal.Section>
      </Modal>
    </BlockStack>
  );
}
