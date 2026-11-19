"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BlockStack, Button, Card, EmptyState, InlineStack, SkeletonBodyText, Text } from "@shopify/polaris";
import { Alert, useColissimo } from "../cm-kit";
import { ColissimoPage } from "../cm-page";
import { LABEL_URL, colissimoCall } from "../colissimo-api";

type Row = { id: string; orderId: string; orderReference: string | null; trackId: string; country: string; createdAt: string; documents: Record<string, number | string> };

const date = (value: string) => new Intl.DateTimeFormat("fr-FR", { dateStyle: "short" }).format(new Date(value));

/** Reads a PDF as base64 (the part after the comma of the data URL). */
const readBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(new Error("Lecture du fichier impossible."));
    reader.readAsDataURL(file);
  });

function Documents() {
  const { toast } = useColissimo();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);
  const files = useRef<Record<string, File | undefined>>({});

  useEffect(() => {
    let cancelled = false;
    colissimoCall<Row[]>("/customs")
      .then((loaded) => !cancelled && setRows(loaded))
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : "Chargement impossible."));
    return () => {
      cancelled = true;
    };
  }, [tick]);

  async function send() {
    setBusy(true);
    let sent = 0;
    const problems: string[] = [];
    for (const id of picked) {
      for (const kind of ["COMMERCIAL_INVOICE", "OTHER"] as const) {
        const file = files.current[`${id}:${kind}`];
        if (!file) continue;
        try {
          if (file.type !== "application/pdf") throw new Error("Seuls les fichiers PDF sont acceptés.");
          await colissimoCall(`/customs/${id}`, { method: "POST", body: JSON.stringify({ kind, file: await readBase64(file) }) });
          sent += 1;
        } catch (e) {
          problems.push(`${rows?.find((row) => row.id === id)?.trackId ?? id} : ${e instanceof Error ? e.message : "Envoi impossible."}`);
        }
      }
    }
    setBusy(false);
    if (sent) toast(`${sent} document${sent > 1 ? "s" : ""} envoyé${sent > 1 ? "s" : ""} à la douane`);
    if (problems.length) toast(problems.join(" · "), true);
    if (!sent && !problems.length) toast("Choisissez au moins un fichier PDF.", true);
    setTick((n) => n + 1);
  }

  if (error) return <Alert tone="danger">{error}</Alert>;
  if (!rows) return <Card><SkeletonBodyText lines={6} /></Card>;

  return (
    <BlockStack gap="400">
      <Alert>Ajoutez la facture et, si la valeur dépasse 1 000 €, le document administratif unique de chaque colis hors Union européenne ou outre-mer. Seuls les fichiers PDF sont acceptés (5 Mo au plus).</Alert>
      {rows.length === 0 ? (
        <Card><EmptyState heading="Aucun envoi à traiter" image=""><p>Les colis qui demandent des documents douaniers apparaissent ici après la création de leur étiquette.</p></EmptyState></Card>
      ) : (
        <>
          <div className="cm-table-wrap">
            <table className="cm-table">
              <thead><tr><th><span style={{ position: "absolute", left: -9999 }}>Sélection</span></th><th>Commande</th><th>Numéro de suivi</th><th>Pays</th><th>Date</th><th>Facture</th><th>Document administratif unique</th></tr></thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td><input type="checkbox" aria-label={`Colis ${row.trackId}`} checked={picked.includes(row.id)} onChange={(e) => setPicked(e.target.checked ? [...picked, row.id] : picked.filter((id) => id !== row.id))} /></td>
                    <td><Link href={`/admin_ben/orders/${row.orderId}`}>{row.orderReference ?? `…${row.orderId.slice(-8)}`}</Link></td>
                    <td><a className="cm-mono" href={LABEL_URL(row.id)} target="_blank" rel="noopener noreferrer" title="Ouvrir l’étiquette">{row.trackId}</a></td>
                    <td>{row.country}</td>
                    <td className="cm-num">{date(row.createdAt)}</td>
                    <td>
                      {row.documents.COMMERCIAL_INVOICE ? <Text as="p" variant="bodySm" tone="success">Envoyée · n° {row.documents.COMMERCIAL_INVOICE}</Text> : null}
                      <input type="file" accept="application/pdf" aria-label={`Facture du colis ${row.trackId}`} onChange={(e) => { files.current[`${row.id}:COMMERCIAL_INVOICE`] = e.target.files?.[0]; if (e.target.files?.[0] && !picked.includes(row.id)) setPicked([...picked, row.id]); }} />
                    </td>
                    <td>
                      {row.documents.OTHER ? <Text as="p" variant="bodySm" tone="success">Envoyé · n° {row.documents.OTHER}</Text> : null}
                      <input type="file" accept="application/pdf" aria-label={`Document administratif du colis ${row.trackId}`} onChange={(e) => { files.current[`${row.id}:OTHER`] = e.target.files?.[0]; if (e.target.files?.[0] && !picked.includes(row.id)) setPicked([...picked, row.id]); }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <InlineStack><Button variant="primary" onClick={() => void send()} loading={busy} disabled={picked.length === 0}>Envoyer à la douane</Button></InlineStack>
        </>
      )}
    </BlockStack>
  );
}

export default function DocumentsPage() {
  return <ColissimoPage current="documents" title="Documents douaniers"><Documents /></ColissimoPage>;
}
