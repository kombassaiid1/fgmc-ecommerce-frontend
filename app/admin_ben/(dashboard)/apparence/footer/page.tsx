"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Banner, Button, Checkbox, FormLayout, Spinner, TextField } from "@shopify/polaris";
import { ChevronDownIcon, ChevronUpIcon, DeleteIcon, PlusIcon } from "@shopify/polaris-icons";
import { Copyright, Link2, Megaphone, Palette, Store, type LucideIcon } from "lucide-react";
import { toast } from "sonner";

import { FooterView } from "@/components/footer/footer-view";
import { type FooterConfig, type FooterGroup, type FooterLink, type FooterSite, DEFAULT_FOOTER, EMPTY_SITE, toFooterSite } from "@/lib/footer";
import { LogoField } from "../../livraison/logo-field";
// The page frame (title, side menu, cards, save bar) is the one of the shop information page.
import "../../settings/site/site-settings.css";
import "./footer-admin.css";

const MAX_GROUPS = 4;
const MAX_LINKS = 8;
const MAX_LEGAL = 6;

const SECTIONS: Array<{ id: string; label: string; icon: LucideIcon; tone: string; color: string; description: string }> = [
  { id: "style", label: "Style", icon: Palette, tone: "#fdeaf0", color: "#b3265a", description: "Les couleurs, et les détails d’atelier qui donnent son caractère au pied de page." },
  { id: "marque", label: "Marque", icon: Store, tone: "#eaf2ff", color: "#2456a6", description: "Logo, accroche et grand nom. Coordonnées et réseaux viennent des informations de la boutique." },
  { id: "liens", label: "Colonnes de liens", icon: Link2, tone: "#e7f7ef", color: "#18794e", description: "Jusqu’à quatre colonnes de liens, pour aider vos clients à trouver leur chemin." },
  { id: "bandeau", label: "Bandeau d’appel", icon: Megaphone, tone: "#fff4e5", color: "#a05a00", description: "Un message et un bouton, tout en haut du pied de page, pour demander un devis ou un contact." },
  { id: "bas", label: "Bas de page", icon: Copyright, tone: "#f2edff", color: "#7044a6", description: "Mention de copyright et liens légaux." },
];

/** Ready-made colour sets. */
const PRESETS: Array<{ name: string; backgroundColor: string; textColor: string; accentColor: string }> = [
  { name: "Atelier", backgroundColor: "#0b1f4d", textColor: "#ffffff", accentColor: "#e2232d" },
  { name: "Craie", backgroundColor: "#e8eef7", textColor: "#0b1f4d", accentColor: "#d3202b" },
  { name: "Charbon", backgroundColor: "#14161a", textColor: "#ffffff", accentColor: "#ff4a55" },
  { name: "Bobine", backgroundColor: "#0f3d2e", textColor: "#ffffff", accentColor: "#f5b83d" },
];

const HEX = /^#[0-9a-fA-F]{6}$/;
const linkOk = (url: string) => (url.startsWith("/") && !url.startsWith("//")) || /^(https?:\/\/|mailto:|tel:)\S+$/i.test(url);

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { cache: "no-store", ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(Array.isArray(data.message) ? data.message.join(" ") : data.message || "Action impossible.");
  return data as T;
}

/** Rows to drop on save: a link with neither label nor address. */
const withoutEmpty = (links: FooterLink[]) => links.filter((link) => link.label.trim() !== "" || link.url.trim() !== "");

export default function FooterSettingsPage() {
  const [saved, setSaved] = useState<FooterConfig | null>(null);
  const [form, setForm] = useState<FooterConfig | null>(null);
  const [site, setSite] = useState<FooterSite>(EMPTY_SITE);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [active, setActive] = useState(SECTIONS[0].id);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");

  useEffect(() => {
    call<FooterConfig>("/frontend-api/admin/footer")
      .then((config) => {
        const initial = { ...DEFAULT_FOOTER, ...config };
        setSaved(initial);
        setForm(initial);
      })
      .catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : "Impossible de charger le pied de page."));
    // The shop details only feed the preview; the footer works without them.
    call<Record<string, unknown>>("/frontend-api/admin/site-settings").then((settings) => setSite(toFooterSite(settings))).catch(() => undefined);
  }, []);

  const dirty = useMemo(() => Boolean(form && saved && JSON.stringify(form) !== JSON.stringify(saved)), [form, saved]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  // The side menu follows the section being read.
  const ready = Boolean(form);
  useEffect(() => {
    if (!ready) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActive(visible.target.id.replace("fa-", ""));
      },
      { rootMargin: "-10% 0px -70% 0px" },
    );
    SECTIONS.forEach((section) => {
      const element = document.getElementById(`fa-${section.id}`);
      if (element) observer.observe(element);
    });
    return () => observer.disconnect();
  }, [ready]);

  if (!form || !saved) {
    return error ? <Banner tone="critical" title="Pied de page indisponible">{error}</Banner> : <div className="flex justify-center py-16"><Spinner accessibilityLabel="Chargement du pied de page" size="large" /></div>;
  }

  const patch = (changes: Partial<FooterConfig>) => setForm((current) => (current ? { ...current, ...changes } : current));
  const goTo = (id: string) => {
    setActive(id);
    document.getElementById(`fa-${id}`)?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  };

  async function save() {
    if (!form) return;
    setError(null);
    const groups: FooterGroup[] = [];
    for (const group of form.groups) {
      const links = withoutEmpty(group.links);
      if (!group.title.trim() && links.length === 0) continue;
      if (!group.title.trim()) return setError("Donnez un titre à chaque colonne de liens.");
      for (const link of links) {
        if (!link.label.trim() || !link.url.trim()) return setError(`Colonne « ${group.title} » : chaque lien a besoin d’un texte et d’une adresse.`);
        if (!linkOk(link.url.trim())) return setError(`Colonne « ${group.title} » : l’adresse « ${link.url} » est invalide. Commencez par / ou https://.`);
      }
      groups.push({ title: group.title.trim(), links: links.map((link) => ({ ...link, label: link.label.trim(), url: link.url.trim() })) });
    }
    const legalLinks = withoutEmpty(form.legalLinks);
    for (const link of legalLinks) {
      if (!link.label.trim() || !link.url.trim() || !linkOk(link.url.trim())) return setError("Liens légaux : chaque lien a besoin d’un texte et d’une adresse valide (commençant par / ou https://).");
    }
    if (form.cta.enabled && form.cta.buttonLabel.trim() && !linkOk(form.cta.buttonUrl.trim())) return setError("Bandeau d’appel : l’adresse du bouton est invalide. Commencez par / ou https://.");
    for (const key of ["backgroundColor", "textColor", "accentColor"] as const) {
      if (!HEX.test(form[key])) return setError("Les couleurs doivent être au format #rrggbb.");
    }

    setSaving(true);
    try {
      const config = await call<FooterConfig>("/frontend-api/admin/footer", { method: "PUT", body: JSON.stringify({ config: { ...form, groups, legalLinks } }) });
      const next = { ...DEFAULT_FOOTER, ...config };
      setSaved(next);
      setForm(next);
      toast.success("Pied de page enregistré : il est en ligne.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  }

  const updateGroup = (index: number, change: Partial<FooterGroup>) => patch({ groups: form.groups.map((group, i) => (i === index ? { ...group, ...change } : group)) });
  const moveItem = <T,>(items: T[], from: number, to: number): T[] => {
    if (to < 0 || to >= items.length) return items;
    const next = [...items];
    next.splice(to, 0, next.splice(from, 1)[0]);
    return next;
  };

  return (
    <div className="ss-page mx-auto w-full max-w-[1180px] pb-28">
      <header className="ss-hero">
        <Link href="/admin_ben/apparence" className="ss-back">← Apparence</Link>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="ss-title">Pied de page</h1>
            <p className="ss-lead">Composez le pied de page de votre boutique et voyez le résultat avant de l’enregistrer.</p>
          </div>
          <span className={`ss-state ${dirty ? "is-dirty" : ""}`} role="status">
            <span aria-hidden="true" className="ss-dot" />
            {dirty ? "Modifications non enregistrées" : "Tout est enregistré"}
          </span>
        </div>
      </header>

      {error ? <div className="mt-4"><Banner tone="critical" title="Enregistrement impossible" onDismiss={() => setError(null)}>{error}</Banner></div> : null}

      {/* ------------------------------------------------------------ live preview */}
      <section className="fa-preview mt-6" aria-label="Aperçu du pied de page">
        <div className="fa-preview-bar">
          <span className="fa-preview-title">Aperçu en direct</span>
          <div className="fa-device" role="group" aria-label="Taille de l’aperçu">
            <button type="button" aria-pressed={device === "desktop"} onClick={() => setDevice("desktop")}>Ordinateur</button>
            <button type="button" aria-pressed={device === "mobile"} onClick={() => setDevice("mobile")}>Mobile</button>
          </div>
        </div>
        <FooterPreview device={device}>
          {form.enabled ? <FooterView config={form} site={site} preview /> : <div className="fa-off">Le pied de page est masqué sur la boutique.</div>}
        </FooterPreview>
      </section>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[210px_minmax(0,1fr)]">
        <nav aria-label="Sections" className="ss-nav">
          <ul>
            {SECTIONS.map((section) => {
              const Icon = section.icon;
              return (
                <li key={section.id}>
                  <button type="button" onClick={() => goTo(section.id)} aria-current={active === section.id ? "true" : undefined} className="ss-nav-item">
                    <span className="ss-nav-icon" style={{ background: section.tone, color: section.color }}><Icon className="size-4" aria-hidden="true" /></span>
                    <span className="ss-nav-label">{section.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="min-w-0 space-y-6">
          {/* ------------------------------------------------------------ style */}
          <Section id="style">
            <FormLayout>
              <Checkbox label="Afficher le pied de page sur la boutique" checked={form.enabled} onChange={(enabled) => patch({ enabled })} />

              <div>
                <p className="fa-label">Palettes</p>
                <div className="fa-presets">
                  {PRESETS.map((preset) => {
                    const selected = preset.backgroundColor === form.backgroundColor && preset.textColor === form.textColor && preset.accentColor === form.accentColor;
                    return (
                      <button key={preset.name} type="button" aria-pressed={selected} onClick={() => patch({ backgroundColor: preset.backgroundColor, textColor: preset.textColor, accentColor: preset.accentColor })} className="fa-preset">
                        <span className="fa-swatch" style={{ background: preset.backgroundColor }} aria-hidden="true">
                          <i style={{ background: preset.textColor }} /><i style={{ background: preset.accentColor }} />
                        </span>
                        <span>{preset.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <FormLayout.Group>
                <ColorField label="Fond" value={form.backgroundColor} onChange={(backgroundColor) => patch({ backgroundColor })} />
                <ColorField label="Texte" value={form.textColor} onChange={(textColor) => patch({ textColor })} />
                <ColorField label="Accent (points, boutons)" value={form.accentColor} onChange={(accentColor) => patch({ accentColor })} />
              </FormLayout.Group>

              <div className="ss-box">
                <p className="fa-label">Détails d’atelier</p>
                <div className="fa-toggles">
                  <Checkbox label="Grille de table de coupe" helpText="Un quadrillage fin sur le fond." checked={form.showGrid} onChange={(showGrid) => patch({ showGrid })} />
                  <Checkbox label="Bord cranté" helpText="Le haut découpé aux ciseaux, avec ses coutures." checked={form.showEdge} onChange={(showEdge) => patch({ showEdge })} />
                  <Checkbox label="Mètre ruban" helpText="Une règle graduée tout en bas." checked={form.showRuler} onChange={(showRuler) => patch({ showRuler })} />
                  <Checkbox label="Grand nom en filigrane" helpText="Le nom de la marque, en grand, tracé en contour." checked={form.showWordmark} onChange={(showWordmark) => patch({ showWordmark })} />
                  <Checkbox label="Bouton « Haut de page »" helpText="Il remonte en haut en douceur." checked={form.showBackToTop} onChange={(showBackToTop) => patch({ showBackToTop })} />
                </div>
              </div>
            </FormLayout>
          </Section>

          {/* ------------------------------------------------------------ marque */}
          <Section id="marque">
            <FormLayout>
              <LogoField value={form.logo} onChange={(logo) => patch({ logo })} noun="Logo du pied de page" change="Changer l’image" remove="Retirer" hint="Facultatif. Sans image, le logo des informations de la boutique est utilisé. Il est posé sur une étiquette blanche." />
              <TextField label="Accroche" value={form.tagline} onChange={(tagline) => patch({ tagline })} autoComplete="off" multiline={2} maxLength={200} showCharacterCount />
              <TextField label="Grand nom en filigrane" value={form.wordmark} onChange={(wordmark) => patch({ wordmark })} autoComplete="off" maxLength={24} helpText="Court de préférence : un sigle ou un nom, comme FGMC." />
              <div className="ss-box">
                <div className="fa-toggles">
                  <Checkbox label="Afficher les coordonnées" helpText="Téléphone, e-mail et adresse des informations de la boutique." checked={form.showContact} onChange={(showContact) => patch({ showContact })} />
                  <Checkbox label="Afficher les réseaux sociaux" helpText="Les réseaux renseignés dans les informations de la boutique." checked={form.showSocial} onChange={(showSocial) => patch({ showSocial })} />
                  <Checkbox label="Afficher la carte" helpText="Une carte avec l’adresse de la boutique et un bouton d’itinéraire. Elle n’apparaît que si l’adresse est renseignée." checked={form.showMap} onChange={(showMap) => patch({ showMap })} />
                </div>
                <p className="mt-3 text-xs text-[#667085]">
                  À modifier dans <Link href="/admin_ben/settings/site" className="text-[#2456a6] underline">Informations de la boutique</Link>.
                </p>
              </div>
            </FormLayout>
          </Section>

          {/* ------------------------------------------------------------ liens */}
          <Section id="liens">
            <div className="space-y-4">
              {form.groups.length === 0 ? <p className="text-sm text-[#667085]">Aucune colonne pour le moment. Ajoutez-en une pour afficher des liens.</p> : null}
              {form.groups.map((group, index) => (
                <div key={index} className="fa-group">
                  <div className="fa-group-head">
                    <div className="min-w-0 flex-1">
                      <TextField label={`Titre de la colonne ${index + 1}`} value={group.title} onChange={(title) => updateGroup(index, { title })} autoComplete="off" maxLength={60} />
                    </div>
                    <div className="fa-group-actions">
                      <Button icon={ChevronUpIcon} accessibilityLabel={`Monter la colonne ${group.title || index + 1}`} disabled={index === 0} onClick={() => patch({ groups: moveItem(form.groups, index, index - 1) })} />
                      <Button icon={ChevronDownIcon} accessibilityLabel={`Descendre la colonne ${group.title || index + 1}`} disabled={index === form.groups.length - 1} onClick={() => patch({ groups: moveItem(form.groups, index, index + 1) })} />
                      <Button icon={DeleteIcon} tone="critical" accessibilityLabel={`Supprimer la colonne ${group.title || index + 1}`} onClick={() => patch({ groups: form.groups.filter((_, i) => i !== index) })} />
                    </div>
                  </div>
                  <LinkRows links={group.links} max={MAX_LINKS} onChange={(links) => updateGroup(index, { links })} />
                </div>
              ))}
              <Button icon={PlusIcon} disabled={form.groups.length >= MAX_GROUPS} onClick={() => patch({ groups: [...form.groups, { title: "", links: [{ label: "", url: "", newTab: false }] }] })}>
                {form.groups.length >= MAX_GROUPS ? `${MAX_GROUPS} colonnes au maximum` : "Ajouter une colonne"}
              </Button>
            </div>
          </Section>

          {/* ------------------------------------------------------------ bandeau */}
          <Section id="bandeau">
            <FormLayout>
              <Checkbox label="Afficher le bandeau d’appel" checked={form.cta.enabled} onChange={(enabled) => patch({ cta: { ...form.cta, enabled } })} />
              {form.cta.enabled ? (
                <>
                  <TextField label="Titre" value={form.cta.title} onChange={(title) => patch({ cta: { ...form.cta, title } })} autoComplete="off" maxLength={120} showCharacterCount />
                  <TextField label="Texte" value={form.cta.text} onChange={(text) => patch({ cta: { ...form.cta, text } })} autoComplete="off" multiline={2} maxLength={240} />
                  <FormLayout.Group>
                    <TextField label="Texte du bouton" value={form.cta.buttonLabel} onChange={(buttonLabel) => patch({ cta: { ...form.cta, buttonLabel } })} autoComplete="off" maxLength={40} />
                    <TextField label="Adresse du bouton" value={form.cta.buttonUrl} onChange={(buttonUrl) => patch({ cta: { ...form.cta, buttonUrl } })} autoComplete="off" placeholder="/informations" error={form.cta.buttonUrl.trim() && !linkOk(form.cta.buttonUrl.trim()) ? "Commencez par / ou https://" : undefined} />
                  </FormLayout.Group>
                </>
              ) : null}
            </FormLayout>
          </Section>

          {/* ------------------------------------------------------------ bas de page */}
          <Section id="bas">
            <FormLayout>
              <TextField label="Mention de copyright" value={form.copyright} onChange={(copyright) => patch({ copyright })} autoComplete="off" maxLength={200} helpText="{year} devient l’année en cours et {siteName} le nom de la boutique." />
              <div>
                <p className="fa-label">Liens légaux</p>
                <LinkRows links={form.legalLinks} max={MAX_LEGAL} onChange={(legalLinks) => patch({ legalLinks })} addLabel="Ajouter un lien légal" emptyText="Mentions légales, conditions de vente, confidentialité…" />
              </div>
            </FormLayout>
          </Section>
        </div>
      </div>

      {dirty ? (
        <div className="ss-savebar" role="region" aria-label="Enregistrer les modifications">
          <span className="ss-savebar-text">Modifications non enregistrées</span>
          <Button disabled={saving} onClick={() => setForm(saved)}>Annuler</Button>
          <Button variant="primary" loading={saving} onClick={() => void save()}>Enregistrer</Button>
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Section({ id, children }: { id: string; children: React.ReactNode }) {
  const section = SECTIONS.find((item) => item.id === id) ?? SECTIONS[0];
  const Icon = section.icon;
  return (
    <section id={`fa-${id}`} aria-labelledby={`fa-h-${id}`} className="ss-card">
      <div className="ss-card-head">
        <span className="ss-card-icon" style={{ background: section.tone, color: section.color }}><Icon className="size-5" aria-hidden="true" /></span>
        <div className="min-w-0">
          <h2 id={`fa-h-${id}`} className="ss-card-title">{section.label}</h2>
          <p className="ss-card-desc">{section.description}</p>
        </div>
      </div>
      <div className="ss-card-body">{children}</div>
    </section>
  );
}

/** The footer drawn at the width of a computer or a phone, shrunk to fit the page. */
function FooterPreview({ device, children }: { device: "desktop" | "mobile"; children: React.ReactNode }) {
  const frame = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(900);
  useEffect(() => {
    const element = frame.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const target = device === "desktop" ? 1280 : 390;
  const scale = Math.min(1, width / target);
  return (
    <div ref={frame} className="fa-frame">
      <div className="fa-page-bg" style={{ width: target * scale }}>
        <div style={{ width: target, zoom: scale }}>
          <div className="fa-fake-page" aria-hidden="true"><span /><span /><span /></div>
          {children}
        </div>
      </div>
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="fa-color">
      <label className="fa-label" htmlFor={`fa-color-${label}`}>{label}</label>
      <div className="fa-color-row">
        <input type="color" aria-label={`${label} (sélecteur)`} value={HEX.test(value) ? value : "#000000"} onChange={(event) => onChange(event.target.value)} />
        <input id={`fa-color-${label}`} type="text" value={value} onChange={(event) => onChange(event.target.value)} spellCheck={false} aria-invalid={!HEX.test(value)} />
      </div>
    </div>
  );
}

/** The rows of a list of links: text, address, new-tab choice, and move/delete buttons. */
function LinkRows({ links, max, onChange, addLabel = "Ajouter un lien", emptyText }: { links: FooterLink[]; max: number; onChange: (links: FooterLink[]) => void; addLabel?: string; emptyText?: string }) {
  const set = (index: number, change: Partial<FooterLink>) => onChange(links.map((link, i) => (i === index ? { ...link, ...change } : link)));
  const move = (from: number, to: number) => {
    if (to < 0 || to >= links.length) return;
    const next = [...links];
    next.splice(to, 0, next.splice(from, 1)[0]);
    onChange(next);
  };
  return (
    <div className="fa-links">
      {links.length === 0 && emptyText ? <p className="text-sm text-[#667085]">{emptyText}</p> : null}
      {links.map((link, index) => {
        const invalid = link.url.trim() !== "" && !linkOk(link.url.trim());
        return (
          <div key={index} className="fa-link-row">
            <TextField label={`Texte du lien ${index + 1}`} labelHidden placeholder="Texte du lien" value={link.label} onChange={(label) => set(index, { label })} autoComplete="off" maxLength={80} />
            <TextField label={`Adresse du lien ${index + 1}`} labelHidden placeholder="/page ou https://…" value={link.url} onChange={(url) => set(index, { url })} autoComplete="off" error={invalid ? "Commencez par / ou https://" : undefined} />
            <Checkbox label="Nouvel onglet" checked={link.newTab} onChange={(newTab) => set(index, { newTab })} />
            <div className="fa-group-actions">
              <Button icon={ChevronUpIcon} size="slim" accessibilityLabel={`Monter le lien ${index + 1}`} disabled={index === 0} onClick={() => move(index, index - 1)} />
              <Button icon={ChevronDownIcon} size="slim" accessibilityLabel={`Descendre le lien ${index + 1}`} disabled={index === links.length - 1} onClick={() => move(index, index + 1)} />
              <Button icon={DeleteIcon} size="slim" tone="critical" accessibilityLabel={`Supprimer le lien ${index + 1}`} onClick={() => onChange(links.filter((_, i) => i !== index))} />
            </div>
          </div>
        );
      })}
      <Button size="slim" icon={PlusIcon} disabled={links.length >= max} onClick={() => onChange([...links, { label: "", url: "", newTab: false }])}>{links.length >= max ? `${max} liens au maximum` : addLabel}</Button>
    </div>
  );
}

