"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Button, useFrame } from "@shopify/polaris";
import "./gls-module.css";

type Environment = "sandbox" | "live";
type AuthMode = "SHIPIT" | "PORTAL";
type Server = "" | "fr01" | "fr02";
type EnvView = { authMode: AuthMode; server: Server; baseUrl: string; defaultBaseUrl: string; login: string; contactId: string; agencyCode: string; clientId: string; passwordSet: boolean; clientSecretSet: boolean; ready: boolean };
type Config = { mode: Environment; configured: boolean; sandbox: EnvView; live: EnvView };
type Draft = { authMode: AuthMode; server: Server; baseUrl: string; login: string; password: string; contactId: string; agencyCode: string; clientId: string; clientSecret: string };
type Drafts = Record<Environment, Draft>;
type Result = { ok: boolean; message: string };

const emptyView: EnvView = { authMode: "SHIPIT", server: "", baseUrl: "", defaultBaseUrl: "", login: "", contactId: "", agencyCode: "", clientId: "", passwordSet: false, clientSecretSet: false, ready: false };
const emptyDraft: Draft = { authMode: "SHIPIT", server: "", baseUrl: "", login: "", password: "", contactId: "", agencyCode: "", clientId: "", clientSecret: "" };

const COPY: Record<Environment, { title: string; text: string }> = {
  sandbox: { title: "Test", text: "Pour essayer sans risque : « Valider un envoi test » ne crée aucune étiquette." },
  live: { title: "Production", text: "Pour expédier de vrais colis : GLS facture chaque étiquette créée." },
};

const SERVER_NAMES: Record<string, string> = { fr01: "Serveur 1 (fr01)", fr02: "Serveur 2 (fr02)" };

function toDraft(view: EnvView): Draft {
  return { authMode: view.authMode, server: view.server, baseUrl: view.baseUrl, login: view.login, password: "", contactId: view.contactId, agencyCode: view.agencyCode, clientId: view.clientId, clientSecret: "" };
}

function contactIdError(value: string) {
  if (!value) return "";
  return /^[A-Za-z0-9]{1,20}$/.test(value) ? "" : "Lettres et chiffres uniquement, 20 caractères au plus.";
}

export default function GlsConfigForm() {
  const { showToast, hideToast } = useFrame();
  const toastCount = useRef(0);
  const [config, setConfig] = useState<Config | null>(null);
  const [mode, setMode] = useState<Environment>("sandbox");
  const [drafts, setDrafts] = useState<Drafts>({ sandbox: emptyDraft, live: emptyDraft });
  const [liveAsked, setLiveAsked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<"" | "connection" | "validate">("");
  const [results, setResults] = useState<Partial<Record<Environment, Result>>>({});
  const [loadError, setLoadError] = useState("");

  const toast = useCallback((content: string, error = false) => {
    const id = `gls-${Date.now()}-${++toastCount.current}`;
    showToast({ id, content, error, duration: 6000, onDismiss: () => hideToast({ id }) });
  }, [hideToast, showToast]);

  const apply = useCallback((data: Config) => {
    const normalized = { ...data, sandbox: { ...emptyView, ...data.sandbox }, live: { ...emptyView, ...data.live } };
    setConfig(normalized);
    setMode(data.mode);
    setDrafts({ sandbox: toDraft(normalized.sandbox), live: toDraft(normalized.live) });
    setLiveAsked(false);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const response = await fetch("/frontend-api/admin/gls-integration", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Impossible de charger la configuration GLS.");
        apply(data);
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : "Chargement impossible.");
      }
    })();
  }, [apply]);

  function setField<K extends keyof Draft>(env: Environment, field: K, value: Draft[K]) {
    const keep = field === "password" || field === "clientSecret";
    setDrafts((old) => ({ ...old, [env]: { ...old[env], [field]: keep || typeof value !== "string" ? value : (value.trim() as Draft[K]) } }));
  }

  async function save(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (!config) return;
    for (const env of ["sandbox", "live"] as const) {
      if (contactIdError(drafts[env].contactId)) {
        toast(`Corrigez le Contact ID de l’environnement ${COPY[env].title} avant d’enregistrer.`, true);
        return;
      }
    }
    setSaving(true);
    try {
      const response = await fetch("/frontend-api/admin/gls-integration", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, sandbox: drafts.sandbox, live: drafts.live }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(Array.isArray(data.message) ? data.message.join(" ") : data.message || "Enregistrement impossible.");
      apply(data);
      setResults({});
      toast(`Configuration enregistrée. GLS utilise l’environnement ${COPY[data.mode as Environment].title}.`);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Enregistrement impossible.", true);
    } finally {
      setSaving(false);
    }
  }

  async function check(kind: "connection" | "validate") {
    const env = mode;
    setTesting(kind);
    try {
      const response = await fetch(`/frontend-api/admin/gls-integration/${kind === "connection" ? "test" : "validate"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ environment: env }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(Array.isArray(data.message) ? data.message.join(" ") : data.message || "Vérification impossible.");
      if (kind === "validate") {
        setResults((old) => ({
          ...old,
          [env]: data.ok
            ? { ok: true, message: "GLS a validé un envoi d’essai : le compte, le Contact ID et le format des envois sont acceptés. Aucune étiquette n’a été créée." }
            : { ok: false, message: `GLS signale : ${(data.issues as string[]).join(" ; ") || "envoi refusé"}` },
        }));
      } else {
        setResults((old) => ({ ...old, [env]: { ok: true, message: `GLS a accepté la connexion${data.server ? ` (${SERVER_NAMES[data.server] ?? data.server}, retenu automatiquement)` : ""} : l’accès ShipIT est valide.` } }));
        if (data.server) {
          const refreshed = await fetch("/frontend-api/admin/gls-integration", { cache: "no-store" });
          if (refreshed.ok) apply(await refreshed.json());
        }
      }
    } catch (error) {
      setResults((old) => ({ ...old, [env]: { ok: false, message: error instanceof Error ? error.message : "Vérification impossible." } }));
    } finally {
      setTesting("");
    }
  }

  if (loadError) return <div className="gls-result" data-tone="error" role="alert">{loadError}</div>;
  if (!config) return <div className="gls-skeleton" aria-busy="true" aria-label="Chargement de la configuration GLS" />;

  const saved = config[config.mode];
  const draft = drafts[mode];
  const view = config[mode];
  const idError = contactIdError(draft.contactId);
  const result = results[mode];

  const envDirty = (env: Environment) => {
    const d = drafts[env];
    const s = config[env];
    return Boolean(d.password) || Boolean(d.clientSecret) || d.authMode !== s.authMode || d.server !== s.server || d.clientId !== s.clientId || d.baseUrl !== s.baseUrl || d.login !== s.login || d.contactId !== s.contactId || d.agencyCode !== s.agencyCode;
  };
  const dirty = envDirty("sandbox") || envDirty("live") || mode !== config.mode;
  const switchingToLive = mode === "live" && config.mode !== "live";
  const needsLiveStep = switchingToLive && !liveAsked;
  const checkDisabled = !view.ready || Boolean(testing) || envDirty(mode);

  const serverLine = saved.authMode === "PORTAL" ? "Passerelle ShipIT-Farm" : saved.server ? SERVER_NAMES[saved.server] : "Trouvé au premier test";

  return (
    <form onSubmit={save} noValidate className="gls-form">
      <section className="gls-label" aria-labelledby="gls-label-title">
        <div className="gls-label-spine" aria-hidden="true" />
        <div className="gls-label-body">
          <div className="gls-label-top">
            <div className="gls-label-state">
              <h2 id="gls-label-title">Connexion GLS</h2>
              <span className="gls-pill" data-tone={config.configured ? "ok" : "wait"}>{config.configured ? "Prête" : "À compléter"}</span>
            </div>
            <span className="gls-pill" data-tone={config.mode === "live" ? "live" : "test"}>La boutique utilise : {COPY[config.mode].title}</span>
          </div>
          <dl className="gls-facts">
            <div><dt>Connexion</dt><dd>{saved.authMode === "PORTAL" ? "Clé du portail GLS" : "Identifiant ShipIT"}</dd></div>
            <div><dt>Serveur</dt><dd>{serverLine}</dd></div>
            <div><dt>Compte expéditeur</dt><dd className="is-mono">{saved.contactId || "—"}</dd></div>
            <div><dt>Identifiant</dt><dd className="is-mono">{(saved.authMode === "PORTAL" ? saved.clientId : saved.login) || "—"}</dd></div>
          </dl>
          <div className="gls-barcode" aria-hidden="true" />
        </div>
      </section>

      <fieldset className="gls-section">
        <legend>Environnement utilisé par la boutique</legend>
        <p className="gls-section-lead">Les réglages des deux environnements restent enregistrés : vous pouvez passer de l’un à l’autre à tout moment.</p>
        <div className="gls-choices">
          {(["sandbox", "live"] as const).map((env) => (
            <label key={env} className="gls-choice" data-env={env}>
              <input type="radio" name="gls-mode" value={env} checked={mode === env} onChange={() => setMode(env)} />
              <span className="gls-choice-card">
                <strong>{COPY[env].title}</strong>
                <span>{COPY[env].text}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="gls-section">
        <legend>Connexion à GLS</legend>
        <p className="gls-section-lead">Réglages de l’environnement <strong>{COPY[mode].title}</strong>.</p>
        <div className="gls-choices">
          {([
            { value: "SHIPIT", title: "Identifiant ShipIT", text: "Le même identifiant et mot de passe Web API que dans le module GLS de PrestaShop. À utiliser si votre module PrestaShop fonctionne." },
            { value: "PORTAL", title: "Clé du portail GLS", text: "Une application du portail développeurs GLS (ShipIT-Farm). GLS doit avoir activé l’API pour votre compte." },
          ] as const).map((method) => (
            <label key={method.value} className="gls-choice">
              <input type="radio" name={`gls-${mode}-method`} value={method.value} checked={draft.authMode === method.value} onChange={() => setField(mode, "authMode", method.value)} />
              <span className="gls-choice-card">
                <strong>{method.title}</strong>
                <span>{method.text}</span>
              </span>
            </label>
          ))}
        </div>

        {draft.authMode === "SHIPIT" ? (
          <>
            <div className="gls-field-row">
              <div className="gls-field">
                <label htmlFor="gls-login">Identifiant Web API</label>
                <input id="gls-login" value={draft.login} onChange={(e) => setField(mode, "login", e.target.value)} autoComplete="off" spellCheck={false} />
              </div>
              <div className="gls-field">
                <label htmlFor="gls-password">Mot de passe Web API</label>
                <input id="gls-password" type="password" value={draft.password} onChange={(e) => setField(mode, "password", e.target.value)} placeholder={view.passwordSet ? "Mot de passe enregistré" : ""} autoComplete="new-password" spellCheck={false} />
              </div>
            </div>
            <div className="gls-field">
              <label htmlFor="gls-server">Serveur GLS France</label>
              <select id="gls-server" value={draft.server} onChange={(e) => setField(mode, "server", e.target.value as Server)} aria-describedby="gls-server-help">
                <option value="">Automatique (recommandé)</option>
                <option value="fr01">Serveur 1 (fr01)</option>
                <option value="fr02">Serveur 2 (fr02)</option>
              </select>
              <small id="gls-server-help">Chaque compte est sur l’un des deux serveurs. En automatique, le bon est trouvé au premier test puis retenu, comme le fait le module PrestaShop.</small>
            </div>
          </>
        ) : (
          <div className="gls-field-row">
            <div className="gls-field">
              <label htmlFor="gls-client">Clé de l’application</label>
              <input id="gls-client" value={draft.clientId} onChange={(e) => setField(mode, "clientId", e.target.value)} autoComplete="off" spellCheck={false} />
            </div>
            <div className="gls-field">
              <label htmlFor="gls-secret">Secret de l’application</label>
              <input id="gls-secret" type="password" value={draft.clientSecret} onChange={(e) => setField(mode, "clientSecret", e.target.value)} placeholder={view.clientSecretSet ? "Secret enregistré" : ""} autoComplete="new-password" spellCheck={false} />
            </div>
          </div>
        )}
        {view.passwordSet || view.clientSecretSet ? <p className="gls-kept">Laissez le mot de passe ou le secret vide pour garder celui qui est enregistré. Ils sont chiffrés et jamais réaffichés.</p> : null}
      </fieldset>

      <fieldset className="gls-section">
        <legend>Compte expéditeur</legend>
        <div className="gls-field-row">
          <div className={`gls-field${idError ? " has-error" : ""}`}>
            <label htmlFor="gls-contact">Contact ID</label>
            <input id="gls-contact" value={draft.contactId} onChange={(e) => setField(mode, "contactId", e.target.value)} autoComplete="off" spellCheck={false} aria-invalid={Boolean(idError)} aria-describedby="gls-contact-help" />
            <small id="gls-contact-help">{idError || "Identifie votre compte expéditeur sur chaque étiquette."}</small>
          </div>
          <div className="gls-field">
            <label htmlFor="gls-agency">Code agence (facultatif)</label>
            <input id="gls-agency" value={draft.agencyCode} onChange={(e) => setField(mode, "agencyCode", e.target.value)} autoComplete="off" spellCheck={false} aria-describedby="gls-agency-help" />
            <small id="gls-agency-help">Conservé pour référence. Il n’est pas envoyé à GLS.</small>
          </div>
        </div>
      </fieldset>

      <section className="gls-checks" aria-labelledby="gls-checks-title">
        <h3 id="gls-checks-title" className="gls-section-title">Vérifier la connexion</h3>
        <div className="gls-check-list">
          <div className="gls-check">
            <Button onClick={() => void check("connection")} loading={testing === "connection"} disabled={checkDisabled}>Tester la connexion</Button>
            <p>Vérifie l’identifiant et trouve le serveur de votre compte.</p>
          </div>
          <div className="gls-check">
            <Button onClick={() => void check("validate")} loading={testing === "validate"} disabled={checkDisabled}>Valider un envoi test</Button>
            <p>GLS contrôle un envoi d’essai. Aucune étiquette n’est créée et rien n’est facturé.</p>
          </div>
        </div>
        {envDirty(mode) && view.ready ? <p className="gls-hint">Enregistrez vos modifications pour pouvoir vérifier.</p> : null}
        {!view.ready ? <p className="gls-hint">Renseignez l’identifiant, le mot de passe et le Contact ID, puis enregistrez pour pouvoir vérifier.</p> : null}
        {result ? <div className="gls-result" data-tone={result.ok ? "ok" : "error"} role={result.ok ? "status" : "alert"}>{result.message}</div> : null}
      </section>

      {switchingToLive && liveAsked ? (
        <div className="gls-live-warning" role="alert">
          <strong>Passer en production.</strong> Chaque étiquette créée sera facturée par GLS et correspond à un vrai colis. Confirmez pour activer l’environnement de production.
        </div>
      ) : null}

      <div className="gls-savebar">
        {needsLiveStep ? (
          <Button variant="primary" onClick={() => setLiveAsked(true)}>Passer en production…</Button>
        ) : (
          <Button variant="primary" submit loading={saving} disabled={!dirty}>
            {switchingToLive ? "Confirmer et activer la production" : "Enregistrer"}
          </Button>
        )}
        <p data-dirty={dirty}>{dirty ? "Des modifications ne sont pas enregistrées." : `Environnement actuel : ${COPY[config.mode].title}.`}</p>
      </div>
    </form>
  );
}
