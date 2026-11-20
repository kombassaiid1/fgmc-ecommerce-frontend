"use client";

import { useCallback, useEffect, useState } from "react";
import { AppProvider } from "@shopify/polaris";
import fr from "@shopify/polaris/locales/fr.json";
import { ExternalLink, FilePlus2, ImageIcon, Loader2, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { MediaPickerDialog } from "@/components/admin/media-picker-dialog";
import { getImageUrl } from "@/lib/api";

import { HOME_SLUG, type PageSettings, type PageSummary, createPage, deletePage, listPages, pagePath, renamePage, savePage, slugify } from "./pages-api";
import "./pages-dialog.css";

/**
 * The pages of the shop: switch between them, create one, and set the one being edited (title, address,
 * published or not, and how it shows in search results). New pages stay hidden until they are published.
 */
export function PagesDialog({
  current,
  onClose,
  onOpenPage,
  onSettingsSaved,
  canSwitch,
}: {
  current: PageSettings;
  onClose: () => void;
  /** Open another page in the builder. */
  onOpenPage: (slug: string) => void;
  onSettingsSaved: (settings: PageSettings) => void;
  /** False while the page being edited has changes that are not saved yet. */
  canSwitch: boolean;
}) {
  const [pages, setPages] = useState<PageSummary[] | null>(null);
  const [creating, setCreating] = useState(false);

  const reload = useCallback(() => {
    listPages().then(setPages).catch((error: unknown) => toast.error(error instanceof Error ? error.message : "Impossible de charger les pages."));
  }, []);
  useEffect(reload, [reload]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="pd-scrim" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="pd" role="dialog" aria-modal="true" aria-labelledby="pd-title">
        <header className="pd-head">
          <h2 id="pd-title">Pages</h2>
          <button type="button" className="pd-icon" onClick={onClose} aria-label="Fermer"><X className="size-5" aria-hidden="true" /></button>
        </header>

        <div className="pd-body">
          {/* ------------------------------------------------------------ the list */}
          <section className="pd-list" aria-label="Liste des pages">
            <button type="button" className="pd-new" onClick={() => setCreating(true)}><FilePlus2 className="size-4" aria-hidden="true" /> Nouvelle page</button>
            {!canSwitch ? <p className="pd-note">Enregistrement en cours : patientez un instant avant de changer de page.</p> : null}
            {pages === null ? (
              <p className="pd-note"><Loader2 className="inline size-4 animate-spin" aria-hidden="true" /> Chargement…</p>
            ) : (
              <ul>
                {pages.map((page) => (
                  <li key={page.slug}>
                    <button type="button" className="pd-item" aria-current={page.slug === current.slug ? "page" : undefined} disabled={!canSwitch && page.slug !== current.slug} onClick={() => (page.slug === current.slug ? undefined : onOpenPage(page.slug))}>
                      <span className="pd-item-text">
                        <span className="pd-item-title">{page.slug === current.slug ? current.title : page.title || page.slug}</span>
                        <span className="pd-item-path">{pagePath(page.slug)}</span>
                      </span>
                      <span className={`pd-badge ${page.slug === current.slug ? (current.published ? "is-live" : "") : page.published ? "is-live" : ""}`}>{(page.slug === current.slug ? current.published : page.published) ? "En ligne" : "Brouillon"}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* ------------------------------------------------------------ the details */}
          <section className="pd-detail" aria-label="Réglages de la page">
            {creating ? (
              <CreateForm pages={pages ?? []} onCancel={() => setCreating(false)} onCreated={(slug) => onOpenPage(slug)} />
            ) : (
              <SettingsForm current={current} onSaved={(settings) => { onSettingsSaved(settings); reload(); }} onRenamed={onOpenPage} onDeleted={() => onOpenPage(HOME_SLUG)} />
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function CreateForm({ pages, onCancel, onCreated }: { pages: PageSummary[]; onCancel: () => void; onCreated: (slug: string) => void }) {
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [copyFrom, setCopyFrom] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const address = slugEdited ? slug : slugify(title);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (!title.trim()) return setError("Donnez un titre à la page.");
    setBusy(true);
    try {
      const page = await createPage({ title: title.trim(), slug: address || undefined, copyFrom: copyFrom || undefined });
      toast.success("Page créée : elle reste en brouillon jusqu’à sa publication.");
      onCreated(page.slug);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Création impossible.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="pd-form">
      <h3>Nouvelle page</h3>
      <label className="pd-field">
        <span>Titre</span>
        <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="À propos de nous" maxLength={120} autoFocus />
      </label>
      <label className="pd-field">
        <span>Adresse</span>
        <div className="pd-address"><span aria-hidden="true">/</span><input value={address} onChange={(event) => { setSlug(slugify(event.target.value)); setSlugEdited(true); }} placeholder="a-propos-de-nous" maxLength={60} /></div>
        <small>Lettres minuscules, chiffres et tirets. La page sera visible sur {address ? `/${address}` : "cette adresse"} une fois publiée.</small>
      </label>
      <label className="pd-field">
        <span>Partir d’une copie de (facultatif)</span>
        <select value={copyFrom} onChange={(event) => setCopyFrom(event.target.value)}>
          <option value="">Une page vide</option>
          {pages.map((page) => <option key={page.slug} value={page.slug}>{page.title || page.slug}</option>)}
        </select>
      </label>
      {error ? <p role="alert" className="pd-error">{error}</p> : null}
      <div className="pd-actions">
        <button type="button" className="pd-btn" onClick={onCancel} disabled={busy}>Annuler</button>
        <button type="submit" className="pd-btn is-primary" disabled={busy}>{busy ? "Création…" : "Créer la page"}</button>
      </div>
    </form>
  );
}

function SettingsForm({ current, onSaved, onRenamed, onDeleted }: { current: PageSettings; onSaved: (settings: PageSettings) => void; onRenamed: (slug: string) => void; onDeleted: () => void }) {
  const isHome = current.slug === HOME_SLUG;
  const [title, setTitle] = useState(current.title);
  const [slug, setSlug] = useState(current.slug);
  const [published, setPublished] = useState(current.published);
  const [metaTitle, setMetaTitle] = useState(current.metaTitle ?? "");
  const [metaDescription, setMetaDescription] = useState(current.metaDescription ?? "");
  const [ogImage, setOgImage] = useState(current.ogImage ?? "");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const dirty = title !== current.title || published !== current.published || metaTitle !== (current.metaTitle ?? "") || metaDescription !== (current.metaDescription ?? "") || ogImage !== (current.ogImage ?? "") || slug !== current.slug;

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (!title.trim()) return setError("Donnez un titre à la page.");
    setBusy(true);
    try {
      let result = await savePage(current.slug, { title, published, metaTitle, metaDescription, ogImage });
      if (slug !== current.slug) {
        result = await renamePage(current.slug, slug);
        toast.success("Réglages enregistrés. L’adresse a changé.");
        onRenamed(result.slug);
        return;
      }
      toast.success("Réglages de la page enregistrés.");
      onSaved(result);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Enregistrement impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm(`Supprimer la page « ${current.title} » ? Son contenu sera perdu et ne pourra pas être récupéré.`)) return;
    setBusy(true);
    try {
      await deletePage(current.slug);
      toast.success("Page supprimée.");
      onDeleted();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Suppression impossible.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="pd-form">
      <div className="pd-form-head">
        <h3>Réglages de la page</h3>
        {published || isHome ? (
          <a className="pd-link" href={pagePath(current.slug)} target="_blank" rel="noopener noreferrer">Voir la page <ExternalLink className="size-3.5" aria-hidden="true" /></a>
        ) : null}
      </div>

      <label className="pd-field">
        <span>Titre</span>
        <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} />
      </label>

      <label className="pd-field">
        <span>Adresse</span>
        <div className="pd-address"><span aria-hidden="true">/</span><input value={isHome ? "" : slug} onChange={(event) => setSlug(slugify(event.target.value))} disabled={isHome} placeholder={isHome ? "(page d’accueil)" : ""} maxLength={60} /></div>
        {isHome ? <small>La page d’accueil garde l’adresse /.</small> : <small>Changer l’adresse change le lien de la page : mettez à jour les liens qui y mènent.</small>}
      </label>

      <div className="pd-switch-row">
        <button type="button" role="switch" aria-checked={published} aria-label="Page publiée" disabled={isHome} onClick={() => setPublished((value) => !value)} className="pd-switch" />
        <div>
          <strong>{published ? "En ligne" : "Brouillon"}</strong>
          <small>{isHome ? "La page d’accueil est toujours en ligne." : published ? "Visible par tous vos visiteurs. Chaque modification est mise en ligne tout de suite." : "Invisible pour les visiteurs tant que vous ne l’avez pas publiée."}</small>
        </div>
      </div>

      <fieldset className="pd-seo">
        <legend>Dans les résultats de recherche</legend>
        <label className="pd-field">
          <span>Titre pour Google <em>{metaTitle.length}/70</em></span>
          <input value={metaTitle} onChange={(event) => setMetaTitle(event.target.value)} maxLength={70} placeholder={title} />
        </label>
        <label className="pd-field">
          <span>Description <em>{metaDescription.length}/170</em></span>
          <textarea value={metaDescription} onChange={(event) => setMetaDescription(event.target.value)} maxLength={170} rows={3} placeholder="Une ou deux phrases qui donnent envie de lire la page." />
        </label>
        <div className="pd-field">
          <span>Image de partage</span>
          <div className="pd-og">
            {/* The media library can sit on any storage host. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <div className="pd-og-preview">{ogImage ? <img src={getImageUrl(ogImage)} alt="" /> : <ImageIcon className="size-5" aria-hidden="true" />}</div>
            <div className="pd-og-actions">
              <button type="button" className="pd-btn" onClick={() => setPickerOpen(true)}>{ogImage ? "Changer l’image" : "Choisir dans la médiathèque"}</button>
              {ogImage ? <button type="button" className="pd-btn is-quiet" onClick={() => setOgImage("")}>Retirer</button> : null}
            </div>
          </div>
        </div>
      </fieldset>

      {error ? <p role="alert" className="pd-error">{error}</p> : null}
      <div className="pd-actions">
        {!isHome ? <button type="button" className="pd-btn is-danger" onClick={() => void remove()} disabled={busy}><Trash2 className="size-4" aria-hidden="true" /> Supprimer</button> : <span />}
        <button type="submit" className="pd-btn is-primary" disabled={busy || !dirty}>{busy ? "Enregistrement…" : "Enregistrer les réglages"}</button>
      </div>

      {pickerOpen ? (
        <AppProvider i18n={fr}>
          <MediaPickerDialog open imagesOnly selectedUrl={ogImage || null} onClose={() => setPickerOpen(false)} onSelect={(item) => { setOgImage(item.url); setPickerOpen(false); }} />
        </AppProvider>
      ) : null}
    </form>
  );
}
