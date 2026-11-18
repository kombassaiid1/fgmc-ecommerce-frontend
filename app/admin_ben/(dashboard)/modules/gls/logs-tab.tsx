"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Badge, Banner, BlockStack, Button, Card, InlineStack, SkeletonBodyText, Text } from "@shopify/polaris";
import { toast } from "sonner";
import { glsCall, type GlsLogLine } from "./gls-api";

const date = (value: string) => new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "medium" }).format(new Date(value));

/** The Journal: what was sent to GLS and what GLS answered when it refused something. */
export function LogsTab() {
  const [lines, setLines] = useState<GlsLogLine[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setLines(await glsCall<GlsLogLine[]>("/logs"));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chargement impossible.");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    glsCall<GlsLogLine[]>("/logs")
      .then((loaded) => {
        if (!cancelled) setLines(loaded);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Chargement impossible.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function clear() {
    if (!window.confirm("Vider le journal GLS ?")) return;
    setBusy(true);
    try {
      await glsCall("/logs", { method: "DELETE" });
      toast.success("Journal vidé.");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action impossible.");
    } finally {
      setBusy(false);
    }
  }

  if (error) return <Banner tone="critical" title="Impossible de charger le journal">{error}</Banner>;
  if (!lines) return <Card><SkeletonBodyText lines={6} /></Card>;

  return (
    <BlockStack gap="300">
      <InlineStack align="space-between" blockAlign="center" gap="300">
        <Text as="p" variant="bodySm" tone="subdued">Les 200 derniers événements : erreurs renvoyées par GLS, étiquettes créées et annulées.</Text>
        <InlineStack gap="200">
          <Button onClick={() => void load()}>Actualiser</Button>
          <Button tone="critical" onClick={() => void clear()} loading={busy} disabled={lines.length === 0}>Vider le journal</Button>
        </InlineStack>
      </InlineStack>
      <Card padding="0">
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--p-color-bg-surface-secondary)" }}>
                {["Date", "Type", "Action", "Message", "Commande"].map((title) => (
                  <th key={title} style={{ textAlign: "left", padding: "var(--p-space-300)", whiteSpace: "nowrap" }}><Text as="span" variant="headingSm">{title}</Text></th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.id} style={{ borderTop: "1px solid var(--p-color-border)", verticalAlign: "top" }}>
                  <td style={{ padding: "var(--p-space-200) var(--p-space-300)", whiteSpace: "nowrap" }}><Text as="span" variant="bodySm">{date(line.createdAt)}</Text></td>
                  <td style={{ padding: "var(--p-space-200) var(--p-space-300)" }}><Badge tone={line.level === "error" ? "critical" : "info"}>{line.level === "error" ? "Erreur" : "Info"}</Badge></td>
                  <td style={{ padding: "var(--p-space-200) var(--p-space-300)" }}><Text as="span" variant="bodySm">{line.action}</Text></td>
                  <td style={{ padding: "var(--p-space-200) var(--p-space-300)" }}><Text as="span" variant="bodySm">{line.message}</Text></td>
                  <td style={{ padding: "var(--p-space-200) var(--p-space-300)", whiteSpace: "nowrap" }}>
                    {line.orderId ? <Link href={`/admin_ben/orders/${line.orderId}`}>…{line.orderId.slice(-8)}</Link> : "—"}
                  </td>
                </tr>
              ))}
              {lines.length === 0 ? (
                <tr><td colSpan={5} style={{ padding: "var(--p-space-500)", textAlign: "center" }}><Text as="span" tone="subdued">Le journal est vide.</Text></td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
    </BlockStack>
  );
}
