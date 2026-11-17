"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Badge,
  Banner,
  BlockStack,
  Box,
  Button,
  Card,
  Checkbox,
  Divider,
  FormLayout,
  InlineGrid,
  InlineStack,
  Select,
  SkeletonBodyText,
  Text,
  TextField,
  Thumbnail,
} from "@shopify/polaris";
import { DeleteIcon, DeliveryIcon } from "@shopify/polaris-icons";
import { toast } from "sonner";
import { shippingAdmin, type Billing, type CarrierInput, type OutOfRange, type Zone } from "@/lib/api/shipping-admin";
import { getImageUrl } from "@/lib/api";
import { LogoField } from "../../logo-field";
import { formatMoney, parseNumber } from "../../ui";

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
};

const EMPTY: Draft = {
  name: "", transitTime: "", speedGrade: 5, logoUrl: "", trackingUrl: "", active: true, isPickup: false,
  freeShipping: false, billing: "WEIGHT", addHandling: true, outOfRange: "HIGHEST", minWeightKg: "0", maxWeightKg: "0",
};

const GRADES = Array.from({ length: 10 }, (_, grade) => ({
  label: grade === 0 ? "0 · le plus lent" : grade === 5 ? "5 · standard" : grade === 9 ? "9 · le plus rapide" : String(grade),
  value: String(grade),
}));

/** What a customer would be charged, without handling. Mirrors the server rules; the server stays authoritative. */
function simulate(input: CarrierInput, zoneId: string, value: number): { price: number } | { reason: string } {
  const ranges = [...input.ranges].sort((a, b) => a.from - b.from);
  const rateOf = (range: CarrierInput["ranges"][number]) => range.rates.find((rate) => rate.zoneId === zoneId)?.price ?? null;

  if (input.billing === "WEIGHT") {
    if (input.maxWeightKg > 0 && value > input.maxWeightKg) return { reason: `Au-dessus du poids maximum (${input.maxWeightKg} kg)` };
    if (input.minWeightKg > 0 && value < input.minWeightKg) return { reason: `En dessous du poids minimum (${input.minWeightKg} kg)` };
  }
  if (input.freeShipping) return ranges.some((range) => rateOf(range) !== null) ? { price: 0 } : { reason: "Zone non desservie" };

  const inside = ranges.find((range) => value >= range.from && value < range.to);
  if (inside) {
    const price = rateOf(inside);
    return price === null ? { reason: "Zone non desservie pour cette tranche" } : { price };
  }
  const highest = ranges[ranges.length - 1];
  if (highest && value >= highest.to) {
    if (input.outOfRange === "DISABLE") return { reason: "Au-dessus de la dernière tranche : transporteur masqué" };
    const price = rateOf(highest);
    return price === null ? { reason: "Zone non desservie pour la dernière tranche" } : { price };
  }
  return { reason: "En dessous de la première tranche" };
}

export default function CarrierEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const creating = id === "nouveau";
  const router = useRouter();

  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [zones, setZones] = useState<Zone[]>([]);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [ranges, setRanges] = useState<UiRange[]>([]);
  const [freeZones, setFreeZones] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [simZone, setSimZone] = useState("");
  const [simValue, setSimValue] = useState("2");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const zoneList = await shippingAdmin.zones();
        const carrier = creating ? null : await shippingAdmin.carrier(id);
        if (cancelled) return;
        setZones(zoneList);
        if (carrier) {
          setDraft({
            name: carrier.name, transitTime: carrier.transitTime, speedGrade: carrier.speedGrade, logoUrl: carrier.logoUrl,
            trackingUrl: carrier.trackingUrl, active: carrier.active, isPickup: carrier.isPickup, freeShipping: carrier.freeShipping,
            billing: carrier.billing, addHandling: carrier.addHandling, outOfRange: carrier.outOfRange,
            minWeightKg: String(carrier.minWeightKg), maxWeightKg: String(carrier.maxWeightKg),
          });
          if (carrier.freeShipping) setFreeZones([...new Set(carrier.ranges.flatMap((range) => range.rates.map((rate) => rate.zoneId)))]);
          else
            setRanges(
              carrier.ranges.map((range) => ({
                from: String(range.from),
                to: String(range.to),
                prices: Object.fromEntries(range.rates.map((rate) => [rate.zoneId, String(rate.price)])),
              })),
            );
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

  const setRange = (index: number, patch: Partial<UiRange>) => setRanges((old) => old.map((range, i) => (i === index ? { ...range, ...patch } : range)));
  const setPrice = (index: number, zoneId: string, value: string) => setRanges((old) => old.map((range, i) => (i === index ? { ...range, prices: { ...range.prices, [zoneId]: value } } : range)));
  const setAllPrices = (index: number, value: string) => setRanges((old) => old.map((range, i) => (i === index ? { ...range, prices: Object.fromEntries(zones.map((zone) => [zone.id, value])) } : range)));
  const addRange = () => setRanges((old) => [...old, { from: old.length ? old[old.length - 1].to : "0", to: "", prices: {} }]);

  /** Builds the request, or names the first problem found. */
  const built = ((): { input?: CarrierInput; problem?: string } => {
    if (!draft.name.trim()) return { problem: "Le nom du transporteur est requis." };
    const minWeightKg = parseNumber(draft.minWeightKg);
    const maxWeightKg = parseNumber(draft.maxWeightKg);
    if (!Number.isFinite(minWeightKg) || !Number.isFinite(maxWeightKg) || minWeightKg < 0 || maxWeightKg < 0) return { problem: "Les poids minimum et maximum doivent être des nombres positifs ou zéro." };
    if (maxWeightKg > 0 && minWeightKg > maxWeightKg) return { problem: "Le poids minimum ne peut pas dépasser le poids maximum." };

    let result: CarrierInput["ranges"] = [];
    if (draft.freeShipping) {
      if (freeZones.length) result = [{ from: 0, to: 999999, rates: freeZones.map((zoneId) => ({ zoneId, price: 0 })) }];
    } else {
      if (ranges.length === 0) return { problem: "Ajoutez au moins une tranche de tarif, ou choisissez la livraison gratuite." };
      for (let i = 0; i < ranges.length; i += 1) {
        const from = parseNumber(ranges[i].from);
        const to = parseNumber(ranges[i].to);
        if (!Number.isFinite(from) || !Number.isFinite(to) || from < 0) return { problem: `Tranche ${i + 1} : renseignez « de » et « à ».` };
        if (to <= from) return { problem: `Tranche ${i + 1} : « à » doit être supérieur à « de ».` };
        const rates: Array<{ zoneId: string; price: number }> = [];
        for (const zone of zones) {
          const text = ranges[i].prices[zone.id] ?? "";
          if (text.trim() === "") continue;
          const price = parseNumber(text);
          if (!Number.isFinite(price) || price < 0) return { problem: `Tranche ${i + 1}, zone « ${zone.name} » : prix invalide.` };
          rates.push({ zoneId: zone.id, price });
        }
        result.push({ from, to, rates });
      }
      const sorted = [...result].sort((a, b) => a.from - b.from);
      for (let i = 1; i < sorted.length; i += 1) {
        if (sorted[i].from < sorted[i - 1].to) return { problem: "Deux tranches se chevauchent : la fin d’une tranche doit être inférieure ou égale au début de la suivante." };
      }
      if (!result.some((range) => range.rates.length)) return { problem: "Renseignez au moins un prix pour une zone." };
    }

    return {
      input: {
        name: draft.name.trim(), transitTime: draft.transitTime.trim(), speedGrade: draft.speedGrade, logoUrl: draft.logoUrl.trim(),
        trackingUrl: draft.trackingUrl.trim(), active: draft.active, isPickup: draft.isPickup, freeShipping: draft.freeShipping,
        billing: draft.billing, addHandling: draft.addHandling, outOfRange: draft.outOfRange, minWeightKg, maxWeightKg, ranges: result,
      },
    };
  })();

  async function save() {
    setAttempted(true);
    if (!built.input) return toast.error(built.problem ?? "Vérifiez le formulaire.");
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
  const effectiveZone = servedZones.some((zone) => zone.id === simZone) ? simZone : (servedZones[0]?.id ?? "");
  const simulated = built.input && effectiveZone && Number.isFinite(parseNumber(simValue)) ? simulate(built.input, effectiveZone, parseNumber(simValue)) : null;

  if (error) {
    return (
      <BlockStack gap="300">
        <Banner tone="critical" title="Impossible de charger ce transporteur">{error}</Banner>
        <InlineStack><Button url="/admin_ben/livraison/transporteurs">Retour aux transporteurs</Button></InlineStack>
      </BlockStack>
    );
  }
  if (!loaded) return <Card><SkeletonBodyText lines={10} /></Card>;

  return (
    <BlockStack gap="400">
      <InlineStack align="space-between" blockAlign="center" gap="300">
        <InlineStack gap="300" blockAlign="center">
          <Button variant="plain" url="/admin_ben/livraison/transporteurs">← Transporteurs</Button>
          <Text as="h2" variant="headingLg">{creating ? "Nouveau transporteur" : draft.name || "Transporteur"}</Text>
          <Badge tone={draft.active ? "success" : undefined}>{draft.active ? "Actif" : "Désactivé"}</Badge>
        </InlineStack>
      </InlineStack>

      {attempted && built.problem ? <Banner tone="warning" title="À corriger avant d’enregistrer">{built.problem}</Banner> : null}

      <InlineGrid columns={{ xs: 1, lg: ["twoThirds", "oneThird"] }} gap="400" alignItems="start">
        <BlockStack gap="400">
          <Card>
            <BlockStack gap="400">
              <Text as="h3" variant="headingMd">Général</Text>
              <FormLayout>
                <FormLayout.Group>
                  <TextField label="Nom du transporteur" autoComplete="off" value={draft.name} maxLength={60} onChange={(v) => set("name", v)} helpText="Affiché au client : utilisez le nom officiel du service." />
                  <TextField label="Délai de livraison" autoComplete="off" value={draft.transitTime} maxLength={80} onChange={(v) => set("transitTime", v)} helpText="Texte libre, par exemple « 2 à 3 jours ouvrés »." />
                </FormLayout.Group>
                <FormLayout.Group>
                  <Select label="Rapidité" options={GRADES} value={String(draft.speedGrade)} onChange={(v) => set("speedGrade", Number(v))} helpText="De 0 à 9. Sert à comparer les transporteurs, par exemple pour mettre en avant le plus rapide." />
                  <LogoField value={draft.logoUrl} onChange={(url) => set("logoUrl", url)} />
                </FormLayout.Group>
                <TextField label="Lien de suivi" autoComplete="off" value={draft.trackingUrl} placeholder="https://suivi.exemple.com/?colis=@" onChange={(v) => set("trackingUrl", v)} helpText="Remplacez le numéro de suivi par le signe @." />
                <Checkbox label="Transporteur actif" checked={draft.active} onChange={(v) => set("active", v)} />
                <Checkbox label="Retrait en magasin" checked={draft.isPickup} onChange={(v) => set("isPickup", v)} helpText="Le client vient chercher sa commande : pas de livraison à son adresse." />
              </FormLayout>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="400">
              <Text as="h3" variant="headingMd">Zones et tarifs</Text>
              {zones.length === 0 ? (
                <Banner tone="warning" title="Aucune zone" action={{ content: "Gérer les zones", url: "/admin_ben/international/zones" }}>
                  <p>Créez d’abord une zone pour pouvoir fixer des tarifs.</p>
                </Banner>
              ) : null}

              <Checkbox label="Livraison gratuite avec ce transporteur" checked={draft.freeShipping} onChange={(v) => set("freeShipping", v)} />

              {draft.freeShipping ? (
                <BlockStack gap="200">
                  <Text as="p" variant="bodySm" tone="subdued">Cochez les zones desservies.</Text>
                  <InlineStack gap="400">
                    {zones.map((zone) => (
                      <Checkbox key={zone.id} label={zone.name} checked={freeZones.includes(zone.id)} onChange={() => setFreeZones((old) => (old.includes(zone.id) ? old.filter((z) => z !== zone.id) : [...old, zone.id]))} />
                    ))}
                  </InlineStack>
                </BlockStack>
              ) : (
                <>
                  <FormLayout>
                    <FormLayout.Group>
                      <Select label="Facturation" options={[{ label: "Selon le poids total", value: "WEIGHT" }, { label: "Selon le montant total", value: "PRICE" }]} value={draft.billing} onChange={(v) => set("billing", v as Billing)} helpText="Ce que votre transporteur utilise pour calculer son prix." />
                      <Select label="Au-delà de la dernière tranche" options={[{ label: "Appliquer le prix de la dernière tranche", value: "HIGHEST" }, { label: "Ne pas proposer ce transporteur", value: "DISABLE" }]} value={draft.outOfRange} onChange={(v) => set("outOfRange", v as OutOfRange)} />
                    </FormLayout.Group>
                    <Checkbox label="Ajouter les frais de manutention" checked={draft.addHandling} onChange={(v) => set("addHandling", v)} helpText="Les frais se règlent dans l’onglet Préférences." />
                  </FormLayout>

                  <Divider />

                  <BlockStack gap="200">
                    <Text as="p" variant="bodySm" tone="subdued">
                      Une tranche commence à « de » (inclus) et finit à « à » (exclu). Laissez un prix vide pour que la zone ne soit pas desservie pour cette tranche.
                    </Text>
                    <Box borderWidth="025" borderColor="border" borderRadius="200" overflowX="scroll">
                      <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                          <tr style={{ background: "var(--p-color-bg-surface-secondary)" }}>
                            <th style={{ padding: "var(--p-space-200)", width: 44 }}><Text as="span" visuallyHidden>Retirer la tranche</Text></th>
                            {[`De (${unit})`, `À (${unit})`, "Toutes (€)"].map((label) => (
                              <th key={label} style={{ padding: "var(--p-space-200)", textAlign: "left" }}><Text as="span" variant="headingSm">{label}</Text></th>
                            ))}
                            {zones.map((zone) => (
                              <th key={zone.id} style={{ padding: "var(--p-space-200)", textAlign: "left" }}><Text as="span" variant="headingSm">{zone.name} (€)</Text></th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {ranges.map((range, index) => (
                            <tr key={index} style={{ borderTop: "1px solid var(--p-color-border)" }}>
                              <td style={{ padding: "var(--p-space-100)", textAlign: "center" }}><Button icon={DeleteIcon} tone="critical" variant="tertiary" accessibilityLabel={`Retirer la tranche ${index + 1}`} onClick={() => setRanges((old) => old.filter((_, i) => i !== index))} /></td>
                              <td style={{ padding: "var(--p-space-200)", minWidth: 92 }}><TextField label={`Tranche ${index + 1}, de`} labelHidden autoComplete="off" inputMode="decimal" value={range.from} onChange={(v) => setRange(index, { from: v })} /></td>
                              <td style={{ padding: "var(--p-space-200)", minWidth: 92 }}><TextField label={`Tranche ${index + 1}, à`} labelHidden autoComplete="off" inputMode="decimal" value={range.to} onChange={(v) => setRange(index, { to: v })} /></td>
                              <td style={{ padding: "var(--p-space-200)", minWidth: 92 }}><TextField label={`Tranche ${index + 1}, même prix pour toutes les zones`} labelHidden autoComplete="off" inputMode="decimal" placeholder="€" value="" onChange={(v) => setAllPrices(index, v)} /></td>
                              {zones.map((zone) => (
                                <td key={zone.id} style={{ padding: "var(--p-space-200)", minWidth: 92 }}><TextField label={`Tranche ${index + 1}, prix ${zone.name}`} labelHidden autoComplete="off" inputMode="decimal" placeholder="—" value={range.prices[zone.id] ?? ""} onChange={(v) => setPrice(index, zone.id, v)} /></td>
                              ))}
                            </tr>
                          ))}
                          {ranges.length === 0 ? (
                            <tr><td colSpan={4 + zones.length} style={{ padding: "var(--p-space-400)", textAlign: "center" }}><Text as="span" variant="bodySm" tone="subdued">Aucune tranche. Ajoutez-en une pour fixer vos prix.</Text></td></tr>
                          ) : null}
                        </tbody>
                      </table>
                    </Box>
                    <InlineStack><Button onClick={addRange}>Ajouter une tranche</Button></InlineStack>
                  </BlockStack>
                </>
              )}
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="400">
              <BlockStack gap="100">
                <Text as="h3" variant="headingMd">Limites</Text>
                <Text as="p" variant="bodySm" tone="subdued">Hors de ces limites de poids, le transporteur n’est pas proposé. Les dimensions des colis ne sont pas gérées : vos produits n’ont pas de dimensions enregistrées.</Text>
              </BlockStack>
              <FormLayout>
                <FormLayout.Group>
                  <TextField label="Poids minimum de la commande" autoComplete="off" inputMode="decimal" suffix="kg" value={draft.minWeightKg} onChange={(v) => set("minWeightKg", v)} helpText="0 pour aucune limite." />
                  <TextField label="Poids maximum de la commande" autoComplete="off" inputMode="decimal" suffix="kg" value={draft.maxWeightKg} onChange={(v) => set("maxWeightKg", v)} helpText="0 pour aucune limite." />
                </FormLayout.Group>
              </FormLayout>
            </BlockStack>
          </Card>
        </BlockStack>

        <div style={{ position: "sticky", top: "var(--p-space-400)" }}>
          <Card>
            <BlockStack gap="400">
              <BlockStack gap="100">
                <Text as="h3" variant="headingMd">Ce que voit le client</Text>
                <Text as="p" variant="bodySm" tone="subdued">Aperçu au paiement et simulateur de prix, pour vérifier vos tranches avant d’enregistrer.</Text>
              </BlockStack>

              <Box padding="300" borderWidth="025" borderColor="border" borderRadius="300" background="bg-surface-secondary">
                <InlineStack gap="300" blockAlign="center" wrap={false}>
                  <Thumbnail source={draft.logoUrl ? getImageUrl(draft.logoUrl) : DeliveryIcon} alt="" size="medium" />
                  <BlockStack gap="050">
                    <Text as="span" variant="bodyMd" fontWeight="semibold">{draft.name || "Nom du transporteur"}</Text>
                    <Text as="span" variant="bodySm" tone="subdued">{draft.transitTime || "Délai de livraison"}{draft.isPickup ? " · retrait sur place" : ""}</Text>
                  </BlockStack>
                  <Box>
                    <Text as="span" variant="headingMd" numeric>
                      {simulated && "price" in simulated ? (simulated.price === 0 ? "Gratuit" : formatMoney(simulated.price)) : "—"}
                    </Text>
                  </Box>
                </InlineStack>
              </Box>

              <Divider />

              {built.input && servedZones.length ? (
                <BlockStack gap="300">
                  <Select label="Zone du client" options={servedZones.map((zone) => ({ label: zone.name, value: zone.id }))} value={effectiveZone} onChange={setSimZone} />
                  {draft.freeShipping ? null : (
                    <TextField
                      label={draft.billing === "WEIGHT" ? "Poids de la commande" : "Montant de la commande"}
                      autoComplete="off"
                      inputMode="decimal"
                      suffix={unit}
                      value={simValue}
                      onChange={setSimValue}
                    />
                  )}
                  {simulated ? (
                    "price" in simulated ? (
                      <Banner tone="success" title={simulated.price === 0 ? "Livraison gratuite" : `Le client paie ${formatMoney(simulated.price)}`}>
                        <p>Hors frais de manutention et hors règles de livraison gratuite des préférences.</p>
                      </Banner>
                    ) : (
                      <Banner tone="warning" title="Non proposé au client"><p>{simulated.reason}.</p></Banner>
                    )
                  ) : (
                    <Text as="p" variant="bodySm" tone="subdued">Entrez une valeur pour voir le prix.</Text>
                  )}
                </BlockStack>
              ) : (
                <Text as="p" variant="bodySm" tone={built.problem ? "caution" : "subdued"}>
                  {built.problem ?? "Aucune zone n’est desservie : choisissez au moins une zone."}
                </Text>
              )}
            </BlockStack>
          </Card>
        </div>
      </InlineGrid>

      <Divider />
      <InlineStack align="end" gap="200">
        <Button url="/admin_ben/livraison/transporteurs">Annuler</Button>
        <Button variant="primary" onClick={() => void save()} loading={saving}>{creating ? "Créer le transporteur" : "Enregistrer"}</Button>
      </InlineStack>
    </BlockStack>
  );
}
