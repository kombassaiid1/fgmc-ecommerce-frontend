"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Banner, Button, FormLayout, Select, Spinner, TextField } from "@shopify/polaris";
import { MediaPickerDialog } from "@/components/admin/media-picker-dialog";
import { getImageUrl } from "@/lib/api";
import { ExternalLink, ImageOff, Phone, Search, Share2, Store, type LucideIcon } from "lucide-react";
import { FaFacebookF, FaInstagram, FaLinkedinIn, FaPinterestP, FaSnapchat, FaTiktok, FaWhatsapp, FaXTwitter, FaYoutube } from "react-icons/fa6";
import { toast } from "sonner";

import "./site-settings.css";

/** The shop's general settings, as the SiteSettings table holds them. */
type SiteSettings = {
  siteName: string;
  siteUrl: string | null;
  logo: string | null;
  mobileLogo: string | null;
  favicon: string | null;
  contactEmail: string | null;
  phoneNumber: string | null;
  secondPhoneNumber: string | null;
  address: string | null;
  postalCode: string | null;
  city: string | null;
  country: string | null;
  orderNotificationEmail: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  metaKeywords: string | null;
  ogImage: string | null;
  robotsDefault: string | null;
  socialLinks: Record<string, string>;
  locale: string | null;
};

const TEXT_KEYS = [
  "siteName", "siteUrl", "logo", "mobileLogo", "favicon", "contactEmail", "phoneNumber", "secondPhoneNumber", "address", "postalCode", "city", "country",
  "orderNotificationEmail", "metaTitle", "metaDescription", "metaKeywords", "ogImage", "robotsDefault",
  "locale",
] as const;

type TextKey = (typeof TEXT_KEYS)[number];
type SocialId = "facebook" | "instagram" | "x" | "youtube" | "tiktok" | "linkedin" | "pinterest" | "whatsapp" | "snapchat";
type Form = Record<TextKey, string> & { social: Record<SocialId, string> };

/** The social networks the shop can link to. Each has its brand colour and its logo (Font Awesome brand icons) for its tile. */
const SOCIAL: Array<{ id: SocialId; label: string; placeholder: string; background: string; color?: string; glyph: React.ReactNode }> = [
  { id: "facebook", label: "Facebook", placeholder: "https://www.facebook.com/votrepage", background: "#1877f2", glyph: <FaFacebookF className="size-[18px]" aria-hidden="true" /> },
  { id: "instagram", label: "Instagram", placeholder: "https://www.instagram.com/votrecompte", background: "linear-gradient(45deg, #f9a03f, #e1306c 55%, #833ab4)", glyph: <FaInstagram className="size-5" aria-hidden="true" /> },
  { id: "x", label: "X (Twitter)", placeholder: "https://x.com/votrecompte", background: "#111418", glyph: <FaXTwitter className="size-[18px]" aria-hidden="true" /> },
  { id: "youtube", label: "YouTube", placeholder: "https://www.youtube.com/@votrechaine", background: "#ff0000", glyph: <FaYoutube className="size-5" aria-hidden="true" /> },
  { id: "tiktok", label: "TikTok", placeholder: "https://www.tiktok.com/@votrecompte", background: "#111418", glyph: <FaTiktok className="size-[18px]" aria-hidden="true" /> },
  { id: "linkedin", label: "LinkedIn", placeholder: "https://www.linkedin.com/company/votre-entreprise", background: "#0a66c2", glyph: <FaLinkedinIn className="size-[18px]" aria-hidden="true" /> },
  { id: "pinterest", label: "Pinterest", placeholder: "https://www.pinterest.com/votrecompte", background: "#e60023", glyph: <FaPinterestP className="size-[18px]" aria-hidden="true" /> },
  { id: "whatsapp", label: "WhatsApp", placeholder: "https://wa.me/33600000000", background: "#25d366", glyph: <FaWhatsapp className="size-5" aria-hidden="true" /> },
  { id: "snapchat", label: "Snapchat", placeholder: "https://www.snapchat.com/add/votrecompte", background: "#fffc00", color: "#111418", glyph: <FaSnapchat className="size-5" aria-hidden="true" /> },
];

function isHttpUrl(value: string) {
  try {
    return /^https?:$/.test(new URL(value.trim()).protocol);
  } catch {
    return false;
  }
}

/** The groups of the page: what the side menu lists, and which fields count towards "filled". */
const SECTIONS: Array<{ id: string; label: string; icon: LucideIcon; tone: string; color: string; keys: TextKey[]; description: string }> = [
  { id: "identite", label: "Identité", icon: Store, tone: "#eaf2ff", color: "#2456a6", keys: ["siteName", "siteUrl", "locale", "logo", "mobileLogo", "favicon"], description: "Le nom, l’adresse, la langue et les logos qui représentent votre boutique." },
  { id: "coordonnees", label: "Coordonnées", icon: Phone, tone: "#e7f7ef", color: "#18794e", keys: ["contactEmail", "phoneNumber", "secondPhoneNumber", "address", "postalCode", "city", "country", "orderNotificationEmail"], description: "Comment vos clients vous joignent, et où partent les alertes de commande." },
  { id: "seo", label: "Référencement", icon: Search, tone: "#f2edff", color: "#7044a6", keys: ["metaTitle", "metaDescription", "metaKeywords", "ogImage", "robotsDefault"], description: "Ce que Google et les réseaux sociaux affichent quand votre site apparaît." },
  { id: "reseaux", label: "Réseaux sociaux", icon: Share2, tone: "#fdeaf0", color: "#b3265a", keys: [], description: "Les pages qui représentent votre boutique sur les réseaux. Laissez vide ce que vous n’utilisez pas." },
];

function toForm(settings: SiteSettings): Form {
  const form = { social: Object.fromEntries(SOCIAL.map((network) => [network.id, settings.socialLinks?.[network.id] ?? ""])) } as Form;
  for (const key of TEXT_KEYS) form[key] = settings[key] ?? "";
  return form;
}

async function call<T>(init?: RequestInit): Promise<T> {
  const response = await fetch("/frontend-api/admin/site-settings", { cache: "no-store", ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(Array.isArray(data.message) ? data.message.join(" ") : data.message || "Action impossible.");
  return data as T;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function hostOf(url: string) {
  try {
    return new URL(url.includes("://") ? url : `https://${url}`).host;
  } catch {
    return url.trim();
  }
}

export default function SiteSettingsPage() {
  const [saved, setSaved] = useState<Form | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [active, setActive] = useState(SECTIONS[0].id);

  useEffect(() => {
    call<SiteSettings>()
      .then((settings) => {
        const initial = toForm(settings);
        setSaved(initial);
        setForm(initial);
      })
      .catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : "Impossible de charger les paramètres."));
  }, []);

  const dirty = useMemo(() => Boolean(form && saved && JSON.stringify(form) !== JSON.stringify(saved)), [form, saved]);

  // Leaving the page with unsaved changes asks first.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  // The side menu follows the section being read.
  const ready = Boolean(form);
  const observer = useRef<IntersectionObserver | null>(null);
  useEffect(() => {
    if (!ready) return;
    observer.current = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActive(visible.target.id.replace("sec-", ""));
      },
      { rootMargin: "-10% 0px -70% 0px" },
    );
    SECTIONS.forEach((section) => {
      const element = document.getElementById(`sec-${section.id}`);
      if (element) observer.current?.observe(element);
    });
    return () => observer.current?.disconnect();
  }, [ready]);

  if (!form || !saved) {
    return error ? (
      <Banner tone="critical" title="Paramètres indisponibles">{error}</Banner>
    ) : (
      <div className="flex justify-center py-16"><Spinner accessibilityLabel="Chargement des paramètres" size="large" /></div>
    );
  }

  const set = <K extends keyof Form>(key: K) => (value: Form[K]) => setForm((current) => (current ? { ...current, [key]: value } : current));
  const text = (key: TextKey, label: string, extra: Partial<React.ComponentProps<typeof TextField>> = {}) => (
    <TextField label={label} value={form[key]} onChange={set(key)} autoComplete="off" {...extra} />
  );
  /** Filled fields of a section, out of how many it has. The social section counts its networks. */
  const countOf = (section: (typeof SECTIONS)[number]): [number, number] =>
    section.id === "reseaux"
      ? [SOCIAL.filter((network) => form.social[network.id].trim() !== "").length, SOCIAL.length]
      : [section.keys.filter((key) => form[key].trim() !== "").length, section.keys.length];

  const goTo = (id: string) => {
    setActive(id);
    document.getElementById(`sec-${id}`)?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  };

  async function save() {
    if (!form) return;
    setError(null);
    for (const [key, label] of [["contactEmail", "E-mail de contact"], ["orderNotificationEmail", "E-mail des notifications de commande"]] as const) {
      if (form[key].trim() && !EMAIL.test(form[key].trim())) {
        setError(`${label} : adresse invalide.`);
        return;
      }
    }
    if (!form.siteName.trim()) {
      setError("Indiquez le nom de la boutique.");
      return;
    }
    for (const network of SOCIAL) {
      const link = form.social[network.id].trim();
      if (link && !isHttpUrl(link)) {
        setError(`${network.label} : indiquez une adresse complète, par exemple ${network.placeholder}.`);
        return;
      }
    }
    const payload: Record<string, unknown> = {};
    for (const key of TEXT_KEYS) payload[key] = form[key].trim();
    payload.socialLinks = Object.fromEntries(SOCIAL.map((network) => [network.id, form.social[network.id].trim()]).filter(([, link]) => link));
    setSaving(true);
    try {
      const result = await call<SiteSettings>({ method: "PATCH", body: JSON.stringify(payload) });
      const next = toForm(result);
      setSaved(next);
      setForm(next);
      toast.success("Paramètres enregistrés.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  }

  const host = hostOf(form.siteUrl);
  const previewTitle = form.metaTitle.trim() || form.siteName.trim() || "Titre de la page";
  const previewDescription = form.metaDescription.trim() || "Ajoutez une description : c’est le texte qui s’affiche sous le titre dans les résultats de recherche.";

  return (
    <div className="ss-page mx-auto w-full max-w-[1180px] pb-28">
      {/* ------------------------------------------------------------ header */}
      <header className="ss-hero">
        <Link href="/admin_ben/settings" className="ss-back">← Paramètres</Link>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="ss-title">Informations de la boutique</h1>
            <p className="ss-lead">Identité, coordonnées, référencement et suivi : tout ce qui décrit votre site, au même endroit.</p>
          </div>
          <span className={`ss-state ${dirty ? "is-dirty" : ""}`} role="status">
            <span aria-hidden="true" className="ss-dot" />
            {dirty ? "Modifications non enregistrées" : "Tout est enregistré"}
          </span>
        </div>
      </header>

      {error ? (
        <div className="mt-4">
          <Banner tone="critical" title="Enregistrement impossible" onDismiss={() => setError(null)}>{error}</Banner>
        </div>
      ) : null}

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[210px_minmax(0,1fr)]">
        {/* ------------------------------------------------------------ side menu */}
        <nav aria-label="Sections" className="ss-nav">
          <ul>
            {SECTIONS.map((section) => {
              const Icon = section.icon;
              const [filled, total] = countOf(section);
              return (
                <li key={section.id}>
                  <button type="button" onClick={() => goTo(section.id)} aria-current={active === section.id ? "true" : undefined} className="ss-nav-item">
                    <span className="ss-nav-icon" style={{ background: section.tone, color: section.color }}><Icon className="size-4" aria-hidden="true" /></span>
                    <span className="ss-nav-label">{section.label}</span>
                    <span className="ss-nav-count" aria-label={`${filled} champs remplis sur ${total}`}>{filled}/{total}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="min-w-0 space-y-6">
          {/* ------------------------------------------------------------ identité */}
          <Section id="identite">
            <FormLayout>
              <FormLayout.Group>
                {text("siteName", "Nom de la boutique", { requiredIndicator: true })}
                {text("siteUrl", "Adresse du site", { placeholder: "https://exemple.com" })}
              </FormLayout.Group>
              <FormLayout.Group>
                <Select label="Langue du site" value={form.locale} onChange={set("locale")} options={[{ label: "Non précisée", value: "" }, { label: "Français (fr_FR)", value: "fr_FR" }, { label: "Français, Tunisie (fr_TN)", value: "fr_TN" }, { label: "Anglais (en_US)", value: "en_US" }]} />
                <div />
              </FormLayout.Group>
              <div className="ss-tiles">
                <ImageTile label="Logo" hint="Affiché dans l’en-tête du site." value={form.logo} onChange={set("logo")} />
                <ImageTile label="Logo mobile" hint="Version compacte, pour les téléphones." value={form.mobileLogo} onChange={set("mobileLogo")} />
                <ImageTile label="Favicon" hint="Icône de l’onglet du navigateur, de préférence carrée." value={form.favicon} onChange={set("favicon")} square />
              </div>
            </FormLayout>
          </Section>

          {/* ------------------------------------------------------------ coordonnées */}
          <Section id="coordonnees">
            <FormLayout>
              <FormLayout.Group>
                {text("contactEmail", "E-mail de contact", { type: "email" })}
                {text("phoneNumber", "Téléphone", { type: "tel" })}
              </FormLayout.Group>
              <FormLayout.Group>
                {text("secondPhoneNumber", "Deuxième téléphone", { type: "tel", helpText: "Facultatif : un mobile, un numéro SAV…" })}
                <div />
              </FormLayout.Group>
              <TextField label="Adresse" value={form.address} onChange={set("address")} autoComplete="off" multiline={2} placeholder="Numéro et nom de la rue" />
              <FormLayout.Group>
                {text("postalCode", "Code postal", { autoComplete: "postal-code" })}
                {text("city", "Ville")}
                {text("country", "Pays", { placeholder: "France" })}
              </FormLayout.Group>
              {text("orderNotificationEmail", "E-mail des notifications de commande", { type: "email", helpText: "Reçoit un message à chaque nouvelle commande." })}
            </FormLayout>
          </Section>

          {/* ------------------------------------------------------------ référencement */}
          <Section id="seo">
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <FormLayout>
                {text("metaTitle", "Titre par défaut", { maxLength: 70, showCharacterCount: true, helpText: "50 à 60 caractères conviennent le mieux." })}
                <TextField label="Description par défaut" value={form.metaDescription} onChange={set("metaDescription")} autoComplete="off" multiline={3} maxLength={170} showCharacterCount helpText="150 à 160 caractères conviennent le mieux." />
                {text("metaKeywords", "Mots-clés", { helpText: "Séparés par des virgules (facultatif)." })}
                <Select label="Indexation par les moteurs de recherche" value={form.robotsDefault} onChange={set("robotsDefault")} options={[{ label: "Par défaut", value: "" }, { label: "Indexer le site", value: "index" }, { label: "Ne pas indexer", value: "noindex" }]} />
                <ImageTile label="Image de partage" hint="Affichée quand une page est partagée. 1200 × 630 px conseillé." value={form.ogImage} onChange={set("ogImage")} wide />
              </FormLayout>

              <div className="space-y-4">
                <div>
                  <p className="ss-preview-label">Aperçu dans Google</p>
                  <div className="ss-serp">
                    <div className="flex items-center gap-2">
                      <span className="ss-serp-fav">{form.favicon ? <FallbackImg src={form.favicon} alt="" className="size-4 object-contain" /> : <Store className="size-3" aria-hidden="true" />}</span>
                      <div className="min-w-0 leading-tight">
                        <div className="truncate text-sm text-[#202124]">{form.siteName.trim() || "Votre boutique"}</div>
                        <div className="truncate text-xs text-[#4d5156]">{host || "exemple.com"}</div>
                      </div>
                    </div>
                    <div className="ss-serp-title">{previewTitle}</div>
                    <p className="ss-serp-desc">{previewDescription}</p>
                  </div>
                </div>

                <div>
                  <p className="ss-preview-label">Aperçu du partage</p>
                  <div className="ss-og">
                    <div className="ss-og-image">
                      {form.ogImage ? <FallbackImg src={form.ogImage} alt="" className="size-full object-cover" /> : <span className="grid size-full place-items-center text-xs text-[#8a94a0]">Aucune image de partage</span>}
                    </div>
                    <div className="px-3 py-2.5">
                      <div className="truncate text-[11px] uppercase tracking-wide text-[#667085]">{host || "exemple.com"}</div>
                      <div className="truncate text-sm font-semibold text-[#202124]">{previewTitle}</div>
                      <div className="line-clamp-2 text-xs text-[#667085]">{previewDescription}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Section>

          {/* ------------------------------------------------------------ réseaux */}
          <Section id="reseaux">
            <ul className="ss-social">
              {SOCIAL.map((network) => {
                const value = form.social[network.id];
                const filled = value.trim() !== "";
                const valid = !filled || isHttpUrl(value);
                return (
                  <li key={network.id} className="ss-social-row">
                    <span className="ss-social-tile" style={{ background: network.background, color: network.color ?? "#fff" }} aria-hidden="true">{network.glyph}</span>
                    <span className="ss-social-name">{network.label}</span>
                    <div className="ss-social-field">
                      <TextField
                        label={`Adresse ${network.label}`}
                        labelHidden
                        value={value}
                        onChange={(next) => setForm((current) => (current ? { ...current, social: { ...current.social, [network.id]: next } } : current))}
                        autoComplete="off"
                        type="url"
                        placeholder={network.placeholder}
                        error={valid ? undefined : "Adresse invalide : commencez par https://"}
                      />
                    </div>
                    {filled && valid ? (
                      <a href={value.trim()} target="_blank" rel="noopener noreferrer" className="ss-social-open" aria-label={`Ouvrir ${network.label} dans un nouvel onglet`}>
                        <ExternalLink className="size-4" aria-hidden="true" />
                      </a>
                    ) : (
                      <span className="ss-social-open is-empty" aria-hidden="true" />
                    )}
                  </li>
                );
              })}
            </ul>
          </Section>
        </div>
      </div>

      {/* ------------------------------------------------------------ save bar */}
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
    <section id={`sec-${id}`} aria-labelledby={`ss-h-${id}`} className="ss-card">
      <div className="ss-card-head">
        <span className="ss-card-icon" style={{ background: section.tone, color: section.color }}><Icon className="size-5" aria-hidden="true" /></span>
        <div className="min-w-0">
          <h2 id={`ss-h-${id}`} className="ss-card-title">{section.label}</h2>
          <p className="ss-card-desc">{section.description}</p>
        </div>
      </div>
      <div className="ss-card-body">{children}</div>
    </section>
  );
}

/** An image chosen from the media library, with its preview on a checkerboard so transparent logos read properly. */
function ImageTile({ label, hint, value, onChange, square = false, wide = false }: { label: string; hint: string; value: string; onChange: (value: string) => void; square?: boolean; wide?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="ss-tile">
      <span className="ss-tile-label">{label}</span>
      <button type="button" onClick={() => setOpen(true)} aria-label={value ? `Changer : ${label}` : `Choisir : ${label}`} aria-haspopup="dialog" className={`ss-tile-preview ${square ? "is-square" : ""} ${wide ? "is-wide" : ""}`}>
        {value.trim() ? <FallbackImg src={value} alt={`Aperçu : ${label}`} className={wide ? "size-full object-cover" : "max-h-full max-w-full object-contain"} /> : <span className="ss-tile-empty"><ImageOff className="size-5" aria-hidden="true" /><span>Aucune image</span></span>}
        <span className="ss-tile-hover">{value.trim() ? "Changer" : "Choisir"}</span>
      </button>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="slim" onClick={() => setOpen(true)}>{value.trim() ? "Changer l’image" : "Choisir dans la médiathèque"}</Button>
        {value.trim() ? <Button size="slim" variant="tertiary" tone="critical" onClick={() => onChange("")}>Retirer</Button> : null}
      </div>
      <p className="ss-tile-hint">{hint}</p>
      <MediaPickerDialog
        open={open}
        imagesOnly
        selectedUrl={value || null}
        onClose={() => setOpen(false)}
        onSelect={(item) => {
          onChange(item.url);
          setOpen(false);
        }}
      />
    </div>
  );
}

/** Shows an image, or an "invalid image" note when the address does not load. */
function FallbackImg({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  if (failed === src) return <span className="ss-img-error"><ImageOff className="size-4" aria-hidden="true" />Image introuvable</span>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={getImageUrl(src)} alt={alt} className={className} onError={() => setFailed(src)} />;
}
