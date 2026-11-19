"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge, BlockStack, Button, Card, IndexTable, InlineStack, Text } from "@shopify/polaris";
import { DeleteIcon } from "@shopify/polaris-icons";
import { Alert, useColissimo } from "../cm-kit";
import { ColissimoPage } from "../cm-page";
import { BASE } from "../cm-shell";
import { LABEL_URL, colissimoCall, type LabelResult } from "../colissimo-api";
import { OrderTable, useOrderList } from "../order-list";

function Orders() {
  const { toast } = useColissimo();
  const list = useOrderList("/orders");
  const [busy, setBusy] = useState("");
  const [results, setResults] = useState<LabelResult[] | null>(null);

  async function create() {
    setBusy("create");
    setResults(null);
    try {
      const done = await colissimoCall<LabelResult[]>("/labels", { method: "POST", body: JSON.stringify({ orders: list.selected.map((orderId) => ({ orderId })) }) });
      setResults(done);
      list.setSelected([]);
      list.reload();
      const ok = done.filter((item) => item.ok).length;
      toast(`${ok} étiquette${ok > 1 ? "s" : ""} créée${ok > 1 ? "s" : ""}${done.some((item) => !item.ok) ? `, ${done.filter((item) => !item.ok).length} en erreur` : ""}`, done.every((item) => !item.ok));
    } catch (e) {
      toast(e instanceof Error ? e.message : "Création impossible.", true);
    } finally {
      setBusy("");
    }
  }

  async function remove() {
    if (!window.confirm(`Supprimer les étiquettes de ${list.selected.length} commande(s) ? Cette action est définitive.`)) return;
    setBusy("delete");
    try {
      const result = await colissimoCall<{ deleted: number }>("/labels/delete", { method: "POST", body: JSON.stringify({ orderIds: list.selected }) });
      toast(`${result.deleted} étiquette${result.deleted > 1 ? "s" : ""} supprimée${result.deleted > 1 ? "s" : ""}`);
      list.setSelected([]);
      list.reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Suppression impossible.", true);
    } finally {
      setBusy("");
    }
  }

  return (
    <BlockStack gap="400">
      <Alert>
        <Text as="p" variant="bodyMd">Pour certaines destinations, passez par <Link href={`${BASE}/postage`}>Affranchissement</Link> afin de compléter les informations obligatoires avant de créer l’étiquette. Les erreurs sont dans le <Link href={`${BASE}/logs`}>journal</Link>.</Text>
      </Alert>

      {results ? (
        <Card padding="0">
          <BlockStack gap="0">
            <div style={{ padding: "var(--p-space-400)" }}>
              <Text as="h2" variant="headingMd">Résultat</Text>
              <Text as="p" variant="bodySm" tone="subdued">{results.filter((item) => item.ok).length} sur {results.length} étiquettes créées</Text>
            </div>
            <IndexTable
              resourceName={{ singular: "résultat", plural: "résultats" }}
              itemCount={results.length}
              selectable={false}
              headings={[{ title: "Commande" }, { title: "Résultat" }, { title: "Documents" }]}>
              {results.map((item, index) => (
                <IndexTable.Row id={item.orderId} key={item.orderId} position={index}>
                  <IndexTable.Cell>{item.reference ?? `…${item.orderId.slice(-8)}`}</IndexTable.Cell>
                  <IndexTable.Cell>{item.ok ? <Badge tone="success">{item.trackId}</Badge> : <Badge tone="critical">{item.error}</Badge>}</IndexTable.Cell>
                  <IndexTable.Cell>
                    <InlineStack gap="200">
                      {item.shipmentId ? <a href={LABEL_URL(item.shipmentId)} target="_blank" rel="noopener noreferrer">Étiquette</a> : null}
                      {item.returnShipmentId ? <a href={LABEL_URL(item.returnShipmentId)} target="_blank" rel="noopener noreferrer">Étiquette retour</a> : null}
                    </InlineStack>
                  </IndexTable.Cell>
                </IndexTable.Row>
              ))}
            </IndexTable>
          </BlockStack>
        </Card>
      ) : null}

      <InlineStack gap="200" blockAlign="center">
        <Button variant="primary" onClick={() => void create()} disabled={!list.selected.length || Boolean(busy)} loading={busy === "create"}>
          {list.selected.length ? `Créer ${list.selected.length} étiquette${list.selected.length > 1 ? "s" : ""}` : "Créer les étiquettes"}
        </Button>
        <Button icon={DeleteIcon} tone="critical" onClick={() => void remove()} disabled={!list.selected.length || Boolean(busy)} loading={busy === "delete"}>Supprimer les étiquettes</Button>
        {!list.selected.length ? <Text as="span" variant="bodySm" tone="subdued">Sélectionnez des commandes dans la liste.</Text> : null}
      </InlineStack>

      <OrderTable list={list} showLabel />
    </BlockStack>
  );
}

export default function OrdersPage() {
  return <ColissimoPage current="orders" title="Commandes"><Orders /></ColissimoPage>;
}
