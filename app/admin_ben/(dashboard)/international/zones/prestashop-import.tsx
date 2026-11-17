"use client";

import { useEffect, useState } from "react";
import { Banner, BlockStack, Box, Button, Checkbox, DataTable, Modal, SkeletonBodyText, Text } from "@shopify/polaris";
import { toast } from "sonner";

type Summary = {
  source: { zones: number; countries: number; states: number };
  zones: { create: number; update: number; same: number; createSample: string[] };
  countries: { assign: number; moved: number; same: number; skippedInactive: number; skippedNoZone: number };
  states: { create: number; update: number; same: number; skippedNoCountry: number; createSample: string[] };
};

const URL = "/frontend-api/admin/prestashop-integration/geography";

async function call(method: "GET" | "POST", includeInactiveCountries: boolean): Promise<Summary> {
  const response = await fetch(method === "GET" ? `${URL}?includeInactiveCountries=${includeInactiveCountries}` : URL, {
    method,
    cache: "no-store",
    ...(method === "POST" ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify({ includeInactiveCountries }) } : {}),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(Array.isArray(data.message) ? data.message.join(" ") : data.message || "Impossible de lire PrestaShop.");
  return data as Summary;
}

/** Import of zones, the zone of each country, and states from the connected PrestaShop shop. */
export function PrestashopImport({ onImported }: { onImported: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<{ key: string; summary?: Summary; error?: string } | null>(null);
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState<Summary | null>(null);

  const key = `${includeInactive}|${attempt}`;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    call("GET", includeInactive)
      .then((summary) => {
        if (!cancelled) setLoaded({ key, summary });
      })
      .catch((e: unknown) => {
        if (!cancelled) setLoaded({ key, error: e instanceof Error ? e.message : "Impossible de lire PrestaShop." });
      });
    return () => {
      cancelled = true;
    };
  }, [open, key, includeInactive]);

  const loading = open && loaded?.key !== key;
  const summary = loaded?.key === key ? loaded.summary : undefined;
  const error = loaded?.key === key ? loaded.error : undefined;
  const nothingToDo = summary
    ? summary.zones.create + summary.zones.update + summary.countries.assign + summary.states.create + summary.states.update === 0
    : false;

  function close() {
    setOpen(false);
    setDone(null);
    setLoaded(null);
  }

  async function runImport() {
    setImporting(true);
    try {
      const result = await call("POST", includeInactive);
      setDone(result);
      toast.success("Import PrestaShop terminé.");
      await onImported();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import impossible.");
    } finally {
      setImporting(false);
    }
  }

  const rows = summary
    ? [
        ["Zones", summary.zones.create, summary.zones.update, summary.zones.same, "—"],
        ["Pays (zone de chaque pays)", summary.countries.assign + (summary.countries.moved ? ` (dont ${summary.countries.moved} déplacés)` : ""), "—", summary.countries.same, summary.countries.skippedInactive + summary.countries.skippedNoZone],
        ["États", summary.states.create, summary.states.update, summary.states.same, summary.states.skippedNoCountry],
      ]
    : [];

  return (
    <>
      <Button onClick={() => setOpen(true)}>Importer depuis PrestaShop</Button>

      <Modal
        open={open}
        onClose={close}
        size="large"
        title="Importer depuis PrestaShop"
        primaryAction={done ? { content: "Terminer", onAction: close } : { content: "Importer", loading: importing, disabled: loading || Boolean(error) || !summary || nothingToDo, onAction: () => void runImport() }}
        secondaryActions={done ? [] : [{ content: "Annuler", onAction: close, disabled: importing }]}>
        <Modal.Section>
          <BlockStack gap="400">
            {done ? (
              <Banner tone="success" title="Import terminé">
                <p>
                  {done.zones.create} zone(s) créée(s), {done.zones.update} mise(s) à jour · {done.countries.assign} pays rattaché(s) à une zone · {done.states.create} état(s) créé(s), {done.states.update} mis à jour.
                </p>
              </Banner>
            ) : error ? (
              <Banner tone="critical" title="Impossible de lire PrestaShop" action={{ content: "Configurer PrestaShop", url: "/admin_ben/modules/prestashop" }} secondaryAction={{ content: "Réessayer", onAction: () => setAttempt((n) => n + 1) }}>
                <p>{error}</p>
              </Banner>
            ) : loading || !summary ? (
              <BlockStack gap="200">
                <Text as="p" variant="bodyMd" tone="subdued">Lecture des zones, pays et états de PrestaShop…</Text>
                <SkeletonBodyText lines={5} />
              </BlockStack>
            ) : (
              <>
                <Text as="p" variant="bodyMd">
                  PrestaShop contient <strong>{summary.source.zones}</strong> zone(s), <strong>{summary.source.countries}</strong> pays et <strong>{summary.source.states}</strong> état(s). Voici ce que l’import ferait :
                </Text>
                <Box borderWidth="025" borderColor="border" borderRadius="200" overflowX="scroll">
                  <DataTable
                    columnContentTypes={["text", "numeric", "numeric", "numeric", "numeric"]}
                    headings={["", "À créer / rattacher", "À mettre à jour", "Déjà à jour", "Ignorés"]}
                    rows={rows}
                  />
                </Box>
                {nothingToDo ? (
                  <Banner tone="info" title="Tout est déjà à jour"><p>Votre boutique contient déjà les zones, pays et états de PrestaShop.</p></Banner>
                ) : null}
                <Checkbox
                  label="Inclure les pays désactivés dans PrestaShop"
                  checked={includeInactive}
                  onChange={setIncludeInactive}
                  helpText="Par défaut, seuls les pays actifs dans PrestaShop sont rattachés à une zone."
                />
                <BlockStack gap="100">
                  <Text as="p" variant="bodySm" tone="subdued">L’import ne supprime rien. Les zones et les états sont retrouvés par leur nom, les pays par leur code : vous pouvez le relancer sans créer de doublons.</Text>
                  <Text as="p" variant="bodySm" tone="subdued">La clé Webservice de PrestaShop doit avoir la permission de lecture sur « zones », « countries » et « states ».</Text>
                </BlockStack>
              </>
            )}
          </BlockStack>
        </Modal.Section>
      </Modal>
    </>
  );
}
