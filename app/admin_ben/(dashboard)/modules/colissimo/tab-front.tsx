"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge, BlockStack, Button, ChoiceList, FormLayout, InlineStack, Select as PolarisSelect, SkeletonBodyText, Text as PolarisText, TextField } from "@shopify/polaris";
import { DeleteIcon, PlusIcon } from "@shopify/polaris-icons";
import { shippingAdmin, EMPTY_CARRIER, type Carrier } from "@/lib/api/shipping-admin";
import { Group, Panel, Select, Text, YesNo, asBool, asText, useColissimo, useForm } from "./cm-kit";
import { COLISSIMO_TRACKING_URL, colissimoCall, patch, type DeliveryDateOptions, type ModuleConfig } from "./colissimo-api";

const DAYS: Array<[string, string]> = [["monday", "Lundi"], ["tuesday", "Mardi"], ["wednesday", "Mercredi"], ["thursday", "Jeudi"], ["friday", "Vendredi"], ["saturday", "Samedi"], ["sunday", "Dimanche"]];
const HOURS = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`);
const hourOptions = HOURS.map((hour) => ({ value: hour, label: hour }));
const prepOptions = Array.from({ length: 11 }, (_, i) => ({ value: String(i), label: String(i) }));
const RELAY_FILTERS = [
  { value: "0", label: "Bureaux de poste uniquement" },
  { value: "1", label: "Tous les points de retrait" },
  { value: "2", label: "Points de retrait uniquement" },
  { value: "3", label: "Commerçants partenaires Pickup uniquement" },
  { value: "5", label: "Bureaux de poste et commerçants partenaires" },
  { value: "10", label: "Tous les points sauf les consignes Pickup" },
  { value: "11", label: "Tous les points sauf les points Pickme voisin" },
];

/* ---------------------------------------------------------------- */
/* Carriers: which shop carrier is which Colissimo service           */
/* ---------------------------------------------------------------- */

type ServiceType = "HOME" | "HOME_SIGN" | "RELAY";
const SERVICES: Array<{ type: ServiceType; title: string; carrierName: string; delay: string }> = [
  { type: "HOME", title: "Domicile sans signature", carrierName: "Colissimo Domicile", delay: "Livraison en 48h, dans la boîte aux lettres ou au domicile" },
  { type: "HOME_SIGN", title: "Domicile avec signature", carrierName: "Colissimo Domicile avec signature", delay: "Livraison en 48h, remise contre signature" },
  { type: "RELAY", title: "Point de retrait", carrierName: "Colissimo Point de retrait", delay: "Livraison en 48h dans le point de retrait de votre choix" },
];

function Carriers() {
  const { toast } = useColissimo();
  const [carriers, setCarriers] = useState<Carrier[] | null>(null);
  const [busy, setBusy] = useState("");

  useEffect(() => {
    let cancelled = false;
    shippingAdmin.carriers().then((list) => !cancelled && setCarriers(list)).catch(() => !cancelled && setCarriers([]));
    return () => {
      cancelled = true;
    };
  }, []);

  const assigned = (type: ServiceType) => carriers?.find((carrier) => carrier.colissimoType === type);
  async function reload() {
    setCarriers(await shippingAdmin.carriers());
  }
  async function assign(type: ServiceType, carrierId: string) {
    const previous = assigned(type);
    if (previous?.id === carrierId || (!previous && !carrierId)) return;
    setBusy(type);
    try {
      if (previous) await shippingAdmin.setCarrierColissimoType(previous.id, "");
      if (carrierId) await shippingAdmin.setCarrierColissimoType(carrierId, type);
      await reload();
      toast(carrierId ? "Transporteur associé au service Colissimo" : "Association retirée");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Enregistrement impossible.", true);
      await reload().catch(() => undefined);
    } finally {
      setBusy("");
    }
  }
  async function createFor(service: (typeof SERVICES)[number]) {
    setBusy(service.type);
    try {
      const created = await shippingAdmin.createCarrier({ ...EMPTY_CARRIER, name: service.carrierName, transitTime: service.delay, speedGrade: 8, trackingUrl: COLISSIMO_TRACKING_URL, colissimoType: service.type });
      await reload();
      toast(`Transporteur « ${created.name} » créé. Réglez maintenant ses tarifs.`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Création impossible.", true);
    } finally {
      setBusy("");
    }
  }

  return (
    <Panel
      title="Transporteurs"
      description={<>Chaque service Colissimo s’appuie sur un transporteur de la boutique. Ne les supprimez pas : le module en a besoin. <Link href="/admin_ben/livraison/transporteurs">Régler leurs zones, tranches et tarifs</Link>.</>}>
      {!carriers ? <SkeletonBodyText lines={4} /> : (
        <BlockStack gap="400">
          {SERVICES.map((service) => {
            const current = assigned(service.type);
            return (
              <BlockStack key={service.type} gap="150">
                <InlineStack align="space-between" blockAlign="center" gap="200">
                  <PolarisText as="h3" variant="headingSm">{service.title}</PolarisText>
                  {current ? <Badge tone={current.active ? "success" : "attention"}>{current.active ? "Actif" : "Désactivé"}</Badge> : <Badge>Non associé</Badge>}
                </InlineStack>
                <InlineStack gap="200" blockAlign="end" wrap>
                  <div style={{ flex: "1 1 260px", maxWidth: 420 }}>
                    <PolarisSelect
                      label={`Transporteur pour ${service.title}`}
                      labelHidden
                      value={current?.id ?? ""}
                      disabled={busy === service.type}
                      onChange={(value) => void assign(service.type, value)}
                      options={[
                        { label: "Choisir un transporteur", value: "" },
                        ...carriers.map((carrier) => {
                          const taken = carrier.colissimoType && carrier.colissimoType !== service.type ? SERVICES.find((item) => item.type === carrier.colissimoType) : undefined;
                          return { label: `${carrier.name}${carrier.active ? "" : " — désactivé"}${taken ? ` — déjà utilisé (${taken.title})` : ""}`, value: carrier.id, disabled: Boolean(taken) };
                        }),
                      ]}
                    />
                  </div>
                  <Button onClick={() => void createFor(service)} disabled={Boolean(current)} loading={busy === service.type} icon={PlusIcon}>Créer ce transporteur</Button>
                </InlineStack>
                <PolarisText as="p" variant="bodySm" tone="subdued">
                  {current ? (current.ranges.length === 0 && !current.freeShipping ? "Aucun tarif : il ne sera pas proposé tant que ses tarifs ne sont pas réglés." : "Proposé aux clients.") : "Sans transporteur associé, ce service n’est pas proposé aux clients."}
                </PolarisText>
              </BlockStack>
            );
          })}
        </BlockStack>
      )}
    </Panel>
  );
}

/* ---------------------------------------------------------------- */
/* Settings (DDP, door codes, weighting)                             */
/* ---------------------------------------------------------------- */

function Settings() {
  const { config } = useColissimo();
  const c = config.values;
  const form = useForm(
    {
      COLISSIMO_ENABLE_DDP: asBool(c.COLISSIMO_ENABLE_DDP),
      COLISSIMO_DDP_COST: asText(c.COLISSIMO_DDP_COST),
      COLISSIMO_DDP_GB_COST: asText(c.COLISSIMO_DDP_GB_COST),
      COLISSIMO_DDP_US_COST: asText(c.COLISSIMO_DDP_US_COST),
      COLISSIMO_ENABLE_DOOR_CODES: asBool(c.COLISSIMO_ENABLE_DOOR_CODES),
      COLISSIMO_WEIGHTING_PRICES: asBool(c.COLISSIMO_WEIGHTING_PRICES),
      COLISSIMO_WEIGHTING_TYPE: asText(c.COLISSIMO_WEIGHTING_TYPE),
      COLISSIMO_WEIGHTING_VALUE_PERCENT: asText(c.COLISSIMO_WEIGHTING_VALUE_PERCENT),
      COLISSIMO_WEIGHTING_VALUE_AMOUNT: asText(c.COLISSIMO_WEIGHTING_VALUE_AMOUNT),
    },
    (values) => patch<ModuleConfig>("/config/front", values),
  );
  const v = form.values;
  return (
    <Panel title="Tarifs et options de livraison" description="Ce que vos clients paient en plus du tarif du transporteur, et les informations qu’ils peuvent donner au paiement." onSave={() => void form.submit()} saving={form.saving} dirty={form.dirty}>
      <Group
        label="Droits de douane payés (DDP)"
        tip="Ajoute les frais de douane au prix de la livraison"
        help={<>Depuis le 29/08, les États-Unis exigent que l’exportateur paie les droits de douane : les envois doivent partir avec l’option <a href="https://www.colissimo.entreprise.laposte.fr/fr/possibilites" target="_blank" rel="noopener noreferrer">DDP (Delivered Duty Paid)</a>.</>}>
        <YesNo name="COLISSIMO_ENABLE_DDP" value={v.COLISSIMO_ENABLE_DDP} onChange={(on) => form.set("COLISSIMO_ENABLE_DDP", on)} />
      </Group>
      {v.COLISSIMO_ENABLE_DDP ? (
        <FormLayout>
          <FormLayout.Group>
          <TextField label="Coût DDP par défaut" suffix="€" value={v.COLISSIMO_DDP_COST} onChange={(value) => form.set("COLISSIMO_DDP_COST", value)} autoComplete="off" inputMode="decimal" />
          <TextField label="Royaume-Uni" suffix="€" value={v.COLISSIMO_DDP_GB_COST} onChange={(value) => form.set("COLISSIMO_DDP_GB_COST", value)} autoComplete="off" inputMode="decimal" />
          <TextField label="États-Unis" suffix="€" value={v.COLISSIMO_DDP_US_COST} onChange={(value) => form.set("COLISSIMO_DDP_US_COST", value)} autoComplete="off" inputMode="decimal" />
          </FormLayout.Group>
        </FormLayout>
      ) : null}
      <Group label="Codes de porte" tip="Affiche deux champs de code de porte au paiement" help="Le client les renseigne pour une livraison à domicile ; ils sont imprimés sur l’étiquette.">
        <YesNo name="COLISSIMO_ENABLE_DOOR_CODES" value={v.COLISSIMO_ENABLE_DOOR_CODES} onChange={(on) => form.set("COLISSIMO_ENABLE_DOOR_CODES", on)} />
      </Group>
      <Group label="Majorer les prix Colissimo" help="Ajoute un pourcentage ou un montant au tarif de chaque transporteur Colissimo.">
        <YesNo name="COLISSIMO_WEIGHTING_PRICES" value={v.COLISSIMO_WEIGHTING_PRICES} onChange={(on) => form.set("COLISSIMO_WEIGHTING_PRICES", on)} />
      </Group>
      {v.COLISSIMO_WEIGHTING_PRICES ? (
        <FormLayout>
          <ChoiceList
            title="Type de majoration"
            choices={[{ label: "Pourcentage", value: "percent" }, { label: "Montant", value: "amount" }]}
            selected={[v.COLISSIMO_WEIGHTING_TYPE]}
            onChange={([choice]) => form.set("COLISSIMO_WEIGHTING_TYPE", choice)}
          />
          {v.COLISSIMO_WEIGHTING_TYPE === "percent" ? (
            <TextField label="Pourcentage" suffix="%" value={v.COLISSIMO_WEIGHTING_VALUE_PERCENT} onChange={(value) => form.set("COLISSIMO_WEIGHTING_VALUE_PERCENT", value)} autoComplete="off" inputMode="decimal" />
          ) : (
            <TextField label="Montant" suffix="€" value={v.COLISSIMO_WEIGHTING_VALUE_AMOUNT} onChange={(value) => form.set("COLISSIMO_WEIGHTING_VALUE_AMOUNT", value)} autoComplete="off" inputMode="decimal" />
          )}
        </FormLayout>
      ) : null}
    </Panel>
  );
}

/* ---------------------------------------------------------------- */
/* Estimated delivery date                                           */
/* ---------------------------------------------------------------- */

function DeliveryDate() {
  const { config } = useColissimo();
  const [depots, setDepots] = useState<Array<{ code: string; label: string }>>([]);
  const form = useForm<{ display: boolean; options: DeliveryDateOptions }>(
    { display: asBool(config.values.COLISSIMO_DISPLAY_DELIVERY_DATE), options: config.structured.deliveryDate },
    (values) => patch<ModuleConfig>("/delivery-date", values),
  );
  const o = form.values.options;
  const setOptions = (patchValue: Partial<DeliveryDateOptions>) => form.set("options", { ...o, ...patchValue });

  useEffect(() => {
    let cancelled = false;
    colissimoCall<Array<{ code: string; label: string }>>("/depot-sites").then((list) => !cancelled && setDepots(list)).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Panel
      title="Date de livraison estimée"
      description="Affichée au paiement sous les transporteurs Colissimo. Elle n’apparaît que si l’option est aussi activée sur votre compte Colissimo."
      onSave={() => void form.submit()}
      saving={form.saving}
      dirty={form.dirty}>
      <Group label="Afficher la date dans le tunnel de commande">
        <YesNo name="COLISSIMO_DISPLAY_DELIVERY_DATE" value={form.values.display} onChange={(on) => form.set("display", on)} />
      </Group>
      <Group label="Lieu de dépôt" tip="Votre site de dépôt Colissimo" htmlFor="dd-regate" help={depots.length ? undefined : "La liste des sites n’a pas pu être chargée : saisissez le code de votre site (compte Colissimo requis)."}>
        {depots.length ? (
          <Select id="dd-regate" value={o.regate_code} onChange={(value) => setOptions({ regate_code: value })} options={[{ value: "", label: "—" }, ...depots.map((depot) => ({ value: depot.code, label: depot.label }))]} />
        ) : (
          <Text id="dd-regate" size="sm" value={o.regate_code} max={20} onChange={(value) => setOptions({ regate_code: value })} />
        )}
      </Group>
      <Group label="Heures limites et délais de préparation" tip="Passée l’heure limite du jour, la commande part le lendemain." help="Le délai est le nombre de jours pour préparer la commande avant de la déposer.">
        <div className="cm-table-wrap">
          <table className="cm-table">
            <thead><tr><th>Jour</th><th>Heure limite</th><th>Délai (jours)</th></tr></thead>
            <tbody>
              {DAYS.map(([key, label]) => (
                <tr key={key}>
                  <td>{label}</td>
                  <td><select aria-label={`Heure limite du ${label.toLowerCase()}`} value={o.cutoff_hours[key]} onChange={(event) => setOptions({ cutoff_hours: { ...o.cutoff_hours, [key]: event.target.value } })}>{hourOptions.map((h) => <option key={h.value} value={h.value}>{h.label}</option>)}</select></td>
                  <td><select aria-label={`Délai de préparation du ${label.toLowerCase()}`} value={String(o.preparation_days[key])} onChange={(event) => setOptions({ preparation_days: { ...o.preparation_days, [key]: Number(event.target.value) } })}>{prepOptions.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</select></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Group>
      <Group label="Message affiché" htmlFor="dd-text" help={<>Utilisez <code>{"{$deliveryDate}"}</code> pour placer la date où vous voulez. Sans message, Colissimo fournit le sien.</>}>
        <Text id="dd-text" value={o.text} max={300} onChange={(value) => setOptions({ text: value })} />
      </Group>
      <InlineStack gap="400" wrap>
        <Group label="Couleur du texte" htmlFor="dd-color"><input id="dd-color" type="color" value={o.text_color} onChange={(event) => setOptions({ text_color: event.target.value })} style={{ width: 56, height: 36, padding: 2 }} /></Group>
        <Group label="Police" htmlFor="dd-font"><Select id="dd-font" value={o.text_police} onChange={(value) => setOptions({ text_police: value })} options={config.lists.widgetFonts.map((font) => ({ value: font, label: font }))} size="md" /></Group>
      </InlineStack>
      <Group label="Jours exceptionnels" help="Un jour férié ou une fermeture : heure limite et délai propres à cette date.">
        <BlockStack gap="200">
          {o.exceptions.length ? (
            <div className="cm-table-wrap">
              <table className="cm-table">
                <thead><tr><th>Date</th><th>Heure limite</th><th>Délai (jours)</th><th><span style={{ position: "absolute", left: -9999 }}>Supprimer</span></th></tr></thead>
                <tbody>
                  {o.exceptions.map((item, index) => (
                    <tr key={index}>
                      <td><input type="date" aria-label="Date de l’exception" value={item.date} onChange={(event) => setOptions({ exceptions: o.exceptions.map((it, i) => (i === index ? { ...it, date: event.target.value } : it)) })} /></td>
                      <td><select aria-label="Heure limite" value={item.cutoff} onChange={(event) => setOptions({ exceptions: o.exceptions.map((it, i) => (i === index ? { ...it, cutoff: event.target.value } : it)) })}>{hourOptions.map((h) => <option key={h.value} value={h.value}>{h.label}</option>)}</select></td>
                      <td><select aria-label="Délai de préparation" value={String(item.preparation)} onChange={(event) => setOptions({ exceptions: o.exceptions.map((it, i) => (i === index ? { ...it, preparation: Number(event.target.value) } : it)) })}>{prepOptions.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</select></td>
                      <td><Button icon={DeleteIcon} variant="tertiary" tone="critical" accessibilityLabel="Supprimer cette exception" onClick={() => setOptions({ exceptions: o.exceptions.filter((_, i) => i !== index) })} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          <div><Button icon={PlusIcon} onClick={() => setOptions({ exceptions: [...o.exceptions, { date: new Date().toISOString().slice(0, 10), cutoff: "15:00", preparation: 1 }] })}>Ajouter un jour exceptionnel</Button></div>
        </BlockStack>
      </Group>
    </Panel>
  );
}

/* ---------------------------------------------------------------- */
/* Pickup widget                                                     */
/* ---------------------------------------------------------------- */

function WidgetPhone() {
  const { config } = useColissimo();
  const form = useForm({ COLISSIMO_WIDGET_PHONE: asBool(config.values.COLISSIMO_WIDGET_PHONE) }, (values) => patch<ModuleConfig>("/config/widgetPhone", values));
  return (
    <Panel title="Téléphone du point de retrait" description="Colissimo prévient le client par SMS dès que son colis est arrivé." onSave={() => void form.submit()} saving={form.saving} dirty={form.dirty}>
      <Group label="Rendre le champ facultatif" help="Si non, le client doit saisir un numéro de mobile pour choisir un point de retrait.">
        <YesNo name="COLISSIMO_WIDGET_PHONE" value={form.values.COLISSIMO_WIDGET_PHONE} onChange={(on) => form.set("COLISSIMO_WIDGET_PHONE", on)} />
      </Group>
    </Panel>
  );
}

function WidgetPanel({ mobile }: { mobile: boolean }) {
  const { config, toast } = useColissimo();
  const s = mobile ? "_MOBILE" : "";
  const k = (name: string) => `${name}${s}`;
  const c = config.values;
  const get = (name: string) => c[k(name)];
  const initial: Record<string, string | boolean> = {
    [k("COLISSIMO_WIDGET_NATIVE")]: asBool(get("COLISSIMO_WIDGET_NATIVE")),
    [k("COLISSIMO_WIDGET_REMOTE")]: asBool(get("COLISSIMO_WIDGET_REMOTE")),
    [k("COLISSIMO_WIDGET_RELAY_FILTER")]: asText(get("COLISSIMO_WIDGET_RELAY_FILTER")),
    [k("COLISSIMO_WIDGET_ENDPOINT")]: asText(get("COLISSIMO_WIDGET_ENDPOINT")),
    [k("COLISSIMO_WIDGET_COLOR_1")]: asText(get("COLISSIMO_WIDGET_COLOR_1")),
    [k("COLISSIMO_WIDGET_COLOR_2")]: asText(get("COLISSIMO_WIDGET_COLOR_2")),
    [k("COLISSIMO_WIDGET_FONT")]: asText(get("COLISSIMO_WIDGET_FONT")),
    [k("COLISSIMO_WIDGET_OSM_MAP_MODAL")]: asBool(get("COLISSIMO_WIDGET_OSM_MAP_MODAL")),
    [k("COLISSIMO_OSM_RELAY_FILTER")]: asText(get("COLISSIMO_OSM_RELAY_FILTER")),
    [k("COLISSIMO_WIDGET_OSM_NUMBER_POINT")]: asText(get("COLISSIMO_WIDGET_OSM_NUMBER_POINT")),
  };
  if (mobile) {
    initial.COLISSIMO_WIDGET_OSM_DISPLAY_MAP_MOBILE = asBool(c.COLISSIMO_WIDGET_OSM_DISPLAY_MAP_MOBILE);
    initial.COLISSIMO_WIDGET_OSM_DISPLAY_SUPERPOSED = asBool(c.COLISSIMO_WIDGET_OSM_DISPLAY_SUPERPOSED);
    initial.COLISSIMO_WIDGET_OSM_FIRST_DISPLAY = asText(c.COLISSIMO_WIDGET_OSM_FIRST_DISPLAY);
  }
  const form = useForm(initial, (values) => patch<ModuleConfig>(`/config/${mobile ? "widgetMobile" : "widget"}`, values));
  const v = form.values;
  const native = v[k("COLISSIMO_WIDGET_NATIVE")] as boolean;
  const name = (base: string) => `${base}${s}`;
  const filter = (base: string, label: string) => <PolarisSelect label={label} value={String(v[name(base)])} onChange={(value) => form.set(name(base), value)} options={RELAY_FILTERS} />;

  async function check() {
    try {
      await colissimoCall("/widget-check", { method: "POST", body: JSON.stringify({ url: v[name("COLISSIMO_WIDGET_ENDPOINT")] }) });
      toast("Le webservice du widget est disponible");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Vérification impossible.", true);
    }
  }

  return (
    <Panel
      title={mobile ? "Points de retrait sur mobile" : "Points de retrait sur ordinateur"}
      description={mobile ? "Ce que voient les clients sur téléphone, avec les réglages propres à l’écran réduit." : "Le widget de choix du point de retrait, tel que vos clients le voient au paiement sur ordinateur."}
      onSave={() => void form.submit()}
      saving={form.saving}
      dirty={form.dirty}>
      <Group label="Widget natif Colissimo" tip="Avec « Oui », le widget officiel de Colissimo est utilisé. Avec « Non », c’est un widget OpenStreetMap." help="Videz le cache de la boutique si vous changez cette option.">
        <YesNo name={name("COLISSIMO_WIDGET_NATIVE")} value={native} onChange={(on) => form.set(name("COLISSIMO_WIDGET_NATIVE"), on)} />
      </Group>

      {native ? (
        <>
          <Group label="Widget Colissimo par défaut" tip="« Oui » donne accès aux dernières fonctionnalités. Choisissez « Non » en cas de conflit d’affichage avec d’autres modules.">
            <YesNo name={name("COLISSIMO_WIDGET_REMOTE")} value={v[name("COLISSIMO_WIDGET_REMOTE")] as boolean} onChange={(on) => form.set(name("COLISSIMO_WIDGET_REMOTE"), on)} />
          </Group>
          {filter("COLISSIMO_WIDGET_RELAY_FILTER", "Points de retrait proposés")}
          <FormLayout>
            <TextField label="Adresse du webservice" value={String(v[name("COLISSIMO_WIDGET_ENDPOINT")])} onChange={(value) => form.set(name("COLISSIMO_WIDGET_ENDPOINT"), value)} maxLength={300} autoComplete="off" />
            <div><Button onClick={() => void check()} disabled={form.dirty}>Vérifier la disponibilité</Button></div>
          </FormLayout>
          <InlineStack gap="400" wrap>
            <Group label="Couleur des icônes d’information" htmlFor={name("c2")} help="Éléments en orange dans l’exemple">
              <input id={name("c2")} type="color" value={String(v[name("COLISSIMO_WIDGET_COLOR_2")])} onChange={(event) => form.set(name("COLISSIMO_WIDGET_COLOR_2"), event.target.value)} style={{ width: 56, height: 36, padding: 2 }} />
            </Group>
            <Group label="Couleur du point sélectionné" htmlFor={name("c1")} help="Éléments en gris dans l’exemple">
              <input id={name("c1")} type="color" value={String(v[name("COLISSIMO_WIDGET_COLOR_1")])} onChange={(event) => form.set(name("COLISSIMO_WIDGET_COLOR_1"), event.target.value)} style={{ width: 56, height: 36, padding: 2 }} />
            </Group>
          </InlineStack>
          <Group label="Police du texte" htmlFor={name("font")}>
            <Select id={name("font")} value={String(v[name("COLISSIMO_WIDGET_FONT")])} onChange={(value) => form.set(name("COLISSIMO_WIDGET_FONT"), value)} options={config.lists.widgetFonts.map((font) => ({ value: font, label: font }))} size="md" />
          </Group>
          <Group label="Exemple d’affichage">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="cm-preview" src={mobile ? "/colissimo/colissimo_widget_mobile.png" : "/colissimo/colissimo_widget.png"} alt="Exemple d’affichage du widget Colissimo" style={mobile ? { maxWidth: 320 } : undefined} />
          </Group>
        </>
      ) : (
        <>
          <Group label="Afficher le widget dans une fenêtre" tip="Sinon il s’affiche directement dans la page">
            <YesNo name={name("COLISSIMO_WIDGET_OSM_MAP_MODAL")} value={v[name("COLISSIMO_WIDGET_OSM_MAP_MODAL")] as boolean} onChange={(on) => form.set(name("COLISSIMO_WIDGET_OSM_MAP_MODAL"), on)} />
          </Group>
          {filter("COLISSIMO_OSM_RELAY_FILTER", "Points de retrait proposés")}
          <PolarisSelect label="Nombre de points affichés" value={String(v[name("COLISSIMO_WIDGET_OSM_NUMBER_POINT")])} onChange={(value) => form.set(name("COLISSIMO_WIDGET_OSM_NUMBER_POINT"), value)} options={Array.from({ length: 20 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))} />
        </>
      )}

      {mobile ? (
        <BlockStack gap="300">
          <PolarisText as="h3" variant="headingSm">Options mobile</PolarisText>
          <Group label="Afficher la carte" tip="Carte et liste, ou liste seule">
            <YesNo name="COLISSIMO_WIDGET_OSM_DISPLAY_MAP_MOBILE" value={v.COLISSIMO_WIDGET_OSM_DISPLAY_MAP_MOBILE as boolean} onChange={(on) => form.set("COLISSIMO_WIDGET_OSM_DISPLAY_MAP_MOBILE", on)} />
          </Group>
          <Group label="Carte et liste superposées" tip="Un bouton permet de basculer de l’une à l’autre">
            <YesNo name="COLISSIMO_WIDGET_OSM_DISPLAY_SUPERPOSED" value={v.COLISSIMO_WIDGET_OSM_DISPLAY_SUPERPOSED as boolean} onChange={(on) => form.set("COLISSIMO_WIDGET_OSM_DISPLAY_SUPERPOSED", on)} />
          </Group>
          <PolarisSelect label="Premier élément affiché" value={String(v.COLISSIMO_WIDGET_OSM_FIRST_DISPLAY)} onChange={(value) => form.set("COLISSIMO_WIDGET_OSM_FIRST_DISPLAY", value)} options={[{ value: "map", label: "Carte" }, { value: "list", label: "Liste" }]} />
        </BlockStack>
      ) : null}
    </Panel>
  );
}

/** Customers section: carriers, prices and options, delivery date and the pickup widgets. */
export function TabFront() {
  return (
    <>
      <Carriers />
      <Settings />
      <DeliveryDate />
      <WidgetPhone />
      <WidgetPanel mobile={false} />
      <WidgetPanel mobile />
    </>
  );
}
