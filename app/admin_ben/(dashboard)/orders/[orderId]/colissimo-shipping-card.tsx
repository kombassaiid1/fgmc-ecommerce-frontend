"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Banner, BlockStack, Box, Button, InlineStack, Select, SkeletonBodyText, Text } from "@shopify/polaris";
import { toast } from "sonner";
import { CarrierCard, ChosenDelivery, ShipmentBlock } from "./carrier-card";
import type { OrderDetail } from "@/lib/api/orders";
import { useOrderStates } from "@/lib/use-order-states";
import { prefill } from "./gls-shipping-card";

export type ColissimoType = "HOME" | "HOME_SIGN" | "RELAY";
type Shipment = {
  id: string;
  productCode: string;
  /** RETURN marks a return label (customer to shop). */
  colissimoType: ColissimoType | "RETURN" | null;
  trackIds: string[];
  hasCustomsDocument: boolean;
  weightKg: number;
  lastStatus: string | null;
  lastEventAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
};
type TrackingEvent = { date: string; time: string; description: string; place: string };
type Config = { configured: boolean };
export type ColissimoDeliveryChoice = { colissimoType: ColissimoType; pickupPointId: string | null; relay: { name: string; street: string; zip: string; city: string } | null; customerMobile: string | null };
type ModuleSettings = { returnLabel: boolean };

export const COLISSIMO_API = "/frontend-api/admin/colissimo-integration";
export const COLISSIMO_TYPE_NAMES: Record<ColissimoType, string> = { HOME: "Domicile sans signature", HOME_SIGN: "Domicile avec signature", RELAY: "Point de retrait" };

export async function colissimoFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${COLISSIMO_API}${path}`, { cache: "no-store", ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(Array.isArray(data.message) ? data.message.join(" ") : data.message || "Action impossible.");
  return data as T;
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

/** The Colissimo card of an order: label status and tracking. Printing a label happens on its own page. */
export function ColissimoShippingCard({ order, disabledReason }: { order: OrderDetail; disabledReason?: string }) {
  const [newStatus, setNewStatus] = useState("Expédié");
  const { options: statusOptions } = useOrderStates();
  const [config, setConfig] = useState<Config | null>(null);
  const [shipments, setShipments] = useState<Shipment[] | null>(null);
  const [form] = useState(() => prefill(order));
  const [delivery, setDelivery] = useState<ColissimoDeliveryChoice | null>(null);
  const [busy, setBusy] = useState("");
  const [events, setEvents] = useState<Record<string, TrackingEvent[]>>({});
  const [loadError, setLoadError] = useState("");
  const [moduleSettings, setModuleSettings] = useState<ModuleSettings | null>(null);

  const fetchAll = useCallback(() => Promise.all([colissimoFetch<Config>(""), colissimoFetch<Shipment[]>(`/orders/${order.id}/shipments`)]), [order.id]);

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
    colissimoFetch<ModuleSettings>("/settings").then((loaded) => !cancelled && setModuleSettings(loaded)).catch(() => undefined);
    colissimoFetch<ColissimoDeliveryChoice | null>(`/orders/${order.id}/delivery`).then((chosen) => !cancelled && chosen && setDelivery(chosen)).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [fetchAll, order.id]);

  const active = shipments?.find((shipment) => !shipment.cancelledAt && shipment.colissimoType !== "RETURN") ?? null;
  const returnActive = shipments?.some((shipment) => !shipment.cancelledAt && shipment.colissimoType === "RETURN") ?? false;
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

  const createReturn = () =>
    run(
      "return",
      () =>
        colissimoFetch(`/orders/${order.id}/shipments`, {
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
            weightKg: 1,
            colissimoType: "HOME",
            returnLabel: true,
          }),
        }),
      "Étiquette retour créée.",
    );

  async function refresh(shipment: Shipment) {
    const result = await run("track-" + shipment.id, () => colissimoFetch<{ events: TrackingEvent[] }>(`/shipments/${shipment.id}/tracking`, { method: "POST" }), "Suivi actualisé.");
    if (result) setEvents((old) => ({ ...old, [shipment.id]: result.events }));
  }

  async function cancel(shipment: Shipment) {
    if (!window.confirm("Marquer cette étiquette Colissimo comme annulée ? Colissimo ne permet pas de l’annuler à distance : ne remettez pas ce colis à La Poste.")) return;
    await run("cancel-" + shipment.id, () => colissimoFetch(`/shipments/${shipment.id}/cancel`, { method: "POST" }), "Étiquette marquée annulée.");
  }

  const statusBadge = (shipment: Shipment) =>
    shipment.cancelledAt ? <Badge>Annulée</Badge> : shipment.deliveredAt ? <Badge tone="success">Livrée</Badge> : <Badge tone="info">Étiquette créée</Badge>;

  const statusChoices = [{ label: "Ne pas changer l’état", value: "" }, ...statusOptions.map((option) => ({ label: option.label, value: option.value }))];

  return (
    <CarrierCard
      title="Expédition Colissimo"
      logo={{ src: "/colissimo/Colissimo_Logo_H.png", alt: "Colissimo", width: 100 }}
      status={config?.configured ? <Badge tone="success">Compte connecté</Badge> : config ? <Badge tone="attention">À configurer</Badge> : null}
      settingsHref="/admin_ben/modules/colissimo"
      settingsLabel="Réglages Colissimo"
      disabledReason={disabledReason}>
      {delivery?.colissimoType ? <ChosenDelivery label={COLISSIMO_TYPE_NAMES[delivery.colissimoType]} detail={delivery.relay ? `${delivery.relay.name}, ${delivery.relay.zip} ${delivery.relay.city}` : undefined} /> : null}

      {loadError ? <Banner tone="critical">{loadError}</Banner> : null}
      {!loadError && (!config || !shipments) ? <SkeletonBodyText lines={3} /> : null}
      {config && !config.configured ? (
        <Banner tone="warning" title="Colissimo n’est pas encore configuré" action={{ content: "Renseigner les identifiants Colissimo", url: "/admin_ben/modules/colissimo" }}>
          <Text as="p" variant="bodyMd">Aucune étiquette ne peut être créée tant que le compte n’est pas connecté.</Text>
        </Banner>
      ) : null}

      {config?.configured && shipments && !active ? (
        <Box padding="300" background="bg-surface-secondary" borderRadius="300">
          <BlockStack gap="200">
            <InlineStack gap="300" blockAlign="end" wrap>
              <div style={{ flex: "1 1 220px", minWidth: 200 }}>
                <Select label="Après l’impression, passer la commande à" value={newStatus} onChange={setNewStatus} options={statusChoices} />
              </div>
              <Button variant="primary" url={`/admin_ben/orders/${order.id}/colissimo-label?status=${encodeURIComponent(newStatus)}`}>Imprimer l’étiquette</Button>
            </InlineStack>
            <Text as="p" variant="bodySm" tone="subdued">Une étiquette Colissimo peut être créée même sans transporteur Colissimo associé : les informations manquantes sont demandées avant la création. Colissimo facture les colis scannés.</Text>
          </BlockStack>
        </Box>
      ) : null}

      {shipments?.map((shipment) => (
        <ShipmentBlock
          key={shipment.id}
          cancelled={Boolean(shipment.cancelledAt)}
          badges={<>{statusBadge(shipment)}<Badge>{shipment.productCode}</Badge></>}
          meta={`${shipment.colissimoType === "RETURN" ? "Étiquette retour" : COLISSIMO_TYPE_NAMES[shipment.colissimoType as ColissimoType] ?? "Colis"} · ${shipment.weightKg} kg · ${formatDate(shipment.createdAt)}`}
          numbers={shipment.trackIds.map((trackId) => ({
            id: trackId,
            labelHref: `${COLISSIMO_API}/shipments/${shipment.id}/label`,
            trackHref: `https://www.laposte.fr/outils/suivre-vos-envois?code=${encodeURIComponent(trackId)}`,
            trackText: "Suivi La Poste",
            extra: shipment.hasCustomsDocument ? <a href={`${COLISSIMO_API}/shipments/${shipment.id}/customs`} target="_blank" rel="noopener noreferrer" className="text-sm text-[#005bd3] hover:underline">CN23</a> : undefined,
          }))}
          lastStatus={shipment.lastStatus}
          lastEvent={shipment.lastStatus ? formatDate(shipment.lastEventAt) : undefined}
          events={events[shipment.id]}
          onTrack={() => void refresh(shipment)}
          trackBusy={busy === "track-" + shipment.id}
          onCancel={() => void cancel(shipment)}
          cancelBusy={busy === "cancel-" + shipment.id}
          cancelLabel="Marquer annulée"
        />
      ))}

      {config?.configured && shipments && moduleSettings?.returnLabel && !returnActive ? (
        <Box padding="300" borderWidth="025" borderColor="border" borderRadius="300" borderStyle="dashed">
          <InlineStack align="space-between" blockAlign="center" gap="300">
            <div style={{ flex: "1 1 240px" }}>
              <Text as="p" variant="bodyMd" fontWeight="semibold">Étiquette retour</Text>
              <Text as="p" variant="bodySm" tone="subdued">Le colis repart de {form.name || "le client"}{form.zip ? `, ${form.zip} ${form.city}` : ""} vers l’adresse de l’expéditeur.</Text>
            </div>
            <Button onClick={() => void createReturn()} loading={busy === "return"} disabled={!formValid || Boolean(busy)}>Créer l’étiquette retour</Button>
          </InlineStack>
        </Box>
      ) : null}
    </CarrierCard>
  );
}
