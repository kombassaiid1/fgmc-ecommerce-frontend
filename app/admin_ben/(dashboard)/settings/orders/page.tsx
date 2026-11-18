"use client";

import { useEffect, useState } from "react";
import { Banner, BlockStack, Button, Card, ChoiceList, InlineStack, Select, SkeletonBodyText, Text, TextField } from "@shopify/polaris";
import { toast } from "sonner";
import { orderSettingsApi } from "@/lib/api/order-settings";
import { previewReference, type OrderSettings, type ReferenceReset, type ReferenceType } from "@/lib/order-reference";

type Draft = { type: ReferenceType; prefix: string; digits: string; reset: ReferenceReset; nextNumber: string };

const toDraft = (settings: OrderSettings): Draft => ({
  type: settings.type,
  prefix: settings.prefix,
  digits: String(settings.digits),
  reset: settings.reset,
  nextNumber: settings.nextNumber == null ? "" : String(settings.nextNumber),
});

const DIGITS = Array.from({ length: 9 }, (_, index) => ({ label: index === 0 ? "1 (sans zéros devant)" : `${index + 1}`, value: String(index + 1) }));
const RESETS: Array<{ label: string; value: ReferenceReset }> = [
  { label: "Jamais : le numéro continue toujours", value: "NEVER" },
  { label: "Chaque année", value: "YEARLY" },
  { label: "Chaque mois", value: "MONTHLY" },
];

/** Paramètres de la boutique, Commandes: how new orders are numbered. */
export default function OrderSettingsPage() {
  const [saved, setSaved] = useState<OrderSettings | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    orderSettingsApi
      .get()
      .then((settings) => {
        if (cancelled) return;
        setSaved(settings);
        setDraft(toDraft(settings));
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Chargement impossible.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error && !draft) return <Banner tone="critical" title="Impossible de charger les réglages des commandes">{error}</Banner>;
  if (!draft || !saved) return <Card><SkeletonBodyText lines={8} /></Card>;

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((old) => (old ? { ...old, [key]: value } : old));
  const sequence = draft.type !== "RANDOM";
  const digits = Number(draft.digits) || 1;
  const next = Number(draft.nextNumber);
  const nextValid = !sequence || draft.nextNumber === "" || (Number.isInteger(next) && next >= 1 && next <= 999_999_999);
  const sample = (type: ReferenceType) => previewReference(type, draft.prefix, digits, nextValid && next >= 1 ? next : saved.nextNumber ?? 1);
  const dirty = JSON.stringify(draft) !== JSON.stringify(toDraft(saved));

  const choices: Array<{ value: ReferenceType; label: string; helpText: string }> = [
    { value: "PREFIX_YEAR_MONTH_SEQ", label: "Préfixe, année, mois et numéro", helpText: `Par exemple ${sample("PREFIX_YEAR_MONTH_SEQ")} : ${draft.prefix || "(sans préfixe)"} + année + mois + numéro de commande.` },
    { value: "PREFIX_YEAR_SEQ", label: "Préfixe, année et numéro", helpText: `Par exemple ${sample("PREFIX_YEAR_SEQ")}.` },
    { value: "PREFIX_SEQ", label: "Préfixe et numéro", helpText: `Par exemple ${sample("PREFIX_SEQ")}.` },
    { value: "RANDOM", label: "Aléatoire", helpText: "9 lettres au hasard, comme la référence par défaut de PrestaShop (par exemple XKBKNABJK)." },
  ];

  async function save() {
    if (!draft || !nextValid) return;
    setSaving(true);
    setError("");
    try {
      const result = await orderSettingsApi.save({
        type: draft.type,
        prefix: draft.prefix.trim(),
        digits,
        reset: draft.reset,
        ...(sequence && draft.nextNumber !== "" ? { nextNumber: next } : {}),
      });
      setSaved(result);
      setDraft(toDraft(result));
      toast.success("Référence des commandes enregistrée.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <BlockStack gap="400">
      <Card>
        <BlockStack gap="500">
          <BlockStack gap="100">
            <Text as="h1" variant="headingLg">Commandes</Text>
            <Text as="p" tone="subdued">Choisissez comment les nouvelles commandes sont numérotées. Les commandes déjà passées gardent leur référence.</Text>
          </BlockStack>
          {error ? <Banner tone="critical" title={error} /> : null}

          <ChoiceList title="Format de la référence des commandes" choices={choices} selected={[draft.type]} onChange={(value) => set("type", (value[0] as ReferenceType) ?? draft.type)} />

          {sequence ? (
            <BlockStack gap="400">
              <InlineStack gap="400" wrap>
                <div style={{ width: 200 }}>
                  <TextField label="Préfixe" autoComplete="off" maxLength={6} value={draft.prefix} helpText="6 lettres ou chiffres au plus, ou rien." onChange={(value) => set("prefix", value.replace(/[^A-Za-z0-9]/g, ""))} />
                </div>
                <div style={{ width: 240 }}>
                  <Select label="Chiffres minimum du numéro" options={DIGITS} value={draft.digits} helpText="Complète avec des zéros devant." onChange={(value) => set("digits", value)} />
                </div>
                <div style={{ width: 300 }}>
                  <Select label="Le numéro repart à 1" options={RESETS} value={draft.reset} onChange={(value) => set("reset", value as ReferenceReset)} />
                </div>
              </InlineStack>
              <div style={{ maxWidth: 300 }}>
                <TextField
                  label="Numéro de la prochaine commande"
                  type="number"
                  autoComplete="off"
                  min={1}
                  value={draft.nextNumber}
                  error={nextValid ? undefined : "Indiquez un nombre entier, 1 ou plus."}
                  helpText="Pour continuer la numérotation de PrestaShop, indiquez le numéro qui suit votre dernière commande."
                  onChange={(value) => set("nextNumber", value)}
                />
              </div>
            </BlockStack>
          ) : null}

          <Banner tone="info" title={`La prochaine commande aura la référence ${dirty || !sequence ? sample(draft.type) : saved.example}`}>
            <p>{sequence ? "Le numéro augmente de 1 à chaque commande." : "Une référence au hasard est choisie pour chaque commande."} Deux commandes n’ont jamais la même référence.</p>
          </Banner>
        </BlockStack>
      </Card>

      <InlineStack align="end">
        <Button variant="primary" loading={saving} disabled={!dirty || !nextValid} onClick={() => void save()}>Enregistrer</Button>
      </InlineStack>
    </BlockStack>
  );
}
