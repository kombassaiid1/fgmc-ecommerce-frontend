"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Button, useFrame } from "@shopify/polaris";
import "./gls-module.css";

type Environment = "sandbox" | "live";
type EnvView = { baseUrl: string; login: string; contactId: string; agencyCode: string; passwordSet: boolean; ready: boolean };
type Config = { mode: Environment; configured: boolean; sandbox: EnvView; live: EnvView };
type Draft = { baseUrl: string; login: string; password: string; contactId: string; agencyCode: string };
type Drafts = Record<Environment, Draft>;

const emptyView: EnvView = { baseUrl: "", login: "", contactId: "", agencyCode: "", passwordSet: false, ready: false };
const emptyDraft: Draft = { baseUrl: "", login: "", password: "", contactId: "", agencyCode: "" };

const copy: Record<Environment, { title: string; text: string }> = {
  sandbox: {
    title: "Test",
    text: "Pour essayer la création d’étiquettes avec les identifiants de test que GLS vous a remis.",
  },
  live: {
    title: "Production",
    text: "Pour expédier de vrais colis : GLS facture chaque étiquette créée.",
  },
};

function toDraft(view: EnvView): Draft {
  return { baseUrl: view.baseUrl, login: view.login, password: "", contactId: view.contactId, agencyCode: view.agencyCode };
}

function errorFor(field: "baseUrl" | "contactId", value: string) {
  if (!value) return "";
  if (field === "baseUrl") {
    return /^https:\/\/[^\s/]+/i.test(value) || /^http:\/\/(localhost|127\.0\.0\.1)/i.test(value)
      ? ""
      : "L’adresse doit commencer par https://";
  }
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
  const [testing, setTesting] = useState<Environment | "">("");
  const [results, setResults] = useState<Partial<Record<Environment, { ok: boolean; message: string }>>>({});
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

  function setField(env: Environment, field: keyof Draft, value: string) {
    setDrafts((old) => ({ ...old, [env]: { ...old[env], [field]: field === "password" ? value : value.trim() } }));
  }

  async function save(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (!config) return;
    for (const env of ["sandbox", "live"] as const) {
      if (errorFor("baseUrl", drafts[env].baseUrl) || errorFor("contactId", drafts[env].contactId)) {
        toast(`Corrigez les champs de l’environnement ${copy[env].title} avant d’enregistrer.`, true);
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
      toast(`Configuration enregistrée. GLS utilise l’environnement ${copy[data.mode as Environment].title}.`);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Enregistrement impossible.", true);
    } finally {
      setSaving(false);
    }
  }

  async function test(env: Environment) {
    setTesting(env);
    try {
      const response = await fetch("/frontend-api/admin/gls-integration/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ environment: env }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(Array.isArray(data.message) ? data.message.join(" ") : data.message || "Connexion impossible.");
      setResults((old) => ({ ...old, [env]: { ok: true, message: "GLS a accepté la connexion : l’adresse du serveur, l’identifiant et le mot de passe sont valides." } }));
    } catch (error) {
      setResults((old) => ({ ...old, [env]: { ok: false, message: error instanceof Error ? error.message : "Connexion impossible." } }));
    } finally {
      setTesting("");
    }
  }

  if (loadError) return <div className="gls-result" data-tone="error" role="alert">{loadError}</div>;
  if (!config) return <div className="gls-skeleton" aria-busy="true" aria-label="Chargement de la configuration GLS" />;

  const envDirty = (env: Environment) => {
    const draft = drafts[env];
    const saved = config[env];
    return Boolean(draft.password) || draft.baseUrl !== saved.baseUrl || draft.login !== saved.login || draft.contactId !== saved.contactId || draft.agencyCode !== saved.agencyCode;
  };
  const dirty = envDirty("sandbox") || envDirty("live") || mode !== config.mode;
  const switchingToLive = mode === "live" && config.mode !== "live";
  const needsLiveStep = switchingToLive && !liveAsked;

  return (
    <form onSubmit={save} noValidate>
      <p className="gls-intro">
        GLS fournit un accès pour vos essais et un accès pour la production. <strong>Choisissez celui que la boutique utilise</strong> : les deux restent enregistrés, vous pouvez basculer à tout moment.
      </p>

      <fieldset className="gls-envs">
        <legend className="visually-hidden">Environnement GLS actif</legend>
        {(["sandbox", "live"] as const).map((env) => {
          const view = config[env];
          const draft = drafts[env];
          const urlError = errorFor("baseUrl", draft.baseUrl);
          const idError = errorFor("contactId", draft.contactId);
          const result = results[env];
          const active = mode === env;
          return (
            <section key={env} className={`gls-env${active ? " is-active" : ""}`} data-env={env} aria-labelledby={`gls-${env}-title`}>
              <div className="gls-env-edge" aria-hidden="true" />
              <div className="gls-env-body">
                <div className="gls-env-top">
                  <div>
                    <h2 id={`gls-${env}-title`}>{copy[env].title}</h2>
                    <p>{copy[env].text}</p>
                  </div>
                  <button type="button" className="gls-choose" aria-pressed={active} onClick={() => setMode(env)}>
                    {active ? "Environnement actif" : "Utiliser celui-ci"}
                  </button>
                </div>

                <div className={`gls-field${urlError ? " has-error" : ""}`}>
                  <label htmlFor={`gls-${env}-url`}>Serveur GLS</label>
                  <input id={`gls-${env}-url`} value={draft.baseUrl} onChange={(e) => setField(env, "baseUrl", e.target.value)} placeholder="https://…" autoComplete="off" spellCheck={false} aria-invalid={Boolean(urlError)} aria-describedby={`gls-${env}-url-help`} />
                  <small id={`gls-${env}-url-help`}>{urlError || "L’adresse du serveur ShipIT que GLS vous a communiquée avec vos identifiants."}</small>
                </div>

                <div className="gls-field-row">
                  <div className="gls-field">
                    <label htmlFor={`gls-${env}-login`}>Identifiant Web API</label>
                    <input id={`gls-${env}-login`} value={draft.login} onChange={(e) => setField(env, "login", e.target.value)} autoComplete="off" spellCheck={false} />
                  </div>
                  <div className="gls-field">
                    <label htmlFor={`gls-${env}-password`}>Mot de passe Web API</label>
                    <input id={`gls-${env}-password`} type="password" value={draft.password} onChange={(e) => setField(env, "password", e.target.value)} placeholder={view.passwordSet ? "Mot de passe enregistré" : ""} autoComplete="new-password" spellCheck={false} />
                  </div>
                </div>

                <div className="gls-field-row">
                  <div className={`gls-field${idError ? " has-error" : ""}`}>
                    <label htmlFor={`gls-${env}-contact`}>Contact ID</label>
                    <input id={`gls-${env}-contact`} value={draft.contactId} onChange={(e) => setField(env, "contactId", e.target.value)} autoComplete="off" spellCheck={false} aria-invalid={Boolean(idError)} aria-describedby={`gls-${env}-contact-help`} />
                    <small id={`gls-${env}-contact-help`}>{idError || "Identifie votre compte expéditeur sur chaque étiquette."}</small>
                  </div>
                  <div className="gls-field">
                    <label htmlFor={`gls-${env}-agency`}>Code agence (facultatif)</label>
                    <input id={`gls-${env}-agency`} value={draft.agencyCode} onChange={(e) => setField(env, "agencyCode", e.target.value)} autoComplete="off" spellCheck={false} aria-describedby={`gls-${env}-agency-help`} />
                    <small id={`gls-${env}-agency-help`}>Conservé pour référence. Il n’est pas envoyé à GLS.</small>
                  </div>
                </div>
                {view.passwordSet ? <small className="gls-field" style={{ color: "var(--gls-muted)" }}>Laissez le mot de passe vide pour garder celui qui est enregistré. Il est chiffré et jamais réaffiché.</small> : null}
              </div>

              <div className="gls-env-foot">
                <div className="gls-env-actions">
                  <Button onClick={() => void test(env)} loading={testing === env} disabled={!view.ready || Boolean(testing) || envDirty(env)}>
                    Tester la connexion
                  </Button>
                  <span className="gls-state" data-ready={view.ready}>{view.ready ? "Identifiants enregistrés" : "Identifiants incomplets"}</span>
                </div>
                {envDirty(env) && view.ready ? <small className="gls-state">Enregistrez vos modifications pour pouvoir tester.</small> : null}
                {result ? <div className="gls-result" data-tone={result.ok ? "ok" : "error"} role={result.ok ? "status" : "alert"}>{result.message}</div> : null}
              </div>
            </section>
          );
        })}
      </fieldset>

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
        <p>{dirty ? "Des modifications ne sont pas enregistrées." : `Environnement actuel : ${copy[config.mode].title}.`}</p>
      </div>
    </form>
  );
}
