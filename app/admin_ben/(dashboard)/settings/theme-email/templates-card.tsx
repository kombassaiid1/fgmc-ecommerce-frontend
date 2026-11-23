"use client";

import { useCallback, useEffect, useState } from "react";
import { Banner, Button, TextField } from "@shopify/polaris";
import { toast } from "sonner";

/** A model an order status can send (Paramètres, États de commande, « Modèle d’e-mail »). */
export type EmailModel = { id: string; name: string; subject: string; htmlContent: string; isActive: boolean; isDefault?: boolean };
export type ModelDraft = { id?: string; name: string; subject: string; htmlContent: string; isActive: boolean; isDefault?: boolean };

export const EMPTY_MODEL: ModelDraft = { name: "", subject: "Commande {reference} : {etat}", htmlContent: "Bonjour {client},\n\n", isActive: true };
const VARIABLES = [
  { token: "{client}", hint: "nom du client" },
  { token: "{reference}", hint: "n° de commande" },
  { token: "{etat}", hint: "nouvel état" },
  { token: "{total}", hint: "total TTC" },
  { token: "{date}", hint: "date de la commande" },
  { token: "{siteName}", hint: "nom de la boutique" },
];

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/frontend-api/admin/email-templates${path}`, { cache: "no-store", ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(Array.isArray(data.message) ? data.message.join(" ") : data.message || "Action impossible.");
  return data as T;
}

/** The shop's e-mail models. The server creates the missing ones (one per name a status points to) when they are listed. */
export function useEmailModels() {
  const [models, setModels] = useState<EmailModel[] | null>(null);
  const [error, setError] = useState("");
  const reload = useCallback(() => {
    return call<EmailModel[]>("")
      .then((list) => {
        setModels(list.slice().sort((a, b) => a.name.localeCompare(b.name, "fr")));
        setError("");
        return list;
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "Chargement des modèles impossible.");
        return [] as EmailModel[];
      });
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);
  return { models, error, reload };
}

export const toDraft = (model: EmailModel): ModelDraft => ({ id: model.id, name: model.name, subject: model.subject, htmlContent: model.htmlContent, isActive: model.isActive, isDefault: model.isDefault });

/** The subject and message of one model, edited beside its live preview. */
export function ModelEditor({
  draft,
  saved,
  onChange,
  onSaved,
  onDeleted,
}: {
  draft: ModelDraft;
  /** The model as stored, to know whether there is something to save. Null for a new one. */
  saved: EmailModel | null;
  onChange: (draft: ModelDraft) => void;
  onSaved: (model: EmailModel) => void;
  onDeleted: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const dirty = !saved || saved.name !== draft.name || saved.subject !== draft.subject || saved.htmlContent !== draft.htmlContent || saved.isActive !== draft.isActive;
  const invalid = !draft.name.trim() || !draft.subject.trim() || !draft.htmlContent.trim();

  async function save() {
    setSaving(true);
    setError("");
    const body = JSON.stringify({ name: draft.name.trim(), type: "CUSTOM", subject: draft.subject.trim(), htmlContent: draft.htmlContent, isActive: draft.isActive });
    try {
      const model = await (draft.id ? call<EmailModel>(`/${encodeURIComponent(draft.id)}`, { method: "PATCH", body }) : call<EmailModel>("", { method: "POST", body }));
      toast.success(draft.id ? "Modèle enregistré." : "Modèle créé : il est proposé dans les états de commande.");
      onSaved(model);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!draft.id || !window.confirm(`Supprimer le modèle « ${draft.name} » ? Les états qui l’utilisent enverront le message standard.`)) return;
    try {
      await call(`/${encodeURIComponent(draft.id)}`, { method: "DELETE" });
      toast.success("Modèle supprimé.");
      onDeleted();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Suppression impossible.");
    }
  }

  return (
    <div className="ss-card">
      <div className="ss-card-body grid gap-4">
        {error ? <Banner tone="critical" title={error} onDismiss={() => setError("")} /> : null}
        <TextField
          label="Nom du modèle"
          autoComplete="off"
          value={draft.name}
          maxLength={255}
          disabled={Boolean(draft.isDefault)}
          helpText={draft.isDefault ? "Modèle de la boutique : son nom est celui que les états de commande utilisent." : "Le nom proposé dans « États de commande », liste « Modèle d’e-mail »."}
          onChange={(name) => onChange({ ...draft, name })}
        />
        <TextField label="Objet de l’e-mail" autoComplete="off" value={draft.subject} maxLength={500} onChange={(subject) => onChange({ ...draft, subject })} />
        <TextField label="Message" autoComplete="off" multiline={6} value={draft.htmlContent} onChange={(htmlContent) => onChange({ ...draft, htmlContent })} helpText="Les produits et le total de la commande s’affichent sous le message." />
        <div>
          <p className="es-label">Insérer une variable</p>
          <div className="flex flex-wrap gap-1.5">
            {VARIABLES.map((variable) => (
              <button key={variable.token} type="button" className="te-var" title={variable.hint} onClick={() => onChange({ ...draft, htmlContent: `${draft.htmlContent}${variable.token}` })}>
                <code>{variable.token}</code><span>{variable.hint}</span>
              </button>
            ))}
          </div>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" checked={draft.isActive} onChange={(event) => onChange({ ...draft, isActive: event.target.checked })} />
          Modèle actif (inactif : les états qui l’utilisent envoient le message standard)
        </label>
        <div className="flex flex-wrap items-center justify-between gap-2">
          {draft.id && !draft.isDefault ? <Button tone="critical" variant="tertiary" onClick={() => void remove()}>Supprimer le modèle</Button> : <span />}
          <div className="flex gap-2">
            {saved && dirty ? <Button disabled={saving} onClick={() => onChange(toDraft(saved))}>Annuler</Button> : null}
            <Button variant="primary" loading={saving} disabled={invalid || !dirty} onClick={() => void save()}>{draft.id ? "Enregistrer le modèle" : "Créer le modèle"}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
