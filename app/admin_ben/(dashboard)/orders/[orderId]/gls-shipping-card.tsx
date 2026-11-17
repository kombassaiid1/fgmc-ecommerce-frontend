"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Badge, Button, Card, Text } from "@shopify/polaris";
import { toast } from "sonner";
import type { OrderDetail } from "@/lib/api/orders";

type Shipment = {
  id: string;
  environment: "sandbox" | "live";
  product: "PARCEL" | "EXPRESS";
  trackIds: string[];
  weightKg: number;
  parcelCount: number;
  lastStatus: string | null;
  lastEventAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
};
type TrackingEvent = { date: string; time: string; description: string; place: string };
type GlsConfig = { mode: "sandbox" | "live"; configured: boolean };
type Form = { name: string; street: string; zip: string; city: string; countryCode: string; email: string; phone: string };

const API = "/frontend-api/admin/gls-integration";

const COUNTRY_CODES: Record<string, string> = {
  france: "FR", belgique: "BE", allemagne: "DE", espagne: "ES", italie: "IT", "pays-bas": "NL", luxembourg: "LU",
  suisse: "CH", portugal: "PT", "royaume-uni": "GB", autriche: "AT", irlande: "IE", pologne: "PL", tunisie: "TN",
};

function countryCodeOf(value: string | null | undefined) {
  const text = (value ?? "").trim().toLowerCase();
  if (/^[a-z]{2}$/.test(text)) return text.toUpperCase();
  return COUNTRY_CODES[text] ?? "";
}

/** Prefills the consignee from the order. The admin always reviews it before creating a label. */
function prefill(order: OrderDetail): Form {
  const client = order.Client;
  const address = order.Address;
  if (address) {
    return {
      name: [client?.firstName, client?.lastName].filter(Boolean).join(" "),
      street: address.street ?? "",
      zip: address.zipCode ?? "",
      city: address.City ?? "",
      countryCode: countryCodeOf(address.country),
      email: client?.email ?? "",
      phone: client?.phoneNumber ?? "",
    };
  }
  // Guest orders store one line: "street, city, postal code, country".
  const parts = (order.guestAddress ?? "").split(",").map((part) => part.trim()).filter(Boolean);
  return {
    name: order.guestName ?? "",
    street: parts.length >= 4 ? parts[0] : parts.slice(0, Math.max(parts.length - 3, 1)).join(", "),
    city: parts.length >= 4 ? parts[1] : "",
    zip: parts.length >= 4 ? parts[2] : "",
    countryCode: countryCodeOf(parts[parts.length - 1]),
    email: order.guestEmail ?? "",
    phone: order.guestPhone ?? "",
  };
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, { cache: "no-store", ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(Array.isArray(data.message) ? data.message.join(" ") : data.message || "Action impossible.");
  return data as T;
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

const inputClass = "h-9 w-full rounded border border-[#cbd6de] bg-white px-3 text-sm text-[#344054] focus-visible:outline-2 focus-visible:outline-[#168ca8]";

export function GlsShippingCard({ order }: { order: OrderDetail }) {
  const [config, setConfig] = useState<GlsConfig | null>(null);
  const [shipments, setShipments] = useState<Shipment[] | null>(null);
  const [form, setForm] = useState<Form>(() => prefill(order));
  const [weights, setWeights] = useState<string[]>(["1"]);
  const [product, setProduct] = useState<"PARCEL" | "EXPRESS">("PARCEL");
  const [busy, setBusy] = useState("");
  const [events, setEvents] = useState<Record<string, TrackingEvent[]>>({});
  const [loadError, setLoadError] = useState("");

  const fetchAll = useCallback(
    () => Promise.all([call<GlsConfig>(""), call<Shipment[]>(`/orders/${order.id}/shipments`)]),
    [order.id],
  );

  /** Reloads after an action (cancel, create, tracking). */
  const load = useCallback(async () => {
    try {
      const [settings, list] = await fetchAll();
      setConfig(settings);
      setShipments(list);
      setLoadError("");
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Chargement impossible.");
    }
  }, [fetchAll]);

  useEffect(() => {
    let cancelled = false;
    fetchAll()
      .then(([settings, list]) => {
        if (cancelled) return;
        setConfig(settings);
        setShipments(list);
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : "Chargement impossible.");
      });
    return () => {
      cancelled = true;
    };
  }, [fetchAll]);

  const active = shipments?.find((shipment) => !shipment.cancelledAt) ?? null;
  const parsedWeights = weights.map((weight) => Number(weight.replace(",", ".")));
  const weightsValid = parsedWeights.every((weight) => Number.isFinite(weight) && weight >= 0.1 && weight <= 40);
  const formValid = form.name.trim() && form.street.trim() && form.zip.trim() && form.city.trim() && /^[A-Za-z]{2}$/.test(form.countryCode) && weightsValid;

  async function run<T>(key: string, action: () => Promise<T>, success: string) {
    setBusy(key);
    try {
      const result = await action();
      toast.success(success);
      await load();
      return result;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action impossible.");
      return undefined;
    } finally {
      setBusy("");
    }
  }

  const create = () =>
    run(
      "create",
      () =>
        call(`/orders/${order.id}/shipments`, {
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
            },
            weights: parsedWeights,
            product,
          }),
        }),
      "Expédition GLS créée.",
    );

  async function refresh(shipment: Shipment) {
    const result = await run("track-" + shipment.id, () => call<{ events: TrackingEvent[] }>(`/shipments/${shipment.id}/tracking`, { method: "POST" }), "Suivi actualisé.");
    if (result) setEvents((old) => ({ ...old, [shipment.id]: result.events }));
  }

  async function cancel(shipment: Shipment) {
    if (!window.confirm("Annuler cette expédition GLS ? Le colis ne sera plus pris en charge.")) return;
    await run("cancel-" + shipment.id, () => call(`/shipments/${shipment.id}/cancel`, { method: "POST" }), "Expédition GLS annulée.");
  }

  const statusBadge = (shipment: Shipment) =>
    shipment.cancelledAt ? <Badge>Annulée</Badge> : shipment.deliveredAt ? <Badge tone="success">Livrée</Badge> : <Badge tone="info">Étiquette créée</Badge>;

  return (
    <Card padding="0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#dce4ea] px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <Text as="h2" variant="headingMd">Expédition GLS</Text>
          {config?.configured ? <Badge tone={config.mode === "live" ? "success" : "attention"}>{config.mode === "live" ? "Production" : "Mode test"}</Badge> : null}
        </div>
        <Link href="/admin_ben/modules/gls" className="text-xs text-[#22a8c8] hover:underline">Réglages GLS</Link>
      </div>

      <div className="space-y-4 p-4">
        {loadError ? <p role="alert" className="text-sm text-[#b42318]">{loadError}</p> : null}
        {!loadError && (!config || !shipments) ? <p className="text-sm text-[#667085]">Chargement…</p> : null}

        {config && !config.configured ? (
          <p className="text-sm text-[#667085]">
            GLS n’est pas encore configuré pour l’environnement actif. <Link href="/admin_ben/modules/gls" className="text-[#22a8c8] hover:underline">Renseigner les identifiants GLS</Link>.
          </p>
        ) : null}

        {shipments?.map((shipment) => (
          <div key={shipment.id} className={`rounded border border-[#dce4ea] p-3 ${shipment.cancelledAt ? "bg-[#f7f7f7] opacity-80" : "bg-white"}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                {statusBadge(shipment)}
                {shipment.environment === "sandbox" ? <Badge tone="attention">Test</Badge> : null}
                <span className="text-xs text-[#667085]">{shipment.product === "EXPRESS" ? "Express" : "Colis"} · {shipment.parcelCount} colis · {shipment.weightKg} kg · {formatDate(shipment.createdAt)}</span>
              </div>
              {!shipment.cancelledAt ? (
                <div className="flex flex-wrap gap-2">
                  <Button size="slim" onClick={() => void refresh(shipment)} loading={busy === "track-" + shipment.id}>Actualiser le suivi</Button>
                  <Button size="slim" tone="critical" onClick={() => void cancel(shipment)} loading={busy === "cancel-" + shipment.id}>Annuler</Button>
                </div>
              ) : null}
            </div>

            <ul className="mt-3 space-y-2">
              {shipment.trackIds.map((trackId, index) => (
                <li key={trackId} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="font-mono text-[#344054]">{trackId}</span>
                  {!shipment.cancelledAt ? (
                    <span className="flex gap-3 text-xs">
                      <a href={`${API}/shipments/${shipment.id}/label?index=${index}`} target="_blank" rel="noopener noreferrer" className="font-medium text-[#22a8c8] hover:underline">Étiquette PDF</a>
                      <a href="https://gls-group.com/FR/fr/suivi-colis" target="_blank" rel="noopener noreferrer" className="text-[#22a8c8] hover:underline">Suivi sur gls-group.com</a>
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>

            {shipment.lastStatus ? <p className="mt-3 text-sm text-[#344054]">Dernier statut : <strong>{shipment.lastStatus}</strong> <span className="text-xs text-[#667085]">({formatDate(shipment.lastEventAt)})</span></p> : null}
            {events[shipment.id]?.length ? (
              <ol className="mt-3 space-y-1 border-l-2 border-[#dce4ea] pl-3 text-xs text-[#526174]">
                {[...events[shipment.id]].reverse().map((event, index) => (
                  <li key={`${event.date}-${event.time}-${index}`}><span className="text-[#8492a3]">{event.date} {event.time}</span> · {event.description}{event.place ? ` · ${event.place}` : ""}</li>
                ))}
              </ol>
            ) : null}
          </div>
        ))}

        {config?.configured && shipments && !active ? (
          <div className="space-y-3">
            <p className="text-sm font-medium text-[#344054]">Nouvelle expédition</p>
            <p className="text-xs text-[#667085]">Vérifiez l’adresse du destinataire : elle est reprise de la commande et sera imprimée sur l’étiquette.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-semibold text-[#667085]">Destinataire (40 caractères max.)<input className={`${inputClass} mt-1`} value={form.name} maxLength={40} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
              <label className="text-xs font-semibold text-[#667085]">Adresse (40 caractères max.)<input className={`${inputClass} mt-1`} value={form.street} maxLength={40} onChange={(e) => setForm({ ...form, street: e.target.value })} /></label>
              <label className="text-xs font-semibold text-[#667085]">Code postal<input className={`${inputClass} mt-1`} value={form.zip} maxLength={10} onChange={(e) => setForm({ ...form, zip: e.target.value })} /></label>
              <label className="text-xs font-semibold text-[#667085]">Ville<input className={`${inputClass} mt-1`} value={form.city} maxLength={40} onChange={(e) => setForm({ ...form, city: e.target.value })} /></label>
              <label className="text-xs font-semibold text-[#667085]">Pays (code à 2 lettres)<input className={`${inputClass} mt-1 uppercase`} value={form.countryCode} maxLength={2} placeholder="FR" onChange={(e) => setForm({ ...form, countryCode: e.target.value })} /></label>
              <label className="text-xs font-semibold text-[#667085]">Téléphone<input className={`${inputClass} mt-1`} value={form.phone} maxLength={35} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
              <label className="text-xs font-semibold text-[#667085] sm:col-span-2">E-mail (pour l’avis de passage)<input className={`${inputClass} mt-1`} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
            </div>

            <div>
              <p className="text-xs font-semibold text-[#667085]">Poids de chaque colis (kg)</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                {weights.map((weight, index) => (
                  <input key={index} aria-label={`Poids du colis ${index + 1}`} inputMode="decimal" className={`${inputClass} !w-24`} value={weight} onChange={(e) => setWeights(weights.map((w, i) => (i === index ? e.target.value : w)))} />
                ))}
                {weights.length < 10 ? <Button size="slim" onClick={() => setWeights([...weights, "1"])}>Ajouter un colis</Button> : null}
                {weights.length > 1 ? <Button size="slim" onClick={() => setWeights(weights.slice(0, -1))}>Retirer</Button> : null}
              </div>
              {!weightsValid ? <p className="mt-1 text-xs text-[#b42318]">Chaque poids doit être compris entre 0,1 et 40 kg.</p> : null}
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <label className="text-xs font-semibold text-[#667085]">Service
                <select className={`${inputClass} mt-1 min-w-44`} value={product} onChange={(e) => setProduct(e.target.value as "PARCEL" | "EXPRESS")}>
                  <option value="PARCEL">Colis standard</option>
                  <option value="EXPRESS">Express</option>
                </select>
              </label>
              <Button variant="primary" onClick={() => void create()} loading={busy === "create"} disabled={!formValid || Boolean(busy)}>Créer l’expédition GLS</Button>
            </div>
            {config.mode === "live" ? <p className="text-xs text-[#667085]">Environnement de production : GLS facture l’étiquette dès sa création.</p> : null}
          </div>
        ) : null}
      </div>
    </Card>
  );
}
