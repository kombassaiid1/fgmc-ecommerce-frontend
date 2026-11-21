"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Banner, Button, SkeletonBodyText, TextField } from "@shopify/polaris";
import { ChevronLeft, ImageIcon, Monitor, Palette, Smartphone, Type } from "lucide-react";
import { toast } from "sonner";

import "../site/site-settings.css";
import "../email/email-settings.css";
import "./theme-email.css";

type EmailTheme = {
  headerStyle: "band" | "plain";
  showLogo: boolean;
  logoHeight: number;
  logoBadge: boolean;
  headerColor: string;
  pageColor: string;
  cardColor: string;
  textColor: string;
  mutedColor: string;
  buttonColor: string;
  buttonTextColor: string;
  fontFamily: "sans" | "serif" | "rounded";
  radius: number;
  width: number;
  footerText: string;
  showContact: boolean;
  signature: string;
};

type ThemeView = { theme: EmailTheme; defaults: EmailTheme; logoUrl: string | null; siteName: string };
type Kind = "order" | "admin-order" | "reset" | "contact" | "abandoned-cart";

const KINDS: { id: Kind; label: string }[] = [
  { id: "order", label: "Confirmation de commande" },
  { id: "reset", label: "Mot de passe oublié" },
  { id: "contact", label: "Message de contact" },
  { id: "admin-order", label: "Nouvelle commande (équipe)" },
  { id: "abandoned-cart", label: "Panier abandonné" },
];

const COLORS: { key: keyof EmailTheme; label: string }[] = [
  { key: "headerColor", label: "En-tête" },
  { key: "buttonColor", label: "Bouton" },
  { key: "buttonTextColor", label: "Texte du bouton" },
  { key: "pageColor", label: "Fond de la page" },
  { key: "cardColor", label: "Fond du message" },
  { key: "textColor", label: "Texte" },
  { key: "mutedColor", label: "Texte secondaire" },
];

const PALETTES: { name: string; colors: Pick<EmailTheme, "headerColor" | "buttonColor" | "buttonTextColor" | "pageColor" | "cardColor" | "textColor" | "mutedColor"> }[] = [
  { name: "Marine et rouge", colors: { headerColor: "#153675", buttonColor: "#d6202e", buttonTextColor: "#ffffff", pageColor: "#f2f5fa", cardColor: "#ffffff", textColor: "#1d2433", mutedColor: "#667085" } },
  { name: "Ardoise", colors: { headerColor: "#1f2937", buttonColor: "#2563eb", buttonTextColor: "#ffffff", pageColor: "#f3f4f6", cardColor: "#ffffff", textColor: "#111827", mutedColor: "#6b7280" } },
  { name: "Sous-bois", colors: { headerColor: "#1f4d3a", buttonColor: "#c2410c", buttonTextColor: "#ffffff", pageColor: "#f1f5f0", cardColor: "#ffffff", textColor: "#1c2a22", mutedColor: "#5f7068" } },
  { name: "Bordeaux", colors: { headerColor: "#6b1d2e", buttonColor: "#6b1d2e", buttonTextColor: "#ffffff", pageColor: "#f8f1f2", cardColor: "#ffffff", textColor: "#2a1a1d", mutedColor: "#7a6568" } },
  { name: "Nuit", colors: { headerColor: "#0f172a", buttonColor: "#f59e0b", buttonTextColor: "#0f172a", pageColor: "#0f172a", cardColor: "#1e293b", textColor: "#f1f5f9", mutedColor: "#94a3b8" } },
  { name: "Sobre", colors: { headerColor: "#111111", buttonColor: "#111111", buttonTextColor: "#ffffff", pageColor: "#f5f5f5", cardColor: "#ffffff", textColor: "#171717", mutedColor: "#737373" } },
];

const FONTS: { id: EmailTheme["fontFamily"]; label: string; css: string; hint: string }[] = [
  { id: "sans", label: "Moderne", css: "'Helvetica Neue',Helvetica,Arial,sans-serif", hint: "Helvetica, Arial" },
  { id: "serif", label: "Classique", css: "Georgia,'Times New Roman',serif", hint: "Georgia" },
  { id: "rounded", label: "Doux", css: "'Trebuchet MS','Segoe UI',Verdana,sans-serif", hint: "Trebuchet" },
];

const WIDTHS = [
  { value: 520, label: "Étroit" },
  { value: 600, label: "Standard" },
  { value: 680, label: "Large" },
];

const HEX = /^#[0-9a-fA-F]{6}$/;

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/frontend-api/admin/email-theme${path}`, { cache: "no-store", ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(Array.isArray(data.message) ? data.message.join(" ") : data.message || "Action impossible.");
  return data as T;
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  // The text box can hold a half-typed value; the theme only changes once it is a full colour.
  const [typed, setTyped] = useState<string | null>(null);
  const text = typed ?? value;
  return (
    <label className="te-color">
      <span className="es-label" style={{ margin: 0 }}>{label}</span>
      <span className="te-color-box">
        <input type="color" value={value} aria-label={`${label}, sélecteur de couleur`} onChange={(event) => onChange(event.target.value)} />
        <input
          type="text"
          value={text}
          maxLength={7}
          spellCheck={false}
          aria-label={`${label}, code couleur`}
          onChange={(event) => {
            const next = event.target.value.startsWith("#") ? event.target.value : `#${event.target.value}`;
            setTyped(next);
            if (HEX.test(next)) onChange(next.toLowerCase());
          }}
          onBlur={() => setTyped(null)}
        />
      </span>
    </label>
  );
}

function Range({ label, value, min, max, unit, onChange }: { label: string; value: number; min: number; max: number; unit: string; onChange: (value: number) => void }) {
  return (
    <div className="te-range">
      <div className="te-range-head"><span>{label}</span><output>{value} {unit}</output></div>
      <input type="range" min={min} max={max} value={value} aria-label={label} onChange={(event) => onChange(Number(event.target.value))} />
    </div>
  );
}

function Switch({ checked, onChange, labelId }: { checked: boolean; onChange: (value: boolean) => void; labelId: string }) {
  return <button type="button" role="switch" aria-checked={checked} aria-labelledby={labelId} className="es-switch" onClick={() => onChange(!checked)} />;
}

/** Paramètres de la boutique, Thème des e-mails: the look of every e-mail the shop sends, with the e-mail drawn live beside the controls. */
export default function EmailThemePage() {
  const [view, setView] = useState<ThemeView | null>(null);
  const [saved, setSaved] = useState<EmailTheme | null>(null);
  const [draft, setDraft] = useState<EmailTheme | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [kind, setKind] = useState<Kind>("order");
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [html, setHtml] = useState("");
  const [subject, setSubject] = useState("");
  const [busy, setBusy] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [testTo, setTestTo] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null);
  const requestId = useRef(0);

  useEffect(() => {
    let cancelled = false;
    call<ThemeView>("")
      .then((result) => {
        if (cancelled) return;
        setView(result);
        setSaved(result.theme);
        setDraft(result.theme);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Chargement impossible.");
      });
    // Someone to send the test to: the sender address, if the account is set up.
    fetch("/frontend-api/admin/email-settings", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((settings: { fromEmail?: string } | null) => {
        if (!cancelled && settings?.fromEmail) setTestTo((old) => old || settings.fromEmail || "");
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  // The e-mail is drawn by the server, with the same code that sends it, so the preview is what customers get.
  useEffect(() => {
    if (!draft) return;
    const id = ++requestId.current;
    const timer = window.setTimeout(() => {
      setBusy(true);
      call<{ subject: string; html: string }>("/preview", { method: "POST", body: JSON.stringify({ theme: draft, kind }) })
        .then((result) => {
          if (id !== requestId.current) return;
          setHtml(result.html);
          setSubject(result.subject);
          setPreviewError("");
        })
        .catch((e: unknown) => {
          if (id === requestId.current) setPreviewError(e instanceof Error ? e.message : "Aperçu impossible.");
        })
        .finally(() => {
          if (id === requestId.current) setBusy(false);
        });
    }, 220);
    return () => window.clearTimeout(timer);
  }, [draft, kind]);

  if (error && !draft) return <Banner tone="critical" title="Impossible de charger le thème des e-mails">{error}</Banner>;
  if (!draft || !saved || !view) return <div className="ss-page es-page"><div className="ss-card"><div className="ss-card-body"><SkeletonBodyText lines={10} /></div></div></div>;

  const set = <K extends keyof EmailTheme>(key: K, value: EmailTheme[K]) => {
    setDraft((old) => (old ? { ...old, [key]: value } : old));
    setTestResult(null);
  };
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const activePalette = PALETTES.findIndex((palette) => (Object.keys(palette.colors) as (keyof typeof palette.colors)[]).every((key) => palette.colors[key] === draft[key]));

  async function save() {
    if (!draft) return;
    setSaving(true);
    setError("");
    try {
      const result = await call<EmailTheme>("", { method: "PATCH", body: JSON.stringify({ theme: draft }) });
      setSaved(result);
      setDraft(result);
      toast.success("Thème des e-mails enregistré.");
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
      await call<{ success: boolean }>("/test", { method: "POST", body: JSON.stringify({ to: testTo.trim(), kind }) });
      setTestResult({ ok: true, text: `E-mail de test envoyé à ${testTo.trim()}.` });
    } catch (e) {
      setTestResult({ ok: false, text: e instanceof Error ? e.message : "Envoi impossible." });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="ss-page es-page">
      <div className="ss-hero">
        <Link href="/admin_ben/settings" className="ss-back inline-flex items-center gap-1"><ChevronLeft className="size-3.5" aria-hidden="true" />Paramètres de la boutique</Link>
        <h1 className="ss-title mt-3">Thème des e-mails</h1>
        <p className="ss-lead">Les couleurs, la police et le pied de page de tous les e-mails que la boutique envoie. L’aperçu à droite est l’e-mail réel, dessiné avec des données d’exemple.</p>
      </div>

      <div className="te-layout mt-6">
        <div className="te-controls">
          {error ? <Banner tone="critical" title={error} /> : null}

          <section className="ss-card" aria-labelledby="te-colors-title">
            <div className="ss-card-head">
              <span className="ss-card-icon" style={{ background: "#fdeaf0", color: "#b3265a" }}><Palette className="size-5" aria-hidden="true" /></span>
              <div>
                <h2 id="te-colors-title" className="ss-card-title">Couleurs</h2>
                <p className="ss-card-desc">Partez d’une palette, puis ajustez chaque couleur.</p>
              </div>
            </div>
            <div className="ss-card-body grid gap-6">
              <div role="radiogroup" aria-label="Palettes" className="te-palettes">
                {PALETTES.map((palette, index) => (
                  <button
                    key={palette.name}
                    type="button"
                    role="radio"
                    aria-checked={activePalette === index}
                    className="te-palette"
                    onClick={() => setDraft((old) => (old ? { ...old, ...palette.colors } : old))}>
                    <span className="te-strip" aria-hidden="true">
                      <i style={{ background: palette.colors.headerColor }} />
                      <i style={{ background: palette.colors.buttonColor }} />
                      <i style={{ background: palette.colors.pageColor }} />
                      <i style={{ background: palette.colors.cardColor }} />
                    </span>
                    <strong>{palette.name}</strong>
                  </button>
                ))}
              </div>
              <div className="te-colors">
                {COLORS.map((color) => (
                  <ColorField key={color.key} label={color.label} value={draft[color.key] as string} onChange={(value) => set(color.key, value as never)} />
                ))}
              </div>
            </div>
          </section>

          <section className="ss-card" aria-labelledby="te-header-title">
            <div className="ss-card-head">
              <span className="ss-card-icon" style={{ background: "#eaf2ff", color: "#2456a6" }}><ImageIcon className="size-5" aria-hidden="true" /></span>
              <div>
                <h2 id="te-header-title" className="ss-card-title">En-tête et forme</h2>
                <p className="ss-card-desc">Le « Logo des e-mails » se choisit dans <Link href="/admin_ben/settings/site" className="underline">Informations de la boutique</Link>.</p>
              </div>
            </div>
            <div className="ss-card-body grid gap-6">
              <div role="radiogroup" aria-labelledby="te-header-style">
                <p id="te-header-style" className="es-label">Style de l’en-tête</p>
                <div className="es-seg">
                  <button type="button" role="radio" aria-checked={draft.headerStyle === "band"} onClick={() => set("headerStyle", "band")}><strong>Bandeau</strong>fond coloré</button>
                  <button type="button" role="radio" aria-checked={draft.headerStyle === "plain"} onClick={() => set("headerStyle", "plain")}><strong>Simple</strong>filet de couleur</button>
                </div>
              </div>

              <div className="te-row">
                <span className="te-row-text">
                  <strong id="te-logo-label">Afficher le logo</strong>
                  <span>{view.logoUrl ? "Sinon, le nom de la boutique est écrit." : "Aucun logo des e-mails : le nom de la boutique est écrit."}</span>
                </span>
                <Switch checked={draft.showLogo} onChange={(value) => set("showLogo", value)} labelId="te-logo-label" />
              </div>
              {draft.showLogo && view.logoUrl && draft.headerStyle === "band" ? (
                <div className="te-row">
                  <span className="te-row-text">
                    <strong id="te-badge-label">Logo sur fond blanc</strong>
                    <span>Garde lisible un logo foncé sur un bandeau coloré.</span>
                  </span>
                  <Switch checked={draft.logoBadge} onChange={(value) => set("logoBadge", value)} labelId="te-badge-label" />
                </div>
              ) : null}
              {draft.showLogo && view.logoUrl ? <Range label="Hauteur du logo" value={draft.logoHeight} min={20} max={80} unit="px" onChange={(value) => set("logoHeight", value)} /> : null}

              <Range label="Arrondi des angles" value={draft.radius} min={0} max={24} unit="px" onChange={(value) => set("radius", value)} />

              <div role="radiogroup" aria-labelledby="te-width">
                <p id="te-width" className="es-label">Largeur du message</p>
                <div className="es-seg" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
                  {WIDTHS.map((width) => (
                    <button key={width.value} type="button" role="radio" aria-checked={draft.width === width.value} onClick={() => set("width", width.value)}>
                      <strong>{width.label}</strong>{width.value} px
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="ss-card" aria-labelledby="te-text-title">
            <div className="ss-card-head">
              <span className="ss-card-icon" style={{ background: "#fff4e5", color: "#b45309" }}><Type className="size-5" aria-hidden="true" /></span>
              <div>
                <h2 id="te-text-title" className="ss-card-title">Police et textes</h2>
                <p className="ss-card-desc">Utilisez {"{siteName}"} pour écrire le nom de la boutique.</p>
              </div>
            </div>
            <div className="ss-card-body grid gap-6">
              <div role="radiogroup" aria-labelledby="te-font">
                <p id="te-font" className="es-label">Police</p>
                <div className="te-fonts">
                  {FONTS.map((font) => (
                    <button key={font.id} type="button" role="radio" aria-checked={draft.fontFamily === font.id} className="te-font" onClick={() => set("fontFamily", font.id)}>
                      <b style={{ fontFamily: font.css }}>Aa</b>
                      <strong style={{ fontSize: 14 }}>{font.label}</strong>
                      <span>{font.hint}</span>
                    </button>
                  ))}
                </div>
              </div>
              <TextField label="Formule de fin" autoComplete="off" value={draft.signature} maxLength={120} helpText="Dernière ligne des messages envoyés aux clients." onChange={(value) => set("signature", value)} />
              <TextField label="Pied de page" autoComplete="off" multiline={3} value={draft.footerText} maxLength={300} onChange={(value) => set("footerText", value)} />
              <div className="te-row">
                <span className="te-row-text">
                  <strong id="te-contact-label">Coordonnées dans le pied de page</strong>
                  <span>Adresse, téléphone et e-mail de la boutique.</span>
                </span>
                <Switch checked={draft.showContact} onChange={(value) => set("showContact", value)} labelId="te-contact-label" />
              </div>
              <div>
                <Button onClick={() => setDraft(view.defaults)} disabled={JSON.stringify(draft) === JSON.stringify(view.defaults)}>Revenir au thème d’origine</Button>
              </div>
            </div>
          </section>
        </div>

        <div className="te-preview">
          <div role="tablist" aria-label="E-mail à prévisualiser" className="te-kinds">
            {KINDS.map((item) => (
              <button key={item.id} type="button" role="tab" aria-selected={kind === item.id} className="te-kind" onClick={() => setKind(item.id)}>{item.label}</button>
            ))}
          </div>

          <div className="te-window">
            <div className="te-window-bar">
              <span className="te-subject"><b>Objet</b>{subject || "…"}</span>
              <span className="te-devices" role="group" aria-label="Taille de l’aperçu">
                <button type="button" aria-pressed={device === "desktop"} aria-label="Ordinateur" onClick={() => setDevice("desktop")}><Monitor className="size-4" aria-hidden="true" /></button>
                <button type="button" aria-pressed={device === "mobile"} aria-label="Téléphone" onClick={() => setDevice("mobile")}><Smartphone className="size-4" aria-hidden="true" /></button>
              </span>
            </div>
            <div className="te-stage" data-busy={busy}>
              <iframe className="te-frame" data-device={device} title="Aperçu de l’e-mail" sandbox="" srcDoc={html} />
            </div>
          </div>
          {previewError ? <Banner tone="critical" title={previewError} /> : null}

          <div className="ss-card">
            <div className="ss-card-body grid gap-3">
              <div className="te-test">
                <div className="te-test-field">
                  <TextField label="Recevoir cet e-mail dans ma boîte" type="email" autoComplete="off" value={testTo} onChange={(value) => { setTestTo(value); setTestResult(null); }} />
                </div>
                <Button loading={testing} disabled={dirty || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testTo.trim())} onClick={() => void sendTest()}>Envoyer un exemple</Button>
              </div>
              {testResult ? <Banner tone={testResult.ok ? "success" : "critical"} title={testResult.text} /> : <p className="te-note">{dirty ? "Enregistrez le thème avant d’envoyer un exemple : l’envoi utilise le thème enregistré." : "Les mots de passe oubliés, commandes et messages de contact utilisent ce thème."}</p>}
            </div>
          </div>
        </div>
      </div>

      {dirty ? (
        <div className="ss-savebar" role="region" aria-label="Enregistrer les modifications">
          <span className="ss-savebar-text">Modifications non enregistrées</span>
          <Button onClick={() => { setDraft(saved); setTestResult(null); }} disabled={saving}>Annuler</Button>
          <Button variant="primary" loading={saving} onClick={() => void save()}>Enregistrer</Button>
        </div>
      ) : null}
    </div>
  );
}
