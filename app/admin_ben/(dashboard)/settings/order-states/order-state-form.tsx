"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Banner, BlockStack, Button, Card, Checkbox, InlineStack, Select, SkeletonBodyText, Text, TextField } from "@shopify/polaris";
import { toast } from "sonner";
import { EMPTY_ORDER_STATE, orderStatesApi, toInput, type OrderStateInput } from "@/lib/api/order-states";
import { LogoField } from "../../livraison/logo-field";

/** The color to write on a background, black or white, as PrestaShop does for its status labels. */
function textColorFor(background: string) {
  const hex = /^#[0-9a-f]{6}$/i.test(background) ? background.slice(1) : "d1d5db";
  const [r, g, b] = [0, 2, 4].map((index) => parseInt(hex.slice(index, index + 2), 16));
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? "#1f2937" : "#ffffff";
}

const FORBIDDEN = /[<>;=#{}]/;
const BASE = "/admin_ben/settings/order-states";

/** Add or edit an order status, with the same options as PrestaShop's form. */
export function OrderStateForm({ id }: { id?: string }) {
  const router = useRouter();
  const [draft, setDraft] = useState<OrderStateInput | null>(id ? null : EMPTY_ORDER_STATE);
  const [templates, setTemplates] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [removable, setRemovable] = useState(true);

  useEffect(() => {
    let cancelled = false;
    orderStatesApi.templates().then((list) => { if (!cancelled) setTemplates(list); }).catch(() => undefined);
    if (id) {
      orderStatesApi
        .get(id)
        .then((state) => {
          if (cancelled) return;
          setDraft(toInput(state));
          setRemovable(!state.unremovable);
        })
        .catch((e: unknown) => {
          if (!cancelled) setError(e instanceof Error ? e.message : "Chargement impossible.");
        });
    }
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (error && !draft) return <Banner tone="critical" title="Impossible de charger ce statut">{error}</Banner>;
  if (!draft) return <Card><SkeletonBodyText lines={8} /></Card>;

  const set = <K extends keyof OrderStateInput>(key: K, value: OrderStateInput[K]) => setDraft((old) => (old ? { ...old, [key]: value } : old));
  const nameProblem = !draft.name.trim() ? "Indiquez le nom du statut." : FORBIDDEN.test(draft.name) ? "Le nom ne peut pas contenir < > ; = # { }." : draft.name.length > 64 ? "64 caractères au maximum." : "";
  const colorProblem = /^#[0-9a-f]{6}$/i.test(draft.color) ? "" : "Couleur au format #rrggbb.";

  async function save() {
    if (!draft || nameProblem || colorProblem) return;
    setSaving(true);
    setError("");
    try {
      if (id) await orderStatesApi.update(id, draft);
      else await orderStatesApi.create(draft);
      toast.success(id ? "Statut enregistré." : "Statut créé.");
      router.push(BASE);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Enregistrement impossible.");
      setSaving(false);
    }
  }

  const options = [
    { key: "logable", label: "Considérer la commande associée comme validée" },
    { key: "invoice", label: "Autoriser le client à télécharger et à consulter la version PDF de ses factures" },
    { key: "hidden", label: "Masquer ce statut dans toutes les commandes du client" },
    { key: "shipped", label: "Définir la commande comme expédiée" },
    { key: "paid", label: "Définir la commande comme payée", help: "Quand une commande reçoit ce statut, son paiement passe aussi à « Payée »." },
    { key: "delivery", label: "Afficher le PDF du bon de livraison" },
  ] as const;

  const templateOptions = [{ label: "Aucun modèle", value: "" }, ...[...new Set([...templates, ...(draft.template ? [draft.template] : [])])].map((name) => ({ label: name, value: name }))];

  return (
    <BlockStack gap="400">
      <Card>
        <BlockStack gap="500">
          <Text as="h1" variant="headingLg">{id ? "Modifier l’état de commande" : "Ajouter un état de commande"}</Text>
          {error ? <Banner tone="critical" title={error} /> : null}

          <TextField label="Nom du statut" autoComplete="off" requiredIndicator maxLength={64} showCharacterCount value={draft.name} error={draft.name ? nameProblem : undefined} helpText="Nom de l’état, par exemple « En attente »." onChange={(value) => set("name", value)} />

          <BlockStack gap="150">
            <Text as="span" variant="bodyMd">Icône</Text>
            <LogoField value={draft.iconUrl} onChange={(url) => set("iconUrl", url)} showLabel={false} noun="Icône du statut" change="Changer l’icône" remove="Retirer l’icône" hint="Facultatif. Petite image affichée à côté du nom du statut dans la liste." />
          </BlockStack>

          <BlockStack gap="150">
            <Text as="span" variant="bodyMd">Couleur</Text>
            <InlineStack gap="300" blockAlign="center">
              <input type="color" aria-label="Choisir la couleur" value={/^#[0-9a-f]{6}$/i.test(draft.color) ? draft.color : "#d1d5db"} onChange={(event) => set("color", event.target.value)} style={{ width: 48, height: 36, padding: 2, border: "1px solid #c9cccf", borderRadius: 6, background: "#fff", cursor: "pointer" }} />
              <div style={{ width: 130 }}>
                <TextField label="Couleur" labelHidden autoComplete="off" value={draft.color} error={colorProblem || undefined} onChange={(value) => set("color", value.startsWith("#") ? value : `#${value}`)} />
              </div>
              <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 3, backgroundColor: draft.color, color: textColorFor(draft.color), fontSize: 13 }}>{draft.name.trim() || "Aperçu du statut"}</span>
            </InlineStack>
            <Text as="p" variant="bodySm" tone="subdued">Le statut est mis en évidence avec cette couleur dans la liste des commandes.</Text>
          </BlockStack>

          <BlockStack gap="200">
            {options.map((option) => (
              <Checkbox key={option.key} label={option.label} helpText={"help" in option ? option.help : undefined} checked={draft[option.key]} onChange={(on) => set(option.key, on)} />
            ))}
            <Checkbox label="Envoyer un e-mail au client quand le statut de sa commande change" checked={draft.sendEmail} onChange={(on) => set("sendEmail", on)} />
            {draft.sendEmail ? (
              <BlockStack gap="200">
                <Checkbox label="Joindre la facture en PDF à l’e-mail" checked={draft.pdfInvoice} onChange={(on) => set("pdfInvoice", on)} />
                <Checkbox label="Joindre le bon de livraison en PDF à l’e-mail" checked={draft.pdfDelivery} onChange={(on) => set("pdfDelivery", on)} />
                <Select label="Modèle d’e-mail" options={templateOptions} value={draft.template} onChange={(value) => set("template", value)} />
              </BlockStack>
            ) : null}
          </BlockStack>

          <Text as="p" variant="bodySm" tone="subdued">
            Quand une commande reçoit ce statut, la boutique applique l’option « payée » et, si l’envoi d’e-mail est coché, prévient le client par e-mail (avec la facture ou le bon de livraison en PDF si demandé).
          </Text>
          {!removable ? <Banner tone="info" title="Statut nécessaire à la boutique : il ne peut pas être supprimé." /> : null}
        </BlockStack>
      </Card>

      <InlineStack align="end" gap="200">
        <Button url={BASE} disabled={saving}>Annuler</Button>
        <Button variant="primary" loading={saving} disabled={Boolean(nameProblem || colorProblem)} onClick={() => void save()}>Enregistrer</Button>
      </InlineStack>
    </BlockStack>
  );
}
