"use client";

import { useEffect, useState } from "react";
import { Banner, BlockStack, Button, Card, InlineStack, Text } from "@shopify/polaris";
import { getAdminSettings, updateAdminSettings } from "@/lib/api/settings";
import { DEFAULT_ORDER_STATUS_COLORS, mergeOrderStatusColors, ORDER_STATUS_OPTIONS, type OrderStatusColors } from "@/lib/order-statuses";

export default function OrderStatusColorsPage() {
  const [colors, setColors] = useState<OrderStatusColors>(mergeOrderStatusColors());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void getAdminSettings()
      .then((settings) => setColors(mergeOrderStatusColors(settings.orderStatusColors)))
      .catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : "Impossible de charger les couleurs."))
      .finally(() => setLoading(false));
  }, []);

  const updateColor = (status: string, field: "backgroundColor" | "textColor", value: string) => {
    setSaved(false);
    setColors((current) => ({ ...current, [status]: { ...current[status], [field]: value } }));
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const response = await updateAdminSettings({ orderStatusColors: colors });
      setColors(mergeOrderStatusColors(response.orderStatusColors));
      setSaved(true);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Impossible d'enregistrer les couleurs.");
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
              <Text as="h1" variant="headingLg">Couleurs des statuts de commande</Text>
              <Text as="p" tone="subdued">Choisissez une couleur de fond et une couleur de texte pour chaque statut. Ces couleurs seront visibles dans le tableau des commandes.</Text>
            </BlockStack>
            <InlineStack gap="200">
              <Button onClick={() => { setColors(mergeOrderStatusColors(DEFAULT_ORDER_STATUS_COLORS)); setSaved(false); }}>Valeurs par défaut</Button>
              <Button variant="primary" loading={saving} disabled={loading} onClick={() => void save()}>Enregistrer</Button>
            </InlineStack>
          </InlineStack>
          {error ? <Banner tone="critical" title={error} /> : null}
          {saved ? <Banner tone="success" title="Les couleurs des statuts ont été enregistrées." /> : null}
        </BlockStack>
      </Card>

      <Card padding="0">
        <div className="hidden grid-cols-[minmax(220px,1fr)_minmax(160px,220px)_minmax(160px,220px)_160px] items-center gap-x-4 border-b border-[#dce4ea] bg-[#f8fafb] px-5 py-3 text-xs font-semibold uppercase tracking-wide text-[#617184] sm:grid">
          <span>Statut</span><span>Fond</span><span>Texte</span><span>Aperçu</span>
        </div>
        {loading ? <div className="px-5 py-8 text-sm text-[#708090]">Chargement des paramètres...</div> : ORDER_STATUS_OPTIONS.filter(({ value }) => value).map(({ label, value }) => {
          const color = colors[value] ?? DEFAULT_ORDER_STATUS_COLORS[value];
          return (
            <div key={value} className="grid grid-cols-1 gap-y-2 border-b border-[#e7edf1] px-5 py-3 last:border-b-0 sm:grid-cols-[minmax(220px,1fr)_minmax(160px,220px)_minmax(160px,220px)_160px] sm:items-center sm:gap-x-4">
              <Text as="span" variant="bodyMd">{label}</Text>
              <label className="flex items-center gap-2 text-xs text-[#617184]">
                <input aria-label={`Couleur de fond : ${label}`} type="color" value={color.backgroundColor} onChange={(event) => updateColor(value, "backgroundColor", event.target.value)} className="h-9 w-12 cursor-pointer rounded border border-[#cbd6de] bg-white p-1" />
                <span>{color.backgroundColor.toUpperCase()}</span>
              </label>
              <label className="flex items-center gap-2 text-xs text-[#617184]">
                <input aria-label={`Couleur du texte : ${label}`} type="color" value={color.textColor} onChange={(event) => updateColor(value, "textColor", event.target.value)} className="h-9 w-12 cursor-pointer rounded border border-[#cbd6de] bg-white p-1" />
                <span>{color.textColor.toUpperCase()}</span>
              </label>
              <span className="inline-flex w-fit max-w-full rounded-full px-3 py-1 text-xs font-semibold" style={{ backgroundColor: color.backgroundColor, color: color.textColor }}>{label}</span>
            </div>
          );
        })}
      </Card>
    </BlockStack>
  );
}
