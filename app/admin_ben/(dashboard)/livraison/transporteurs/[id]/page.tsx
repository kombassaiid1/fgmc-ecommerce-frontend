"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Badge,
  Banner,
  BlockStack,
  Box,
  Button,
  ButtonGroup,
  Card,
  Checkbox,
  ChoiceList,
  Divider,
  InlineStack,
  Select,
  SkeletonBodyText,
  Text,
  TextField,
  Thumbnail,
} from "@shopify/polaris";
import { CheckIcon, DeleteIcon, DeliveryIcon, XIcon } from "@shopify/polaris-icons";
import { toast } from "sonner";
import { getTaxes, type Tax } from "@/lib/api/taxes";
import { shippingAdmin, type Billing, type CarrierInput, type OutOfRange, type Zone } from "@/lib/api/shipping-admin";
import { getImageUrl } from "@/lib/api";
import { LogoField } from "../../logo-field";
import { parseNumber } from "../../ui";

type UiRange = { from: string; to: string; prices: Record<string, string> };
type Draft = {
  name: string;
  transitTime: string;
  speedGrade: number;
  logoUrl: string;
  trackingUrl: string;
  active: boolean;
  isPickup: boolean;
  freeShipping: boolean;
  billing: Billing;
  addHandling: boolean;
  outOfRange: OutOfRange;
  minWeightKg: string;
  maxWeightKg: string;
  taxId: string;
  glsType: string;
};

const EMPTY: Draft = {
  name: "", transitTime: "", speedGrade: 5, logoUrl: "", trackingUrl: "", active: true, isPickup: false,
  freeShipping: false, billing: "WEIGHT", addHandling: true, outOfRange: "HIGHEST", minWeightKg: "0", maxWeightKg: "0", taxId: "", glsType: "",
};

const GRADES = Array.from({ length: 10 }, (_, grade) => ({
  label: grade === 0 ? "0 · le plus lent" : grade === 5 ? "5 · standard" : grade === 9 ? "9 · le plus rapide" : String(grade),
  value: String(grade),
}));

const STEPS = ["Paramètres généraux", "Zones de livraison et tarifs", "Poids et limites", "Récapitulatif"];

/** The four-step bar: the current step is dark, the others are green, each one is clickable. */
function StepBar({ step, onStep }: { step: number; onStep: (index: number) => void }) {
  return (
    <div role="tablist" aria-label="Étapes du transporteur" style={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
      {STEPS.map((label, index) => {
        const active = index === step;
        return (
          <button
            key={label}
            type="button"
            role="tab"
            aria-selected={active}
            aria-current={active ? "step" : undefined}
            onClick={() => onStep(index)}
            style={{
              appearance: "none",
              border: 0,
              cursor: "pointer",
              flex: "1 1 170px",
              display: "flex",
              alignItems: "center",
              gap: "var(--p-space-200)",
              padding: "var(--p-space-200) var(--p-space-600) var(--p-space-200) var(--p-space-400)",
              font: "inherit",
              fontWeight: active ? 650 : 450,
              textAlign: "left",
              color: active ? "var(--p-color-text-inverse)" : "var(--p-color-text)",
              background: active ? "var(--p-color-bg-fill-inverse)" : "var(--p-color-bg-fill-success-secondary)",
              clipPath: "polygon(0 0, calc(100% - 14px) 0, 100% 50%, calc(100% - 14px) 100%, 0 100%)",
              minHeight: 40,
            }}>
            <span style={{ fontSize: "var(--p-font-size-500)", fontWeight: 300, lineHeight: 1 }}>{index + 1}</span>
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}

const inputCell = { padding: "var(--p-space-100) var(--p-space-200)", minWidth: 110 } as const;

/** The two heading rows stay pinned while the zones scroll: each cell is sticky, opaque and above the inputs. */
const HEAD_H = 58;
const pinned = (top: number) =>
  ({ ...inputCell, position: "sticky", top, zIndex: 500, height: HEAD_H, boxSizing: "border-box", background: "var(--p-color-bg-fill-secondary)" }) as const;

export default function CarrierEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const creating = id === "nouveau";
  const router = useRouter();

  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [zones, setZones] = useState<Zone[]>([]);
  const [taxes, setTaxes] = useState<Tax[]>([]);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [ranges, setRanges] = useState<UiRange[]>([]);
  const [enabled, setEnabled] = useState<string[]>([]);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [attempted, setAttempted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const zoneList = await shippingAdmin.zones();
        const taxList = await getTaxes({ limit: 100 }).then((result) => result.data).catch(() => [] as Tax[]);
        const carrier = creating ? null : await shippingAdmin.carrier(id);
        if (cancelled) return;
        setZones(zoneList);
        setTaxes(taxList);
        if (carrier) {
          setDraft({
            name: carrier.name, transitTime: carrier.transitTime, speedGrade: carrier.speedGrade, logoUrl: carrier.logoUrl,
            trackingUrl: carrier.trackingUrl, active: carrier.active, isPickup: carrier.isPickup, freeShipping: carrier.freeShipping,
            billing: carrier.billing, addHandling: carrier.addHandling, outOfRange: carrier.outOfRange,
            minWeightKg: String(carrier.minWeightKg), maxWeightKg: String(carrier.maxWeightKg), taxId: carrier.taxId, glsType: carrier.glsType,
          });
          setEnabled([...new Set(carrier.ranges.flatMap((range) => range.rates.map((rate) => rate.zoneId)))]);
          if (!carrier.freeShipping) {
            setRanges(
              carrier.ranges.map((range) => ({
                from: String(range.from),
                to: String(range.to),
                prices: Object.fromEntries(range.rates.map((rate) => [rate.zoneId, String(rate.price)])),
              })),
            );
          }
        }
        setLoaded(true);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Chargement impossible.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, creating]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((old) => ({ ...old, [key]: value }));
  const unit = draft.billing === "WEIGHT" ? "kg" : "€";
  const isOn = (zoneId: string) => enabled.includes(zoneId);

  const setRange = (index: number, patch: Partial<UiRange>) => setRanges((old) => old.map((range, i) => (i === index ? { ...range, ...patch } : range)));
  const setPrice = (index: number, zoneId: string, value: string) => setRanges((old) => old.map((range, i) => (i === index ? { ...range, prices: { ...range.prices, [zoneId]: value } } : range)));
  const setAllPrices = (index: number, value: string) => setRanges((old) => old.map((range, i) => (i === index ? { ...range, prices: { ...range.prices, ...Object.fromEntries(enabled.map((zoneId) => [zoneId, value])) } } : range)));
  const addRange = () => setRanges((old) => [...old, { from: old.length ? old[old.length - 1].to : "0", to: "", prices: {} }]);
  const toggleZone = (zoneId: string, on: boolean) => {
    setEnabled((old) => (on ? [...old, zoneId] : old.filter((z) => z !== zoneId)));
    if (!on) setRanges((old) => old.map((range) => ({ ...range, prices: { ...range.prices, [zoneId]: "" } })));
  };
  const toggleAllZones = (on: boolean) => {
    setEnabled(on ? zones.map((zone) => zone.id) : []);
    if (!on) setRanges((old) => old.map((range) => ({ ...range, prices: {} })));
  };

  /** Builds the request, or names the first problem found. */
  const built = ((): { input?: CarrierInput; problem?: string; problemStep?: number } => {
    if (!draft.name.trim()) return { problem: "Le nom du transporteur est requis.", problemStep: 0 };
    const minWeightKg = parseNumber(draft.minWeightKg);
    const maxWeightKg = parseNumber(draft.maxWeightKg);
    if (!Number.isFinite(minWeightKg) || !Number.isFinite(maxWeightKg) || minWeightKg < 0 || maxWeightKg < 0) return { problem: "Les poids minimum et maximum doivent être des nombres positifs ou zéro.", problemStep: 2 };
    if (maxWeightKg > 0 && minWeightKg > maxWeightKg) return { problem: "Le poids minimum ne peut pas dépasser le poids maximum.", problemStep: 2 };

    let result: CarrierInput["ranges"] = [];
    if (draft.freeShipping) {
      if (enabled.length) result = [{ from: 0, to: 999999, rates: enabled.map((zoneId) => ({ zoneId, price: 0 })) }];
    } else {
      if (ranges.length === 0) return { problem: "Ajoutez au moins une tranche de tarif, ou choisissez la livraison gratuite.", problemStep: 1 };
      for (let i = 0; i < ranges.length; i += 1) {
        const from = parseNumber(ranges[i].from);
        const to = parseNumber(ranges[i].to);
        if (!Number.isFinite(from) || !Number.isFinite(to) || from < 0) return { problem: `Tranche ${i + 1} : renseignez « de » et « à ».`, problemStep: 1 };
        if (to <= from) return { problem: `Tranche ${i + 1} : « à » doit être supérieur à « de ».`, problemStep: 1 };
        const rates: Array<{ zoneId: string; price: number }> = [];
        for (const zone of zones) {
          const text = ranges[i].prices[zone.id] ?? "";
          if (!enabled.includes(zone.id) || text.trim() === "") continue;
          const price = parseNumber(text);
          if (!Number.isFinite(price) || price < 0) return { problem: `Tranche ${i + 1}, zone « ${zone.name} » : prix invalide.`, problemStep: 1 };
          rates.push({ zoneId: zone.id, price });
        }
        result.push({ from, to, rates });
      }
      const sorted = [...result].sort((a, b) => a.from - b.from);
      for (let i = 1; i < sorted.length; i += 1) {
        if (sorted[i].from < sorted[i - 1].to) return { problem: "Deux tranches se chevauchent : la fin d’une tranche doit être inférieure ou égale au début de la suivante.", problemStep: 1 };
      }
      if (!result.some((range) => range.rates.length)) return { problem: "Cochez au moins une zone et renseignez son prix.", problemStep: 1 };
    }

    return {
      input: {
        name: draft.name.trim(), transitTime: draft.transitTime.trim(), speedGrade: draft.speedGrade, logoUrl: draft.logoUrl.trim(),
        trackingUrl: draft.trackingUrl.trim(), active: draft.active, isPickup: draft.isPickup, freeShipping: draft.freeShipping,
        billing: draft.billing, addHandling: draft.addHandling, outOfRange: draft.outOfRange, minWeightKg, maxWeightKg, taxId: draft.taxId, glsType: draft.glsType, ranges: result,
      },
    };
  })();

  async function save() {
    setAttempted(true);
    if (!built.input) {
      if (built.problemStep !== undefined) setStep(built.problemStep);
      return toast.error(built.problem ?? "Vérifiez le formulaire.");
    }
    setSaving(true);
    try {
      if (creating) await shippingAdmin.createCarrier(built.input);
      else await shippingAdmin.updateCarrier(id, built.input);
      toast.success("Transporteur enregistré.");
      router.push("/admin_ben/livraison/transporteurs");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  }

  const builtInput = built.input;
  const servedZones = builtInput ? zones.filter((zone) => builtInput.ranges.some((range) => range.rates.some((rate) => rate.zoneId === zone.id))) : [];

  if (error) {
    return (
      <BlockStack gap="300">
        <Banner tone="critical" title="Impossible de charger ce transporteur">{error}</Banner>
        <InlineStack><Button url="/admin_ben/livraison/transporteurs">Retour aux transporteurs</Button></InlineStack>
      </BlockStack>
    );
  }
  if (!loaded) return <Card><SkeletonBodyText lines={10} /></Card>;

  const yesNo = (value: boolean, onChange: (next: boolean) => void, label: string) => (
    <ButtonGroup variant="segmented">
      <Button pressed={value} accessibilityLabel={`${label} : oui`} onClick={() => onChange(true)}>Oui</Button>
      <Button pressed={!value} accessibilityLabel={`${label} : non`} onClick={() => onChange(false)}>Non</Button>
    </ButtonGroup>
  );

  const field = (label: string, control: React.ReactNode, help?: string) => (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(140px, 220px) minmax(0, 1fr)", gap: "var(--p-space-400)", alignItems: "start" }}>
      <Box paddingBlockStart="150"><Text as="span" variant="bodyMd" alignment="end">{label}</Text></Box>
      <BlockStack gap="100">
        {control}
        {help ? <Text as="span" variant="bodySm" tone="subdued">{help}</Text> : null}
      </BlockStack>
    </div>
  );

  const showRanges = !draft.freeShipping;
  const taxField = field(
    "Taxe",
    <Select label="Taxe" labelHidden options={[{ label: "Aucune taxe", value: "" }, ...taxes.map((tax) => ({ label: `${tax.name} (${tax.rate} %)`, value: tax.id }))]} value={draft.taxId} onChange={(v) => set("taxId", v)} />,
    taxes.length === 0 ? "Aucune taxe n’existe encore : créez-les dans International, Taxes." : "Taxe appliquée au prix de livraison.",
  );
  const chosenTax = taxes.find((tax) => tax.id === draft.taxId);
  const allOn = zones.length > 0 && enabled.length === zones.length;

  return (
    <BlockStack gap="400">
      <InlineStack align="space-between" blockAlign="center" gap="300">
        <BlockStack gap="050">
          <Button variant="plain" url="/admin_ben/livraison/transporteurs">← Transporteurs</Button>
          <InlineStack gap="300" blockAlign="center">
            <Text as="h2" variant="headingLg">{creating ? "Nouveau transporteur" : draft.name || "Transporteur"}</Text>
            <Badge tone={draft.active ? "success" : undefined}>{draft.active ? "Actif" : "Désactivé"}</Badge>
          </InlineStack>
        </BlockStack>
        <Button icon={XIcon} url="/admin_ben/livraison/transporteurs">Annuler</Button>
      </InlineStack>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--p-space-400)", alignItems: "flex-start" }}>
        <div style={{ flex: "0 0 240px", maxWidth: "100%" }}>
          <Card padding="0">
            <Box padding="300" borderBlockEndWidth="025" borderColor="border">
              <InlineStack align="space-between" blockAlign="center">
                <Text as="h3" variant="headingSm">Logo</Text>
                <Button variant="tertiary" icon={DeleteIcon} tone="critical" accessibilityLabel="Retirer le logo" disabled={!draft.logoUrl} onClick={() => set("logoUrl", "")} />
              </InlineStack>
            </Box>
            <Box padding="400">
              <InlineStack align="center">
                <Thumbnail source={draft.logoUrl ? getImageUrl(draft.logoUrl) : DeliveryIcon} alt={draft.logoUrl ? `Logo de ${draft.name}` : "Aucun logo"} size="large" />
              </InlineStack>
            </Box>
          </Card>
        </div>

        <div style={{ flex: "1 1 520px", minWidth: 0 }}>
          <BlockStack gap="400">
            <StepBar step={step} onStep={setStep} />

            {attempted && built.problem ? <Banner tone="warning" title="À corriger avant d’enregistrer">{built.problem}</Banner> : null}

            <Card>
              <BlockStack gap="500">
                {step === 0 ? (
                  <BlockStack gap="400">
                    {field("Nom du transporteur *", <TextField label="Nom du transporteur" labelHidden autoComplete="off" value={draft.name} maxLength={60} error={attempted && !draft.name.trim() ? "Le nom est requis." : undefined} onChange={(v) => set("name", v)} />, "Affiché au client : utilisez le nom officiel du service.")}
                    {field("Délai de livraison", <TextField label="Délai de livraison" labelHidden autoComplete="off" value={draft.transitTime} maxLength={80} onChange={(v) => set("transitTime", v)} />, "Texte libre, par exemple « 2 à 3 jours ouvrés ».")}
                    {field("Rapidité", <Select label="Rapidité" labelHidden options={GRADES} value={String(draft.speedGrade)} onChange={(v) => set("speedGrade", Number(v))} />, "De 0 à 9. Sert à comparer les transporteurs, par exemple pour mettre en avant le plus rapide.")}
                    {field("Logo", <LogoField value={draft.logoUrl} onChange={(url) => set("logoUrl", url)} />)}
                    {field("Lien de suivi", <TextField label="Lien de suivi" labelHidden autoComplete="off" value={draft.trackingUrl} placeholder="https://suivi.exemple.com/?colis=@" onChange={(v) => set("trackingUrl", v)} />, "Remplacez le numéro de suivi par le signe @. Facultatif.")}
                    {field(
                      "Type de livraison GLS",
                      <Select
                        label="Type de livraison GLS"
                        labelHidden
                        options={[
                          { label: "Pas un transporteur GLS", value: "" },
                          { label: "GLS Chez vous (à domicile ou en entreprise)", value: "HOME" },
                          { label: "GLS Relais (point relais au choix du client)", value: "RELAY" },
                          { label: "GLS Chez vous + (avec SMS et choix du jour)", value: "FLEX" },
                          { label: "GLS Avant 13h (express)", value: "EXPRESS" },
                        ]}
                        value={draft.glsType}
                        onChange={(v) => set("glsType", v)}
                      />,
                      "Pour les transporteurs GLS : le type décide de l’étiquette créée et de ce que le client doit indiquer (point relais, mobile).",
                    )}
                    {field("Transporteur actif", yesNo(draft.active, (v) => set("active", v), "Transporteur actif"))}
                    {field("Retrait en magasin", yesNo(draft.isPickup, (v) => set("isPickup", v), "Retrait en magasin"), "Le client vient chercher sa commande : pas de livraison à son adresse.")}
                  </BlockStack>
                ) : null}

                {step === 1 ? (
                  <BlockStack gap="400">
                    {field("Frais de manutention", yesNo(draft.addHandling, (v) => set("addHandling", v), "Frais de manutention"), "Le montant se règle dans les préférences de livraison.")}
                    {field("Livraison gratuite", yesNo(draft.freeShipping, (v) => set("freeShipping", v), "Livraison gratuite"))}
                    {showRanges ? (
                      <>
                        {field("Facturation", <ChoiceList title="Facturation" titleHidden choices={[{ label: "Selon le montant total", value: "PRICE" }, { label: "Selon le poids total", value: "WEIGHT" }]} selected={[draft.billing]} onChange={(v) => set("billing", (v[0] as Billing) ?? "WEIGHT")} />)}
                        {taxField}
                        {field("Au-delà de la dernière tranche", <Select label="Au-delà de la dernière tranche" labelHidden options={[{ label: "Appliquer le prix de la dernière tranche", value: "HIGHEST" }, { label: "Ne pas proposer ce transporteur", value: "DISABLE" }]} value={draft.outOfRange} onChange={(v) => set("outOfRange", v as OutOfRange)} />)}
                      </>
                    ) : taxField}

                    <Divider />

                    {zones.length === 0 ? (
                      <Banner tone="warning" title="Aucune zone" action={{ content: "Gérer les zones", url: "/admin_ben/international/zones" }}>
                        <p>Créez d’abord une zone pour pouvoir fixer des tarifs.</p>
                      </Banner>
                    ) : (
                      <BlockStack gap="200">
                        <Text as="h3" variant="headingSm">{showRanges ? "Tranches" : "Zones desservies"}</Text>
                        <Text as="p" variant="bodySm" tone="subdued">
                          {showRanges
                            ? "Chaque colonne est une tranche : elle commence à la première valeur (incluse) et finit à la seconde (exclue). Cochez les zones desservies et indiquez leur prix ; un prix vide veut dire que la zone n’est pas desservie pour cette tranche."
                            : "Cochez les zones où ce transporteur livre gratuitement."}
                        </Text>
                        <Box borderWidth="025" borderColor="border" borderRadius="200">
                          <div style={{ overflow: "auto", maxHeight: 520 }}>
                            <table style={{ borderCollapse: "collapse", width: showRanges ? "auto" : "100%", minWidth: "100%" }}>
                              {showRanges ? (
                                <thead>
                                  <tr>
                                    <th scope="row" style={{ ...pinned(0), textAlign: "left", minWidth: 300, left: 0, zIndex: 501 }}>
                                      <InlineStack align="space-between" blockAlign="center" wrap={false}>
                                        <Text as="span" variant="headingSm">S’applique quand {draft.billing === "WEIGHT" ? "le poids" : "le montant"} est</Text>
                                        <Text as="span" variant="headingMd">≥</Text>
                                      </InlineStack>
                                    </th>
                                    {ranges.map((range, index) => (
                                      <td key={index} style={pinned(0)}>
                                        <TextField label={`Tranche ${index + 1}, de`} labelHidden autoComplete="off" inputMode="decimal" prefix={unit} value={range.from} onChange={(v) => setRange(index, { from: v })} />
                                      </td>
                                    ))}
                                    <td rowSpan={2} style={{ ...pinned(0), height: HEAD_H * 2, verticalAlign: "middle" }}><Button onClick={addRange}>Ajouter une tranche</Button></td>
                                  </tr>
                                  <tr>
                                    <th scope="row" style={{ ...pinned(HEAD_H), textAlign: "left", left: 0, zIndex: 501 }}>
                                      <InlineStack align="space-between" blockAlign="center" wrap={false}>
                                        <Text as="span" variant="headingSm">S’applique quand {draft.billing === "WEIGHT" ? "le poids" : "le montant"} est</Text>
                                        <Text as="span" variant="headingMd">&lt;</Text>
                                      </InlineStack>
                                    </th>
                                    {ranges.map((range, index) => (
                                      <td key={index} style={pinned(HEAD_H)}>
                                        <TextField label={`Tranche ${index + 1}, à`} labelHidden autoComplete="off" inputMode="decimal" prefix={unit} value={range.to} onChange={(v) => setRange(index, { to: v })} />
                                      </td>
                                    ))}
                                  </tr>
                                </thead>
                              ) : null}
                              <tbody>
                                <tr style={{ borderTop: "1px solid var(--p-color-border)", background: "var(--p-color-bg-surface-secondary)" }}>
                                  <th scope="row" style={{ ...inputCell, textAlign: "left" }}>
                                    <Checkbox label="Toutes les zones" checked={allOn ? true : enabled.length ? "indeterminate" : false} onChange={toggleAllZones} />
                                  </th>
                                  {showRanges ? ranges.map((range, index) => (
                                    <td key={index} style={inputCell}>
                                      <TextField label={`Tranche ${index + 1}, même prix pour les zones cochées`} labelHidden autoComplete="off" inputMode="decimal" placeholder="Même prix" suffix="€" disabled={enabled.length === 0} value="" onChange={(v) => setAllPrices(index, v)} />
                                    </td>
                                  )) : null}
                                  {showRanges ? <td /> : null}
                                </tr>
                                {zones.map((zone) => (
                                  <tr key={zone.id} style={{ borderTop: "1px solid var(--p-color-border)" }}>
                                    <th scope="row" style={{ ...inputCell, textAlign: "left", fontWeight: "inherit" }}>
                                      <Checkbox label={zone.name} checked={isOn(zone.id)} onChange={(on) => toggleZone(zone.id, on)} />
                                    </th>
                                    {showRanges ? ranges.map((range, index) => (
                                      <td key={index} style={inputCell}>
                                        <TextField label={`Tranche ${index + 1}, prix ${zone.name}`} labelHidden autoComplete="off" inputMode="decimal" suffix="€" disabled={!isOn(zone.id)} value={range.prices[zone.id] ?? ""} onChange={(v) => setPrice(index, zone.id, v)} />
                                      </td>
                                    )) : null}
                                    {showRanges ? <td /> : null}
                                  </tr>
                                ))}
                              </tbody>
                              {showRanges && ranges.length ? (
                                <tfoot>
                                  <tr style={{ borderTop: "1px solid var(--p-color-border)" }}>
                                    <td style={{ ...inputCell, position: "sticky", left: 0, background: "var(--p-color-bg-surface)" }} />
                                    {ranges.map((range, index) => (
                                      <td key={index} style={inputCell}>
                                        <Button tone="critical" icon={DeleteIcon} accessibilityLabel={`Supprimer la tranche ${index + 1}`} onClick={() => setRanges((old) => old.filter((_, i) => i !== index))}>Supprimer</Button>
                                      </td>
                                    ))}
                                    <td />
                                  </tr>
                                </tfoot>
                              ) : null}
                            </table>
                          </div>
                        </Box>
                        {showRanges && ranges.length === 0 ? <Text as="p" variant="bodySm" tone="subdued">Aucune tranche pour le moment : cliquez sur « Ajouter une tranche ».</Text> : null}
                      </BlockStack>
                    )}
                  </BlockStack>
                ) : null}

                {step === 2 ? (
                  <BlockStack gap="400">
                    {field("Poids minimum de la commande", <TextField label="Poids minimum de la commande" labelHidden autoComplete="off" inputMode="decimal" suffix="kg" value={draft.minWeightKg} onChange={(v) => set("minWeightKg", v)} />, "0 pour aucune limite.")}
                    {field("Poids maximum de la commande", <TextField label="Poids maximum de la commande" labelHidden autoComplete="off" inputMode="decimal" suffix="kg" value={draft.maxWeightKg} onChange={(v) => set("maxWeightKg", v)} />, "0 pour aucune limite. Au-delà, le transporteur n’est pas proposé.")}
                    <Text as="p" variant="bodySm" tone="subdued">Les dimensions des colis et les groupes de clients ne sont pas gérés : vos produits n’ont pas de dimensions enregistrées, et tous les clients voient les mêmes transporteurs.</Text>
                  </BlockStack>
                ) : null}

                {step === 3 ? (
                  <BlockStack gap="400">
                    <InlineStack gap="300" blockAlign="center" wrap={false}>
                      <Thumbnail source={draft.logoUrl ? getImageUrl(draft.logoUrl) : DeliveryIcon} alt="" size="medium" />
                      <BlockStack gap="050">
                        <Text as="h3" variant="headingMd">{draft.name || "Transporteur sans nom"}</Text>
                        <Text as="span" variant="bodySm" tone="subdued">{draft.transitTime || "Délai non renseigné"}</Text>
                      </BlockStack>
                    </InlineStack>

                    <Divider />

                    <BlockStack gap="200">
                      {[
                        ["Taxe", chosenTax ? `${chosenTax.name} (${chosenTax.rate} %)` : "Aucune taxe"],
                        ["Tarif", draft.freeShipping ? "Gratuit" : draft.billing === "WEIGHT" ? "Selon le poids total" : "Selon le montant total"],
                        ...(draft.freeShipping ? [] : [["Tranches", `${ranges.length}`], ["Hors tranche", draft.outOfRange === "HIGHEST" ? "Prix de la dernière tranche" : "Transporteur masqué"]]),
                        ["Limite de poids", Number(parseNumber(draft.maxWeightKg)) > 0 || Number(parseNumber(draft.minWeightKg)) > 0 ? `${parseNumber(draft.minWeightKg) || 0} à ${Number(parseNumber(draft.maxWeightKg)) > 0 ? `${parseNumber(draft.maxWeightKg)} kg` : "sans maximum"}` : "Aucune"],
                      ].map(([label, value]) => (
                        <InlineStack key={label} gap="300" wrap={false}>
                          <Box minWidth="140px"><Text as="span" variant="bodyMd" tone="subdued">{label}</Text></Box>
                          <Text as="span" variant="bodyMd" fontWeight="semibold">{value}</Text>
                        </InlineStack>
                      ))}
                      <InlineStack gap="300" blockAlign="start" wrap={false}>
                        <Box minWidth="140px"><Text as="span" variant="bodyMd" tone="subdued">Zones desservies</Text></Box>
                        {servedZones.length ? (
                          <BlockStack gap="200">
                            <Text as="span" variant="bodyMd" fontWeight="semibold">{servedZones.length} sur {zones.length}</Text>
                            <Box maxWidth="640px">
                              <div style={{ maxHeight: 120, overflow: "auto" }}>
                                <InlineStack gap="100">{servedZones.map((zone) => <Badge key={zone.id}>{zone.name}</Badge>)}</InlineStack>
                              </div>
                            </Box>
                          </BlockStack>
                        ) : (
                          <Text as="span" variant="bodyMd" tone="critical">Aucune : cochez des zones à l’étape 2</Text>
                        )}
                      </InlineStack>
                    </BlockStack>

                    {built.problem ? (
                      <Banner tone="warning" title="À corriger avant d’enregistrer"><p>{built.problem}</p></Banner>
                    ) : null}
                  </BlockStack>
                ) : null}

                <Divider />
                <InlineStack align="end" gap="200">
                  <Button disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>Précédent</Button>
                  <Button disabled={step === STEPS.length - 1} onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}>Suivant</Button>
                  <Button variant="primary" icon={CheckIcon} onClick={() => void save()} loading={saving}>{creating ? "Créer le transporteur" : "Terminer"}</Button>
                </InlineStack>
              </BlockStack>
            </Card>
          </BlockStack>
        </div>
      </div>
    </BlockStack>
  );
}
