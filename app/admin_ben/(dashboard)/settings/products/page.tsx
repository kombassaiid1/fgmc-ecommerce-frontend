"use client";

import { useEffect, useState } from "react";
import { Banner, BlockStack, Button, Card, InlineGrid, InlineStack, Text, TextField } from "@shopify/polaris";
import { DEFAULT_PRODUCT_SETTINGS, getAdminSettings, updateAdminSettings, type ProductSettings } from "@/lib/api/settings";
import { SupplierPricingSettings } from "@/components/admin/supplier-pricing-settings";

type FormValues = Record<keyof ProductSettings, string>;

function toFormValues(settings: Partial<ProductSettings> | null | undefined): FormValues {
  const merged = { ...DEFAULT_PRODUCT_SETTINGS, ...settings };
  return {
    defaultStockQuantity: String(merged.defaultStockQuantity),
    markupPercent: String(merged.markupPercent),
    fixedFee: String(merged.fixedFee),
    roundingIncrement: String(merged.roundingIncrement),
  };
}

export default function ProductSettingsPage() {
  const [values, setValues] = useState<FormValues>(() => toFormValues(DEFAULT_PRODUCT_SETTINGS));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void getAdminSettings()
      .then((settings) => setValues(toFormValues(settings.productSettings)))
      .catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : "Impossible de charger les paramètres produit."))
      .finally(() => setLoading(false));
  }, []);

  const update = (field: keyof ProductSettings, value: string) => {
    setSaved(false);
    setValues((current) => ({ ...current, [field]: value }));
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    const productSettings = {
      defaultStockQuantity: Number(values.defaultStockQuantity),
      markupPercent: Number(values.markupPercent),
      fixedFee: Number(values.fixedFee),
      roundingIncrement: Number(values.roundingIncrement),
    };
    if (Object.values(productSettings).some((value) => !Number.isFinite(value) || value < 0)
      || !Number.isInteger(productSettings.defaultStockQuantity)
      || productSettings.roundingIncrement <= 0) {
      setError("Vérifiez les valeurs : quantités entières positives et pas d’arrondi strictement supérieur à zéro.");
      setSaving(false);
      return;
    }
    try {
      const response = await updateAdminSettings({ productSettings });
      setValues(toFormValues(response.productSettings));
      setSaved(true);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Impossible d’enregistrer les paramètres produit.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <BlockStack gap="400">
      <Card>
        <BlockStack gap="300">
          <InlineStack align="space-between" blockAlign="center" gap="300">
            <BlockStack gap="100">
              <Text as="h1" variant="headingLg">Paramètres produit</Text>
              <Text as="p" tone="subdued">Le stock par défaut alimente le formulaire de création produit. La règle de prix est appliquée par l’agent lorsqu’il prépare un produit fournisseur sans prix de vente explicite.</Text>
            </BlockStack>
            <InlineStack gap="200">
              <Button onClick={() => { setValues(toFormValues(DEFAULT_PRODUCT_SETTINGS)); setSaved(false); }}>Valeurs par défaut</Button>
              <Button variant="primary" loading={saving} disabled={loading} onClick={() => void save()}>Enregistrer</Button>
            </InlineStack>
          </InlineStack>
          {error ? <Banner tone="critical" title={error} /> : null}
          {saved ? <Banner tone="success" title="Les paramètres produit ont été enregistrés." /> : null}
        </BlockStack>
      </Card>

      <Card>
        {loading ? <Text as="p" tone="subdued">Chargement des paramètres...</Text> : (
          <BlockStack gap="500">
            <BlockStack gap="200">
              <Text as="h2" variant="headingMd">Stock initial</Text>
              <TextField label="Quantité de stock par défaut" type="number" min={0} value={values.defaultStockQuantity} onChange={(value) => update("defaultStockQuantity", value)} autoComplete="off" helpText="Appliquée si aucune quantité n’est fournie pour le nouveau produit." />
            </BlockStack>
            <BlockStack gap="200">
              <Text as="h2" variant="headingMd">Calcul du prix de vente</Text>
              <Text as="p" tone="subdued">La règle s’applique si le prix de vente n’est pas donné et qu’un prix d’achat fournisseur est disponible. Un prix de vente saisi explicitement reste inchangé.</Text>
              <InlineGrid columns={{ xs: 1, md: 3 }} gap="300">
                <TextField label="Majoration" type="number" min={0} step={0.1} suffix="%" value={values.markupPercent} onChange={(value) => update("markupPercent", value)} autoComplete="off" />
                <TextField label="Frais fixes ajoutés" type="number" min={0} step={0.01} prefix="€" value={values.fixedFee} onChange={(value) => update("fixedFee", value)} autoComplete="off" />
                <TextField label="Pas d’arrondi" type="number" min={0.001} step={0.01} prefix="€" value={values.roundingIncrement} onChange={(value) => update("roundingIncrement", value)} autoComplete="off" helpText="Exemple : 0,05 arrondit au multiple de 5 centimes le plus proche." />
              </InlineGrid>
              <div className="rounded-lg bg-[#f6f8fa] p-4 text-sm text-[#475467]">
                <strong>Prix de vente HT :</strong> (coût d’achat net HT × (1 + majoration / 100) + frais fixes), puis arrondi au pas choisi.
                <br />Exemple avec les valeurs actuelles : 10 € × (1 + {values.markupPercent || "0"} / 100) + {values.fixedFee || "0"} €.
              </div>
            </BlockStack>
          </BlockStack>
        )}
      </Card>
      <SupplierPricingSettings />
    </BlockStack>
  );
}
