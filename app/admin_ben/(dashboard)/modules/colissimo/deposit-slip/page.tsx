"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge, BlockStack, Button, Card, EmptyState, IndexTable, InlineStack, SkeletonBodyText, Text, useIndexResourceState } from "@shopify/polaris";
import { Alert, useColissimo } from "../cm-kit";
import { ColissimoPage } from "../cm-page";
import { colissimoCall, type ColissimoShipment } from "../colissimo-api";

const date = (value: string) => new Intl.DateTimeFormat("fr-FR", { dateStyle: "short" }).format(new Date(value));

function Table({ shipments }: { shipments: ColissimoShipment[] }) {
  const { toast } = useColissimo();
  const [busy, setBusy] = useState(false);
  const { selectedResources, allResourcesSelected, handleSelectionChange } = useIndexResourceState(shipments, { selectedResources: shipments.filter((row) => !row.deliveredAt).map((row) => row.id) });

  async function generate() {
    setBusy(true);
    try {
      const trackIds = shipments.filter((row) => selectedResources.includes(row.id)).map((row) => row.trackIds[0]);
      const response = await fetch("/frontend-api/admin/colissimo-integration/deposit-slip", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ trackIds }) });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(Array.isArray(data.message) ? data.message.join(" ") : data.message || "Génération impossible.");
      }
      const url = URL.createObjectURL(await response.blob());
      window.open(url, "_blank", "noopener");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      toast("Bordereau de dépôt généré");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Génération impossible.", true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <BlockStack gap="400">
      <InlineStack gap="200" blockAlign="center">
        <Button variant="primary" onClick={() => void generate()} loading={busy} disabled={selectedResources.length === 0}>
          {selectedResources.length ? `Générer le bordereau (${selectedResources.length} colis)` : "Générer le bordereau"}
        </Button>
        <Text as="span" variant="bodySm" tone="subdued">Cochez les colis que vous remettez à La Poste.</Text>
      </InlineStack>
      <Card padding="0">
        <IndexTable
          resourceName={{ singular: "colis", plural: "colis" }}
          itemCount={shipments.length}
          selectedItemsCount={allResourcesSelected ? "All" : selectedResources.length}
          onSelectionChange={handleSelectionChange}
          headings={[{ title: "Numéro de suivi" }, { title: "Commande" }, { title: "Créé le" }, { title: "Poids", alignment: "end" }, { title: "Statut" }]}>
          {shipments.map((shipment, index) => (
            <IndexTable.Row id={shipment.id} key={shipment.id} position={index} selected={selectedResources.includes(shipment.id)}>
              <IndexTable.Cell><span className="cm-mono">{shipment.trackIds[0]}</span></IndexTable.Cell>
              <IndexTable.Cell><Link href={`/admin_ben/orders/${shipment.orderId}`} onClick={(event) => event.stopPropagation()}>{shipment.orderReference ?? `…${shipment.orderId.slice(-8)}`}</Link></IndexTable.Cell>
              <IndexTable.Cell><span className="cm-num">{date(shipment.createdAt)}</span></IndexTable.Cell>
              <IndexTable.Cell><span className="cm-num">{shipment.weightKg} kg</span></IndexTable.Cell>
              <IndexTable.Cell>{shipment.deliveredAt ? <Badge tone="success">Livré</Badge> : <Badge>En cours</Badge>}</IndexTable.Cell>
            </IndexTable.Row>
          ))}
        </IndexTable>
      </Card>
    </BlockStack>
  );
}

function DepositSlip() {
  const [shipments, setShipments] = useState<ColissimoShipment[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    colissimoCall<ColissimoShipment[]>("/shipments/open")
      .then((rows) => !cancelled && setShipments(rows))
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : "Chargement impossible."));
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <Alert tone="danger">{error}</Alert>;
  if (!shipments) return <Card><SkeletonBodyText lines={6} /></Card>;
  return (
    <BlockStack gap="400">
      <Alert>Le bordereau de dépôt (PDF) liste les colis remis à La Poste, avec un code-barres à faire scanner. Colis des 60 derniers jours, hors annulés et retours.</Alert>
      {shipments.length === 0 ? (
        <Card><EmptyState heading="Aucune étiquette récente" image=""><p>Créez une étiquette depuis une commande pour l’ajouter à un bordereau.</p></EmptyState></Card>
      ) : (
        <Table shipments={shipments} />
      )}
    </BlockStack>
  );
}

export default function DepositSlipPage() {
  return <ColissimoPage current="deposit-slip" title="Bordereau de dépôt"><DepositSlip /></ColissimoPage>;
}
