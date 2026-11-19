"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge, BlockStack, Button, Card, EmptyState, IndexTable, InlineStack, SkeletonBodyText, Text } from "@shopify/polaris";
import { DeleteIcon, RefreshIcon } from "@shopify/polaris-icons";
import { Alert, useColissimo } from "../cm-kit";
import { ColissimoPage } from "../cm-page";
import { colissimoCall, type ColissimoLogLine } from "../colissimo-api";

const date = (value: string) => new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "medium" }).format(new Date(value));

function Logs() {
  const { toast, config } = useColissimo();
  const [lines, setLines] = useState<ColissimoLogLine[] | null>(null);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    colissimoCall<ColissimoLogLine[]>("/logs")
      .then((loaded) => !cancelled && setLines(loaded))
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : "Chargement impossible."));
    return () => {
      cancelled = true;
    };
  }, [tick]);

  async function clear() {
    if (!window.confirm("Vider le journal Colissimo ?")) return;
    try {
      await colissimoCall("/logs", { method: "DELETE" });
      toast("Journal vidé");
      setTick((n) => n + 1);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Action impossible.", true);
    }
  }

  if (error) return <Alert tone="danger">{error}</Alert>;
  if (!lines) return <Card><SkeletonBodyText lines={8} /></Card>;
  return (
    <BlockStack gap="400">
      {!config.values.COLISSIMO_LOGS ? <Alert tone="warning">Les journaux détaillés sont désactivés (Configuration, Compte). Les erreurs importantes sont tout de même enregistrées ici.</Alert> : null}
      <InlineStack gap="200">
        <Button icon={RefreshIcon} onClick={() => setTick((n) => n + 1)}>Actualiser</Button>
        <Button icon={DeleteIcon} tone="critical" onClick={() => void clear()} disabled={lines.length === 0}>Vider le journal</Button>
      </InlineStack>
      <Card padding="0">
        {lines.length === 0 ? (
          <EmptyState heading="Le journal est vide" image=""><p>Les échanges avec Colissimo et les erreurs apparaissent ici.</p></EmptyState>
        ) : (
          <IndexTable
            resourceName={{ singular: "événement", plural: "événements" }}
            itemCount={lines.length}
            selectable={false}
            headings={[{ title: "Date" }, { title: "Type" }, { title: "Action" }, { title: "Message" }, { title: "Commande" }]}>
            {lines.map((line, index) => (
              <IndexTable.Row id={line.id} key={line.id} position={index}>
                <IndexTable.Cell><span className="cm-num">{date(line.createdAt)}</span></IndexTable.Cell>
                <IndexTable.Cell><Badge tone={line.level === "error" ? "critical" : "info"}>{line.level === "error" ? "Erreur" : "Info"}</Badge></IndexTable.Cell>
                <IndexTable.Cell>{line.action}</IndexTable.Cell>
                <IndexTable.Cell><div style={{ whiteSpace: "normal", minWidth: 280, maxWidth: 560 }}><Text as="span" variant="bodySm">{line.message}</Text></div></IndexTable.Cell>
                <IndexTable.Cell>{line.orderId ? <Link href={`/admin_ben/orders/${line.orderId}`}>…{line.orderId.slice(-8)}</Link> : "—"}</IndexTable.Cell>
              </IndexTable.Row>
            ))}
          </IndexTable>
        )}
      </Card>
    </BlockStack>
  );
}

export default function LogsPage() {
  return <ColissimoPage current="configuration" title="Journal"><Logs /></ColissimoPage>;
}
