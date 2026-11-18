"use client";

import { useEffect, useState } from "react";
import { Banner, BlockStack, Button, List, Modal, SkeletonBodyText, Text } from "@shopify/polaris";
import { toast } from "sonner";
import { orderStatesApi, type OrderStateImportPreview, type OrderStateImportResult } from "@/lib/api/order-states";

/** Copies the order statuses of the connected PrestaShop shop: their name, color, icon and options. */
export function PrestashopOrderStateImport({ onImported }: { onImported: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<{ attempt: number; preview?: OrderStateImportPreview; error?: string } | null>(null);
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState<OrderStateImportResult | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    orderStatesApi
      .importPreview()
      .then((preview) => {
        if (!cancelled) setLoaded({ attempt, preview });
      })
      .catch((e: unknown) => {
        if (!cancelled) setLoaded({ attempt, error: e instanceof Error ? e.message : "Impossible de lire PrestaShop." });
      });
    return () => {
      cancelled = true;
    };
  }, [open, attempt]);

  const current = loaded?.attempt === attempt ? loaded : null;
  const preview = current?.preview;
  const loading = open && !current;

  function close() {
    if (importing) return;
    setOpen(false);
    setDone(null);
    setLoaded(null);
    setAttempt((n) => n + 1);
  }

  async function run() {
    setImporting(true);
    try {
      setDone(await orderStatesApi.importFromPrestashop());
      toast.success("Statuts importés.");
      await onImported();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import impossible.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>Importer depuis PrestaShop</Button>
      <Modal
        open={open}
        onClose={close}
        title="Importer les états de commandes de PrestaShop"
        primaryAction={
          done
            ? { content: "Terminer", onAction: close }
            : { content: "Importer", loading: importing, disabled: loading || !preview || preview.create.length + preview.update === 0, onAction: () => void run() }
        }
        secondaryActions={done ? [] : [{ content: "Annuler", onAction: close, disabled: importing }]}>
        <Modal.Section>
          <BlockStack gap="400">
            {done ? (
              <Banner tone="success" title="Import terminé">
                <p>{done.created} statut(s) créé(s), {done.updated} mis à jour avec la couleur, les options et le modèle d’e-mail de PrestaShop, {done.icons} icône(s) récupérée(s).</p>
              </Banner>
            ) : current?.error ? (
              <Banner tone="critical" title="Impossible de lire PrestaShop" action={{ content: "Configurer PrestaShop", url: "/admin_ben/modules/prestashop" }} secondaryAction={{ content: "Réessayer", onAction: () => setAttempt((n) => n + 1) }}>
                <p>{current.error}</p>
              </Banner>
            ) : loading || !preview ? (
              <BlockStack gap="200">
                <Text as="p" variant="bodyMd" tone="subdued">Lecture des états de commandes dans PrestaShop…</Text>
                <SkeletonBodyText lines={4} />
              </BlockStack>
            ) : (
              <>
                <Text as="p" variant="bodyMd">
                  PrestaShop contient <strong>{preview.source}</strong> état(s) de commande. <strong>{preview.update}</strong> existent déjà ici (même nom ou déjà importés) : leur couleur, leur icône et leurs options seront remplacées par celles de PrestaShop. <strong>{preview.create.length}</strong> seraient créés.
                </Text>
                {preview.create.length ? (
                  <Banner tone="info" title={`${preview.create.length} nouveau(x) statut(s)`}>
                    <List>{preview.create.slice(0, 30).map((name) => <List.Item key={name}>{name}</List.Item>)}</List>
                    {preview.create.length > 30 ? <p>… et {preview.create.length - 30} autre(s).</p> : null}
                  </Banner>
                ) : null}
                <Text as="p" variant="bodySm" tone="subdued">
                  L’import ne supprime aucun statut et ne change pas l’état des commandes. Sont repris : le nom, la couleur, l’icône (téléchargée vers la médiathèque) et les options (commande validée, facture, masqué, e-mail au client, pièces jointes, expédié, payé, bon de livraison, modèle d’e-mail). La clé Webservice de PrestaShop doit avoir la permission de lecture sur « order_states ».
                </Text>
              </>
            )}
          </BlockStack>
        </Modal.Section>
      </Modal>
    </>
  );
}
