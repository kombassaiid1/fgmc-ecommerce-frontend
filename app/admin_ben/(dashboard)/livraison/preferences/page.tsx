"use client";

import { useEffect, useMemo, useState } from "react";
import { Banner, BlockStack, Box, Button, Card, FormLayout, InlineStack, Select, SkeletonBodyText, Text, TextField } from "@shopify/polaris";
import { toast } from "sonner";
import { shippingAdmin, type Carrier, type Preferences } from "@/lib/api/shipping-admin";
import { parseNumber } from "../ui";

type Draft = {
  handlingFee: string;
  freeAbovePrice: string;
  freeAboveWeightKg: string;
  defaultCarrier: string;
  sortBy: Preferences["sortBy"];
  orderWay: Preferences["orderWay"];
  defaultItemWeightKg: string;
};

const toDraft = (p: Preferences): Draft => ({
  handlingFee: String(p.handlingFee),
  freeAbovePrice: String(p.freeAbovePrice),
  freeAboveWeightKg: String(p.freeAboveWeightKg),
  defaultCarrier: p.defaultCarrier,
  sortBy: p.sortBy,
  orderWay: p.orderWay,
  defaultItemWeightKg: String(p.defaultItemWeightKg),
});

export default function PreferencesPage() {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saved, setSaved] = useState<Draft | null>(null);
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([shippingAdmin.preferences(), shippingAdmin.carriers()])
      .then(([preferences, list]) => {
        if (cancelled) return;
        setDraft(toDraft(preferences));
        setSaved(toDraft(preferences));
        setCarriers(list);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Chargement impossible.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(saved), [draft, saved]);

  if (error) return <Banner tone="critical" title="Impossible de charger les préférences">{error}</Banner>;
  if (!draft) return <Card><SkeletonBodyText lines={8} /></Card>;

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft({ ...draft, [key]: value });

  async function save() {
    if (!draft) return;
    const numbers = {
      handlingFee: parseNumber(draft.handlingFee),
      freeAbovePrice: parseNumber(draft.freeAbovePrice),
      freeAboveWeightKg: parseNumber(draft.freeAboveWeightKg),
      defaultItemWeightKg: parseNumber(draft.defaultItemWeightKg),
    };
    if (Object.values(numbers).some((value) => !Number.isFinite(value) || value < 0)) {
      return toast.error("Les montants et poids doivent être des nombres positifs ou zéro.");
    }
    setSaving(true);
    try {
      const result = await shippingAdmin.savePreferences({ ...numbers, defaultCarrier: draft.defaultCarrier, sortBy: draft.sortBy, orderWay: draft.orderWay });
      setDraft(toDraft(result));
      setSaved(toDraft(result));
      toast.success("Préférences enregistrées.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Box maxWidth="900px">
      <BlockStack gap="400">
        <Card>
          <BlockStack gap="400">
            <BlockStack gap="100">
              <Text as="h2" variant="headingMd">Frais et livraison gratuite</Text>
              <Text as="p" variant="bodySm" tone="subdued">
                Une livraison gratuite supprime aussi les frais de manutention. Elle ne fait pas apparaître un transporteur qui ne livre pas la zone du client.
              </Text>
            </BlockStack>
            <FormLayout>
              <FormLayout.Group>
                <TextField label="Frais de manutention" autoComplete="off" inputMode="decimal" suffix="€" value={draft.handlingFee} onChange={(v) => set("handlingFee", v)} helpText="Ajoutés une fois par commande aux transporteurs qui les incluent. 0 si vous n’en facturez pas." />
                <TextField label="Gratuite à partir d’un montant" autoComplete="off" inputMode="decimal" suffix="€" value={draft.freeAbovePrice} onChange={(v) => set("freeAbovePrice", v)} helpText="Montant de la commande à partir duquel la livraison est offerte. 0 désactive la règle." />
                <TextField label="Gratuite à partir d’un poids" autoComplete="off" inputMode="decimal" suffix="kg" value={draft.freeAboveWeightKg} onChange={(v) => set("freeAboveWeightKg", v)} helpText="Poids de la commande à partir duquel la livraison est offerte. 0 désactive la règle." />
              </FormLayout.Group>
            </FormLayout>
          </BlockStack>
        </Card>

        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">Affichage au client</Text>
            <FormLayout>
              <FormLayout.Group>
                <Select
                  label="Transporteur mis en avant"
                  options={[
                    { label: "Le moins cher", value: "BEST_PRICE" },
                    { label: "Le plus rapide", value: "BEST_GRADE" },
                    ...carriers.map((carrier) => ({ label: carrier.name, value: carrier.id })),
                  ]}
                  value={draft.defaultCarrier}
                  onChange={(v) => set("defaultCarrier", v)}
                  helpText="Présélectionné au paiement quand il peut livrer la commande."
                />
                <Select
                  label="Trier par"
                  options={[{ label: "Position (ordre de la liste)", value: "POSITION" }, { label: "Prix", value: "PRICE" }]}
                  value={draft.sortBy}
                  onChange={(v) => set("sortBy", v as Draft["sortBy"])}
                />
                <Select
                  label="Sens du tri"
                  options={[{ label: "Croissant", value: "ASC" }, { label: "Décroissant", value: "DESC" }]}
                  value={draft.orderWay}
                  onChange={(v) => set("orderWay", v as Draft["orderWay"])}
                />
              </FormLayout.Group>
            </FormLayout>
          </BlockStack>
        </Card>

        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">Poids</Text>
            <Box maxWidth="360px">
              <TextField
                label="Poids par défaut d’un article"
                autoComplete="off"
                inputMode="decimal"
                suffix="kg"
                value={draft.defaultItemWeightKg}
                onChange={(v) => set("defaultItemWeightKg", v)}
                helpText="Utilisé pour un produit sans poids renseigné. Laissez 0 pour qu’il ne compte pas dans le poids de la commande."
              />
            </Box>
          </BlockStack>
        </Card>

        <InlineStack gap="300" blockAlign="center">
          <Button variant="primary" onClick={() => void save()} loading={saving} disabled={!dirty}>Enregistrer</Button>
          {dirty ? <Text as="span" variant="bodySm" tone="subdued">Des modifications ne sont pas enregistrées.</Text> : null}
        </InlineStack>
      </BlockStack>
    </Box>
  );
}
