"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown, ChevronUp, LoaderCircle, RotateCw, X } from "lucide-react";

export type SupplierBatchItem = {
  index: number;
  url: string;
  status: "QUEUED" | "ANALYZING" | "READY" | "DUPLICATE" | "ERROR" | "CREATING" | "CREATED" | "FAILED";
  selected: boolean;
  title?: string;
  supplierReference?: string;
  brandName?: string;
  brandIsNew?: boolean;
  draft?: Record<string, unknown>;
  pricing?: Record<string, unknown>;
  duplicate?: Record<string, unknown>;
  error?: string;
  result?: Record<string, unknown>;
};

export type SupplierBatch = {
  id: string;
  status: string;
  phase: "ANALYSIS" | "REVIEW" | "CREATION" | "COMPLETED" | "CANCELLED";
  total: number;
  analysisProgress: number;
  creationProgress: number;
  items: SupplierBatchItem[];
  report?: { created: number; ignored: number; failed: Array<{ title?: string; url: string; reason: string }> };
};

type Props = { batch: SupplierBatch; onRefresh: () => Promise<void> };
type EditableField = "title" | "sku" | "supplierReference" | "brandName" | "description" | "shortDescription" | "tag" | "supplierPrice" | "price" | "qty" | "images";
const fields: Array<{ key: EditableField; label: string }> = [
  { key: "title", label: "Titre" },
  { key: "sku", label: "SKU" },
  { key: "supplierReference", label: "Référence fournisseur" },
  { key: "brandName", label: "Marque" },
  { key: "description", label: "Description" },
  { key: "shortDescription", label: "Description courte" },
  { key: "tag", label: "Tag" },
  { key: "supplierPrice", label: "Prix fournisseur brut" },
  { key: "price", label: "Prix de vente HT" },
  { key: "qty", label: "Stock initial" },
  { key: "images", label: "Images (une URL par ligne)" },
];

function textValue(value: unknown): string {
  if (Array.isArray(value)) return value.filter((part): part is string => typeof part === "string").join("\n");
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

function statusLabel(status: SupplierBatchItem["status"]) {
  return ({ READY: "Prêt", DUPLICATE: "Doublon", ERROR: "Erreur", QUEUED: "En attente", ANALYZING: "Analyse…", CREATING: "Création…", CREATED: "Créé", FAILED: "Échec" })[status];
}

async function postAction(id: string, action: "confirm" | "cancel" | "retry") {
  const response = await fetch(`/frontend-api/admin/agent/chat/batches/${encodeURIComponent(id)}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }),
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload && typeof payload === "object" && "message" in payload ? String(payload.message) : "L’action sur le lot a échoué.");
}

export function SupplierBatchCard({ batch, onRefresh }: Props) {
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [editedValues, setEditedValues] = useState<Record<number, Record<EditableField, string>>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const selectedCount = useMemo(() => batch.items.filter((item) => item.selected && item.status === "READY").length, [batch.items]);
  const creationTotal = batch.items.filter((item) => item.selected && ["READY", "CREATING", "CREATED", "FAILED"].includes(item.status)).length;
  const running = batch.status === "PROCESSING";
  const review = batch.phase === "REVIEW" && batch.status === "PENDING";
  const failedCount = batch.report?.failed.length ?? batch.items.filter((item) => item.status === "FAILED" || item.status === "ERROR").length;

  async function updateRow(index: number, patch: Record<string, unknown>) {
    setBusy(true); setError("");
    try {
      const draft = patch.draft && typeof patch.draft === "object" ? patch.draft : undefined;
      const response = await fetch(`/frontend-api/admin/agent/chat/batches/${encodeURIComponent(batch.id)}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: [{ index, ...patch, ...(draft ? { draft } : {}) }] }),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload && typeof payload === "object" && "message" in payload ? String(payload.message) : "La ligne n’a pas pu être enregistrée.");
      await onRefresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "La ligne n’a pas pu être enregistrée.");
    } finally { setBusy(false); }
  }

  async function act(action: "confirm" | "cancel" | "retry") {
    setBusy(true); setError("");
    try { await postAction(batch.id, action); await onRefresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "L’action a échoué."); }
    finally { setBusy(false); }
  }

  return (
    <section className="my-3 w-full overflow-hidden rounded-xl border border-blue-200 bg-white shadow-sm" aria-label="Traitement du lot fournisseur">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-blue-50/60 px-4 py-3">
        <div>
          <h3 className="font-semibold text-slate-900">Lot de {batch.total} produits</h3>
          {batch.phase === "ANALYSIS" && <p className="mt-1 text-xs text-slate-600">Analyse {batch.analysisProgress}/{batch.total}</p>}
          {batch.phase === "CREATION" && <p className="mt-1 text-xs text-slate-600">Création {batch.creationProgress}/{creationTotal || batch.total}</p>}
          {batch.phase === "REVIEW" && <p className="mt-1 text-xs text-slate-600">Vérifiez les brouillons avant confirmation.</p>}
        </div>
        {running && <span className="inline-flex items-center gap-2 text-xs font-medium text-[#0858b1]"><LoaderCircle size={15} className="animate-spin" /> Traitement en arrière-plan</span>}
      </header>

      <div className="max-h-[55vh] overflow-auto">
        <table className="w-full min-w-[760px] border-collapse text-left text-xs">
          <thead className="sticky top-0 z-10 bg-slate-50 text-slate-600">
            <tr>{["", "Produit", "Référence fournisseur", "Marque", "Coût net HT", "Prix de vente HT", "Statut", ""].map((head, index) => <th key={`${head}-${index}`} className="border-b border-slate-200 px-3 py-2 font-semibold">{head}</th>)}</tr>
          </thead>
          <tbody>
            {batch.items.map((item) => {
              const valuesForItem = editedValues[item.index] ?? {
                title: textValue(item.draft?.title), sku: textValue(item.draft?.sku), supplierReference: textValue(item.draft?.supplierReference),
                brandName: textValue(item.brandName), description: textValue(item.draft?.description), shortDescription: textValue(item.draft?.shortDescription),
                tag: textValue(item.draft?.tag), supplierPrice: textValue(item.draft?.supplierPrice), price: textValue(item.draft?.price), qty: textValue(item.draft?.qty),
                images: textValue(item.draft?.images),
              };
              return <FragmentRow key={item.index} item={item} values={valuesForItem} editable={review && Boolean(item.draft)} expanded={Boolean(expanded[item.index])}
                onToggle={() => setExpanded((current) => ({ ...current, [item.index]: !current[item.index] }))}
                onSelect={(selected) => void updateRow(item.index, { selected })}
                onChange={(key, value) => setEditedValues((current) => ({ ...current, [item.index]: { ...valuesForItem, [key]: value } }))}
                onSave={() => {
                  const draft: Record<string, unknown> = { ...item.draft };
                  for (const field of fields) {
                    if (field.key === "brandName") continue;
                    if (field.key === "images") draft.images = valuesForItem.images.split(/\r?\n/).map((url) => url.trim()).filter(Boolean);
                    else draft[field.key] = valuesForItem[field.key];
                  }
                  void updateRow(item.index, { draft, brandName: valuesForItem.brandName, selected: item.selected });
                }} />;
            })}
          </tbody>
        </table>
      </div>

        {batch.phase === "COMPLETED" && batch.report && <div className="space-y-2 border-t border-slate-200 bg-slate-50 px-4 py-3 text-sm">
        <p><strong>{batch.report.created}</strong> produit(s) créé(s), <strong>{batch.report.ignored}</strong> doublon(s) ignoré(s), <strong>{batch.report.failed.length}</strong> échec(s).</p>
        {batch.report.failed.map((failure, index) => <p key={`${failure.url}-${index}`} className="text-xs text-red-700">{failure.title || failure.url} — {failure.reason}</p>)}
      </div>}

      {error && <p role="alert" className="border-t border-red-100 bg-red-50 px-4 py-2 text-xs text-red-700">{error}</p>}
      <footer className="flex flex-wrap items-center gap-2 border-t border-slate-200 px-4 py-3">
        {review && <>
          <button type="button" disabled={busy || selectedCount === 0} onClick={() => void act("confirm")} className="inline-flex items-center gap-2 rounded-lg bg-[#0858b1] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"><Check size={14} /> Confirmer les {selectedCount} produits sélectionnés</button>
          <button type="button" disabled={busy} onClick={() => void act("cancel")} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 disabled:opacity-50"><X size={14} /> Annuler</button>
        </>}
        {(batch.status === "PENDING" || batch.status === "COMPLETED") && failedCount > 0 && <button type="button" disabled={busy} onClick={() => void act("retry")} className="inline-flex items-center gap-2 rounded-lg bg-[#0858b1] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"><RotateCw size={14} /> Réessayer les échecs</button>}
        {busy && <LoaderCircle size={16} className="animate-spin text-[#0858b1]" />}
      </footer>
    </section>
  );
}

function FragmentRow({ item, values, editable, expanded, onToggle, onSelect, onChange, onSave }: {
  item: SupplierBatchItem;
  values?: Record<EditableField, string>;
  editable: boolean;
  expanded: boolean;
  onToggle: () => void;
  onSelect: (value: boolean) => void;
  onChange: (key: EditableField, value: string) => void;
  onSave: () => void;
}) {
  const canSelect = editable && item.status === "READY";
  const purchase = item.draft?.buyPriceHT;
  const sale = item.draft?.price;
  return <>
    <tr className="border-b border-slate-100 align-top">
      <td className="px-3 py-3"><input aria-label={`Sélectionner ${item.title || `produit ${item.index + 1}`}`} type="checkbox" checked={item.selected} disabled={!canSelect} onChange={(event) => onSelect(event.target.checked)} /></td>
      <td className="max-w-64 px-3 py-3 font-medium text-slate-900">{item.title || item.url}</td>
      <td className="px-3 py-3 text-slate-700">{item.supplierReference || "—"}</td>
      <td className="px-3 py-3 text-slate-700">{item.brandName || "—"}{item.brandIsNew && <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-800">Nouveau</span>}</td>
      <td className="px-3 py-3 text-slate-700">{textValue(purchase) || "—"}</td>
      <td className="px-3 py-3 text-slate-700">{textValue(sale) || "—"}</td>
      <td className="px-3 py-3"><span className={`whitespace-nowrap rounded-full px-2 py-1 font-medium ${item.status === "READY" ? "bg-emerald-50 text-emerald-700" : item.status === "DUPLICATE" ? "bg-amber-50 text-amber-700" : item.status === "ERROR" || item.status === "FAILED" ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-600"}`}>{statusLabel(item.status)}</span></td>
      <td className="px-3 py-2"><button type="button" aria-label={expanded ? "Masquer le détail" : "Afficher le détail"} onClick={onToggle} className="rounded p-1 text-slate-500 hover:bg-slate-100">{expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</button></td>
    </tr>
    {expanded && <tr className="border-b border-slate-200 bg-slate-50"><td colSpan={8} className="px-4 py-3">
      <div className="mb-2 break-all text-[11px] text-slate-500">{item.url}</div>
      {item.error && <p className="mb-2 text-xs text-red-700">{item.error}</p>}
      {item.duplicate && <p className="mb-2 text-xs text-amber-800">Doublon : {textValue(item.duplicate.reason) || "un produit correspondant existe déjà"}</p>}
      {item.draft && <details className="mb-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
        <summary className="cursor-pointer text-[11px] font-semibold text-slate-700">Voir les attributs, le stock et le brouillon complet</summary>
        <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words text-[10px] leading-4 text-slate-600">{JSON.stringify({ attributes: item.draft.attributeTerms, combinations: item.draft.combinaisons, categories: item.draft.categoryIds, stock: { quantity: item.draft.qty, status: item.draft.stockStatus }, images: item.draft.images }, null, 2)}</pre>
      </details>}
      {values && <div className="grid gap-2 sm:grid-cols-2">
        {fields.map(({ key, label }) => <label key={key} className={`grid gap-1 text-[11px] font-medium text-slate-600 ${key === "description" || key === "shortDescription" || key === "images" ? "sm:col-span-2" : ""}`}>
          {label}{key === "description" || key === "shortDescription" || key === "images" ? <textarea rows={key === "description" ? 4 : 2} disabled={!editable} value={values[key]} onChange={(event) => onChange(key, event.target.value)} className="rounded border border-slate-300 bg-white px-2 py-1.5 text-xs font-normal text-slate-800 disabled:bg-slate-100" /> : <input disabled={!editable} value={values[key]} onChange={(event) => onChange(key, event.target.value)} className="rounded border border-slate-300 bg-white px-2 py-1.5 text-xs font-normal text-slate-800 disabled:bg-slate-100" />}
        </label>)}
      </div>}
      {editable && values && <button type="button" onClick={onSave} className="mt-3 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100">Enregistrer les corrections</button>}
    </td></tr>}
  </>;
}
