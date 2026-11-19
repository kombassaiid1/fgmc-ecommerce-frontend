"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Banner, BlockStack, Box, Button, InlineStack, Select, SkeletonBodyText, Text } from "@shopify/polaris";
import { toast } from "sonner";
import { CarrierCard, ChosenDelivery, ShipmentBlock } from "./carrier-card";
import { getDeliverySlipUrl, type OrderDetail } from "@/lib/api/orders";
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
export function GlsShippingCard({ order, disabledReason }: { order: OrderDetail; disabledReason?: string }) {
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

  const statusChoices = [{ label: "Ne pas changer l’état", value: "" }, ...statusOptions.map((option) => ({ label: option.label, value: option.value }))];
  const typeNames: Record<string, string> = { HOME: "Chez vous", RELAY: "Relais", FLEX: "Chez vous +", EXPRESS: "Avant 13h", RETURN: "Étiquette retour" };

  return (
    <CarrierCard
      title="Transporteur GLS"
      logo={{ src: "/gls/gls-logo.jpg", alt: "GLS", width: 56 }}
      status={config?.configured ? <Badge tone={config.mode === "live" ? "success" : "attention"}>{config.mode === "live" ? "Production" : "Mode test"}</Badge> : null}
      settingsHref="/admin_ben/modules/gls"
      settingsLabel="Réglages GLS"
      disabledReason={disabledReason}>
      {delivery?.glsType ? <ChosenDelivery label={GLS_TYPE_NAMES[delivery.glsType]} detail={delivery.relay ? `${delivery.relay.name}, ${delivery.relay.zip} ${delivery.relay.city}` : undefined} /> : null}

      {loadError ? <Banner tone="critical">{loadError}</Banner> : null}
      {!loadError && (!config || !shipments) ? <SkeletonBodyText lines={3} /> : null}
      {config && !config.configured ? (
        <Banner tone="warning" title="GLS n’est pas encore configuré" action={{ content: "Renseigner les identifiants GLS", url: "/admin_ben/modules/gls" }}>
          <Text as="p" variant="bodyMd">Aucune étiquette ne peut être créée tant que l’environnement actif n’a pas ses identifiants.</Text>
        </Banner>
      ) : null}

      {config?.configured && shipments && !active ? (
        <Box padding="300" background="bg-surface-secondary" borderRadius="300">
          <BlockStack gap="200">
            <InlineStack gap="300" blockAlign="end" wrap>
              <div style={{ flex: "1 1 220px", minWidth: 200 }}>
                <Select label="Après l’impression, passer la commande à" value={newStatus} onChange={setNewStatus} options={statusChoices} />
              </div>
              <Button variant="primary" url={`/admin_ben/orders/${order.id}/gls-label?status=${encodeURIComponent(newStatus)}`}>Imprimer l’étiquette</Button>
            </InlineStack>
            <Text as="p" variant="bodySm" tone="subdued">Une étiquette GLS peut être créée même sans transporteur GLS associé : les informations manquantes sont demandées avant la création.</Text>
          </BlockStack>
        </Box>
      ) : null}

      {shipments?.map((shipment) => (
        <ShipmentBlock
          key={shipment.id}
          cancelled={Boolean(shipment.cancelledAt)}
          badges={<>{statusBadge(shipment)}{shipment.environment === "sandbox" ? <Badge tone="attention">Test</Badge> : null}</>}
          meta={`${typeNames[shipment.glsType ?? ""] ?? (shipment.product === "EXPRESS" ? "Express" : "Colis")} · ${shipment.parcelCount} colis · ${shipment.weightKg} kg · ${formatDate(shipment.createdAt)}`}
          numbers={shipment.trackIds.map((trackId, index) => ({
            id: trackId,
            labelHref: `${GLS_API}/shipments/${shipment.id}/label?index=${index}`,
            trackHref: `https://gls-group.eu/FR/fr/suivi-colis?match=${shipment.trackIds.map(encodeURIComponent).join(",")}`,
            trackText: "Suivi GLS",
          }))}
          lastStatus={shipment.lastStatus}
          lastEvent={shipment.lastStatus ? formatDate(shipment.lastEventAt) : undefined}
          events={events[shipment.id] ? [...events[shipment.id]].reverse() : undefined}
          onTrack={() => void refresh(shipment)}
          trackBusy={busy === "track-" + shipment.id}
          onCancel={() => void cancel(shipment)}
          cancelBusy={busy === "cancel-" + shipment.id}
        />
      ))}

      {config?.configured && shipments && moduleSettings?.returnService.enabled && !returnActive ? (
        <Box padding="300" borderWidth="025" borderColor="border" borderRadius="300" borderStyle="dashed">
          <InlineStack align="space-between" blockAlign="center" gap="300">
            <div style={{ flex: "1 1 240px" }}>
              <Text as="p" variant="bodyMd" fontWeight="semibold">Étiquette retour</Text>
              <Text as="p" variant="bodySm" tone="subdued">Le colis repart de {form.name || "le client"}{form.zip ? `, ${form.zip} ${form.city}` : ""} vers l’adresse de retour de la boutique.</Text>
            </div>
            <Button onClick={() => void createReturn()} loading={busy === "return"} disabled={!formValid || Boolean(busy)}>Créer l’étiquette retour</Button>
          </InlineStack>
        </Box>
      ) : null}

      {moduleSettings?.deliveryNote ? (
        <InlineStack><Button url={getDeliverySlipUrl(order.id)} external>Ouvrir le bon de livraison</Button></InlineStack>
      ) : null}
    </CarrierCard>
  );
}
