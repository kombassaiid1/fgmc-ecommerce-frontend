"use client";

import { useEffect, useState } from "react";
import { Banner, BlockStack, Box, Button, DataTable, Modal, SkeletonBodyText, Text } from "@shopify/polaris";
import { toast } from "sonner";

type Summary = {
  source: number;
  logosImported?: number;
  create: Array<{ name: string; active: boolean; billing: "WEIGHT" | "PRICE"; freeShipping: boolean; ranges: number; zones: number }>;
  existing: string[];
  skippedDeleted: number;
  withoutPrices: string[];
  missingZones: string[];
  overlappingRangesDropped: number;
};

const URL = "/frontend-api/admin/prestashop-integration/carriers";

async function call(method: "GET" | "POST"): Promise<Summary> {
  const response = await fetch(URL, { method, cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(Array.isArray(data.message) ? data.message.join(" ") : data.message || "Impossible de lire PrestaShop.");
  return data as Summary;
}

/** Import of carriers, their price grids and options from the connected PrestaShop shop. */
export function PrestashopCarrierImport({ onImported }: { onImported: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<{ attempt: number; summary?: Summary; error?: string } | null>(null);
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState<Summary | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    call("GET")
      .then((summary) => {
        if (!cancelled) setLoaded({ attempt, summary });
      })
      .catch((e: unknown) => {
        if (!cancelled) setLoaded({ attempt, error: e instanceof Error ? e.message : "Impossible de lire PrestaShop." });
      });
    return () => {
      cancelled = true;
    };
  }, [open, attempt]);

  const current = loaded?.attempt === attempt ? loaded : null;
  const summary = current?.summary;
  const error = current?.error;
  const loading = open && !current;

  function close() {
    setOpen(false);
    setDone(null);
    setLoaded(null);
  }

  async function runImport() {
    setImporting(true);
    try {
      setDone(await call("POST"));
      toast.success("Transporteurs importés.");
      await onImported();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import impossible.");
    } finally {
      setImporting(false);
    }
  }

  const rows =
    summary?.create.map((carrier) => [
      carrier.name,
      carrier.freeShipping ? "Gratuit" : carrier.billing === "WEIGHT" ? "Au poids" : "Au prix",
      carrier.ranges,
      carrier.zones,
      carrier.active ? "Actif" : "Désactivé",
    ]) ?? [];

  return (
    <>
      <Button onClick={() => setOpen(true)}>Importer depuis PrestaShop</Button>

      <Modal
        open={open}
        onClose={close}
        size="large"
        title="Importer les transporteurs de PrestaShop"
        primaryAction={
          done
            ? { content: "Terminer", onAction: close }
            : { content: summary ? `Importer ${summary.create.length} transporteur(s)` : "Importer", loading: importing, disabled: loading || Boolean(error) || !summary || summary.create.length === 0, onAction: () => void runImport() }
        }
        secondaryActions={done ? [] : [{ content: "Annuler", onAction: close, disabled: importing }]}>
        <Modal.Section>
          <BlockStack gap="400">
            {done ? (
              <Banner tone="success" title="Import terminé">
                <p>{done.create.length} transporteur(s) importé(s), {done.logosImported ?? 0} logo(s) récupéré(s). Vérifiez leurs tarifs, puis activez-les quand vous êtes prêt.</p>
              </Banner>
            ) : error ? (
              <Banner tone="critical" title="Impossible de lire PrestaShop" action={{ content: "Configurer PrestaShop", url: "/admin_ben/modules/prestashop" }} secondaryAction={{ content: "Réessayer", onAction: () => setAttempt((n) => n + 1) }}>
                <p>{error}</p>
              </Banner>
            ) : loading || !summary ? (
              <BlockStack gap="200">
                <Text as="p" variant="bodyMd" tone="subdued">Lecture des transporteurs et de leurs tarifs dans PrestaShop…</Text>
                <SkeletonBodyText lines={5} />
              </BlockStack>
            ) : (
              <>
                <Text as="p" variant="bodyMd">
                  PrestaShop contient <strong>{summary.source}</strong> transporteur(s). <strong>{summary.create.length}</strong> seraient importés
                  {summary.existing.length ? <>, <strong>{summary.existing.length}</strong> existent déjà ici (même nom) et ne sont pas modifiés</> : null}
                  {summary.skippedDeleted ? <>, <strong>{summary.skippedDeleted}</strong> supprimés dans PrestaShop sont ignorés</> : null}.
                </Text>

                {summary.create.length ? (
                  <Box borderWidth="025" borderColor="border" borderRadius="200" overflowX="scroll">
                    <DataTable columnContentTypes={["text", "text", "numeric", "numeric", "text"]} headings={["Transporteur", "Facturation", "Tranches", "Zones", "Statut"]} rows={rows} />
                  </Box>
                ) : (
                  <Banner tone="info" title="Rien à importer"><p>Tous les transporteurs de PrestaShop sont déjà dans la boutique.</p></Banner>
                )}

                {summary.missingZones.length ? (
                  <Banner tone="warning" title="Certaines zones n’existent pas encore ici" action={{ content: "Importer les zones", url: "/admin_ben/international/zones" }}>
                    <p>Les tarifs de ces zones ne seront pas importés : {summary.missingZones.join(", ")}. Importez d’abord les zones depuis PrestaShop, puis relancez cet import.</p>
                  </Banner>
                ) : null}
                {summary.withoutPrices.length ? (
                  <Banner tone="warning" title="Transporteurs sans tarif">
                    <p>{summary.withoutPrices.join(", ")} seront importés sans tarif : complétez-les dans l’éditeur avant de les activer.</p>
                  </Banner>
                ) : null}
                {summary.overlappingRangesDropped ? (
                  <Banner tone="warning" title="Tranches ignorées"><p>{summary.overlappingRangesDropped} tranche(s) qui se chevauchaient n’ont pas été reprises.</p></Banner>
                ) : null}

                <BlockStack gap="100">
                  <Text as="p" variant="bodySm" tone="subdued">Sont repris : le nom, le délai, le lien de suivi, la facturation (poids ou prix), les tranches et le prix de chaque tranche par zone, les frais de manutention, le comportement hors tranche et le poids maximum. Les logos sont téléchargés depuis PrestaShop vers la médiathèque.</Text>
                  <Text as="p" variant="bodySm" tone="subdued">L’import ne supprime ni ne modifie rien. La clé Webservice de PrestaShop doit avoir la permission de lecture sur « carriers », « price_ranges », « weight_ranges », « deliveries » et « zones ».</Text>
                </BlockStack>
              </>
            )}
          </BlockStack>
        </Modal.Section>
      </Modal>
    </>
  );
}
