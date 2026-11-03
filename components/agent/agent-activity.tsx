"use client";
import { useEffect, useState } from "react";
import { Check, LoaderCircle, X, Clock3 } from "lucide-react";
import Image from "next/image";
import { Globe } from "lucide-react";
import { SiteFavicon, getPublicSiteDomain } from "./site-favicon";

export type AgentEventSource = { url: string; title?: string; domain?: string };
export type AgentEvent = { id: string; phase: string; label: string; status: string; tool?: string; error?: string; confirmation?: Record<string, unknown>; sources?: AgentEventSource[] };
// Les sources sont des données non fiables : http(s) seulement, texte rendu par React.
function safeSources(sources: unknown): { url: string; label: string; faviconDomain: string | null }[] {
  if (!Array.isArray(sources)) return [];
  return sources.slice(0, 5).flatMap(item => {
    const source = record(item);
    if (typeof source.url !== "string") return [];
    try {
      const url = new URL(source.url);
      if (url.protocol !== "http:" && url.protocol !== "https:") return [];
      const label = typeof source.title === "string" && source.title.trim() ? source.title.trim().slice(0, 200) : typeof source.domain === "string" && source.domain ? source.domain : url.hostname;
      return [{ url: url.href, label, faviconDomain: getPublicSiteDomain(url.href) }];
    } catch { return []; }
  });
}
type ConfirmationState = { status: string; result?: unknown; error?: string };
function record(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function text(value: unknown) { return typeof value === "string" ? value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() : value == null ? "—" : JSON.stringify(value); }
const fields: Record<string, string> = { title: "Nom", price: "Prix HT", qty: "Stock", tag: "Tag", description: "Description", shortDescription: "Description courte", images: "Images", metaTitle: "Titre SEO", metaDescription: "Description SEO", metaKeywords: "Mots-clés SEO" };

export function AgentActivity({ events, states, busy, active, onAction }: { events: AgentEvent[]; states: Record<string, ConfirmationState>; busy: boolean; active: boolean; onAction: (id: string, action: "confirm" | "cancel") => void }) {
 const [now, setNow] = useState(Date.now);
 useEffect(() => {
  const timer = window.setInterval(() => setNow(Date.now()), 30_000);
  return () => window.clearInterval(timer);
 }, []);
 const toolEvents = events.filter(event => event.phase === "tool");
 const confirmations = events.filter(event => typeof event.confirmation?.confirmationId === "string");
 if (!toolEvents.length && !confirmations.length) return null;
 const running = active;
 return <div className="w-full space-y-3">
  {toolEvents.length > 0 && <details className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600" open={running}>
   <summary className="cursor-pointer font-medium">{running ? "Vérifications en cours…" : `${toolEvents.length} vérification(s)`}</summary>
   <ol className="mt-2 space-y-2">{toolEvents.map(event => <li key={event.id} className="flex items-start gap-2">
    {event.status === "running" ? <LoaderCircle size={14} className="mt-0.5 shrink-0 animate-spin" /> : event.status === "failed" ? <X size={14} className="mt-0.5 shrink-0 text-red-600" /> : <Check size={14} className="mt-0.5 shrink-0 text-emerald-600" />}
    <span className="min-w-0 flex-1">{event.label}{event.error && <span className="mt-1 block text-red-600">{event.error}</span>}
     {(() => { const sources = safeSources(event.sources); return sources.length > 0 && <ul className="mt-1.5 space-y-1">{sources.map(source => <li key={source.url} className="min-w-0">
      <a href={source.url} target="_blank" rel="noopener noreferrer" title={source.label} className="inline-flex max-w-full items-center gap-1.5 text-[#0858b1] underline">
       {source.faviconDomain ? <SiteFavicon domain={source.faviconDomain} /> : <Globe size={16} className="shrink-0 text-slate-400" aria-hidden="true" />}
       <span className="min-w-0 truncate">{source.label}</span>
      </a>
     </li>)}</ul>; })()}
    </span>
   </li>)}</ol>
  </details>}
  {confirmations.map(event => {
   const c = event.confirmation!; const id = c.confirmationId as string;
   const action = c.action; const update = action === "update_product"; const publish = action === "publish_product";
   const expired = typeof c.expiresAt === "string" && Date.parse(c.expiresAt) <= now;
   const restoredStatus = c.status === "COMPLETED" ? "confirmed" : c.status === "CANCELLED" ? "cancelled" : expired ? "expired" : c.status === "PROCESSING" ? "confirming" : "pending";
   const state = states[id] ?? { status: restoredStatus, result: c.result };
   const done = state.status === "confirmed" || state.status === "cancelled"; const pending = state.status === "confirming" || state.status === "cancelling";
   const product = record(c.product); const drafts = Array.isArray(c.productDrafts) ? c.productDrafts.map(record) : c.productDraft ? [record(c.productDraft)] : [];
   const result = record(state.result); const results = Array.isArray(result.createdProducts) ? result.createdProducts.map(record) : result.id ? [result] : [];
   return <section key={id} className="space-y-3 rounded-xl border border-blue-200 bg-white p-3 text-xs text-slate-700" aria-label="Confirmation de l’opération">
    <h4 className="font-semibold text-slate-900">{state.status === "confirmed" ? update ? "Produit modifié" : publish ? "Produit publié" : "Création confirmée" : state.status === "cancelled" ? "Opération annulée" : update ? "Confirmer les modifications" : publish ? "Confirmer la publication" : `Confirmer ${drafts.length > 1 ? `le lot de ${drafts.length} produits` : "le brouillon"}`}</h4>
    {typeof product.title === "string" && <p className="font-medium">{product.title}{typeof product.sku === "string" ? ` — ${product.sku}` : ""}</p>}
    {typeof c.message === "string" && <p>{c.message}</p>}
    {Array.isArray(c.diff) && <div className="max-h-64 overflow-auto"><table className="w-full text-left"><thead><tr><th className="p-1">Champ</th><th className="p-1">Avant</th><th className="p-1">Après</th></tr></thead><tbody>{c.diff.map((item, index) => { const diff = record(item); return <tr key={index} className="border-t"><th className="p-1 align-top">{fields[String(diff.field)] ?? String(diff.field)}</th><td className="max-w-32 break-words p-1 align-top">{text(diff.before)}</td><td className="max-w-32 break-words p-1 align-top">{text(diff.after)}</td></tr>; })}</tbody></table></div>}
    {drafts.map((draft, index) => <details key={index} open={drafts.length === 1} className="rounded-lg bg-slate-50 p-2"><summary className="cursor-pointer font-medium">{text(draft.title)} — {text(draft.sku)}</summary>
     <p className="mt-2">Prix HT : {text(draft.price)} € · Stock : {text(draft.qty)} · Tag : {text(draft.tag)}</p>
     {Array.isArray(draft.images) && typeof draft.images[0] === "string" && <Image src={draft.images[0]} alt={text(draft.title)} width={160} height={120} unoptimized className="mt-2 max-h-28 w-auto rounded object-contain" />}
     <p className="mt-2 font-medium">Description courte</p><p>{text(draft.shortDescription)}</p><p className="mt-2 font-medium">Description</p><p className="max-h-40 overflow-auto">{text(draft.description)}</p>
    </details>)}
    {results.map((item, index) => <div key={index} className="rounded-lg bg-emerald-50 p-2 text-emerald-900"><p className="font-medium">{text(item.title)}</p><p>{item.outcome === "ALREADY_EXISTS" ? "Déjà présent — création ignorée" : "Opération enregistrée"} · Référence : {text(item.sku)} · Statut : {text(item.status)}</p></div>)}
    {state.error && <p role="alert" className="text-red-700">{state.error}</p>}
    {state.status === "expired" && <p className="text-amber-700">Confirmation expirée. Demandez à l’agent de reprendre les données enregistrées.</p>}
    {pending && <p className="flex items-center gap-2"><Clock3 size={14} />Opération en cours…</p>}
    {!done && !pending && state.status !== "expired" && <div className="flex gap-2"><button type="button" disabled={busy} onClick={() => onAction(id, "confirm")} className="rounded-lg bg-[#0858b1] px-3 py-2 font-medium text-white disabled:opacity-50">{update ? "Confirmer les modifications" : publish ? "Confirmer la publication" : "Confirmer le lot"}</button><button type="button" disabled={busy} onClick={() => onAction(id, "cancel")} className="rounded-lg border px-3 py-2 disabled:opacity-50">Annuler</button></div>}
   </section>;
  })}
 </div>;
}
