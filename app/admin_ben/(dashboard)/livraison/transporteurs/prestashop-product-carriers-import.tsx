"use client";

import { useEffect, useRef, useState } from "react";
import { Banner, BlockStack, Button, List, Modal, ProgressBar, SkeletonBodyText, Text } from "@shopify/polaris";
import { toast } from "sonner";

type Summary = { products: number; withList: number; linkedCarriers: number };
type Page = { total: number; processed: number; nextOffset: number | null; restricted: number; unrestricted: number; notImported: number; unknown: number };
type Totals = { processed: number; total: number; restricted: number; unrestricted: number; notImported: number; unknown: number };

const URL = "/frontend-api/admin/prestashop-integration/product-carriers";

async function request<T>(init?: RequestInit): Promise<T> {
  const response = await fetch(URL, { cache: "no-store", ...init, headers: { ...(init?.body ? { "Content-Type": "application/json" } : {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(Array.isArray(data.message) ? data.message.join(" ") : data.message || "Action impossible.");
  return data as T;
}

/** Copies the "Transporteurs disponibles" list of every imported product from PrestaShop, page by page. */
export function PrestashopProductCarriersImport() {
  const [open, setOpen] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<{ attempt: number; summary?: Summary; error?: string } | null>(null);
  const [running, setRunning] = useState(false);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [finished, setFinished] = useState(false);
  const [failure, setFailure] = useState("");
  const stop = useRef(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    request<Summary>()
      .then((summary) => {
        if (!cancelled) setLoaded({ attempt, summary });
      })
      .catch((e: unknown) => {
        if (!cancelled) setLoaded({ attempt, error: e instanceof Error ? e.message : "Impossible de lire la boutique." });
      });
    return () => {
      cancelled = true;
    };
  }, [open, attempt]);

  const current = loaded?.attempt === attempt ? loaded : null;
  const summary = current?.summary;
  const loading = open && !current;

  function close() {
    if (running) return;
    setOpen(false);
    setLoaded(null);
    setTotals(null);
    setFinished(false);
    setFailure("");
    setAttempt((n) => n + 1);
  }

  async function run() {
    stop.current = false;
    setRunning(true);
    setFinished(false);
    setFailure("");
    const sum: Totals = { processed: 0, total: summary?.products ?? 0, restricted: 0, unrestricted: 0, notImported: 0, unknown: 0 };
    setTotals({ ...sum });
    let offset: number | null = 0;
    try {
      while (offset !== null && !stop.current) {
        const page: Page = await request<Page>({ method: "POST", body: JSON.stringify({ offset, limit: 100 }) });
        sum.total = page.total;
        sum.processed = page.processed;
        sum.restricted += page.restricted;
        sum.unrestricted += page.unrestricted;
        sum.notImported += page.notImported;
        sum.unknown += page.unknown;
        setTotals({ ...sum });
        offset = page.nextOffset;
      }
      if (offset === null) {
        setFinished(true);
        toast.success("Transporteurs des produits importés.");
      }
    } catch (e) {
      setFailure(e instanceof Error ? e.message : "Import impossible.");
    } finally {
      setRunning(false);
    }
  }

  const percent = totals && totals.total > 0 ? Math.round((totals.processed / totals.total) * 100) : 0;

  return (
    <>
      <Button onClick={() => setOpen(true)}>Importer les transporteurs des produits</Button>

      <Modal
        open={open}
        onClose={close}
        title="Importer les transporteurs autorisés des produits"
        primaryAction={
          finished
            ? { content: "Terminer", onAction: close }
            : { content: totals && failure ? "Reprendre" : "Importer", loading: running, disabled: loading || !summary || summary.products === 0 || summary.linkedCarriers === 0, onAction: () => void run() }
        }
        secondaryActions={finished ? [] : [{ content: running ? "Arrêter" : "Annuler", onAction: () => (running ? (stop.current = true) : close()) }]}>
        <Modal.Section>
          <BlockStack gap="400">
            {current?.error ? (
              <Banner tone="critical" title="Impossible de lire la boutique" secondaryAction={{ content: "Réessayer", onAction: () => setAttempt((n) => n + 1) }}><p>{current.error}</p></Banner>
            ) : loading || !summary ? (
              <BlockStack gap="200"><Text as="p" variant="bodyMd" tone="subdued">Lecture de la boutique…</Text><SkeletonBodyText lines={3} /></BlockStack>
            ) : (
              <>
                <Text as="p" variant="bodyMd">
                  <strong>{summary.products}</strong> produit(s) viennent de PrestaShop. <strong>{summary.withList}</strong> ont déjà une liste de transporteurs ici : sans liste, un produit peut utiliser tous les transporteurs, y compris ceux que PrestaShop lui interdit.
                </Text>
                {summary.linkedCarriers === 0 ? (
                  <Banner tone="warning" title="Aucun transporteur n’est lié à PrestaShop" action={{ content: "Importer les transporteurs", onAction: close }}>
                    <p>Lancez d’abord « Importer depuis PrestaShop » et « Mettre à jour les transporteurs » : le lien sert à retrouver chaque transporteur d’un produit.</p>
                  </Banner>
                ) : (
                  <Text as="p" variant="bodySm" tone="subdued">{summary.linkedCarriers} transporteur(s) sont liés à PrestaShop.</Text>
                )}

                {totals ? (
                  <BlockStack gap="200">
                    <ProgressBar progress={percent} size="small" />
                    <Text as="p" variant="bodySm" tone="subdued">{totals.processed} produit(s) sur {totals.total} traités.</Text>
                  </BlockStack>
                ) : null}
                {failure ? <Banner tone="critical" title="L’import s’est arrêté"><p>{failure} Les produits déjà traités sont gardés ; « Reprendre » recommence au début sans rien casser.</p></Banner> : null}
                {finished && totals ? (
                  <Banner tone="success" title="Import terminé">
                    <List>
                      <List.Item>{totals.restricted} produit(s) avec une liste de transporteurs copiée</List.Item>
                      <List.Item>{totals.unrestricted} produit(s) sans liste dans PrestaShop : tous les transporteurs sont permis</List.Item>
                      {totals.notImported ? <List.Item>{totals.notImported} produit(s) dont la liste ne contient aucun transporteur importé ici : laissés tels quels</List.Item> : null}
                      {totals.unknown ? <List.Item>{totals.unknown} produit(s) introuvables dans PrestaShop : ignorés</List.Item> : null}
                    </List>
                  </Banner>
                ) : null}

                {!totals ? (
                  <Text as="p" variant="bodySm" tone="subdued">
                    Par lots de 100 produits, la liste « Transporteurs disponibles » de chaque produit est lue dans PrestaShop avec le module FGMC (version 1.1.0 ou plus) et copiée ici. Seules ces listes changent : le nom, le prix, le stock ou les images des produits ne sont pas touchés. Vous pouvez arrêter et reprendre à tout moment.
                  </Text>
                ) : null}
              </>
            )}
          </BlockStack>
        </Modal.Section>
      </Modal>
    </>
  );
}
