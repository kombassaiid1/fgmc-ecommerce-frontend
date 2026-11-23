"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { Banner, Button, Select, SkeletonBodyText, TextField } from "@shopify/polaris";
import { ChevronDown, ChevronRight, RefreshCw } from "lucide-react";

import "../settings/site/site-settings.css";
import "./journal.css";

type Entry = {
  id: string;
  createdAt: string;
  userId: string | null;
  userEmail: string | null;
  userName: string | null;
  userRole: string | null;
  action: string;
  actionLabel: string;
  module: string;
  moduleLabel: string;
  summary: string;
  method: string;
  path: string;
  entityId: string | null;
  statusCode: number;
  success: boolean;
  durationMs: number;
  ip: string | null;
  userAgent: string | null;
  details: { body?: unknown; query?: unknown; impersonation?: boolean } | null;
};
type Page = { items: Entry[]; total: number; page: number; limit: number; pages: number };
type Filters = { users: { id: string; label: string }[]; modules: { key: string; label: string }[]; actions: { key: string; label: string }[]; last24h: number };
type Query = { search: string; userId: string; module: string; action: string; status: string; from: string; to: string };

const EMPTY: Query = { search: "", userId: "", module: "", action: "", status: "", from: "", to: "" };
const LIMIT = 50;

async function get<T>(path: string): Promise<T> {
  const response = await fetch(`/frontend-api/admin/activity-log${path}`, { cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(Array.isArray(data.message) ? data.message.join(" ") : data.message || "Chargement impossible.");
  return data as T;
}

const dateTime = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });
const who = (entry: Entry) => entry.userName || entry.userEmail || "Inconnu";

/** The browser and system of a user agent, in a few words. */
function deviceOf(agent: string | null) {
  if (!agent) return "—";
  const browser = /Edg\//.test(agent) ? "Edge" : /OPR\//.test(agent) ? "Opera" : /Chrome\//.test(agent) ? "Chrome" : /Firefox\//.test(agent) ? "Firefox" : /Safari\//.test(agent) ? "Safari" : "Navigateur";
  const system = /Windows/.test(agent) ? "Windows" : /Android/.test(agent) ? "Android" : /iPhone|iPad/.test(agent) ? "iOS" : /Mac OS/.test(agent) ? "macOS" : /Linux/.test(agent) ? "Linux" : "";
  return system ? `${browser} · ${system}` : browser;
}

/** Journal d'activité: every change made in the back office, who made it, when and from where. */
export default function JournalPage() {
  const [filters, setFilters] = useState<Filters | null>(null);
  const [query, setQuery] = useState<Query>(EMPTY);
  const [applied, setApplied] = useState<Query>(EMPTY);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Page | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<string | null>(null);
  const request = useRef(0);

  useEffect(() => {
    get<Filters>("/filters").then(setFilters).catch(() => undefined);
  }, []);

  const load = useCallback(() => {
    const id = ++request.current;
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
    for (const [key, value] of Object.entries(applied)) {
      if (!value) continue;
      // The dates are whole days: from the start of the first to the end of the last.
      params.set(key, key === "from" ? new Date(`${value}T00:00:00`).toISOString() : key === "to" ? new Date(`${value}T23:59:59.999`).toISOString() : value);
    }
    get<Page>(`?${params}`)
      .then((result) => {
        if (id !== request.current) return;
        setData(result);
        setError("");
      })
      .catch((e: unknown) => {
        if (id === request.current) setError(e instanceof Error ? e.message : "Chargement impossible.");
      })
      .finally(() => {
        if (id === request.current) setLoading(false);
      });
  }, [applied, page]);
  useEffect(load, [load]);

  // The search waits for a pause in typing; the other filters apply at once.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setApplied(query);
      setPage(1);
    }, query.search !== applied.search ? 350 : 0);
    return () => window.clearTimeout(timer);
  }, [query]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = <K extends keyof Query>(key: K) => (value: string) => setQuery((old) => ({ ...old, [key]: value }));
  const filtered = Object.values(query).some(Boolean);

  return (
    <div className="ss-page jr-page">
      <div className="ss-hero">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="ss-title">Journal d’activité</h1>
            <p className="ss-lead">Toutes les actions faites dans l’administration : qui, quoi, quand et depuis où. Les consultations de pages ne sont pas enregistrées.</p>
          </div>
          <div className="flex items-center gap-3">
            {filters ? <span className="jr-chip">{filters.last24h} action{filters.last24h > 1 ? "s" : ""} sur 24 h</span> : null}
            <Button icon={<RefreshCw className="size-4" aria-hidden="true" />} onClick={load} loading={loading && Boolean(data)}>Actualiser</Button>
          </div>
        </div>
      </div>

      <section className="ss-card mt-6" aria-label="Filtres">
        <div className="ss-card-body jr-filters">
          <TextField label="Rechercher" autoComplete="off" value={query.search} onChange={set("search")} placeholder="Description, e-mail, adresse IP, n°…" clearButton onClearButtonClick={() => set("search")("")} />
          <Select label="Personne" value={query.userId} onChange={set("userId")} options={[{ label: "Tout le monde", value: "" }, ...(filters?.users ?? []).map((user) => ({ label: user.label, value: user.id }))]} />
          <Select label="Section" value={query.module} onChange={set("module")} options={[{ label: "Toutes", value: "" }, ...(filters?.modules ?? []).map((module) => ({ label: module.label, value: module.key }))]} />
          <Select label="Type d’action" value={query.action} onChange={set("action")} options={[{ label: "Tous", value: "" }, ...(filters?.actions ?? []).map((action) => ({ label: action.label, value: action.key }))]} />
          <Select label="Résultat" value={query.status} onChange={set("status")} options={[{ label: "Tous", value: "" }, { label: "Réussi", value: "success" }, { label: "Échoué", value: "failure" }]} />
          <TextField label="Du" type="date" autoComplete="off" value={query.from} onChange={set("from")} max={query.to || undefined} />
          <TextField label="Au" type="date" autoComplete="off" value={query.to} onChange={set("to")} min={query.from || undefined} />
          <div className="jr-reset"><Button disabled={!filtered} onClick={() => setQuery(EMPTY)}>Effacer les filtres</Button></div>
        </div>
      </section>

      {error ? <div className="mt-4"><Banner tone="critical" title={error} /></div> : null}

      <section className="ss-card mt-4" aria-label="Actions enregistrées">
        {!data ? (
          <div className="ss-card-body"><SkeletonBodyText lines={8} /></div>
        ) : data.items.length === 0 ? (
          <div className="ss-card-body jr-empty">{filtered ? "Aucune action ne correspond à ces filtres." : "Aucune action enregistrée pour l’instant. Elles apparaîtront ici dès qu’un membre de l’équipe modifiera quelque chose."}</div>
        ) : (
          <div className="jr-scroll" data-busy={loading}>
            <table className="jr-table">
              <thead>
                <tr><th aria-label="Détails" /><th>Date</th><th>Qui</th><th>Action</th><th>Description</th><th>Section</th><th>Adresse IP</th><th>Résultat</th></tr>
              </thead>
              <tbody>
                {data.items.map((entry) => {
                  const expanded = open === entry.id;
                  return (
                    <Fragment key={entry.id}>
                      <tr className="jr-row" data-open={expanded || undefined} onClick={() => setOpen(expanded ? null : entry.id)}>
                        <td>
                          <button type="button" className="jr-toggle" aria-expanded={expanded} aria-label={expanded ? "Masquer le détail" : "Voir le détail"} onClick={(event) => { event.stopPropagation(); setOpen(expanded ? null : entry.id); }}>
                            {expanded ? <ChevronDown className="size-4" aria-hidden="true" /> : <ChevronRight className="size-4" aria-hidden="true" />}
                          </button>
                        </td>
                        <td className="jr-nowrap">{dateTime.format(new Date(entry.createdAt))}</td>
                        <td>
                          <div className="jr-who">{who(entry)}</div>
                          {entry.userName && entry.userEmail ? <div className="jr-sub">{entry.userEmail}</div> : null}
                        </td>
                        <td><span className="jr-badge" data-action={entry.action}>{entry.actionLabel}</span></td>
                        <td className="jr-summary">{entry.summary}</td>
                        <td className="jr-nowrap">{entry.moduleLabel}</td>
                        <td className="jr-nowrap jr-mono">{entry.ip ?? "—"}</td>
                        <td><span className="jr-result" data-ok={entry.success}>{entry.success ? "Réussi" : `Échec ${entry.statusCode}`}</span></td>
                      </tr>
                      {expanded ? (
                        <tr className="jr-detail-row">
                          <td />
                          <td colSpan={7}>
                            <dl className="jr-detail">
                              <div><dt>Requête</dt><dd className="jr-mono">{entry.method} {entry.path}</dd></div>
                              <div><dt>Code de réponse</dt><dd>{entry.statusCode} · {entry.durationMs} ms</dd></div>
                              {entry.entityId ? <div><dt>Élément concerné</dt><dd className="jr-mono">{entry.entityId}</dd></div> : null}
                              <div><dt>Appareil</dt><dd title={entry.userAgent ?? undefined}>{deviceOf(entry.userAgent)}</dd></div>
                              {entry.userRole ? <div><dt>Rôle</dt><dd>{entry.userRole === "ADMIN" ? "Administrateur" : "Gestionnaire"}</dd></div> : null}
                              {entry.details?.impersonation ? <div><dt>Note</dt><dd>Action faite en se connectant en tant que client.</dd></div> : null}
                            </dl>
                            {entry.details?.body && Object.keys(entry.details.body as object).length ? (
                              <>
                                <p className="jr-detail-title">Données envoyées <span>(mots de passe et clés masqués)</span></p>
                                <pre className="jr-json">{JSON.stringify(entry.details.body, null, 2)}</pre>
                              </>
                            ) : null}
                            {entry.details?.query && Object.keys(entry.details.query as object).length ? (
                              <>
                                <p className="jr-detail-title">Paramètres de l’adresse</p>
                                <pre className="jr-json">{JSON.stringify(entry.details.query, null, 2)}</pre>
                              </>
                            ) : null}
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {data && data.total > 0 ? (
          <div className="jr-pager">
            <span>{(data.page - 1) * data.limit + 1}–{Math.min(data.page * data.limit, data.total)} sur {data.total}</span>
            <div className="flex gap-2">
              <Button disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)}>Précédent</Button>
              <Button disabled={page >= data.pages || loading} onClick={() => setPage((value) => value + 1)}>Suivant</Button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
