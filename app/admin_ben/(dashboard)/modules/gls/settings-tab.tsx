"use client";

import { useEffect, useState } from "react";
import { Banner, Button, Card, SkeletonBodyText } from "@shopify/polaris";
import { toast } from "sonner";
import { getBackendBaseUrl } from "@/lib/backend-url";
import { orderStatesApi } from "@/lib/api/order-states";
import { glsCall, type GlsSettings } from "./gls-api";

type RelayType = GlsSettings["relayTypes"][number];
type Shipper = GlsSettings["alternativeShipper"];

const RELAY_TYPES: Array<{ value: RelayType; label: string }> = [
  { value: "SHOP", label: "Commerces partenaires" },
  { value: "LOCKER", label: "Consignes automatiques" },
  { value: "KEEPER", label: "GLS Keeper" },
];

const NO_CHANGE = { value: "", label: "Ne pas changer l’état" };

const TRACKING_ROWS: Array<{ key: keyof GlsSettings["trackingStates"]; label: string }> = [
  { key: "inTransit", label: "En transit" },
  { key: "inWarehouse", label: "Au dépôt de livraison" },
  { key: "inDelivery", label: "En cours de livraison" },
  { key: "delivered", label: "Livré" },
];

function YesNo({ legend, name, value, onChange, help }: { legend: string; name: string; value: boolean; onChange: (on: boolean) => void; help?: string }) {
  return (
    <fieldset className="gls-field gls-switch-field">
      <legend>{legend}</legend>
      <div className="gls-switch">
        <label>
          <input type="radio" name={name} checked={value} onChange={() => onChange(true)} />
          <span>Oui</span>
        </label>
        <label>
          <input type="radio" name={name} checked={!value} onChange={() => onChange(false)} />
          <span>Non</span>
        </label>
      </div>
      {help ? <small>{help}</small> : null}
    </fieldset>
  );
}

function Field({ id, label, value, onChange, max, type = "text" }: { id: string; label: string; value: string; onChange: (value: string) => void; max: number; type?: string }) {
  return (
    <div className="gls-field">
      <label htmlFor={id}>{label}</label>
      <input id={id} type={type} autoComplete="off" maxLength={max} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

/** The Réglages tab: relay display, label printing and tracking, as in the original module. */
export function SettingsTab() {
  const [settings, setSettings] = useState<GlsSettings | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [running, setRunning] = useState(false);
  // The order statuses (managed in Paramètres, États de commandes); the value is the status key.
  const [stateChoices, setStateChoices] = useState<Array<{ value: string; label: string }>>([NO_CHANGE]);

  useEffect(() => {
    let cancelled = false;
    glsCall<GlsSettings>("/settings")
      .then((loaded) => {
        if (!cancelled) setSettings(loaded);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Chargement impossible.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    orderStatesApi
      .list()
      .then((rows) => {
        if (!cancelled) setStateChoices([NO_CHANGE, ...rows.map((row) => ({ value: row.key, label: row.name }))]);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <Banner tone="critical" title="Impossible de charger les réglages">{error}</Banner>;
  if (!settings) return <Card><SkeletonBodyText lines={8} /></Card>;

  const update = (next: GlsSettings) => {
    setSettings(next);
    setDirty(true);
  };
  const alt = settings.alternativeShipper;
  const setAlt = (patch: Partial<Shipper>) => update({ ...settings, alternativeShipper: { ...alt, ...patch } });
  const trackingUrl = `${getBackendBaseUrl()}/gls/tracking/update?key=${settings.trackingKey}`;

  async function save() {
    if (!settings) return;
    setSaving(true);
    try {
      const saved = await glsCall<GlsSettings>("/settings", { method: "PATCH", body: JSON.stringify(settings) });
      setSettings(saved);
      setDirty(false);
      toast.success("Réglages GLS enregistrés.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(trackingUrl);
      toast.success("Adresse copiée.");
    } catch {
      toast.error("Copie impossible : sélectionnez l’adresse et copiez-la à la main.");
    }
  }

  async function runNow() {
    setRunning(true);
    try {
      const result = await glsCall<{ checked: number; updated: number; failed: number }>("/tracking/run", { method: "POST" });
      toast.success(`${result.checked} colis vérifiés, ${result.updated} commande(s) mise(s) à jour${result.failed ? `, ${result.failed} erreur(s) (voir le Journal)` : ""}.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Mise à jour impossible.");
    } finally {
      setRunning(false);
    }
  }

  async function newKey() {
    if (!window.confirm("Générer une nouvelle clé ? L’ancienne adresse cessera de fonctionner : pensez à changer la tâche planifiée.")) return;
    try {
      const saved = await glsCall<GlsSettings>("/settings/tracking-key", { method: "POST" });
      setSettings((old) => (old ? { ...old, trackingKey: saved.trackingKey } : saved));
      toast.success("Nouvelle clé générée.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action impossible.");
    }
  }

  const excluded = (type: RelayType) => !settings.relayTypes.includes(type);
  const exchange = settings.exchange;
  const setExchange = (patch: Partial<GlsSettings["exchange"]>) => update({ ...settings, exchange: { ...exchange, ...patch } });
  const back = settings.returnService;
  const setBack = (patch: Partial<GlsSettings["returnService"]>) => update({ ...settings, returnService: { ...back, ...patch } });
  const stateSelect = (id: string, label: string, value: string, onChange: (value: string) => void) => (
    <div className="gls-field">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)}>
        {stateChoices.map((state) => <option key={state.value} value={state.value}>{state.label}</option>)}
      </select>
    </div>
  );

  return (
    <div className="gls-settings">
      <section className="gls-section" aria-labelledby="gls-set-relay">
        <h2 id="gls-set-relay" className="gls-section-title">Affichage des relais GLS</h2>
        <fieldset className="gls-field gls-switch-field">
          <legend>Types de relais à exclure</legend>
          <div className="gls-checklist">
            {RELAY_TYPES.map((type) => (
              <label key={type.value}>
                <input
                  type="checkbox"
                  checked={excluded(type.value)}
                  onChange={(event) => {
                    const next = event.target.checked ? settings.relayTypes.filter((value) => value !== type.value) : [...settings.relayTypes, type.value];
                    if (next.length === 0) {
                      toast.error("Gardez au moins un type de point relais.");
                      return;
                    }
                    update({ ...settings, relayTypes: next });
                  }}
                />
                {type.label}
              </label>
            ))}
          </div>
          <small>Les types cochés ne sont pas proposés au client dans la recherche de point relais.</small>
        </fieldset>
      </section>

      <section className="gls-section" aria-labelledby="gls-set-exchange">
        <h2 id="gls-set-exchange" className="gls-section-title">Options d’export / import</h2>
        <p className="gls-section-lead">Pour le logiciel GLS WinExpé : l’onglet Commandes exporte les commandes en fichier CSV et lit le fichier avec les numéros de suivi que WinExpé renvoie.</p>
        <YesNo legend="Ajouter un préfixe au numéro de commande dans l’export / import GLS" name="gls-prefix-on" value={exchange.prefixEnabled} onChange={(on) => setExchange({ prefixEnabled: on })} />
        {exchange.prefixEnabled ? (
          <div className="gls-field">
            <label htmlFor="gls-prefix">Préfixe de commande</label>
            <input id="gls-prefix" maxLength={10} autoComplete="off" placeholder="1" value={exchange.prefix} onChange={(event) => setExchange({ prefix: event.target.value.replace(/[^A-Za-z0-9]/g, "") })} />
            <small>Caractères alphanumériques uniquement. Vide : le préfixe est « 1 ».</small>
          </div>
        ) : null}
        <YesNo legend="Utiliser la référence de la commande au lieu de l’identifiant" name="gls-ref" value={exchange.useReference} onChange={(on) => setExchange({ useReference: on })} help="La référence est celle imprimée sur l’étiquette GLS (8 derniers caractères de l’identifiant)." />
        <div className="gls-form-grid">
          {stateSelect("gls-state-export", "État de la commande après l’export", exchange.stateAfterExport, (value) => setExchange({ stateAfterExport: value }))}
          {stateSelect("gls-state-import", "État de la commande après l’import", exchange.stateAfterImport, (value) => setExchange({ stateAfterImport: value }))}
        </div>
      </section>

      <section className="gls-section" aria-labelledby="gls-set-labels">
        <h2 id="gls-set-labels" className="gls-section-title">Impression des étiquettes</h2>
        <YesNo legend="Proposer un bon de livraison pour chaque commande" name="gls-note" value={settings.deliveryNote} onChange={(on) => update({ ...settings, deliveryNote: on })} help="Un bouton « Imprimer le bon de livraison » apparaît dans la carte Expédition GLS de la commande." />
        <YesNo
          legend="Activer une autre adresse d’expéditeur"
          name="gls-alt"
          value={alt.enabled}
          onChange={(on) => setAlt({ enabled: on })}
          help="Par défaut, GLS imprime l’adresse de votre compte. Activez ceci pour en imprimer une autre, par exemple celle de votre entrepôt."
        />
        {alt.enabled ? (
          <div className="gls-form-grid">
            <Field id="gls-alt-name" label="Nom" max={40} value={alt.name} onChange={(value) => setAlt({ name: value })} />
            <Field id="gls-alt-name2" label="Complément de nom" max={40} value={alt.name2} onChange={(value) => setAlt({ name2: value })} />
            <Field id="gls-alt-street" label="Adresse" max={40} value={alt.street} onChange={(value) => setAlt({ street: value })} />
            <Field id="gls-alt-zip" label="Code postal" max={10} value={alt.zip} onChange={(value) => setAlt({ zip: value })} />
            <Field id="gls-alt-city" label="Ville" max={40} value={alt.city} onChange={(value) => setAlt({ city: value })} />
            <Field id="gls-alt-country" label="Pays (2 lettres)" max={2} value={alt.country} onChange={(value) => setAlt({ country: value })} />
            <Field id="gls-alt-email" label="E-mail" type="email" max={80} value={alt.email} onChange={(value) => setAlt({ email: value })} />
            <Field id="gls-alt-contact" label="Personne à contacter" max={40} value={alt.contact} onChange={(value) => setAlt({ contact: value })} />
            <Field id="gls-alt-phone" label="Téléphone" max={35} value={alt.phone} onChange={(value) => setAlt({ phone: value })} />
            <Field id="gls-alt-mobile" label="Mobile" max={35} value={alt.mobile} onChange={(value) => setAlt({ mobile: value })} />
          </div>
        ) : null}
        <YesNo legend="Activer le service retour en magasin" name="gls-return" value={back.enabled} onChange={(on) => setBack({ enabled: on })} help="Permet de créer une étiquette retour depuis la commande : le colis repart du client vers l’adresse de retour ci-dessous." />
        {back.enabled ? (
          <div className="gls-form-grid">
            <Field id="gls-back-name" label="Nom (adresse de retour)" max={40} value={back.name} onChange={(value) => setBack({ name: value })} />
            <Field id="gls-back-name2" label="Complément de nom" max={40} value={back.name2} onChange={(value) => setBack({ name2: value })} />
            <Field id="gls-back-street" label="Adresse" max={40} value={back.street} onChange={(value) => setBack({ street: value })} />
            <Field id="gls-back-zip" label="Code postal" max={10} value={back.zip} onChange={(value) => setBack({ zip: value })} />
            <Field id="gls-back-city" label="Ville" max={40} value={back.city} onChange={(value) => setBack({ city: value })} />
            <Field id="gls-back-country" label="Pays (2 lettres)" max={2} value={back.country} onChange={(value) => setBack({ country: value })} />
          </div>
        ) : null}
      </section>

      <section className="gls-section" aria-labelledby="gls-set-tracking">
        <h2 id="gls-set-tracking" className="gls-section-title">Suivi des colis</h2>
        <div className="gls-note">
          <p>
            Une tâche planifiée (cron) peut appeler l’adresse ci-dessous : les commandes avec un colis GLS en cours passent alors à l’état choisi plus bas, selon le suivi GLS. Les commandes annulées, retournées, remboursées ou déjà livrées ne sont jamais modifiées.
          </p>
          <div className="gls-url">
            <input readOnly aria-label="Adresse de mise à jour du suivi" value={trackingUrl} onFocus={(event) => event.currentTarget.select()} />
            <Button onClick={() => void copy()}>Copier</Button>
            <Button onClick={() => void runNow()} loading={running} disabled={dirty}>Lancer la mise à jour maintenant</Button>
          </div>
          <p className="gls-note-foot">
            {dirty ? "Enregistrez vos réglages avant de lancer la mise à jour. " : ""}
            Cette adresse contient une clé secrète : ne la partagez pas. <button type="button" className="gls-link" onClick={() => void newKey()}>Générer une nouvelle clé</button>
          </p>
        </div>

        <div className="gls-states" role="group" aria-label="État de commande selon le suivi GLS">
          <div className="gls-states-head" aria-hidden="true"><span>Suivi GLS</span><span>État de la commande</span></div>
          {TRACKING_ROWS.map((row) => (
            <div key={row.key} className="gls-states-row">
              <label htmlFor={`gls-track-${row.key}`}>{row.label}</label>
              <select id={`gls-track-${row.key}`} value={settings.trackingStates[row.key]} onChange={(event) => update({ ...settings, trackingStates: { ...settings.trackingStates, [row.key]: event.target.value } })}>
                {stateChoices.map((state) => <option key={state.value} value={state.value}>{state.label}</option>)}
              </select>
            </div>
          ))}
        </div>
      </section>

      <div className="gls-savebar">
        <Button variant="primary" onClick={() => void save()} loading={saving} disabled={!dirty}>Enregistrer les réglages</Button>
        <p data-dirty={dirty}>{dirty ? "Modifications non enregistrées" : "Réglages à jour."}</p>
      </div>
    </div>
  );
}
