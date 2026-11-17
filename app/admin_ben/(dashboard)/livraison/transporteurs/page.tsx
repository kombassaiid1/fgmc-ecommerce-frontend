"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Badge,
  Banner,
  BlockStack,
  Box,
  Button,
  ButtonGroup,
  Card,
  IndexTable,
  InlineStack,
  Modal,
  SkeletonBodyText,
  Text,
  Thumbnail,
} from "@shopify/polaris";
import { ChevronDownIcon, ChevronUpIcon, DeliveryIcon } from "@shopify/polaris-icons";
import { toast } from "sonner";
import { shippingAdmin, type Carrier, type Zone } from "@/lib/api/shipping-admin";
import { getImageUrl } from "@/lib/api";
import { formatMoney } from "../ui";

function priceSummary(carrier: Carrier) {
  if (carrier.freeShipping) return "Gratuit";
  const prices = carrier.ranges.flatMap((range) => range.rates.map((rate) => rate.price));
  if (prices.length === 0) return "Aucun tarif";
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return min === max ? formatMoney(min) : `${formatMoney(min)} à ${formatMoney(max)}`;
}

function servedZones(carrier: Carrier, zones: Zone[]) {
  const ids = new Set(carrier.ranges.flatMap((range) => range.rates.map((rate) => rate.zoneId)));
  return zones.filter((zone) => ids.has(zone.id)).map((zone) => zone.name);
}

export default function CarriersPage() {
  const [carriers, setCarriers] = useState<Carrier[] | null>(null);
  const [zones, setZones] = useState<Zone[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [toDelete, setToDelete] = useState<Carrier | null>(null);

  const reload = useCallback(async () => {
    try {
      const [list, zoneList] = await Promise.all([shippingAdmin.carriers(), shippingAdmin.zones()]);
      setCarriers(list);
      setZones(zoneList);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chargement impossible.");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([shippingAdmin.carriers(), shippingAdmin.zones()])
      .then(([list, zoneList]) => {
        if (cancelled) return;
        setCarriers(list);
        setZones(zoneList);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Chargement impossible.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function act(key: string, action: () => Promise<unknown>, success: string) {
    setBusy(key);
    try {
      await action();
      toast.success(success);
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action impossible.");
    } finally {
      setBusy("");
    }
  }

  const move = (index: number, direction: -1 | 1) => {
    if (!carriers) return;
    const target = index + direction;
    if (target < 0 || target >= carriers.length) return;
    const ids = carriers.map((carrier) => carrier.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    void act("move", () => shippingAdmin.reorderCarriers(ids), "Ordre mis à jour.");
  };

  if (error) return <Banner tone="critical" title="Impossible de charger les transporteurs">{error}</Banner>;
  if (!carriers) return <Card><SkeletonBodyText lines={6} /></Card>;

  return (
    <BlockStack gap="400">
      <InlineStack align="space-between" blockAlign="start" gap="400" wrap={false}>
        <Box maxWidth="640px">
          <Text as="p" variant="bodyMd" tone="subdued">
            Un transporteur par service, par exemple « Colissimo domicile » et « Colissimo express ». L’ordre de la liste est celui présenté au client quand le tri par position est choisi.
          </Text>
        </Box>
        <Button variant="primary" url="/admin_ben/livraison/transporteurs/nouveau">Ajouter un transporteur</Button>
      </InlineStack>

      {zones.length === 0 ? (
        <Banner tone="warning" title="Créez d’abord vos zones" action={{ content: "Gérer les zones", url: "/admin_ben/international/zones" }}>
          <p>Les tarifs dépendent de la zone du client : sans zone, aucun prix ne peut être défini.</p>
        </Banner>
      ) : null}

      {carriers.length === 0 ? (
        <Card>
          <BlockStack gap="200" inlineAlign="center">
            <Box paddingBlock="400">
              <BlockStack gap="200" inlineAlign="center">
                <Text as="h2" variant="headingMd">Aucun transporteur</Text>
                <Box maxWidth="520px">
                  <Text as="p" variant="bodyMd" tone="subdued" alignment="center">
                    Tant qu’aucun transporteur n’est actif, la boutique garde l’ancien tarif fixe : 8 € en livraison standard, retrait gratuit. Dès que vous en activez un, le client voit vos transporteurs et vos tarifs.
                  </Text>
                </Box>
                <Button variant="primary" url="/admin_ben/livraison/transporteurs/nouveau">Ajouter un transporteur</Button>
              </BlockStack>
            </Box>
          </BlockStack>
        </Card>
      ) : (
        <Card padding="0">
          <IndexTable
            resourceName={{ singular: "transporteur", plural: "transporteurs" }}
            itemCount={carriers.length}
            selectable={false}
            headings={[
              { title: "Ordre" },
              { title: "Transporteur" },
              { title: "Facturation" },
              { title: "Zones desservies" },
              { title: "Tarifs" },
              { title: "Statut" },
              { title: "Actions", alignment: "end" },
            ]}>
            {carriers.map((carrier, index) => {
              const served = servedZones(carrier, zones);
              return (
                <IndexTable.Row id={carrier.id} key={carrier.id} position={index}>
                  <IndexTable.Cell>
                    <ButtonGroup variant="segmented">
                      <Button icon={ChevronUpIcon} accessibilityLabel={`Monter ${carrier.name}`} disabled={index === 0 || Boolean(busy)} onClick={() => move(index, -1)} />
                      <Button icon={ChevronDownIcon} accessibilityLabel={`Descendre ${carrier.name}`} disabled={index === carriers.length - 1 || Boolean(busy)} onClick={() => move(index, 1)} />
                    </ButtonGroup>
                  </IndexTable.Cell>
                  <IndexTable.Cell>
                    <InlineStack gap="300" blockAlign="center" wrap={false}>
                      <Thumbnail source={carrier.logoUrl ? getImageUrl(carrier.logoUrl) : DeliveryIcon} alt="" size="small" />
                      <BlockStack gap="050">
                        <Text as="span" variant="bodyMd" fontWeight="semibold">{carrier.name}</Text>
                        <Text as="span" variant="bodySm" tone="subdued">
                          {carrier.transitTime || "Délai non renseigné"} · rapidité {carrier.speedGrade}/9{carrier.isPickup ? " · retrait" : ""}
                        </Text>
                      </BlockStack>
                    </InlineStack>
                  </IndexTable.Cell>
                  <IndexTable.Cell>
                    {carrier.freeShipping ? <Badge tone="success">Gratuit</Badge> : <Badge>{carrier.billing === "WEIGHT" ? "Au poids" : "Au montant"}</Badge>}
                  </IndexTable.Cell>
                  <IndexTable.Cell>
                    {served.length ? (
                      <InlineStack gap="100">{served.map((name) => <Badge key={name} tone="info">{name}</Badge>)}</InlineStack>
                    ) : (
                      <Badge tone="warning">Aucune zone</Badge>
                    )}
                  </IndexTable.Cell>
                  <IndexTable.Cell>
                    <Text as="span" variant="bodyMd" numeric>{priceSummary(carrier)}</Text>
                  </IndexTable.Cell>
                  <IndexTable.Cell>
                    <InlineStack gap="200" blockAlign="center" wrap={false}>
                      <Badge tone={carrier.active ? "success" : undefined}>{carrier.active ? "Actif" : "Désactivé"}</Badge>
                      <Button
                        variant="plain"
                        disabled={Boolean(busy)}
                        onClick={() => void act("active-" + carrier.id, () => shippingAdmin.setCarrierActive(carrier.id, !carrier.active), carrier.active ? "Transporteur désactivé." : "Transporteur activé.")}>
                        {carrier.active ? "Désactiver" : "Activer"}
                      </Button>
                    </InlineStack>
                  </IndexTable.Cell>
                  <IndexTable.Cell>
                    <InlineStack gap="200" align="end" wrap={false}>
                      <Button size="slim" url={`/admin_ben/livraison/transporteurs/${carrier.id}`}>Modifier</Button>
                      <Button size="slim" tone="critical" variant="tertiary" disabled={Boolean(busy)} onClick={() => setToDelete(carrier)}>Supprimer</Button>
                    </InlineStack>
                  </IndexTable.Cell>
                </IndexTable.Row>
              );
            })}
          </IndexTable>
        </Card>
      )}

      <Modal
        open={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        title={`Supprimer « ${toDelete?.name ?? ""} » ?`}
        primaryAction={{
          content: "Supprimer le transporteur",
          destructive: true,
          loading: busy.startsWith("del-"),
          onAction: () => {
            const target = toDelete;
            if (!target) return;
            void act("del-" + target.id, () => shippingAdmin.deleteCarrier(target.id), "Transporteur supprimé.").then(() => setToDelete(null));
          },
        }}
        secondaryActions={[{ content: "Annuler", onAction: () => setToDelete(null) }]}>
        <Modal.Section>
          <Text as="p" variant="bodyMd">Le transporteur et tous ses tarifs seront supprimés. Les commandes déjà passées gardent le nom du transporteur choisi.</Text>
        </Modal.Section>
      </Modal>
    </BlockStack>
  );
}
