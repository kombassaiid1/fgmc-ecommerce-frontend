"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Banner, BlockStack, Button, Card, InlineStack, Select, Text } from "@shopify/polaris";

import { PuckEditor } from "@/components/puck/puck-editor";
import { getPageBySlug, upsertPage } from "@/lib/api/pages";

const PAGE_OPTIONS = [
  { label: "Accueil", value: "home" },
  { label: "Template categorie", value: "category" },
  { label: "Template produit", value: "product" },
  { label: "Template blog", value: "blog" },
];

const EMPTY_DATA: Record<string, unknown> = {
  content: [],
  root: { props: { title: "Nouvelle page" } },
  zones: {},
};

export default function AdminAppearanceBuilderPage() {
  const searchParams = useSearchParams();
  const initialSlugFromQuery = searchParams.get("slug")?.trim() || "home";
  const [slug, setSlug] = useState("home");
  const [data, setData] = useState<Record<string, unknown>>(EMPTY_DATA);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setSlug(initialSlugFromQuery);
  }, [initialSlugFromQuery]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      setSuccess(null);
      try {
        const page = await getPageBySlug(slug);
        setData((page.data as Record<string, unknown>) ?? EMPTY_DATA);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Impossible de charger la page du builder.",
        );
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [slug]);

  const pageOptions = useMemo(() => {
    if (PAGE_OPTIONS.some((option) => option.value === slug)) {
      return PAGE_OPTIONS;
    }
    return [{ label: `${slug} (custom)`, value: slug }, ...PAGE_OPTIONS];
  }, [slug]);

  const currentLabel = useMemo(
    () => pageOptions.find((option) => option.value === slug)?.label ?? slug,
    [pageOptions, slug],
  );

  return (
    <div style={{ padding: 16 }}>
      <BlockStack gap="400">
        <Card>
          <BlockStack gap="200">
            <InlineStack align="space-between" blockAlign="center">
              <Text as="h2" variant="headingLg">
                Builder de pages
              </Text>
              <InlineStack gap="200" blockAlign="center">
                <Button url="/admin_ben/apparence/pages">Retour aux pages</Button>
                <Select
                  label=""
                  labelHidden
                  options={pageOptions}
                  value={slug}
                  onChange={setSlug}
                />
              </InlineStack>
            </InlineStack>
            <Text as="p" tone="subdued">
              Editez le layout par drag & drop pour: {currentLabel}.
            </Text>
          </BlockStack>
        </Card>

        {error ? <Banner tone="critical" title={error} /> : null}
        {success ? <Banner tone="success" title={success} /> : null}

        {loading ? (
          <Card>
            <Text as="p" tone="subdued">
              Chargement du builder...
            </Text>
          </Card>
        ) : (
          <div style={{ minHeight: "76vh" }}>
            <PuckEditor
              data={data}
              onPublish={async (nextData) => {
                setSaving(true);
                setError(null);
                setSuccess(null);
                try {
                  await upsertPage({
                    slug,
                    title: `Builder ${slug}`,
                    data: nextData,
                  });
                  setData(nextData);
                  setSuccess("Page enregistree avec succes.");
                } catch (saveError) {
                  setError(
                    saveError instanceof Error
                      ? saveError.message
                      : "Impossible d'enregistrer la page.",
                  );
                } finally {
                  setSaving(false);
                }
              }}
            />
          </div>
        )}

        {saving ? (
          <Card>
            <InlineStack align="space-between" blockAlign="center">
              <Text as="p">Enregistrement...</Text>
              <Button disabled loading>
                Enregistrement
              </Button>
            </InlineStack>
          </Card>
        ) : null}
      </BlockStack>
    </div>
  );
}
