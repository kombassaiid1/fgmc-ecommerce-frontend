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
  taxUnmatched?: string[];
  withTax?: number;
  /** Existing carriers that will be linked to their PrestaShop twin (needed to copy product carriers). */
  toLink?: number;
  linked?: number;
  /** True when the FGMC PrestaShop module (1.1.0) answered, so each carrier's zones are PrestaShop's own. */
  glsTypes?: Array<{ name: string; glsType: string }>;
  zonesKnown?: boolean;
  zoneSync?: Array<{ name: string; removed: number; added: number }>;
  unmatchedZones?: string[];
  zonesUpdated?: number;
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
            : { content: summary ? (summary.create.length ? `Importer ${summary.create.length} transporteur(s)` : "Mettre à jour les transporteurs") : "Importer", loading: importing, disabled: loading || Boolean(error) || !summary || summary.create.length + (summary.toLink ?? 0) + (summary.zoneSync?.length ?? 0) + (summary.glsTypes?.length ?? 0) === 0, onAction: () => void runImport() }
        }
        secondaryActions={done ? [] : [{ content: "Annuler", onAction: close, disabled: importing }]}>
        <Modal.Section>
          <BlockStack gap="400">
            {done ? (
              <Banner tone="success" title="Import terminé">
                <p>{done.create.length} transporteur(s) importé(s), {done.logosImported ?? 0} logo(s) récupéré(s), {done.linked ?? 0} transporteur(s) existant(s) lié(s) à PrestaShop, zones mises à jour pour {done.zonesUpdated ?? 0} transporteur(s). Vérifiez leurs tarifs, puis activez-les quand vous êtes prêt.</p>
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

                {summary.toLink ? (
                  <Banner tone="info" title={`${summary.toLink} transporteur(s) déjà présents seront liés à PrestaShop`}>
                    <p>Ils ne sont pas modifiés. Ce lien permet de reprendre les transporteurs autorisés de chaque produit lors d’un réimport.</p>
                  </Banner>
                ) : null}

                {summary.zoneSync?.length ? (
                  <Banner tone="info" title={`Zones à mettre à jour pour ${summary.zoneSync.length} transporteur(s) d’après PrestaShop`}>
                    <p>{summary.zoneSync.map((item) => `${item.name} (${[item.removed ? `${item.removed} retirée(s)` : '', item.added ? `${item.added} ajoutée(s)` : ''].filter(Boolean).join(', ')})`).join(' · ')}. Seules les zones où PrestaShop active le transporteur sont conservées ; les tarifs ne sont pas modifiés.</p>
                  </Banner>
                ) : null}
                {summary.glsTypes?.length ? (
                  <Banner tone="info" title={`Type GLS à renseigner pour ${summary.glsTypes.length} transporteur(s)`}>
                    <p>{summary.glsTypes.map((item) => `${item.name} : ${({ HOME: 'Chez vous', RELAY: 'Relais', FLEX: 'Chez vous +', EXPRESS: 'Avant 13h' } as Record<string, string>)[item.glsType] ?? item.glsType}`).join(' · ')}. Déduit du nom du transporteur ; vous pouvez le changer dans la fiche du transporteur.</p>
                  </Banner>
                ) : null}
                {summary.unmatchedZones?.length ? (
                  <Banner tone="warning" title="Zones PrestaShop absentes d’ici" action={{ content: "Gérer les zones", url: "/admin_ben/international/zones" }}>
                    <p>Ces zones n’existent pas dans la boutique et sont ignorées : {summary.unmatchedZones.join(', ')}.</p>
                  </Banner>
                ) : null}
                {summary.zonesKnown === false ? (
                  <Banner tone="info" title="Zones non vérifiées">
                    <p>Le module FGMC (version 1.1.0 ou plus) n’est pas détecté sur PrestaShop : les zones de chaque transporteur sont déduites de ses tarifs, et un transporteur gratuit n’a pas de zone. Installez le module depuis Modules, PrestaShop.</p>
                  </Banner>
                ) : null}

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
                {summary.taxUnmatched?.length ? (
                  <Banner tone="warning" title="Taxes à créer" action={{ content: "Gérer les taxes", url: "/admin_ben/international/taxes" }}>
                    <p>Aucune taxe avec le même taux n’existe ici pour : {summary.taxUnmatched.join(", ")}. Ces transporteurs seront importés sans taxe ; créez la taxe puis choisissez-la dans leur fiche.</p>
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
                  <Text as="p" variant="bodySm" tone="subdued">Sont repris : le nom, le délai, le lien de suivi, la facturation (poids ou prix), les tranches et le prix de chaque tranche par zone, les frais de manutention, la taxe (retrouvée par son taux), le comportement hors tranche et le poids maximum. Les logos sont téléchargés depuis PrestaShop vers la médiathèque, et les zones de chaque transporteur sont celles de PrestaShop (avec le module FGMC).</Text>
                  <Text as="p" variant="bodySm" tone="subdued">L’import ne supprime ni ne modifie rien. La clé Webservice de PrestaShop doit avoir la permission de lecture sur « carriers », « price_ranges », « weight_ranges », « deliveries » et « zones » (et « tax_rules » et « taxes » pour reprendre la taxe).</Text>
                </BlockStack>
              </>
            )}
          </BlockStack>
        </Modal.Section>
      </Modal>
    </>
  );
}
