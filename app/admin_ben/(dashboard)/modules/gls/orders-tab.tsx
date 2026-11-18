"use client";

import { useRef, useState } from "react";
import { Banner, Button } from "@shopify/polaris";
import { toast } from "sonner";
import { glsCall } from "./gls-api";

/** Order states whose GLS orders are worth sending to WinExpé. The value is the state's key in the database. */
const EXPORT_STATES: Array<{ value: string; label: string }> = [
  { value: "En_cours", label: "En cours" },
  { value: "Confirmées", label: "Confirmées" },
  { value: "En_cours_preparation", label: "En cours de préparation" },
  { value: "En_cours_expedition", label: "En cours d’expédition" },
  { value: "Remis_au_transporteur", label: "Remis au transporteur" },
];

type ImportResult = { imported: number; skipped: number; errors: string[] };

/** The Commandes tab: the WinExpé export of orders and the import of the tracking numbers it returns. */
export function OrdersTab() {
  const [states, setStates] = useState<string[]>(["En_cours"]);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [fileName, setFileName] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  async function exportCsv() {
    setExporting(true);
    try {
      const response = await fetch(`/frontend-api/admin/gls-integration/orders/export?states=${encodeURIComponent(states.join(","))}`, { cache: "no-store" });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(Array.isArray(data.message) ? data.message.join(" ") : data.message || "Export impossible.");
      }
      const blob = await response.blob();
      const name = /filename="?([^";]+)"?/.exec(response.headers.get("content-disposition") ?? "")?.[1] ?? "GlsCmd.csv";
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = name;
      link.click();
      URL.revokeObjectURL(link.href);
      toast.success("Fichier exporté. Ouvrez-le dans GLS WinExpé.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export impossible.");
    } finally {
      setExporting(false);
    }
  }

  async function importCsv() {
    const file = fileInput.current?.files?.[0];
    if (!file) return;
    setImporting(true);
    setResult(null);
    try {
      const csv = await file.text();
      const outcome = await glsCall<ImportResult>("/orders/import", { method: "POST", body: JSON.stringify({ csv }) });
      setResult(outcome);
      if (outcome.imported > 0) toast.success(`${outcome.imported} numéro(s) de suivi enregistré(s).`);
      else toast.error("Aucun numéro de suivi n’a été enregistré.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import impossible.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="gls-settings">
      <section className="gls-section" aria-labelledby="gls-export-title">
        <h2 id="gls-export-title" className="gls-section-title">Exporter les commandes vers WinExpé</h2>
        <p className="gls-section-lead">Crée un fichier CSV avec les commandes livrées par GLS dans les états choisis, à ouvrir dans le logiciel GLS WinExpé pour imprimer les étiquettes. Les options (préfixe, référence, état après export) se règlent dans l’onglet Réglages.</p>
        <fieldset className="gls-field gls-switch-field">
          <legend>États de commande à exporter</legend>
          <div className="gls-checklist">
            {EXPORT_STATES.map((state) => (
              <label key={state.value}>
                <input type="checkbox" checked={states.includes(state.value)} onChange={(event) => setStates((old) => (event.target.checked ? [...old, state.value] : old.filter((value) => value !== state.value)))} />
                {state.label}
              </label>
            ))}
          </div>
        </fieldset>
        <div>
          <Button variant="primary" onClick={() => void exportCsv()} loading={exporting} disabled={states.length === 0}>Exporter pour WinExpé</Button>
        </div>
      </section>

      <section className="gls-section" aria-labelledby="gls-import-title">
        <h2 id="gls-import-title" className="gls-section-title">Importer les numéros de suivi</h2>
        <p className="gls-section-lead">Choisissez le fichier (.csv ou .txt) que WinExpé a produit après l’impression des étiquettes. Chaque numéro de suivi est enregistré sur sa commande, qui peut changer d’état selon vos réglages.</p>
        <div className="gls-field">
          <label htmlFor="gls-import-file">Fichier WinExpé</label>
          <input id="gls-import-file" ref={fileInput} type="file" accept=".csv,.txt,text/csv,text/plain" onChange={(event) => { setFileName(event.target.files?.[0]?.name ?? ""); setResult(null); }} />
        </div>
        <div>
          <Button variant="primary" onClick={() => void importCsv()} loading={importing} disabled={!fileName}>Importer</Button>
        </div>
        {result ? (
          <Banner tone={result.errors.length ? "warning" : "success"} title={`${result.imported} commande(s) mise(s) à jour${result.skipped ? `, ${result.skipped} ligne(s) ignorée(s) (autre boutique ou format différent)` : ""}`}>
            {result.errors.length ? (
              <ul>{result.errors.map((error) => <li key={error}>{error}</li>)}</ul>
            ) : null}
          </Banner>
        ) : null}
      </section>
    </div>
  );
}
