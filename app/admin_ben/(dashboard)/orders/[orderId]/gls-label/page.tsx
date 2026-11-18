"use client";

import { Suspense, use, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Badge, Banner, Button, Card, Spinner, Text } from "@shopify/polaris";
import { toast } from "sonner";
import { paymentLabel } from "@/lib/payment-label";
import { getOrder, updateOrderStatus, type OrderDetail } from "@/lib/api/orders";
import { GLS_API, GLS_TYPE_NAMES, glsFetch, inputClass, prefill, type Delivery, type Form, type GlsType } from "../gls-shipping-card";

type GlsConfig = { mode: "sandbox" | "live"; configured: boolean };
type Created = { id: string; trackIds: string[]; parcelCount: number };
type SuggestedWeights = { weights: number[]; totalKg: number; source: "order" | "products" | "none" };
type ExistingShipment ={ id: string; cancelledAt: string | null; glsType?: string | null };

const todayIso = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};
const inThirtyDays = () => {
  const day = new Date(Date.now() + 30 * 24 * 3600 * 1000);
  return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
};

const money = (value: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number.isFinite(value) ? value : 0);
const dateTime = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "medium" }).format(date);
};

const labelClass = "mb-1 block text-sm text-[#344054]";

function Required() {
  return <span aria-hidden="true" className="mr-1 text-[#e04b4b]">*</span>;
}

export default function GlsLabelPage({ params }: { params: Promise<{ orderId: string }> }) {
  return (
    <Suspense fallback={<div className="flex justify-center py-16"><Spinner accessibilityLabel="Chargement" size="large" /></div>}>
      <GlsLabel orderId={use(params).orderId} />
    </Suspense>
  );
}

function GlsLabel({ orderId }: { orderId: string }) {
  const search = useSearchParams();
  const statusAfter = search.get("status") ?? "Expédié";

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [config, setConfig] = useState<GlsConfig | null>(null);
  const [existing, setExisting] = useState<ExistingShipment | null>(null);
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [error, setError] = useState("");

  const [form, setForm] = useState<Form | null>(null);
  const [weights, setWeights] = useState<string[]>(["1"]);
  const [weightSource, setWeightSource] = useState<SuggestedWeights | null>(null);
  const [type, setType] = useState<GlsType>("HOME");
  const [parcelShopId, setParcelShopId] = useState("");
  const [date, setDate] = useState(todayIso);
  const [ref1, setRef1] = useState("");
  const [ref2, setRef2] = useState("");
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<Created | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getOrder(orderId),
      glsFetch<GlsConfig>(""),
      glsFetch<ExistingShipment[]>(`/orders/${orderId}/shipments`),
      glsFetch<Delivery | null>(`/orders/${orderId}/delivery`).catch(() => null),
      glsFetch<SuggestedWeights>(`/orders/${orderId}/weight`).catch(() => null),
    ])
      .then(([loaded, settings, shipments, chosen, suggested]) => {
        if (cancelled) return;
        setOrder(loaded);
        setConfig(settings);
        setExisting(shipments.find((shipment) => !shipment.cancelledAt && shipment.glsType !== "RETURN") ?? null);
        setDelivery(chosen);
        const start = prefill(loaded);
        setForm(chosen?.customerMobile ? { ...start, mobile: chosen.customerMobile } : start);
        setRef1(loaded.reference ?? loaded.id.slice(-8));
        if (suggested?.weights.length) {
          setWeights(suggested.weights.map((weight) => String(weight)));
          setWeightSource(suggested);
        }
        if (chosen) {
          setType(chosen.glsType);
          setParcelShopId(chosen.parcelShopId ?? "");
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

  const parsed = weights.map((weight) => Number(weight.replace(",", ".")));
  const weightsValid = parsed.every((weight) => Number.isFinite(weight) && weight > 0 && weight <= 40);
  const belowMinimum = weightsValid && parsed.some((weight) => weight < 0.1);
  const addressValid = Boolean(form.name.trim() && form.street.trim() && form.zip.trim() && form.city.trim() && /^[A-Za-z]{2}$/.test(form.countryCode));
  const dateValid = date >= todayIso() && date <= inThirtyDays();
  const relayValid = type !== "RELAY" || Boolean(parcelShopId.trim());
  const printable = addressValid && weightsValid && dateValid && relayValid && config.configured && !existing && !created;
  const setField = (patch: Partial<Form>) => setForm((old) => (old ? { ...old, ...patch } : old));

  async function print() {
    if (!order || !form || !printable) return;
    // The window is opened now, while the click still counts, and pointed at the label once it exists.
    const win = window.open("", "_blank");
    setBusy(true);
    try {
      const shipment = await glsFetch<Created>(`/orders/${orderId}/shipments`, {
        method: "POST",
        body: JSON.stringify({
          consignee: {
            name: form.name.trim(),
            street: form.street.trim(),
            zip: form.zip.trim(),
            city: form.city.trim(),
            countryCode: form.countryCode.trim().toUpperCase(),
            ...(form.email.trim() ? { email: form.email.trim() } : {}),
            ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
            ...(form.mobile.trim() ? { mobile: form.mobile.trim() } : {}),
          },
          // GLS refuses a parcel under 0.1 kg: the label is created at the minimum.
          weights: parsed.map((weight) => Math.max(0.1, Math.round(weight * 100) / 100)),
          glsType: type,
          ...(type === "RELAY" ? { parcelShopId: parcelShopId.trim() } : {}),
          shippingDate: date,
          references: [ref1.trim(), ref2.trim()].filter(Boolean),
        }),
      });
      setCreated(shipment);
      if (win) win.location.href = `${GLS_API}/shipments/${shipment.id}/label?index=0`;
      toast.success("Étiquette GLS créée.");
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

  const customer = order.Client ? `${order.Client.firstName} ${order.Client.lastName}`.trim() : order.guestName || "Client invité";
  const idShort = order.id.slice(-8);
  const reference = order.reference ?? idShort;

  return (
    <div className="space-y-4">
      <div className="border-b border-[#dce4ea] pb-3">
        <nav aria-label="Fil d’Ariane" className="text-sm text-[#64748b]">
          <Link href="/admin_ben/orders" className="hover:text-[#168ca8]">Commandes</Link> / <Link href={back} className="hover:text-[#168ca8]">Commande {order.reference ?? `…${idShort}`}</Link> / GLS étiquettes
        </nav>
        <h1 className="mt-1 text-2xl font-semibold text-[#344054]">Étiquette de livraison GLS</h1>
      </div>

      {!config.configured ? (
        <Banner tone="warning" title="GLS n’est pas encore configuré pour l’environnement actif">
          <Link href="/admin_ben/modules/gls">Renseigner les identifiants GLS</Link>
        </Banner>
      ) : null}
      {existing && !created ? (
        <Banner tone="warning" title="Cette commande a déjà une étiquette GLS active">
          Annulez-la depuis <Link href={back}>la commande</Link> avant d’en créer une autre.
        </Banner>
      ) : null}
      {config.configured && config.mode === "sandbox" ? <Banner tone="info" title="Mode test : l’étiquette créée n’est pas facturée." /> : null}
      {created ? (
        <Banner tone="success" title="Étiquette GLS créée">
          <p>Numéro(s) de suivi : <strong>{created.trackIds.join(", ")}</strong>. Si l’étiquette ne s’est pas ouverte, autorisez les pop-up ou utilisez les liens :</p>
          <ul className="mt-1 list-disc pl-5">
            {created.trackIds.map((trackId, index) => (
              <li key={trackId}><a href={`${GLS_API}/shipments/${created.id}/label?index=${index}`} target="_blank" rel="noopener noreferrer">Étiquette PDF du colis {index + 1}</a></li>
            ))}
          </ul>
        </Banner>
      ) : (
        <p className="rounded border-l-4 border-[#25b9d7] bg-[#e8f7fb] px-4 py-3 text-sm text-[#344054]">1 commande sélectionnée</p>
      )}

      <Card padding="0">
        <div className="flex items-center gap-2 border-b border-[#dce4ea] px-4 py-3">
          <Text as="h2" variant="headingMd">Impression des étiquettes de livraison</Text>
          {config.configured ? <Badge tone={config.mode === "live" ? "success" : "attention"}>{config.mode === "live" ? "Production" : "Mode test"}</Badge> : null}
        </div>

        <div className="overflow-x-auto px-4">
          <table className="w-full min-w-[820px] border-collapse text-left text-sm text-[#344054]">
            <thead>
              <tr className="border-b border-[#cbd7df] text-[#667085]">
                {["ID", "Référence", "Client", "Total", "Paiement", "Statut", "Date", "Transporteur", "Imprimable"].map((title) => <th key={title} className="py-3 pr-3 font-normal">{title}</th>)}
                <th className="py-3"><span className="visually-hidden">Imprimer</span></th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="py-3 pr-3">…{idShort}</td>
                <td className="py-3 pr-3">{ref1 || reference}</td>
                <td className="py-3 pr-3">{customer}</td>
                <td className="whitespace-nowrap py-3 pr-3">{money(order.priceTTC ?? order.total)}</td>
                <td className="py-3 pr-3">{paymentLabel(order)}</td>
                <td className="py-3 pr-3">{order.etat}</td>
                <td className="whitespace-nowrap py-3 pr-3">{dateTime(order.createdAt)}</td>
                <td className="py-3 pr-3">{delivery ? GLS_TYPE_NAMES[delivery.glsType] : "—"}</td>
                <td className="py-3 pr-3">
                  <div role="img" aria-label={printable ? "Prête à imprimer" : "Informations à compléter"} className={`h-2.5 w-32 rounded-full ${printable ? "bg-[#6fd08c]" : "bg-[#f5c26b]"}`} />
                </td>
                <td className="py-3 text-right">
                  <Button variant="primary" onClick={() => void print()} loading={busy} disabled={!printable || busy} accessibilityLabel="Imprimer l’étiquette">Imprimer</Button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="grid gap-6 p-4 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
          <section aria-labelledby="gls-packages" className="self-start rounded border border-[#dce4ea]">
            <div className="flex items-center gap-2 border-b border-[#dce4ea] bg-[#f7fafc] px-4 py-3">
              <h3 id="gls-packages" className="text-sm font-medium text-[#344054]">Colis</h3>
              <span className="rounded-full bg-[#25b9d7] px-2 py-0.5 text-xs font-semibold text-white">{weights.length}</span>
            </div>
            <div className="space-y-4 p-4">
              {weights.map((weight, index) => (
                <div key={index}>
                  <p className="text-sm font-semibold text-[#344054]">Colis n°{index + 1}</p>
                  <label htmlFor={`gls-weight-${index}`} className={`${labelClass} mt-2`}><Required />Poids</label>
                  <div className="flex">
                    <input id={`gls-weight-${index}`} inputMode="decimal" className={`${inputClass} !rounded-r-none`} value={weight} onChange={(e) => setWeights(weights.map((w, i) => (i === index ? e.target.value : w)))} />
                    <span className="grid place-items-center rounded-r border border-l-0 border-[#cbd6de] bg-[#f2f4f7] px-3 text-sm text-[#667085]">kg</span>
                    {weights.length > 1 ? <button type="button" className="ml-2 px-2 text-sm text-[#b42318] hover:underline" onClick={() => setWeights(weights.filter((_, i) => i !== index))}>Retirer</button> : null}
                  </div>
                </div>
              ))}
              {!weightsValid ? <p className="text-xs text-[#b42318]">Chaque poids doit être supérieur à 0 et ne pas dépasser 40 kg.</p> : null}
              {belowMinimum ? <p className="text-xs text-[#8a5200]">GLS n’accepte pas moins de 0,1 kg par colis : l’étiquette sera créée avec 0,1 kg.</p> : null}
              <p className="text-xs text-[#667085]">
                {weightSource
                  ? `Poids repris de la commande : ${weightSource.totalKg} kg au total (${weightSource.source === "order" ? "calculé au paiement, d’après les poids des produits" : "somme des poids des produits"}). Au-delà de 30 kg la commande est répartie en plusieurs colis.`
                  : "Aucun poids n’est renseigné sur les produits de cette commande : indiquez celui du colis."}
              </p>
            </div>
            <div className="flex justify-end border-t border-[#dce4ea] bg-[#f7fafc] px-4 py-3">
              <Button onClick={() => setWeights([...weights, "1"])} disabled={weights.length >= 10}>+ Ajouter un colis</Button>
            </div>
          </section>

          <div className="grid content-start gap-x-6 gap-y-4 sm:grid-cols-2">
            <div>
              <label htmlFor="gls-service" className={labelClass}><Required />Service GLS</label>
              <select id="gls-service" className={inputClass} value={type} onChange={(e) => setType(e.target.value as GlsType)}>
                {(Object.keys(GLS_TYPE_NAMES) as GlsType[]).map((value) => <option key={value} value={value}>{GLS_TYPE_NAMES[value]}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="gls-ref1" className={labelClass}>Référence supp. 1</label>
              <input id="gls-ref1" className={inputClass} maxLength={25} value={ref1} onChange={(e) => setRef1(e.target.value)} />
            </div>
            <div>
              <label htmlFor="gls-date" className={labelClass}><Required />Date d’expédition</label>
              <input id="gls-date" type="date" className={inputClass} min={todayIso()} max={inThirtyDays()} value={date} onChange={(e) => setDate(e.target.value)} aria-invalid={!dateValid} />
              {!dateValid ? <p className="mt-1 text-xs text-[#b42318]">Choisissez aujourd’hui ou une date dans les 30 prochains jours.</p> : null}
            </div>
            <div>
              <label htmlFor="gls-ref2" className={labelClass}>Référence supp. 2</label>
              <input id="gls-ref2" className={inputClass} maxLength={25} value={ref2} onChange={(e) => setRef2(e.target.value)} />
            </div>
            {type === "RELAY" ? (
              <div className="sm:col-span-2">
                <label htmlFor="gls-relay" className={labelClass}><Required />Identifiant du point relais</label>
                <input id="gls-relay" className={`${inputClass} sm:max-w-xs`} maxLength={40} value={parcelShopId} onChange={(e) => setParcelShopId(e.target.value)} />
                {delivery?.relay ? <p className="mt-1 text-xs text-[#667085]">Choisi par le client : {delivery.relay.name}, {delivery.relay.street}, {delivery.relay.zip} {delivery.relay.city}</p> : null}
              </div>
            ) : null}

            <fieldset className="grid gap-x-6 gap-y-3 border-t border-[#dce4ea] pt-4 sm:col-span-2 sm:grid-cols-2">
              <legend className="mb-2 text-sm font-semibold text-[#344054]">Adresse de livraison <span className="font-normal text-[#667085]">(reprise de la commande, imprimée sur l’étiquette)</span></legend>
              <div><label htmlFor="gls-name" className={labelClass}><Required />Destinataire</label><input id="gls-name" className={inputClass} maxLength={40} value={form.name} onChange={(e) => setField({ name: e.target.value })} /></div>
              <div><label htmlFor="gls-street" className={labelClass}><Required />Adresse</label><input id="gls-street" className={inputClass} maxLength={40} value={form.street} onChange={(e) => setField({ street: e.target.value })} /></div>
              <div><label htmlFor="gls-zip" className={labelClass}><Required />Code postal</label><input id="gls-zip" className={inputClass} maxLength={10} value={form.zip} onChange={(e) => setField({ zip: e.target.value })} /></div>
              <div><label htmlFor="gls-city" className={labelClass}><Required />Ville</label><input id="gls-city" className={inputClass} maxLength={40} value={form.city} onChange={(e) => setField({ city: e.target.value })} /></div>
              <div><label htmlFor="gls-country" className={labelClass}><Required />Pays (2 lettres)</label><input id="gls-country" className={`${inputClass} uppercase`} maxLength={2} placeholder="FR" value={form.countryCode} onChange={(e) => setField({ countryCode: e.target.value })} /></div>
              <div><label htmlFor="gls-mobile" className={labelClass}>Mobile (SMS du livreur)</label><input id="gls-mobile" className={inputClass} maxLength={35} value={form.mobile} onChange={(e) => setField({ mobile: e.target.value })} /></div>
              <div><label htmlFor="gls-phone" className={labelClass}>Téléphone</label><input id="gls-phone" className={inputClass} maxLength={35} value={form.phone} onChange={(e) => setField({ phone: e.target.value })} /></div>
              <div><label htmlFor="gls-email" className={labelClass}>E-mail</label><input id="gls-email" type="email" className={inputClass} value={form.email} onChange={(e) => setField({ email: e.target.value })} /></div>
            </fieldset>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-[#dce4ea] bg-[#f7fafc] px-4 py-3">
          <Button url={back}>← Retour</Button>
          <Button variant="primary" onClick={() => void print()} loading={busy} disabled={!printable || busy}>Tout imprimer</Button>
        </div>
      </Card>
      {statusAfter ? <p className="text-xs text-[#667085]">Après l’impression, la commande passera à l’état « {statusAfter} ».</p> : null}
    </div>
  );
}
