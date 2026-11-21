"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Banner, Button, SkeletonBodyText, TextField } from "@shopify/polaris";
import { AlertCircle, CheckCircle2, ChevronLeft, Eye, EyeOff, Inbox, Info, Mail, Server, ShieldCheck, Store } from "lucide-react";
import { toast } from "sonner";

import "../site/site-settings.css";
import "./email-settings.css";

type EmailSettings = {
  host: string;
  port: number;
  /** true: SSL/TLS from the first byte (port 465). false: STARTTLS (port 587). */
  secure: boolean;
  username: string;
  passwordSet: boolean;
  fromName: string;
  fromEmail: string;
  isActive: boolean;
};

type Draft = { host: string; port: string; secure: boolean; username: string; password: string; fromName: string; fromEmail: string; isActive: boolean };

const toDraft = (settings: EmailSettings): Draft => ({
  host: settings.host,
  port: String(settings.port),
  secure: settings.secure,
  username: settings.username,
  password: "",
  fromName: settings.fromName,
  fromEmail: settings.fromEmail,
  isActive: settings.isActive,
});

const PROVIDERS = [
  { id: "gmail", name: "Gmail", host: "smtp.gmail.com", port: "587", secure: false, hint: "Avec Gmail, créez un « mot de passe d’application » dans votre compte Google : le mot de passe habituel est refusé." },
  { id: "outlook", name: "Outlook", host: "smtp.office365.com", port: "587", secure: false, hint: "Utilisez votre adresse complète comme utilisateur." },
  { id: "ovh", name: "OVH", host: "ssl0.ovh.net", port: "465", secure: true, hint: "Utilisez votre adresse complète comme utilisateur." },
] as const;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/frontend-api/admin/email-settings${path}`, { cache: "no-store", ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(Array.isArray(data.message) ? data.message.join(" ") : data.message || "Action impossible.");
  return data as T;
}

/** Paramètres de la boutique, E-mails: the mail account the shop sends from, and a way to check that it works. */
export default function EmailSettingsPage() {
  const [saved, setSaved] = useState<EmailSettings | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [testTo, setTestTo] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    call<EmailSettings>("")
      .then((settings) => {
        if (cancelled) return;
        setSaved(settings);
        setDraft(toDraft(settings));
        setTestTo(settings.fromEmail);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Chargement impossible.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error && !draft) return <Banner tone="critical" title="Impossible de charger les réglages des e-mails">{error}</Banner>;
  if (!draft || !saved) return <div className="ss-page es-page"><div className="ss-card"><div className="ss-card-body"><SkeletonBodyText lines={10} /></div></div></div>;

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((old) => (old ? { ...old, [key]: value } : old));
    setTestResult(null);
  };
  const port = Number(draft.port);
  const portValid = Number.isInteger(port) && port >= 1 && port <= 65535;
  const fromValid = draft.fromEmail.trim() === "" || EMAIL.test(draft.fromEmail.trim());
  const hostMissing = draft.isActive && draft.host.trim() === "";
  const complete = draft.host.trim() !== "" && draft.username.trim() !== "" && (draft.password !== "" || saved.passwordSet) && EMAIL.test(draft.fromEmail.trim());
  const dirty = JSON.stringify(draft) !== JSON.stringify(toDraft(saved));
  const valid = portValid && fromValid && !hostMissing;
  const provider = PROVIDERS.find((item) => item.host === draft.host.trim().toLowerCase());
  const providerId = provider?.id ?? "other";

  // How far the e-mail's path is set up, and what the last test said.
  const route: "off" | "incomplete" | "ready" | "sending" | "ok" | "fail" = !draft.isActive
    ? "off"
    : testing
      ? "sending"
      : testResult
        ? (testResult.ok ? "ok" : "fail")
        : complete ? "ready" : "incomplete";

  async function save() {
    if (!draft || !valid) return;
    setSaving(true);
    setError("");
    try {
      const result = await call<EmailSettings>("", {
        method: "PATCH",
        body: JSON.stringify({
          host: draft.host.trim(),
          port,
          secure: draft.secure,
          username: draft.username.trim(),
          // Left empty, the saved password is kept.
          password: draft.password,
          fromName: draft.fromName.trim(),
          fromEmail: draft.fromEmail.trim(),
          isActive: draft.isActive,
        }),
      });
      setSaved(result);
      setDraft(toDraft(result));
      setShowPassword(false);
      if (!testTo.trim()) setTestTo(result.fromEmail);
      toast.success("Réglages des e-mails enregistrés.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  }

  async function sendTest() {
    setTesting(true);
    setTestResult(null);
    try {
      await call<{ success: boolean }>("/test", { method: "POST", body: JSON.stringify({ to: testTo.trim() }) });
      setTestResult({ ok: true, text: `Message envoyé à ${testTo.trim()}. S’il n’arrive pas, regardez les courriers indésirables.` });
    } catch (e) {
      setTestResult({ ok: false, text: e instanceof Error ? e.message : "Envoi impossible." });
    } finally {
      setTesting(false);
    }
  }

  const senderName = draft.fromName.trim();
  const senderEmail = draft.fromEmail.trim();
  const initial = (senderName || senderEmail || "?").charAt(0).toUpperCase();

  return (
    <div className="ss-page es-page">
      <div className="ss-hero">
        <Link href="/admin_ben/settings" className="ss-back inline-flex items-center gap-1"><ChevronLeft className="size-3.5" aria-hidden="true" />Paramètres de la boutique</Link>
        <div className="es-head mt-3">
          <div>
            <h1 className="ss-title">E-mails</h1>
            <p className="ss-lead">Le compte avec lequel la boutique écrit à vos clients : confirmations de commande, réponses au formulaire de contact et mots de passe oubliés.</p>
          </div>
          <div className="es-switch-row">
            <span className="es-switch-text">
              <strong id="es-active-label">{draft.isActive ? "Envoi activé" : "Envoi désactivé"}</strong>
              <span>{draft.isActive ? "La boutique envoie les e-mails." : "Aucun e-mail n’est envoyé."}</span>
            </span>
            <button type="button" role="switch" aria-checked={draft.isActive} aria-labelledby="es-active-label" className="es-switch" onClick={() => set("isActive", !draft.isActive)} />
          </div>
        </div>
      </div>

      <div className="es-grid mt-6">
        {error ? <div className="es-error"><Banner tone="critical" title={error} /></div> : null}

        {/* ------------------------------------------------------------ check */}
        <section className="ss-card es-area-check" aria-labelledby="es-check-title">
          <div className="ss-card-head">
            <span className="ss-card-icon" style={{ background: "#e7f7ef", color: "#18794e" }}><ShieldCheck className="size-5" aria-hidden="true" /></span>
            <div>
              <h2 id="es-check-title" className="ss-card-title">Vérifier l’envoi</h2>
              <p className="ss-card-desc">Envoyez-vous un message pour voir si le compte fonctionne.</p>
            </div>
          </div>

          <div className="es-route" data-state={route}>
            <div className="es-node">
              <span className="es-node-icon"><Store className="size-6" aria-hidden="true" /></span>
              <span className="es-node-title">Votre boutique</span>
              <span className="es-node-sub">{draft.isActive ? "Prépare le message" : "Envoi désactivé"}</span>
            </div>
            <div className="es-wire" aria-hidden="true" />
            <div className="es-node">
              <span className="es-node-icon"><Server className="size-6" aria-hidden="true" /></span>
              <span className="es-node-title">{draft.host.trim() || "Serveur d’envoi"}</span>
              <span className="es-node-sub">{draft.host.trim() ? `Port ${draft.port || "?"}, ${draft.secure ? "SSL/TLS" : "STARTTLS"}` : "Pas encore réglé"}</span>
            </div>
            <div className="es-wire is-second" aria-hidden="true" />
            <div className="es-node is-end">
              <span className="es-node-icon"><Inbox className="size-6" aria-hidden="true" /></span>
              <span className="es-node-title">{testResult && testTo.trim() ? testTo.trim() : "Vos clients"}</span>
              <span className="es-node-sub">{route === "ok" ? "Message reçu" : route === "fail" ? "Message non envoyé" : route === "sending" ? "Envoi en cours…" : "Boîte de réception"}</span>
            </div>
          </div>

          {testResult ? (
            <p role="status" className={`es-route-status ${testResult.ok ? "is-ok" : "is-fail"}`}>
              {testResult.ok ? <CheckCircle2 className="size-4" aria-hidden="true" /> : <AlertCircle className="size-4" aria-hidden="true" />}
              <span>{testResult.text}</span>
            </p>
          ) : dirty || !complete ? (
            <p className="es-route-status is-hint">
              <Info className="size-4" aria-hidden="true" />
              <span>{dirty ? "Enregistrez vos changements avant de tester : le test utilise les réglages enregistrés." : "Complétez le serveur, l’utilisateur, le mot de passe et l’adresse d’expédition pour tester."}</span>
            </p>
          ) : null}

          <div className="es-test">
            <div className="es-test-field">
              <TextField label="Envoyer le test à" type="email" autoComplete="off" value={testTo} onChange={(value) => { setTestTo(value); setTestResult(null); }} />
            </div>
            <Button variant="primary" loading={testing} disabled={dirty || !complete || !EMAIL.test(testTo.trim())} onClick={() => void sendTest()}>Envoyer le test</Button>
          </div>
        </section>

        {/* ------------------------------------------------------------ account */}
        <section className="ss-card es-area-account" aria-labelledby="es-account-title">
          <div className="ss-card-head">
            <span className="ss-card-icon" style={{ background: "#eaf2ff", color: "#2456a6" }}><Server className="size-5" aria-hidden="true" /></span>
            <div>
              <h2 id="es-account-title" className="ss-card-title">Compte d’envoi</h2>
              <p className="ss-card-desc">Les identifiants de la boîte mail qui envoie les messages.</p>
            </div>
          </div>
          <div className="ss-card-body grid gap-6">
            <div role="radiogroup" aria-labelledby="es-provider-label">
              <p id="es-provider-label" className="es-label">Votre messagerie</p>
              <div className="es-providers">
                {PROVIDERS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    role="radio"
                    aria-checked={providerId === item.id}
                    className="es-provider"
                    onClick={() => setDraft((old) => (old ? { ...old, host: item.host, port: item.port, secure: item.secure } : old))}>
                    <strong>{item.name}</strong>
                    <span>{item.host}</span>
                  </button>
                ))}
                <button type="button" role="radio" aria-checked={providerId === "other"} className="es-provider" onClick={() => { if (provider) set("host", ""); }}>
                  <strong>Autre</strong>
                  <span>Un autre serveur SMTP</span>
                </button>
              </div>
              {provider ? <p className="es-hint"><Info className="size-4" aria-hidden="true" /><span>{provider.hint}</span></p> : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_140px]">
              <TextField label="Serveur SMTP" autoComplete="off" value={draft.host} placeholder="smtp.exemple.com" error={hostMissing ? "Indiquez le serveur pour activer l’envoi." : undefined} onChange={(value) => set("host", value)} />
              <TextField
                label="Port"
                type="number"
                autoComplete="off"
                min={1}
                max={65535}
                value={draft.port}
                error={portValid ? undefined : "Port invalide."}
                onChange={(value) => {
                  set("port", value);
                  // The usual pairs: 465 is SSL/TLS, 587 and 25 are STARTTLS.
                  if (value === "465") set("secure", true);
                  if (value === "587" || value === "25") set("secure", false);
                }}
              />
            </div>

            <div role="radiogroup" aria-labelledby="es-secure-label">
              <p id="es-secure-label" className="es-label">Chiffrement</p>
              <div className="es-seg">
                <button type="button" role="radio" aria-checked={!draft.secure} onClick={() => { set("secure", false); if (draft.port === "465") set("port", "587"); }}>
                  <strong>STARTTLS</strong>port 587, le plus courant
                </button>
                <button type="button" role="radio" aria-checked={draft.secure} onClick={() => { set("secure", true); if (draft.port === "587" || draft.port === "25") set("port", "465"); }}>
                  <strong>SSL/TLS</strong>port 465
                </button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Utilisateur" autoComplete="off" value={draft.username} helpText="Souvent l’adresse e-mail complète." onChange={(value) => set("username", value)} />
              <TextField
                label="Mot de passe"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={draft.password}
                placeholder={saved.passwordSet ? "••••••••" : ""}
                helpText={saved.passwordSet ? "Un mot de passe est enregistré, chiffré. Laissez vide pour le garder." : "Il est enregistré chiffré et n’est jamais réaffiché."}
                suffix={
                  <button type="button" className="es-reveal" aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"} onClick={() => setShowPassword((value) => !value)}>
                    {showPassword ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
                  </button>
                }
                onChange={(value) => set("password", value)}
              />
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------ sender */}
        <section className="ss-card es-area-sender" aria-labelledby="es-sender-title">
          <div className="ss-card-head">
            <span className="ss-card-icon" style={{ background: "#fdeaf0", color: "#b3265a" }}><Mail className="size-5" aria-hidden="true" /></span>
            <div>
              <h2 id="es-sender-title" className="ss-card-title">Ce que voient vos clients</h2>
              <p className="ss-card-desc">Le nom et l’adresse affichés comme expéditeur dans leur boîte de réception.</p>
            </div>
          </div>
          <div className="ss-card-body grid gap-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Nom de l’expéditeur" autoComplete="off" value={draft.fromName} helpText="Par exemple le nom de la boutique." onChange={(value) => set("fromName", value)} />
              <TextField label="Adresse de l’expéditeur" type="email" autoComplete="off" value={draft.fromEmail} error={fromValid ? undefined : "Cette adresse n’est pas valide."} helpText="Elle doit appartenir au compte ci-dessus." onChange={(value) => set("fromEmail", value)} />
            </div>

            <div>
              <p className="es-label">Aperçu dans une boîte de réception</p>
              <div className="es-mail">
                <span className="es-avatar" aria-hidden="true">{initial}</span>
                <div className="min-w-0">
                  <p className="es-mail-from">
                    <strong className={senderName ? undefined : "es-placeholder"}>{senderName || "Nom de la boutique"}</strong>
                    <span className={senderEmail ? undefined : "es-placeholder"}>{senderEmail ? `<${senderEmail}>` : "<adresse@exemple.com>"}</span>
                  </p>
                  <p className="es-mail-subject">Confirmation de votre commande C261100013</p>
                  <p className="es-mail-line">Merci pour votre commande. Voici le récapitulatif…</p>
                </div>
                <span className="es-mail-time">10:42</span>
              </div>
              <ul className="es-uses" aria-label="Ce compte sert à envoyer">
                <li><CheckCircle2 className="size-3.5" aria-hidden="true" />Confirmations de commande</li>
                <li><CheckCircle2 className="size-3.5" aria-hidden="true" />Messages du formulaire de contact</li>
                <li><CheckCircle2 className="size-3.5" aria-hidden="true" />Mots de passe oubliés</li>
              </ul>
            </div>
          </div>
        </section>
      </div>

      {dirty ? (
        <div className="ss-savebar" role="region" aria-label="Enregistrer les modifications">
          <span className="ss-savebar-text">Modifications non enregistrées</span>
          <Button onClick={() => { setDraft(toDraft(saved)); setShowPassword(false); setTestResult(null); }} disabled={saving}>Annuler</Button>
          <Button variant="primary" loading={saving} disabled={!valid} onClick={() => void save()}>Enregistrer</Button>
        </div>
      ) : null}
    </div>
  );
}
