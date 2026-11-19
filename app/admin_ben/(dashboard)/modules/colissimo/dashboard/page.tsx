"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge, BlockStack, Button, Card, EmptyState, IndexTable, InlineStack, Select, SkeletonBodyText, Text, TextField } from "@shopify/polaris";
import { ClipboardIcon, RefreshIcon } from "@shopify/polaris-icons";
import { getBackendBaseUrl } from "@/lib/backend-url";
import { orderStatesApi } from "@/lib/api/order-states";
import { Alert, Panel, useColissimo } from "../cm-kit";
import { ColissimoPage } from "../cm-page";
import { colissimoCall, patch, type ColissimoSettings, type ColissimoShipment } from "../colissimo-api";

const date = (value: string | null) => (value ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)) : "—");
const DAYS15 = 15 * 24 * 3600 * 1000;

function Dashboard() {
  const { toast } = useColissimo();
  const [settings, setSettings] = useState<ColissimoSettings | null>(null);
  const [rows, setRows] = useState<ColissimoShipment[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [now] = useState(() => Date.now());
  const [states, setStates] = useState<Array<{ value: string; label: string }>>([{ value: "", label: "Ne pas changer l’état" }]);
  const [savingStates, setSavingStates] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([colissimoCall<ColissimoSettings>("/settings"), colissimoCall<ColissimoShipment[]>("/shipments/open")])
      .then(([loaded, shipments]) => {
        if (cancelled) return;
        setSettings(loaded);
        setRows(shipments);
      })
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : "Chargement impossible."));
    orderStatesApi.list().then((list) => !cancelled && setStates([{ value: "", label: "Ne pas changer l’état" }, ...list.map((row) => ({ value: row.key, label: row.name }))])).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  async function reload() {
    const [loaded, shipments] = await Promise.all([colissimoCall<ColissimoSettings>("/settings"), colissimoCall<ColissimoShipment[]>("/shipments/open")]);
    setSettings(loaded);
    setRows(shipments);
  }

  async function updateAll() {
    setBusy(true);
    try {
      const result = await colissimoCall<{ checked: number; updated: number; failed: number }>("/tracking/run", { method: "POST" });
      toast(`${result.checked} colis vérifiés, ${result.updated} commande${result.updated > 1 ? "s" : ""} mise${result.updated > 1 ? "s" : ""} à jour${result.failed ? `, ${result.failed} erreur${result.failed > 1 ? "s" : ""}` : ""}`, result.failed > 0 && result.updated === 0);
      await reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Mise à jour impossible.", true);
    } finally {
      setBusy(false);
    }
  }

  async function saveStates() {
    if (!settings) return;
    setSavingStates(true);
    try {
      setSettings(await patch<ColissimoSettings>("/settings", { trackingStates: settings.trackingStates }));
      toast("Statuts enregistrés");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Enregistrement impossible.", true);
    } finally {
      setSavingStates(false);
    }
  }

  async function newKey() {
    if (!window.confirm("Générer une nouvelle clé ? L’ancienne adresse cessera de fonctionner : pensez à changer la tâche planifiée.")) return;
    try {
      const saved = await colissimoCall<ColissimoSettings>("/settings/tracking-key", { method: "POST" });
      setSettings((old) => (old ? { ...old, trackingKey: saved.trackingKey } : saved));
      toast("Nouvelle clé générée");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Action impossible.", true);
    }
  }

  if (error) return <Alert tone="danger">{error}</Alert>;
  if (!settings || !rows) return <Card><SkeletonBodyText lines={8} /></Card>;

  const cronUrl = `${getBackendBaseUrl()}/colissimo/tracking/update?key=${settings.trackingKey}`;
  const visible = rows.filter((row) => !row.deliveredAt || now - new Date(row.deliveredAt).getTime() < DAYS15);
  const setState = (key: keyof ColissimoSettings["trackingStates"]) => (value: string) => setSettings({ ...settings, trackingStates: { ...settings.trackingStates, [key]: value } });

  return (
    <BlockStack gap="500">
      <Card>
        <BlockStack gap="300">
          <InlineStack align="space-between" blockAlign="center" gap="300">
            <BlockStack gap="050">
              <Text as="h2" variant="headingMd">Mise à jour du suivi</Text>
              <Text as="p" variant="bodySm" tone="subdued">Les colis livrés restent affichés 15 jours.</Text>
            </BlockStack>
            <Button variant="primary" icon={RefreshIcon} onClick={() => void updateAll()} loading={busy}>Mettre à jour tous les suivis</Button>
          </InlineStack>
          <TextField
            label="Adresse pour une tâche planifiée (cron)"
            value={cronUrl}
            readOnly
            autoComplete="off"
            helpText="Demandez à votre hébergeur d’appeler cette adresse à la fréquence voulue. Elle contient une clé secrète : ne la partagez pas."
            monospaced
            connectedRight={
              <InlineStack gap="100" wrap={false}>
                <Button icon={ClipboardIcon} onClick={() => void navigator.clipboard.writeText(cronUrl).then(() => toast("Adresse copiée"), () => toast("Copie impossible", true))}>Copier</Button>
                <Button onClick={() => void newKey()}>Nouvelle clé</Button>
              </InlineStack>
            }
          />
        </BlockStack>
      </Card>

      <Panel title="Statuts selon le suivi" description="L’état que prend la commande quand le suivi Colissimo change. Les commandes annulées, retournées, remboursées ou déjà livrées ne sont jamais modifiées." onSave={() => void saveStates()} saving={savingStates}>
        <Select label="En transit" value={settings.trackingStates.inTransit} options={states} onChange={setState("inTransit")} />
        <Select label="Disponible en point de retrait" value={settings.trackingStates.atPickup} options={states} onChange={setState("atPickup")} />
        <Select label="Livré" value={settings.trackingStates.delivered} options={states} onChange={setState("delivered")} />
      </Panel>

      <Card padding="0">
        <div style={{ padding: "var(--p-space-400)" }}><Text as="h2" variant="headingMd">Colis récents</Text></div>
        {visible.length === 0 ? (
          <EmptyState heading="Aucun colis récent" image="">
            <p>Les colis expédiés avec Colissimo apparaissent ici avec leur dernier statut.</p>
          </EmptyState>
        ) : (
          <IndexTable
            resourceName={{ singular: "colis", plural: "colis" }}
            itemCount={visible.length}
            selectable={false}
            headings={[{ title: "Commande" }, { title: "Numéro de suivi" }, { title: "Service" }, { title: "Poids", alignment: "end" }, { title: "Créé le" }, { title: "Statut" }, { title: "Dernier événement" }, { title: "Étiquette" }]}>
            {visible.map((row, index) => (
              <IndexTable.Row id={row.id} key={row.id} position={index}>
                <IndexTable.Cell><Link href={`/admin_ben/orders/${row.orderId}`}>{row.orderReference ?? `…${row.orderId.slice(-8)}`}</Link></IndexTable.Cell>
                <IndexTable.Cell><a className="cm-mono" href={`https://www.laposte.fr/outils/suivre-vos-envois?code=${encodeURIComponent(row.trackIds[0])}`} target="_blank" rel="noopener noreferrer">{row.trackIds[0]}</a></IndexTable.Cell>
                <IndexTable.Cell>{row.productCode}</IndexTable.Cell>
                <IndexTable.Cell><span className="cm-num">{row.weightKg} kg</span></IndexTable.Cell>
                <IndexTable.Cell><span className="cm-num">{date(row.createdAt)}</span></IndexTable.Cell>
                <IndexTable.Cell>{row.deliveredAt ? <Badge tone="success">Livré</Badge> : row.lastStatus ?? <Badge>Pas encore de suivi</Badge>}</IndexTable.Cell>
                <IndexTable.Cell><span className="cm-num">{date(row.lastEventAt)}</span></IndexTable.Cell>
                <IndexTable.Cell><a href={`/frontend-api/admin/colissimo-integration/shipments/${row.id}/label`} target="_blank" rel="noopener noreferrer">Ouvrir</a></IndexTable.Cell>
              </IndexTable.Row>
            ))}
          </IndexTable>
        )}
      </Card>
    </BlockStack>
  );
}

export default function DashboardPage() {
  return <ColissimoPage current="dashboard" title="Suivi des colis"><Dashboard /></ColissimoPage>;
}
