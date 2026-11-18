"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Badge, Button, Card, Text } from "@shopify/polaris";
import { toast } from "sonner";
import type { OrderDetail } from "@/lib/api/orders";
import { useOrderStates } from "@/lib/use-order-states";

export type GlsType = "HOME" | "RELAY" | "FLEX" | "EXPRESS";
type Shipment = {
  id: string;
  environment: "sandbox" | "live";
  product: "PARCEL" | "EXPRESS";
  /** RETURN marks a return label (customer to shop). */
  glsType?: GlsType | "RETURN" | null;
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
export type Form = { name: string; street: string; zip: string; city: string; countryCode: string; email: string; phone: string; mobile: string };
export type Delivery = { glsType: GlsType; parcelShopId: string | null; relay: { name: string; street: string; zip: string; city: string } | null; customerMobile: string | null };
/** What the Réglages tab turns on for orders. */
type ModuleSettings = { returnService: { enabled: boolean }; deliveryNote: boolean };

export const GLS_API = "/frontend-api/admin/gls-integration";
export const GLS_TYPE_NAMES: Record<GlsType, string> = { HOME: "En entreprise", RELAY: "En Relais GLS", FLEX: "À domicile", EXPRESS: "Express" };

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char);

/** Opens a printable delivery note: who it goes to, and what is in the parcel. */
function printDeliveryNote(order: OrderDetail, form: Form) {
  const products = Array.isArray(order.products) ? (order.products as Array<{ title?: string; quantity?: number }>) : [];
  const rows = products.map((product) => `<tr><td>${escapeHtml(product.title ?? "Article")}</td><td class="n">${Math.max(0, Number(product.quantity) || 0)}</td></tr>`).join("");
  const win = window.open("", "_blank");
  if (!win) {
    toast.error("Autorisez les fenêtres pop-up pour imprimer le bon de livraison.");
    return;
  }
  win.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Bon de livraison</title><style>
    body{font:14px/1.5 system-ui,sans-serif;color:#14213d;margin:32px}h1{font-size:22px;margin:0 0 4px}p{margin:2px 0}
    table{width:100%;border-collapse:collapse;margin-top:24px}th,td{border-bottom:1px solid #c6cfda;padding:8px 6px;text-align:left}th.n,td.n{text-align:right;width:90px}
    .meta{margin-top:16px;display:grid;gap:2px}</style></head><body>
    <h1>Bon de livraison</h1><p>Commande ${escapeHtml(order.reference ?? `…${order.id.slice(-8)}`)} · ${escapeHtml(new Date(order.createdAt).toLocaleDateString("fr-FR"))}</p>
    <div class="meta"><strong>${escapeHtml(form.name)}</strong><span>${escapeHtml(form.street)}</span><span>${escapeHtml(`${form.zip} ${form.city}`.trim())}</span><span>${escapeHtml(form.countryCode)}</span></div>
    <table><thead><tr><th>Article</th><th class="n">Quantité</th></tr></thead><tbody>${rows || '<tr><td colspan="2">Aucun article</td></tr>'}</tbody></table>
    <script>window.onload=function(){window.print()}<\/script></body></html>`);
  win.document.close();
}

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
export function prefill(order: OrderDetail): Form {
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
      mobile: "",
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
    mobile: "",
  };
}

export async function glsFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${GLS_API}${path}`, { cache: "no-store", ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(Array.isArray(data.message) ? data.message.join(" ") : data.message || "Action impossible.");
  return data as T;
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export const inputClass = "h-9 w-full rounded border border-[#cbd6de] bg-white px-3 text-sm text-[#344054] focus-visible:outline-2 focus-visible:outline-[#168ca8]";

/** The GLS card of an order: label status and tracking. Printing a label happens on its own page. */
export function GlsShippingCard({ order }: { order: OrderDetail }) {
  const [newStatus, setNewStatus] = useState("Expédié");
  const { options: statusOptions } = useOrderStates();
  const [config, setConfig] = useState<GlsConfig | null>(null);
  const [shipments, setShipments] = useState<Shipment[] | null>(null);
  const [form] = useState<Form>(() => prefill(order));
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [busy, setBusy] = useState("");
  const [events, setEvents] = useState<Record<string, TrackingEvent[]>>({});
  const [loadError, setLoadError] = useState("");
  const [moduleSettings, setModuleSettings] = useState<ModuleSettings | null>(null);

  useEffect(() => {
    let cancelled = false;
    glsFetch<ModuleSettings>("/settings")
      .then((loaded) => {
        if (!cancelled) setModuleSettings(loaded);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchAll = useCallback(
    () => Promise.all([glsFetch<GlsConfig>(""), glsFetch<Shipment[]>(`/orders/${order.id}/shipments`)]),
    [order.id],
  );

  /** Reloads after an action (cancel, return label, tracking). */
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

  // What the customer chose at checkout (delivery type, relay point).
  useEffect(() => {
    let cancelled = false;
    glsFetch<Delivery | null>(`/orders/${order.id}/delivery`)
      .then((chosen) => {
        if (!cancelled && chosen) setDelivery(chosen);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [order.id]);

  const active = shipments?.find((shipment) => !shipment.cancelledAt && shipment.glsType !== "RETURN") ?? null;
  const returnActive = shipments?.some((shipment) => !shipment.cancelledAt && shipment.glsType === "RETURN") ?? false;
  const formValid = form.name.trim() && form.street.trim() && form.zip.trim() && form.city.trim() && /^[A-Za-z]{2}$/.test(form.countryCode);

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

  /** A return label: the parcel goes from the customer back to the shop's return address. */
  const createReturn = () =>
    run(
      "return",
      () =>
        glsFetch(`/orders/${order.id}/shipments`, {
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
            weights: [1],
            glsType: "HOME",
            returnLabel: true,
          }),
        }),
      "Étiquette retour créée.",
    );

  async function refresh(shipment: Shipment) {
    const result = await run("track-" + shipment.id, () => glsFetch<{ events: TrackingEvent[] }>(`/shipments/${shipment.id}/tracking`, { method: "POST" }), "Suivi actualisé.");
    if (result) setEvents((old) => ({ ...old, [shipment.id]: result.events }));
  }

  async function cancel(shipment: Shipment) {
    if (!window.confirm("Annuler cette expédition GLS ? Le colis ne sera plus pris en charge.")) return;
    await run("cancel-" + shipment.id, () => glsFetch(`/shipments/${shipment.id}/cancel`, { method: "POST" }), "Expédition GLS annulée.");
  }

  const statusBadge = (shipment: Shipment) =>
    shipment.cancelledAt ? <Badge>Annulée</Badge> : shipment.deliveredAt ? <Badge tone="success">Livrée</Badge> : <Badge tone="info">Étiquette créée</Badge>;

  return (
    <Card padding="0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#dce4ea] px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6b7c8c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 3h15v13H1z" /><path d="M16 8h4l3 3v5h-7z" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" /></svg>
          <Text as="h2" variant="headingMd">Transporteur GLS</Text>
          {config?.configured ? <Badge tone={config.mode === "live" ? "success" : "attention"}>{config.mode === "live" ? "Production" : "Mode test"}</Badge> : null}
        </div>
        <Link href="/admin_ben/modules/gls" className="text-xs text-[#22a8c8] hover:underline">Réglages GLS</Link>
      </div>

      <div className="space-y-4 p-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/gls/gls-logo.jpg" alt="GLS" width={220} height={110} className="mx-auto h-auto w-[220px]" />
        <p className="rounded border-l-4 border-[#25b9d7] bg-[#e8f7fb] px-4 py-3 text-sm text-[#344054]">
          Vous pouvez imprimer une étiquette GLS même si aucun transporteur GLS n’est associé à cette commande. Des informations complémentaires seront demandées avant la création de l’étiquette.
        </p>
        {delivery?.glsType ? (
          <p className="text-xs text-[#667085]">
            Livraison choisie par le client : <strong>{GLS_TYPE_NAMES[delivery.glsType]}</strong>
            {delivery.relay ? <> — {delivery.relay.name}, {delivery.relay.zip} {delivery.relay.city}</> : null}
          </p>
        ) : null}
        {loadError ? <p role="alert" className="text-sm text-[#b42318]">{loadError}</p> : null}
        {!loadError && (!config || !shipments) ? <p className="text-sm text-[#667085]">Chargement…</p> : null}

        {config && !config.configured ? (
          <p className="text-sm text-[#667085]">
            GLS n’est pas encore configuré pour l’environnement actif. <Link href="/admin_ben/modules/gls" className="text-[#22a8c8] hover:underline">Renseigner les identifiants GLS</Link>.
          </p>
        ) : null}

        {config?.configured && shipments && !active ? (
          <div className="flex flex-wrap items-center gap-3">
            <label htmlFor="gls-new-status" className="text-sm text-[#344054]">Changer l’état de la commande en</label>
            <select id="gls-new-status" className={`${inputClass} !w-64`} value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
              <option value="">Ne pas changer l’état</option>
              {statusOptions.map((option) => <option key={option.value} value={option.value} style={{ backgroundColor: option.backgroundColor, color: option.textColor }}>{option.label}</option>)}
            </select>
            <Button variant="primary" url={`/admin_ben/orders/${order.id}/gls-label?status=${encodeURIComponent(newStatus)}`}>Imprimer l’étiquette</Button>
          </div>
        ) : null}

        {shipments?.map((shipment) => (
          <div key={shipment.id} className={`rounded border border-[#dce4ea] p-3 ${shipment.cancelledAt ? "bg-[#f7f7f7] opacity-80" : "bg-white"}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                {statusBadge(shipment)}
                {shipment.environment === "sandbox" ? <Badge tone="attention">Test</Badge> : null}
                <span className="text-xs text-[#667085]">{({ HOME: "Chez vous", RELAY: "Relais", FLEX: "Chez vous +", EXPRESS: "Avant 13h", RETURN: "Étiquette retour" } as Record<string, string>)[shipment.glsType ?? ""] ?? (shipment.product === "EXPRESS" ? "Express" : "Colis")} · {shipment.parcelCount} colis · {shipment.weightKg} kg · {formatDate(shipment.createdAt)}</span>
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
                      <a href={`${GLS_API}/shipments/${shipment.id}/label?index=${index}`} target="_blank" rel="noopener noreferrer" className="font-medium text-[#22a8c8] hover:underline">Étiquette PDF</a>
                      <a href={`https://gls-group.eu/FR/fr/suivi-colis?match=${shipment.trackIds.map(encodeURIComponent).join(",")}`} target="_blank" rel="noopener noreferrer" className="text-[#22a8c8] hover:underline">Suivi sur gls-group.eu</a>
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

        {config?.configured && shipments && moduleSettings?.returnService.enabled && !returnActive ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded border border-[#dce4ea] bg-[#f7fafc] px-3 py-2">
            <p className="text-xs text-[#344054]">
              <strong>Étiquette retour</strong> : le colis repart de {form.name || "le client"}{form.zip ? `, ${form.zip} ${form.city}` : ""} vers l’adresse de retour de la boutique (Réglages GLS).
            </p>
            <Button size="slim" onClick={() => void createReturn()} loading={busy === "return"} disabled={!formValid || Boolean(busy)}>Créer l’étiquette retour</Button>
          </div>
        ) : null}

        {moduleSettings?.deliveryNote ? (
          <div>
            <Button size="slim" onClick={() => printDeliveryNote(order, form)}>Imprimer le bon de livraison</Button>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
