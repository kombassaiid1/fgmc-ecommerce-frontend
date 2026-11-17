"use client";

import { useEffect, useState } from "react";
import { Badge, Banner, BlockStack, Box, Button, Card, Icon, IndexTable, InlineStack, Pagination, SkeletonBodyText, Text, TextField, Thumbnail } from "@shopify/polaris";
import { ImageIcon, SearchIcon } from "@shopify/polaris-icons";
import { toast } from "sonner";
import { shippingAdmin, type ProductWeightPage } from "@/lib/api/shipping-admin";
import { parseNumber } from "../ui";

export default function ProductWeightsPage() {
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<ProductWeightPage | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");

  // Search as you type, after a short pause.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1);
      setSearch(query);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let cancelled = false;
    shippingAdmin
      .productWeights(search, page)
      .then((data) => {
        if (cancelled) return;
        setResult(data);
        setDrafts(Object.fromEntries(data.data.map((row) => [row.productId, row.weightKg === null ? "" : String(row.weightKg)])));
        setError("");
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Chargement impossible.");
      });
    return () => {
      cancelled = true;
    };
  }, [search, page]);

  async function save(productId: string) {
    const text = drafts[productId] ?? "";
    setSaving(productId);
    try {
      if (text.trim() === "") {
        await shippingAdmin.clearProductWeight(productId);
        toast.success("Poids retiré : le poids par défaut s’appliquera.");
      } else {
        const weight = parseNumber(text);
        if (!Number.isFinite(weight) || weight < 0 || weight > 1000) {
          toast.error("Entrez un poids en kg, entre 0 et 1000.");
          return;
        }
        await shippingAdmin.setProductWeight(productId, weight);
        toast.success("Poids enregistré.");
      }
      setResult((current) =>
        current ? { ...current, data: current.data.map((row) => (row.productId === productId ? { ...row, weightKg: text.trim() === "" ? null : parseNumber(text) } : row)) } : current,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Enregistrement impossible.");
    } finally {
      setSaving("");
    }
  }

  if (error) return <Banner tone="critical" title="Impossible de charger les produits">{error}</Banner>;

  return (
    <BlockStack gap="400">
      <Box maxWidth="720px">
        <Text as="p" variant="bodyMd" tone="subdued">
          Le poids d’une commande est la somme des poids de ses produits. Il sert aux transporteurs facturés « au poids » et aux limites de poids. Un produit sans poids prend le poids par défaut défini dans les préférences.
        </Text>
      </Box>

      <Box maxWidth="480px">
        <TextField
          label="Rechercher un produit"
          labelHidden
          autoComplete="off"
          placeholder="Rechercher un produit"
          prefix={<Icon source={SearchIcon} />}
          value={query}
          onChange={setQuery}
          clearButton
          onClearButtonClick={() => setQuery("")}
        />
      </Box>

      {!result ? (
        <Card><SkeletonBodyText lines={8} /></Card>
      ) : (
        <Card padding="0">
          <IndexTable
            resourceName={{ singular: "produit", plural: "produits" }}
            itemCount={result.data.length}
            selectable={false}
            emptyState={<Box padding="400"><Text as="p" variant="bodyMd" tone="subdued" alignment="center">Aucun produit trouvé.</Text></Box>}
            headings={[{ title: "Produit" }, { title: "Poids" }, { title: "Statut" }, { title: "Action", alignment: "end" }]}>
            {result.data.map((row, index) => {
              const dirty = (drafts[row.productId] ?? "") !== (row.weightKg === null ? "" : String(row.weightKg));
              return (
                <IndexTable.Row id={row.productId} key={row.productId} position={index}>
                  <IndexTable.Cell>
                    <InlineStack gap="300" blockAlign="center" wrap={false}>
                      <Thumbnail source={row.image || ImageIcon} alt="" size="small" />
                      <Text as="span" variant="bodyMd" fontWeight="semibold">{row.title}</Text>
                    </InlineStack>
                  </IndexTable.Cell>
                  <IndexTable.Cell>
                    <Box minWidth="140px" maxWidth="160px">
                      <TextField
                        label={`Poids de ${row.title}`}
                        labelHidden
                        autoComplete="off"
                        inputMode="decimal"
                        suffix="kg"
                        placeholder="—"
                        value={drafts[row.productId] ?? ""}
                        onChange={(value) => setDrafts({ ...drafts, [row.productId]: value })}
                        onBlur={() => {
                          if (dirty) void save(row.productId);
                        }}
                      />
                    </Box>
                  </IndexTable.Cell>
                  <IndexTable.Cell>
                    {row.weightKg === null ? <Badge>Poids par défaut</Badge> : <Badge tone="success">Renseigné</Badge>}
                  </IndexTable.Cell>
                  <IndexTable.Cell>
                    <InlineStack align="end">
                      <Button size="slim" disabled={!dirty} loading={saving === row.productId} onClick={() => void save(row.productId)}>Enregistrer</Button>
                    </InlineStack>
                  </IndexTable.Cell>
                </IndexTable.Row>
              );
            })}
          </IndexTable>
          <Box padding="300" borderBlockStartWidth="025" borderColor="border">
            <InlineStack align="space-between" blockAlign="center">
              <Text as="span" variant="bodySm" tone="subdued">{result.meta.total} produit(s) · page {result.meta.page} sur {result.meta.totalPages}</Text>
              <Pagination
                label={`Page ${result.meta.page} sur ${result.meta.totalPages}`}
                hasPrevious={page > 1}
                onPrevious={() => setPage(page - 1)}
                hasNext={page < result.meta.totalPages}
                onNext={() => setPage(page + 1)}
              />
            </InlineStack>
          </Box>
        </Card>
      )}
    </BlockStack>
  );
}
