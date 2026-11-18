"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Banner, Button, Card, SkeletonBodyText } from "@shopify/polaris";
import { toast } from "sonner";
import { shippingAdmin, EMPTY_CARRIER, type Carrier } from "@/lib/api/shipping-admin";
import { glsCall, type GlsSettings, type GlsSupplements } from "./gls-api";

type ServiceType = "HOME" | "RELAY" | "FLEX" | "EXPRESS";

/** The four GLS services, named and described as in the original PrestaShop module. */
const SERVICES: Array<{ type: ServiceType; title: string; logo: string; carrierName: string; delay: string }> = [
  { type: "HOME", title: "GLS Business · En entreprise", logo: "/gls/glschezvous.jpg", carrierName: "En entreprise", delay: "Livraison en 24/48h, réservée aux professionnels" },
  { type: "RELAY", title: "GLS Relais · En point relais", logo: "/gls/glsrelais.jpg", carrierName: "En Relais GLS", delay: "Livraison en 24/48h dans le Relais GLS de votre choix" },
  { type: "FLEX", title: "GLS Flex · À domicile", logo: "/gls/glschezvousplus.jpg", carrierName: "À domicile", delay: "Livraison en 24/48h, avec SMS et choix du jour" },
  { type: "EXPRESS", title: "GLS Express · Avant 13h", logo: "/gls/gls13h.jpg", carrierName: "Express", delay: "Livraison le lendemain avant 13h en France métropolitaine" },
];

const AREAS: Array<{ key: keyof Omit<GlsSupplements, "applyIfFree">; label: string; help?: string }> = [
  { key: "mountain", label: "Zone de montagne" },
  { key: "frIsland", label: "Îles françaises", help: "Hors Corse et DOM-TOM." },
  { key: "corsica", label: "Corse" },
  { key: "gbIsland", label: "Îles britanniques" },
  { key: "spPtIsland", label: "Îles espagnoles et portugaises", help: "Hors Baléares." },
  { key: "islands", label: "Îles des autres pays" },
];

const asText = (value: number) => (value > 0 ? String(value).replace(".", ",") : "0");
const parseMoney = (text: string) => {
  const value = Number(text.trim().replace(",", ".") || "0");
  return Number.isFinite(value) && value >= 0 ? value : null;
};

/** Which shop carrier stands for each GLS service, and what GLS adds for islands and mountain areas. */
export function CarriersTab() {
  const [carriers, setCarriers] = useState<Carrier[] | null>(null);
  const [settings, setSettings] = useState<GlsSettings | null>(null);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [savingPrices, setSavingPrices] = useState(false);
  const [pricesDirty, setPricesDirty] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([shippingAdmin.carriers(), glsCall<GlsSettings>("/settings")])
      .then(([list, loaded]) => {
        if (cancelled) return;
        setCarriers(list);
        setSettings(loaded);
        setPrices(Object.fromEntries(AREAS.map((area) => [area.key, asText(loaded.supplements[area.key])])));
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Chargement impossible.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <Banner tone="critical" title="Impossible de charger les transporteurs">{error}</Banner>;
  if (!carriers || !settings) return <Card><SkeletonBodyText lines={8} /></Card>;

  const serviceOf = (carrier: Carrier) => SERVICES.find((service) => service.type === carrier.glsType);
  const assigned = (type: ServiceType) => carriers.find((carrier) => carrier.glsType === type);

  /** Points a service at one carrier; the carrier it used before goes back to being an ordinary carrier. */
  async function assign(type: ServiceType, carrierId: string) {
    const previous = assigned(type);
    if (previous?.id === carrierId || (!previous && !carrierId)) return;
    setBusy(type);
    try {
      if (previous) await shippingAdmin.setCarrierGlsType(previous.id, "");
      if (carrierId) await shippingAdmin.setCarrierGlsType(carrierId, type);
      setCarriers(await shippingAdmin.carriers());
      toast.success(carrierId ? "Transporteur associé au service GLS." : "Association retirée.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Enregistrement impossible.");
      setCarriers(await shippingAdmin.carriers().catch(() => carriers));
    } finally {
      setBusy("");
    }
  }

  async function createFor(service: (typeof SERVICES)[number]) {
    setBusy(service.type);
    try {
      const created = await shippingAdmin.createCarrier({
        ...EMPTY_CARRIER,
        name: service.carrierName,
        transitTime: service.delay,
        speedGrade: 9,
        logoUrl: service.logo,
        trackingUrl: "https://gls-group.eu/FR/fr/suivi-colis?match=@",
        glsType: service.type,
      });
      setCarriers(await shippingAdmin.carriers());
      toast.success(`Transporteur « ${created.name} » créé. Réglez maintenant ses tarifs dans Livraison, Transporteurs.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Création impossible.");
    } finally {
      setBusy("");
    }
  }

  async function saveSettings(patch: Partial<GlsSettings>, done: string) {
    const saved = await glsCall<GlsSettings>("/settings", { method: "PATCH", body: JSON.stringify(patch) });
    setSettings(saved);
    toast.success(done);
    return saved;
  }

  async function setXlOnly(on: boolean) {
    setBusy("xl");
    try {
      await saveSettings({ relayXlOnly: on }, on ? "Seuls les relais XL seront proposés." : "Tous les relais seront proposés.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Enregistrement impossible.");
    } finally {
      setBusy("");
    }
  }

  async function savePrices() {
    if (!settings) return;
    const amounts: Record<string, number> = {};
    for (const area of AREAS) {
      const value = parseMoney(prices[area.key] ?? "0");
      if (value === null) {
        toast.error(`Prix invalide pour « ${area.label} » : saisissez un nombre supérieur ou égal à 0.`);
        return;
      }
      amounts[area.key] = value;
    }
    setSavingPrices(true);
    try {
      const saved = await saveSettings({ supplements: { ...settings.supplements, ...amounts } }, "Prix supplémentaires enregistrés.");
      setPrices(Object.fromEntries(AREAS.map((area) => [area.key, asText(saved.supplements[area.key])])));
      setPricesDirty(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Enregistrement impossible.");
    } finally {
      setSavingPrices(false);
    }
  }

  async function setApplyIfFree(on: boolean) {
    if (!settings) return;
    try {
      await saveSettings({ supplements: { ...settings.supplements, applyIfFree: on } }, on ? "Le supplément s’applique même si la livraison est gratuite." : "Pas de supplément sur une livraison gratuite.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Enregistrement impossible.");
    }
  }

  const stray = carriers.filter((carrier) => carrier.glsType && !serviceOf(carrier));

  return (
    <div className="gls-carriers">
      <section className="gls-section" aria-labelledby="gls-services-title">
        <h2 id="gls-services-title" className="gls-section-title">Un transporteur pour chaque service GLS</h2>
        <p className="gls-section-lead">
          Associez chaque service GLS à un transporteur de la boutique, ou créez-le d’un clic. Ne changez l’association que pour reprendre un transporteur déjà réglé. Pour ne pas proposer un service, désactivez son transporteur dans <Link href="/admin_ben/livraison/transporteurs">Livraison, Transporteurs</Link>.
        </p>

        <ul className="gls-services">
          {SERVICES.map((service) => {
            const current = assigned(service.type);
            const working = busy === service.type;
            return (
              <li key={service.type} className="gls-service">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="gls-service-logo" src={service.logo} alt="" width={96} height={96} />
                <div className="gls-service-body">
                  <div className="gls-field">
                    <label htmlFor={`gls-service-${service.type}`}>{service.title}</label>
                    <div className="gls-service-pick">
                      <select id={`gls-service-${service.type}`} value={current?.id ?? ""} disabled={working} onChange={(event) => void assign(service.type, event.target.value)}>
                        <option value="">Choisir un transporteur</option>
                        {carriers.map((carrier) => {
                          const taken = carrier.glsType && carrier.glsType !== service.type ? SERVICES.find((item) => item.type === carrier.glsType) : undefined;
                          return (
                            <option key={carrier.id} value={carrier.id} disabled={Boolean(taken)}>
                              {carrier.name}{carrier.prestashopId ? ` (PrestaShop n° ${carrier.prestashopId})` : ""}{carrier.active ? "" : " — désactivé"}{taken ? ` — déjà utilisé par ${taken.title.split(" · ")[0]}` : ""}
                            </option>
                          );
                        })}
                      </select>
                      <span className="gls-service-or" aria-hidden="true">ou</span>
                      <Button onClick={() => void createFor(service)} loading={working} disabled={Boolean(current)}>Créer ce transporteur</Button>
                    </div>
                    {current ? (
                      <small>
                        {current.active ? "Actif" : "Désactivé"}
                        {current.ranges.length === 0 && !current.freeShipping ? " · aucun tarif : il ne sera pas proposé tant que vous n’avez pas réglé ses tarifs." : ""}{" "}
                        <Link href={`/admin_ben/livraison/transporteurs`}>Régler les tarifs</Link>
                      </small>
                    ) : (
                      <small>Aucun transporteur associé : ce service n’est pas proposé aux clients.</small>
                    )}
                  </div>

                  {service.type === "RELAY" ? (
                    <fieldset className="gls-field gls-switch-field" disabled={busy === "xl"}>
                      <legend>Afficher uniquement les relais GLS XL</legend>
                      <div className="gls-switch">
                        <label>
                          <input type="radio" name="gls-xl" checked={settings.relayXlOnly} onChange={() => void setXlOnly(true)} />
                          <span>Oui</span>
                        </label>
                        <label>
                          <input type="radio" name="gls-xl" checked={!settings.relayXlOnly} onChange={() => void setXlOnly(false)} />
                          <span>Non</span>
                        </label>
                      </div>
                      <small>Relais qui acceptent les colis de plus de 20 kg, de plus de 120 cm, ou dont longueur + 2 × largeur + hauteur dépasse 180 cm.</small>
                    </fieldset>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
        {stray.length > 0 ? <p className="gls-kept">{stray.length} transporteur(s) ont un type GLS qui n’existe plus : ouvrez-les dans Livraison pour les corriger.</p> : null}
      </section>

      <section className="gls-section gls-supplements" aria-labelledby="gls-sup-title">
        <h2 id="gls-sup-title" className="gls-section-title">Prix supplémentaire par zone géographique</h2>
        <p className="gls-section-lead">Ce montant (hors taxe) s’ajoute au prix de livraison des transporteurs GLS quand l’adresse du client est dans la zone, reconnue par son code postal. À 0, aucun supplément.</p>

        <fieldset className="gls-field gls-switch-field">
          <legend>Appliquer même si la livraison est gratuite</legend>
          <div className="gls-switch">
            <label>
              <input type="radio" name="gls-free" checked={settings.supplements.applyIfFree} onChange={() => void setApplyIfFree(true)} />
              <span>Oui</span>
            </label>
            <label>
              <input type="radio" name="gls-free" checked={!settings.supplements.applyIfFree} onChange={() => void setApplyIfFree(false)} />
              <span>Non</span>
            </label>
          </div>
        </fieldset>

        <div className="gls-area-grid">
          {AREAS.map((area) => {
            const invalid = parseMoney(prices[area.key] ?? "0") === null;
            return (
              <div key={area.key} className={`gls-field${invalid ? " has-error" : ""}`}>
                <label htmlFor={`gls-area-${area.key}`}>{area.label}</label>
                <div className="gls-money">
                  <input
                    id={`gls-area-${area.key}`}
                    inputMode="decimal"
                    value={prices[area.key] ?? "0"}
                    onChange={(event) => {
                      setPrices((old) => ({ ...old, [area.key]: event.target.value }));
                      setPricesDirty(true);
                    }}
                    aria-invalid={invalid}
                  />
                  <span>€</span>
                </div>
                {invalid ? <small>Saisissez un nombre supérieur ou égal à 0.</small> : area.help ? <small>{area.help}</small> : null}
              </div>
            );
          })}
        </div>

        <div className="gls-savebar">
          <Button variant="primary" onClick={() => void savePrices()} loading={savingPrices} disabled={!pricesDirty}>Enregistrer les prix</Button>
          <p data-dirty={pricesDirty}>{pricesDirty ? "Modifications non enregistrées" : "Les prix affichés sont ceux utilisés au paiement."}</p>
        </div>
      </section>
    </div>
  );
}
