"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Button, useFrame } from "@shopify/polaris";
import "./stripe-module.css";

type Environment = "sandbox" | "live";
type EnvView = { publishableKey: string; secretKeySet: boolean; secretKeyHint: string; webhookSecretSet: boolean; ready: boolean };
type Config = { mode: Environment; configured: boolean; sandbox: EnvView; live: EnvView; webhookUrl: string };
type TestResult = {
  environment: Environment; accountId: string; businessName: string; country: string;
  defaultCurrency: string; chargesEnabled: boolean; payoutsEnabled: boolean;
};
type Drafts = Record<Environment, { publishableKey: string; secretKey: string; webhookSecret: string }>;

const emptyView: EnvView = { publishableKey: "", secretKeySet: false, secretKeyHint: "", webhookSecretSet: false, ready: false };

const copy: Record<Environment, { title: string; text: string; pk: string; sk: string }> = {
  sandbox: {
    title: "Sandbox",
    text: "Pour essayer les paiements avec les cartes de test Stripe. Aucun argent n’est débité.",
    pk: "pk_test_…",
    sk: "sk_test_… ou rk_test_…",
  },
  live: {
    title: "Live",
    text: "Pour encaisser de vrais paiements de vos clients.",
    pk: "pk_live_…",
    sk: "sk_live_… ou rk_live_…",
  },
};

function keyError(kind: "pk" | "sk" | "wh", env: Environment, value: string) {
  if (!value) return "";
  if (kind === "wh") return /^whsec_/.test(value) ? "" : "Ce secret doit commencer par whsec_.";
  const tag = env === "sandbox" ? "test" : "live";
  const ok = kind === "pk" ? new RegExp(`^pk_${tag}_`).test(value) : new RegExp(`^(sk|rk)_${tag}_`).test(value);
  if (ok) return "";
  return kind === "pk"
    ? `Cette clé doit commencer par pk_${tag}_.`
    : `Cette clé doit commencer par sk_${tag}_ ou rk_${tag}_.`;
}

export default function StripeConfigForm() {
  const { showToast, hideToast } = useFrame();
  const toastCount = useRef(0);
  const [config, setConfig] = useState<Config | null>(null);
  const [mode, setMode] = useState<Environment>("sandbox");
  const [drafts, setDrafts] = useState<Drafts>({
    sandbox: { publishableKey: "", secretKey: "", webhookSecret: "" },
    live: { publishableKey: "", secretKey: "", webhookSecret: "" },
  });
  const [liveConfirmed, setLiveConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<Environment | "">("");
  const [results, setResults] = useState<Partial<Record<Environment, { ok: boolean; data?: TestResult; message?: string }>>>({});
  const [loadError, setLoadError] = useState("");

  const toast = useCallback((content: string, error = false) => {
    const id = `stripe-${Date.now()}-${++toastCount.current}`;
    showToast({ id, content, error, duration: 6000, onDismiss: () => hideToast({ id }) });
  }, [hideToast, showToast]);

  const apply = useCallback((data: Config) => {
    setConfig({ ...data, sandbox: { ...emptyView, ...data.sandbox }, live: { ...emptyView, ...data.live } });
    setMode(data.mode);
    setDrafts({
      sandbox: { publishableKey: data.sandbox?.publishableKey ?? "", secretKey: "", webhookSecret: "" },
      live: { publishableKey: data.live?.publishableKey ?? "", secretKey: "", webhookSecret: "" },
    });
    setLiveConfirmed(false);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const response = await fetch("/frontend-api/admin/stripe-integration", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Impossible de charger la configuration Stripe.");
        apply(data);
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : "Chargement impossible.");
      }
    })();
  }, [apply]);

  const switchingToLive = Boolean(config) && mode === "live" && config?.mode !== "live";

  function setDraft(env: Environment, field: "publishableKey" | "secretKey" | "webhookSecret", value: string) {
    setDrafts((old) => ({ ...old, [env]: { ...old[env], [field]: value.trim() } }));
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!config) return;
    for (const env of ["sandbox", "live"] as const) {
      if (
        keyError("pk", env, drafts[env].publishableKey) ||
        keyError("sk", env, drafts[env].secretKey) ||
        keyError("wh", env, drafts[env].webhookSecret)
      ) {
        toast(`Corrigez les clés ${copy[env].title} avant d’enregistrer.`, true);
        return;
      }
    }
    setSaving(true);
    try {
      const response = await fetch("/frontend-api/admin/stripe-integration", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, sandbox: drafts.sandbox, live: drafts.live }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(Array.isArray(data.message) ? data.message.join(" ") : data.message || "Enregistrement impossible.");
      apply(data);
      setResults({});
      toast(`Configuration enregistrée. Stripe utilise maintenant l’environnement ${copy[data.mode as Environment].title}.`);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Enregistrement impossible.", true);
    } finally {
      setSaving(false);
    }
  }

  async function test(env: Environment) {
    setTesting(env);
    try {
      const response = await fetch("/frontend-api/admin/stripe-integration/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ environment: env }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(Array.isArray(data.message) ? data.message.join(" ") : data.message || "Connexion impossible.");
      setResults((old) => ({ ...old, [env]: { ok: true, data } }));
    } catch (error) {
      setResults((old) => ({ ...old, [env]: { ok: false, message: error instanceof Error ? error.message : "Connexion impossible." } }));
    } finally {
      setTesting("");
    }
  }

  if (loadError) {
    return <div className="stripe-result" data-tone="error" role="alert">{loadError}</div>;
  }
  if (!config) return <div className="stripe-skeleton" aria-busy="true" aria-label="Chargement de la configuration Stripe" />;

  const dirty = (["sandbox", "live"] as const).some((env) => drafts[env].secretKey || drafts[env].webhookSecret || drafts[env].publishableKey !== config[env].publishableKey) || mode !== config.mode;
  const canSave = dirty && (!switchingToLive || liveConfirmed);

  return (
    <form onSubmit={save} noValidate>
      <p className="stripe-intro">
        Stripe fonctionne avec deux environnements indépendants. <strong>Choisissez celui que la boutique utilise</strong> : vous pouvez garder les clés des deux, et basculer quand vous voulez.
      </p>

      <fieldset className="stripe-envs">
        <legend className="visually-hidden">Environnement Stripe actif</legend>
        {(["sandbox", "live"] as const).map((env) => {
          const view = config[env];
          const draft = drafts[env];
          const pkError = keyError("pk", env, draft.publishableKey);
          const skError = keyError("sk", env, draft.secretKey);
          const whError = keyError("wh", env, draft.webhookSecret);
          const result = results[env];
          const active = mode === env;
          return (
            <section key={env} className={`stripe-env${active ? " is-active" : ""}`} data-env={env} aria-labelledby={`stripe-${env}-title`}>
              <div className="stripe-env-edge" aria-hidden="true" />
              <div className="stripe-env-body">
                <div className="stripe-env-top">
                  <div>
                    <h2 id={`stripe-${env}-title`}>{copy[env].title}</h2>
                    <p>{copy[env].text}</p>
                  </div>
                  <label className="stripe-choose">
                    <input type="radio" name="stripe-mode" value={env} checked={active} onChange={() => setMode(env)} />
                    {active ? "Environnement actif" : "Utiliser celui-ci"}
                  </label>
                </div>

                <div className={`stripe-field${pkError ? " has-error" : ""}`}>
                  <label htmlFor={`stripe-${env}-pk`}>Clé publique</label>
                  <input id={`stripe-${env}-pk`} value={draft.publishableKey} onChange={(e) => setDraft(env, "publishableKey", e.target.value)} placeholder={copy[env].pk} autoComplete="off" spellCheck={false} aria-invalid={Boolean(pkError)} aria-describedby={`stripe-${env}-pk-help`} />
                  <small id={`stripe-${env}-pk-help`}>{pkError || "Visible côté navigateur, utilisée pour afficher le formulaire de paiement."}</small>
                </div>

                <div className={`stripe-field${skError ? " has-error" : ""}`}>
                  <label htmlFor={`stripe-${env}-sk`}>Clé secrète</label>
                  <input id={`stripe-${env}-sk`} type="password" value={draft.secretKey} onChange={(e) => setDraft(env, "secretKey", e.target.value)} placeholder={view.secretKeySet ? `Clé enregistrée ${view.secretKeyHint}` : copy[env].sk} autoComplete="new-password" spellCheck={false} aria-invalid={Boolean(skError)} aria-describedby={`stripe-${env}-sk-help`} />
                  <small id={`stripe-${env}-sk-help`}>{skError || (view.secretKeySet ? "Laissez vide pour garder la clé actuelle. Elle est chiffrée et n’est jamais réaffichée." : "Chiffrée sur le serveur dès l’enregistrement.")}</small>
                </div>

                <div className={`stripe-field${whError ? " has-error" : ""}`}>
                  <label htmlFor={`stripe-${env}-wh`}>Secret de signature du webhook</label>
                  <input id={`stripe-${env}-wh`} type="password" value={draft.webhookSecret} onChange={(e) => setDraft(env, "webhookSecret", e.target.value)} placeholder={view.webhookSecretSet ? "Secret enregistré" : "whsec_…"} autoComplete="new-password" spellCheck={false} aria-invalid={Boolean(whError)} aria-describedby={`stripe-${env}-wh-help`} />
                  <small id={`stripe-${env}-wh-help`}>{whError || (view.webhookSecretSet ? "Laissez vide pour garder le secret actuel." : "Sans lui, un paiement réglé mais non revenu sur le site reste « en attente ».")}</small>
                </div>
              </div>

              <div className="stripe-env-foot">
                <div className="stripe-env-actions">
                  <Button onClick={() => void test(env)} loading={testing === env} disabled={!view.secretKeySet || Boolean(testing) || Boolean(draft.secretKey)}>
                    Tester la clé secrète
                  </Button>
                  <span className="stripe-state" data-ready={view.ready}>{view.ready ? "Clés enregistrées" : "Clés manquantes"}</span>
                </div>
                {result ? (
                  <div className="stripe-result" data-tone={result.ok ? "ok" : "error"} role={result.ok ? "status" : "alert"}>
                    {result.ok && result.data ? (
                      <>
                        Stripe a accepté la clé.
                        <dl>
                          <dt>Compte</dt><dd>{result.data.businessName || result.data.accountId}</dd>
                          <dt>Identifiant</dt><dd>{result.data.accountId}</dd>
                          <dt>Pays · devise</dt><dd>{result.data.country || "—"} · {result.data.defaultCurrency?.toUpperCase() || "—"}</dd>
                          <dt>Paiements</dt><dd>{result.data.chargesEnabled ? "Activés" : "Pas encore activés"}</dd>
                        </dl>
                      </>
                    ) : result.message}
                  </div>
                ) : draft.secretKey ? <small className="stripe-state">Enregistrez la nouvelle clé pour pouvoir la tester.</small> : null}
              </div>
            </section>
          );
        })}
      </fieldset>

      <div className="stripe-webhook">
        <h2>Webhook Stripe</h2>
        <p>
          Dans le tableau de bord Stripe (Développeurs, Webhooks), ajoutez cette adresse et cochez ces trois événements :{" "}
          <code>checkout.session.completed</code>, <code>checkout.session.async_payment_succeeded</code> et{" "}
          <code>checkout.session.async_payment_failed</code>. Stripe vous donne alors le secret de signature à coller ci-dessus.
        </p>
        <div className="stripe-webhook-url">
          <input readOnly aria-label="Adresse du webhook" value={config.webhookUrl || "Définissez API_BASE_URL sur le serveur pour afficher l’adresse publique."} onFocus={(e) => e.currentTarget.select()} />
          <Button onClick={() => navigator.clipboard.writeText(config.webhookUrl).then(() => toast("Adresse du webhook copiée.")).catch(() => toast("Copie impossible.", true))} disabled={!config.webhookUrl}>
            Copier l’adresse
          </Button>
        </div>
        <p className="stripe-webhook-note">
          En local, Stripe ne peut pas joindre votre ordinateur : lancez <code>stripe listen --forward-to {config.webhookUrl || "…"}</code> et utilisez le secret affiché.
        </p>
      </div>

      {switchingToLive ? (
        <div className="stripe-confirm">
          <input id="stripe-live-confirm" type="checkbox" checked={liveConfirmed} onChange={(e) => setLiveConfirmed(e.target.checked)} />
          <label htmlFor="stripe-live-confirm"><strong>Passer en mode Live.</strong> Les prochains paiements seront réels et débités sur les cartes de vos clients. Cochez pour confirmer.</label>
        </div>
      ) : null}

      <div className="stripe-savebar">
        <Button variant="primary" submit loading={saving} disabled={!canSave}>Enregistrer</Button>
        <p>{dirty ? "Des modifications ne sont pas enregistrées." : `Environnement actuel : ${copy[config.mode].title}.`}</p>
      </div>
    </form>
  );
}
