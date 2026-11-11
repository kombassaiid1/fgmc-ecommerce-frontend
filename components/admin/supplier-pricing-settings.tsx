"use client";

import { useEffect, useState } from "react";
import { Banner, BlockStack, Button, Card, InlineGrid, Select, Text, TextField } from "@shopify/polaris";

type Pricing = { priceBasis: string; vatRate: number | null; discountMode: string; discountPercent: number | null; currency: "EUR" };
type Supplier = { code: string; name: string; pricing: Partial<Pricing>; isActive: boolean };
const defaults: Pricing = { priceBasis: "UNKNOWN", vatRate: null, discountMode: "UNKNOWN", discountPercent: null, currency: "EUR" };

function SupplierPricingForm({ supplier }: { supplier: Supplier }) {
  const initial = supplier.pricing ?? {};
  const [pricing, setPricing] = useState<Pricing>({ ...defaults, ...supplier.pricing });
  const [vat, setVat] = useState(initial.vatRate == null ? "" : String(initial.vatRate));
  const [discount, setDiscount] = useState(initial.discountPercent == null ? "" : String(initial.discountPercent));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);
  const save = async () => {
    setSaving(true); setMessage(null);
    const payload = { ...pricing, vatRate: vat.trim() ? Number(vat.replace(",", ".")) : null, discountPercent: discount.trim() ? Number(discount.replace(",", ".")) : null };
    if ((payload.vatRate != null && (!Number.isFinite(payload.vatRate) || payload.vatRate < 0 || payload.vatRate > 100)) || (payload.discountPercent != null && (!Number.isFinite(payload.discountPercent) || payload.discountPercent < 0 || payload.discountPercent > 100)) || (payload.priceBasis === "TTC" && payload.vatRate == null) || (payload.discountMode === "APPLY" && payload.discountPercent == null)) {
      setMessage({ error: true, text: "Indiquez les taux entre 0 et 100 %. La TVA est nécessaire pour un prix TTC, et le pourcentage pour une remise à appliquer." }); setSaving(false); return;
    }
    try {
      const response = await fetch(`/frontend-api/admin/suppliers/${encodeURIComponent(supplier.code)}/pricing`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json();
      if (!response.ok) throw new Error(Array.isArray(result.message) ? result.message.join(", ") : result.message || "Enregistrement impossible.");
      setPricing({ ...defaults, ...result.pricing });
      setMessage({ error: false, text: "Règles fournisseur enregistrées. Elles seront utilisées pour les prochaines préparations." });
    } catch (error) { setMessage({ error: true, text: error instanceof Error ? error.message : "Enregistrement impossible." }); }
    finally { setSaving(false); }
  };
  return <Card><BlockStack gap="300">
    <Text as="h3" variant="headingMd">{supplier.name}</Text>
    {message && <Banner tone={message.error ? "critical" : "success"} title={message.text} />}
    <InlineGrid columns={{ xs: 1, md: 2 }} gap="300">
      <Select label="Base du prix affiché par le fournisseur" options={[{ label: "À confirmer", value: "UNKNOWN" }, { label: "HT — hors taxes", value: "HT" }, { label: "TTC — taxes comprises", value: "TTC" }]} value={pricing.priceBasis} onChange={(value) => { setPricing({ ...pricing, priceBasis: value }); setMessage(null); }} />
      <TextField label="TVA du prix fournisseur" type="number" min={0} max={100} suffix="%" value={vat} onChange={(value) => { setVat(value); setMessage(null); }} autoComplete="off" helpText="Taux réellement appliqué au prix fournisseur, pour la conversion HT/TTC. Ce taux est distinct de la TVA de vente FGMC." />
      <Select label="Remise sur le prix affiché" options={[{ label: "À confirmer", value: "UNKNOWN" }, { label: "Aucune remise", value: "NONE" }, { label: "Déjà incluse dans le prix", value: "INCLUDED" }, { label: "À appliquer au prix affiché", value: "APPLY" }]} value={pricing.discountMode} onChange={(value) => { setPricing({ ...pricing, discountMode: value }); setMessage(null); }} />
      <TextField label="Pourcentage de remise" type="number" min={0} max={100} suffix="%" value={discount} disabled={pricing.discountMode !== "APPLY" && pricing.discountMode !== "INCLUDED"} onChange={(value) => { setDiscount(value); setMessage(null); }} autoComplete="off" helpText="Une remise déjà incluse n’est jamais appliquée une seconde fois." />
    </InlineGrid>
    <Text as="p" tone="subdued">Devise : EUR. Le calcul automatique attend des règles confirmées ; les anciens produits ne sont pas recalculés.</Text>
    <Button variant="primary" loading={saving} onClick={() => void save()}>Enregistrer les règles de {supplier.name}</Button>
  </BlockStack></Card>;
}

export function SupplierPricingSettings() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void fetch("/frontend-api/admin/suppliers", { cache: "no-store" }).then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.message || "Chargement des fournisseurs impossible."); if (active) setSuppliers(data.filter((supplier: Supplier) => supplier.isActive)); }).catch((error) => { if (active) setError(error.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  return <BlockStack gap="300">
    <Text as="h2" variant="headingLg">Prix d’achat fournisseur</Text>
    <Text as="p" tone="subdued">Le coût net HT, après remise éventuelle, sert de base à la majoration. La TVA de vente provient de la taxe du produit ou de la taxe par défaut FGMC.</Text>
    {loading && <Text as="p">Chargement des fournisseurs…</Text>}
    {error && <Banner tone="critical" title={error} />}
    {suppliers.map((supplier) => <SupplierPricingForm key={supplier.code} supplier={supplier} />)}
  </BlockStack>;
}
