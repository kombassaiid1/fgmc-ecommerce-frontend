"use client";

import { Suspense, use, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Banner, Button, Card, Spinner, Text } from "@shopify/polaris";
import { toast } from "sonner";
import { getOrder, updateOrderStatus, type OrderDetail } from "@/lib/api/orders";
import { inputClass, prefill, type Form } from "../gls-shipping-card";
import { COLISSIMO_API, COLISSIMO_TYPE_NAMES, colissimoFetch, type ColissimoDeliveryChoice, type ColissimoType } from "../colissimo-shipping-card";

type Config = { configured: boolean };
type Created = { id: string; trackIds: string[] };
type SuggestedWeight = { weightKg: number; source: "order" | "products" | "none" };
type ExistingShipment = { id: string; cancelledAt: string | null; colissimoType?: string | null };

const labelClass = "mb-1 block text-sm text-[#344054]";

function Required() {
  return <span aria-hidden="true" className="mr-1 text-[#e04b4b]">*</span>;
}

export default function ColissimoLabelPage({ params }: { params: Promise<{ orderId: string }> }) {
  return (
    <Suspense fallback={<div className="flex justify-center py-16"><Spinner accessibilityLabel="Chargement" size="large" /></div>}>
      <ColissimoLabel orderId={use(params).orderId} />
    </Suspense>
  );
}

function ColissimoLabel({ orderId }: { orderId: string }) {
  const search = useSearchParams();
  const statusAfter = search.get("status") ?? "Expédié";

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [config, setConfig] = useState<Config | null>(null);
  const [existing, setExisting] = useState<ExistingShipment | null>(null);
  const [delivery, setDelivery] = useState<ColissimoDeliveryChoice | null>(null);
  const [error, setError] = useState("");

  const [form, setForm] = useState<Form | null>(null);
  const [weight, setWeight] = useState("1");
  const [weightSource, setWeightSource] = useState<SuggestedWeight | null>(null);
  const [type, setType] = useState<ColissimoType>("HOME");
  const [firstName, setFirstName] = useState("");
  const [pickupPointId, setPickupPointId] = useState("");
  const [pickupPointType, setPickupPointType] = useState("A2P");
  const [reference, setReference] = useState("");
  const [insured, setInsured] = useState(false);
  const [nonMachinable, setNonMachinable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<Created | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getOrder(orderId),
      colissimoFetch<Config>(""),
      colissimoFetch<ExistingShipment[]>(`/orders/${orderId}/shipments`),
      colissimoFetch<ColissimoDeliveryChoice | null>(`/orders/${orderId}/delivery`).catch(() => null),
      colissimoFetch<SuggestedWeight>(`/orders/${orderId}/weight`).catch(() => null),
    ])
      .then(([loaded, settings, shipments, chosen, suggested]) => {
        if (cancelled) return;
        setOrder(loaded);
        setConfig(settings);
        setExisting(shipments.find((shipment) => !shipment.cancelledAt && shipment.colissimoType !== "RETURN") ?? null);
        setDelivery(chosen);
        const start = prefill(loaded);
        // The order stores one full name; Colissimo wants the first name and the last name apart.
        const words = start.name.trim().split(/\s+/).filter(Boolean);
        const last = words.length > 1 ? words[words.length - 1] : start.name;
        setFirstName(words.length > 1 ? words.slice(0, -1).join(" ") : "");
        const named = { ...start, name: last };
        setForm(chosen?.customerMobile ? { ...named, mobile: chosen.customerMobile } : named);
        setReference(loaded.reference ?? loaded.id.slice(-8));
        if (suggested && suggested.weightKg > 0) {
          setWeight(String(suggested.weightKg));
          setWeightSource(suggested);
        }
        if (chosen) {
          setType(chosen.colissimoType);
          setPickupPointId(chosen.pickupPointId ?? "");
          const kind = (chosen.relay as { pointType?: string } | null)?.pointType;
          if (kind) setPickupPointType(kind);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Chargement impossible.");
      });
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  const back = `/admin_ben/orders/${orderId}`;
  if (error) return <Banner tone="critical" title="Impossible de charger la commande">{error}</Banner>;
  if (!order || !form || !config) return <div className="flex justify-center py-16"><Spinner accessibilityLabel="Chargement" size="large" /></div>;

  const parsed = Number(weight.replace(",", "."));
  const weightValid = Number.isFinite(parsed) && parsed >= 0.01 && parsed <= 30;
  const addressValid = Boolean(form.name.trim() && form.street.trim() && form.zip.trim() && form.city.trim() && /^[A-Za-z]{2}$/.test(form.countryCode));
  const relayValid = type !== "RELAY" || Boolean(pickupPointId.trim());
  const printable = addressValid && weightValid && relayValid && config.configured && !existing && !created;
  const setField = (patch: Partial<Form>) => setForm((old) => (old ? { ...old, ...patch } : old));

  async function print() {
    if (!order || !form || !printable) return;
    // The window is opened now, while the click still counts, and pointed at the label once it exists.
    const win = window.open("", "_blank");
    setBusy(true);
    try {
      const shipment = await colissimoFetch<Created>(`/orders/${orderId}/shipments`, {
        method: "POST",
        body: JSON.stringify({
          consignee: {
            name: form.name.trim(),
            ...(firstName.trim() ? { firstName: firstName.trim() } : {}),
            street: form.street.trim(),
            zip: form.zip.trim(),
            city: form.city.trim(),
            countryCode: form.countryCode.trim().toUpperCase(),
            ...(form.email.trim() ? { email: form.email.trim() } : {}),
            ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
            ...(form.mobile.trim() ? { mobile: form.mobile.trim() } : {}),
          },
          weightKg: Math.round(parsed * 1000) / 1000,
          colissimoType: type,
          ...(type === "RELAY" ? { pickupPointId: pickupPointId.trim(), pickupPointType } : {}),
          ...(reference.trim() ? { reference: reference.trim() } : {}),
          insured,
          nonMachinable,
        }),
      });
      setCreated(shipment);
      if (win) win.location.href = `${COLISSIMO_API}/shipments/${shipment.id}/label`;
      toast.success("Étiquette Colissimo créée.");
      if (statusAfter && statusAfter !== order.etat) {
        try {
          await updateOrderStatus(order.id, statusAfter);
        } catch (e) {
          toast.error(e instanceof Error ? `Étiquette créée, mais l’état de la commande n’a pas changé : ${e.message}` : "Étiquette créée, mais l’état de la commande n’a pas changé.");
        }
      }
    } catch (e) {
      win?.close();
      toast.error(e instanceof Error ? e.message : "Création impossible.");
    } finally {
      setBusy(false);
    }
  }

  const idShort = order.id.slice(-8);

  return (
    <div className="space-y-4">
      <div className="border-b border-[#dce4ea] pb-3">
        <nav aria-label="Fil d’Ariane" className="text-sm text-[#64748b]">
          <Link href="/admin_ben/orders" className="hover:text-[#168ca8]">Commandes</Link> / <Link href={back} className="hover:text-[#168ca8]">Commande {order.reference ?? `…${idShort}`}</Link> / Étiquette Colissimo
        </nav>
        <h1 className="mt-1 text-2xl font-semibold text-[#344054]">Étiquette de livraison Colissimo</h1>
      </div>

      {!config.configured ? (
        <Banner tone="warning" title="Colissimo n’est pas encore configuré">
          <Link href="/admin_ben/modules/colissimo">Renseigner les identifiants Colissimo</Link>
        </Banner>
      ) : null}
      {existing && !created ? (
        <Banner tone="warning" title="Cette commande a déjà une étiquette Colissimo active">
          Marquez-la annulée depuis <Link href={back}>la commande</Link> avant d’en créer une autre.
        </Banner>
      ) : null}
      {config.configured && !created ? <Banner tone="info" title="Colissimo n’a pas de mode test : l’étiquette créée est facturée selon votre contrat." /> : null}
      {created ? (
        <Banner tone="success" title="Étiquette Colissimo créée">
          <p>Numéro de suivi : <strong>{created.trackIds.join(", ")}</strong>. Si l’étiquette ne s’est pas ouverte, autorisez les pop-up ou utilisez le lien : <a href={`${COLISSIMO_API}/shipments/${created.id}/label`} target="_blank" rel="noopener noreferrer">Étiquette PDF</a></p>
        </Banner>
      ) : null}

      <Card padding="0">
        <div className="border-b border-[#dce4ea] px-4 py-3">
          <Text as="h2" variant="headingMd">Impression de l’étiquette de livraison</Text>
        </div>

        <div className="grid gap-6 p-4 lg:grid-cols-2">
          <div className="grid content-start gap-x-6 gap-y-4 sm:grid-cols-2">
            <div>
              <label htmlFor="colissimo-service" className={labelClass}><Required />Service Colissimo</label>
              <select id="colissimo-service" className={inputClass} value={type} onChange={(e) => setType(e.target.value as ColissimoType)}>
                {(Object.keys(COLISSIMO_TYPE_NAMES) as ColissimoType[]).map((value) => <option key={value} value={value}>{COLISSIMO_TYPE_NAMES[value]}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="colissimo-weight" className={labelClass}><Required />Poids</label>
              <div className="flex">
                <input id="colissimo-weight" inputMode="decimal" className={`${inputClass} !rounded-r-none`} value={weight} onChange={(e) => setWeight(e.target.value)} aria-invalid={!weightValid} />
                <span className="grid place-items-center rounded-r border border-l-0 border-[#cbd6de] bg-[#f2f4f7] px-3 text-sm text-[#667085]">kg</span>
              </div>
              {!weightValid ? <p className="mt-1 text-xs text-[#b42318]">Le poids doit être entre 0,01 et 30 kg.</p> : null}
              <p className="mt-1 text-xs text-[#667085]">
                {weightSource ? `Poids repris de la commande (${weightSource.source === "order" ? "calculé au paiement" : "somme des poids des produits"}).` : "Aucun poids n’est renseigné sur les produits : indiquez celui du colis."}
              </p>
            </div>
            <div>
              <label htmlFor="colissimo-ref" className={labelClass}>Référence imprimée</label>
              <input id="colissimo-ref" className={inputClass} maxLength={30} value={reference} onChange={(e) => setReference(e.target.value)} />
            </div>
            {type === "RELAY" ? (
              <div>
                <label htmlFor="colissimo-relay" className={labelClass}><Required />Identifiant du point de retrait</label>
                <input id="colissimo-relay" className={inputClass} maxLength={40} value={pickupPointId} onChange={(e) => setPickupPointId(e.target.value)} />
                {delivery?.relay ? <p className="mt-1 text-xs text-[#667085]">Choisi par le client : {delivery.relay.name}, {delivery.relay.street}, {delivery.relay.zip} {delivery.relay.city}</p> : null}
                <label htmlFor="colissimo-relay-type" className={`${labelClass} mt-3`}>Type de point</label>
                <select id="colissimo-relay-type" className={inputClass} value={pickupPointType} onChange={(e) => setPickupPointType(e.target.value)}>
                  <option value="A2P">Commerçant partenaire (A2P)</option>
                  <option value="BPR">Bureau de poste (BPR)</option>
                  <option value="PCS">Consigne Pickup (PCS)</option>
                  <option value="CMT">Commerçant, Belgique (CMT)</option>
                  <option value="BDP">Bureau de poste, Belgique (BDP)</option>
                </select>
                <p className="mt-1 text-xs text-[#667085]">Utilisé si Colissimo ne retrouve pas le point : le type décide du produit de l’étiquette.</p>
              </div>
            ) : null}
            <div className="flex flex-col gap-2 sm:col-span-2">
              <label className="flex items-center gap-2 text-sm text-[#344054]"><input type="checkbox" checked={insured} onChange={(e) => setInsured(e.target.checked)} /> Assurer le colis (valeur des produits de la commande)</label>
              <label className="flex items-center gap-2 text-sm text-[#344054]"><input type="checkbox" checked={nonMachinable} onChange={(e) => setNonMachinable(e.target.checked)} /> Colis non mécanisable (supplément Colissimo)</label>
            </div>
          </div>

          <fieldset className="grid content-start gap-x-6 gap-y-3 sm:grid-cols-2">
            <legend className="mb-2 text-sm font-semibold text-[#344054]">Adresse de livraison <span className="font-normal text-[#667085]">(reprise de la commande, imprimée sur l’étiquette)</span></legend>
            <div><label htmlFor="colissimo-firstname" className={labelClass}><Required />Prénom</label><input id="colissimo-firstname" className={inputClass} maxLength={29} autoComplete="given-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} /></div>
            <div><label htmlFor="colissimo-name" className={labelClass}><Required />Nom</label><input id="colissimo-name" className={inputClass} maxLength={35} autoComplete="family-name" value={form.name} onChange={(e) => setField({ name: e.target.value })} /></div>
            <div><label htmlFor="colissimo-street" className={labelClass}><Required />Adresse</label><input id="colissimo-street" className={inputClass} maxLength={35} value={form.street} onChange={(e) => setField({ street: e.target.value })} /></div>
            <div><label htmlFor="colissimo-zip" className={labelClass}><Required />Code postal</label><input id="colissimo-zip" className={inputClass} maxLength={10} value={form.zip} onChange={(e) => setField({ zip: e.target.value })} /></div>
            <div><label htmlFor="colissimo-city" className={labelClass}><Required />Ville</label><input id="colissimo-city" className={inputClass} maxLength={35} value={form.city} onChange={(e) => setField({ city: e.target.value })} /></div>
            <div><label htmlFor="colissimo-country" className={labelClass}><Required />Pays (2 lettres)</label><input id="colissimo-country" className={`${inputClass} uppercase`} maxLength={2} placeholder="FR" value={form.countryCode} onChange={(e) => setField({ countryCode: e.target.value })} /></div>
            <div><label htmlFor="colissimo-mobile" className={labelClass}>Mobile</label><input id="colissimo-mobile" className={inputClass} maxLength={20} value={form.mobile} onChange={(e) => setField({ mobile: e.target.value })} /></div>
            <div><label htmlFor="colissimo-phone" className={labelClass}>Téléphone</label><input id="colissimo-phone" className={inputClass} maxLength={20} value={form.phone} onChange={(e) => setField({ phone: e.target.value })} /></div>
            <div><label htmlFor="colissimo-email" className={labelClass}>E-mail</label><input id="colissimo-email" type="email" className={inputClass} value={form.email} onChange={(e) => setField({ email: e.target.value })} /></div>
          </fieldset>
        </div>

        <div className="flex items-center justify-between border-t border-[#dce4ea] bg-[#f7fafc] px-4 py-3">
          <Button url={back}>← Retour</Button>
          <Button variant="primary" onClick={() => void print()} loading={busy} disabled={!printable || busy}>Imprimer l’étiquette</Button>
        </div>
      </Card>
      {statusAfter ? <p className="text-xs text-[#667085]">Après l’impression, la commande passera à l’état « {statusAfter} ».</p> : null}
    </div>
  );
}
