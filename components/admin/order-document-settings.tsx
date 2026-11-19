"use client";

import { useEffect, useState } from "react";
import { Banner, BlockStack, Button, Card, Checkbox, InlineGrid, InlineStack, Select, SkeletonBodyText, Text, TextField } from "@shopify/polaris";
import { toast } from "sonner";
import { useAdminSession } from "@/components/admin/admin-session";
import { MediaPickerDialog } from "@/components/admin/media-picker-dialog";
import { documentSettingsApi, type OrderDocumentKind, type ProFormaSettings } from "@/lib/api/order-pro-forma-settings";

type Draft = Omit<ProFormaSettings, "nextNumber"> & { nextNumber: string };

const digitsOptions = Array.from({ length: 9 }, (_, index) => ({
  label: String(index + 1), value: String(index + 1),
}));
const ordersYear = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", year: "numeric" });
const toDraft = (settings: ProFormaSettings): Draft => ({
  ...settings, nextNumber: String(settings.nextNumber),
});

export function OrderDocumentSettings({ kind }: { kind: OrderDocumentKind }) {
  const isSlip = kind === "delivery-slip";
  const isCredit = kind === "credit-note";
  const title = isCredit ? "Avoirs" : isSlip ? "Bons de livraison" : "Factures pro-forma";
  const logoLabel = isCredit ? "Logo de l’avoir" : isSlip ? "Logo du bon de livraison" : "Logo de la facture";
  const { can } = useAdminSession();
  const [saved, setSaved] = useState<ProFormaSettings | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    documentSettingsApi.get(kind).then((settings) => {
      if (cancelled) return;
      setSaved(settings);
      setDraft(toDraft(settings));
    }).catch((loadError: unknown) => {
      if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Chargement impossible.");
    });
    return () => { cancelled = true; };
  }, [kind]);

  if (!draft || !saved) {
    return error
      ? <Banner tone="critical" title="Impossible de charger les réglages du document">{error}</Banner>
      : <Card><SkeletonBodyText lines={7} /></Card>;
  }

  const disabled = saving || !can("settings.edit");
  const set = (changes: Partial<Draft>) => setDraft((current) => current ? { ...current, ...changes } : current);
  const nextNumber = Number(draft.nextNumber);
  const nextEdited = draft.useSequence && draft.nextNumber !== String(saved.nextNumber);
  const nextValid = !nextEdited || (/^\d+$/.test(draft.nextNumber) && nextNumber >= saved.nextNumber && nextNumber <= 999_999_999);
  const logoChanged = draft.logoMediaId !== saved.logoMediaId;
  const dirty = nextEdited || logoChanged || draft.useSequence !== saved.useSequence ||
    draft.prefix !== saved.prefix || draft.digits !== saved.digits || draft.includeYear !== saved.includeYear;
  const example = draft.useSequence
    ? draft.prefix + String(nextValid ? nextNumber : saved.nextNumber).padStart(draft.digits, "0") +
      (draft.includeYear ? `/${ordersYear.format(new Date())}` : "")
    : isSlip ? "BL-C26111247" : "PF-C26111247";

  async function save() {
    if (!draft || !dirty || !nextValid || disabled) return;
    setSaving(true);
    setError("");
    try {
      const result = await documentSettingsApi.save(kind, {
        useSequence: draft.useSequence,
        prefix: draft.prefix,
        digits: draft.digits,
        includeYear: draft.includeYear,
        ...(nextEdited ? { nextNumber } : {}),
        ...(logoChanged ? { logoMediaId: draft.logoMediaId } : {}),
      });
      setSaved(result);
      setDraft(toDraft(result));
      toast.success("Paramètres enregistrés.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <BlockStack gap="400">
      <Text as="h1" variant="headingLg">{title}</Text>
      {error ? <Banner tone="critical" title={error} /> : null}

      <Card>
        <BlockStack gap="400">
          <Text as="h2" variant="headingMd">Numérotation</Text>
          {!isCredit && <Select
            label="Format du numéro"
            options={[
              { label: "Référence de la commande", value: "order" },
              { label: "Numéro séquentiel", value: "sequence" },
            ]}
            value={draft.useSequence ? "sequence" : "order"}
            onChange={(value) => set({ useSequence: value === "sequence" })}
            disabled={disabled}
          />}
          {draft.useSequence ? (
            <BlockStack gap="300">
              <InlineGrid columns={{ xs: 1, md: 3 }} gap="300">
                <TextField
                  label="Préfixe" value={draft.prefix} maxLength={12} autoComplete="off"
                  onChange={(value) => set({ prefix: value.replace(/[^A-Za-z0-9-]/g, "") })}
                  disabled={disabled}
                />
                <Select
                  label="Nombre minimum de chiffres" options={digitsOptions} value={String(draft.digits)}
                  onChange={(value) => set({ digits: Number(value) })} disabled={disabled}
                />
                <TextField
                  label="Prochain numéro" type="number" min={saved.nextNumber} max={999_999_999}
                  value={draft.nextNumber} autoComplete="off" onChange={(value) => set({ nextNumber: value })}
                  error={nextValid ? undefined : `Saisissez un entier entre ${saved.nextNumber} et 999 999 999.`}
                  disabled={disabled}
                />
              </InlineGrid>
              <Checkbox label="Ajouter l’année après le numéro" checked={draft.includeYear}
                onChange={(includeYear) => set({ includeYear })} disabled={disabled} />
            </BlockStack>
          ) : null}
          <Banner tone="info" title={`Aperçu du numéro · ${isCredit ? "" : isSlip ? "#" : "N° "}${example}`} />
        </BlockStack>
      </Card>

      <Card>
        <BlockStack gap="300">
          <Text as="h2" variant="headingMd">{logoLabel}</Text>
          <InlineStack gap="300" blockAlign="center">
            <div className="flex h-20 w-44 items-center justify-center rounded-lg border border-[#e0e3e7] bg-white p-2">
              {draft.logoPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={draft.logoPreview} alt={logoLabel} className="max-h-full max-w-full object-contain" />
              ) : <Text as="span" tone="subdued">Logo FGMC par défaut</Text>}
            </div>
            <BlockStack gap="150" inlineAlign="start">
              <Button onClick={() => setPickerOpen(true)} disabled={disabled}>Choisir dans la médiathèque</Button>
              {draft.logoMediaId ? (
                <Button variant="tertiary" disabled={disabled}
                  onClick={() => set({ logoMediaId: null, logoPreview: null, logoUrl: null })}>
                  Rétablir le logo par défaut
                </Button>
              ) : null}
            </BlockStack>
          </InlineStack>
          <MediaPickerDialog
            open={pickerOpen} imagesOnly selectedUrl={draft.logoUrl}
            onClose={() => setPickerOpen(false)}
            onSelect={(item) => {
              set({ logoMediaId: item.id, logoPreview: item.url, logoUrl: item.url });
              setPickerOpen(false);
            }}
          />
        </BlockStack>
      </Card>

      <InlineStack align="end">
        <Button variant="primary" loading={saving} disabled={disabled || !dirty || !nextValid} onClick={() => void save()}>
          Enregistrer
        </Button>
      </InlineStack>
    </BlockStack>
  );
}
