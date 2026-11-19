"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Bike, Car, Check, ChevronDown, MapPin, PersonStanding, Search, Smartphone, X, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getColissimoWidgetConfig, searchColissimoRelays, type ColissimoRelay, type ColissimoWidgetConfig } from "@/lib/api/shipping";
import { loadScript, loadStyle } from "@/lib/load-script";
import { cn } from "@/lib/utils";

/** The parts of Leaflet and of the Colissimo jQuery plugin this component calls. */
type LeafletMap = { setView: (center: [number, number], zoom: number) => LeafletMap; remove: () => void; fitBounds: (bounds: unknown, options?: unknown) => void };
type LeafletApi = {
  map: (element: HTMLElement) => LeafletMap;
  tileLayer: (url: string, options: unknown) => { addTo: (map: LeafletMap) => void };
  marker: (position: [number, number], options?: unknown) => { addTo: (map: LeafletMap) => { on: (event: string, handler: () => void) => void; bindTooltip: (text: string) => void } };
  latLngBounds: (points: Array<[number, number]>) => unknown;
};
type ColissimoPoint = Record<string, string>;
type JQueryLike = ((selector: string) => { frameColissimoOpen: (options: Record<string, unknown>) => void; frameColissimoClose: () => void }) & object;
declare global {
  interface Window {
    L?: LeafletApi;
    jQuery?: JQueryLike;
    callBackFrame?: (point: ColissimoPoint) => void;
  }
}

/**
 * The pop-up the pickup point widgets live in. It is rendered on the page body so no parent of the checkout (a sticky
 * header, a transformed container) can cover or clip it, and it is centred over a dimmed page like the PrestaShop one.
 */
function Overlay({ label, onClose, closeButton = true, children }: { label: string; onClose: () => void; closeButton?: boolean; children: ReactNode }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    // The native widget has its own close button (a ".widget_colissimo_close" element): it closes this pop-up too.
    const onClick = (event: MouseEvent) => {
      if ((event.target as Element | null)?.closest?.(".widget_colissimo_close")) onClose();
    };
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    document.addEventListener("click", onClick);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("click", onClick);
    };
  }, [onClose]);

  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 grid place-items-center bg-black/55 p-3" style={{ zIndex: 2147483000 }} onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={label} className="relative w-full overflow-auto rounded-xl bg-white shadow-2xl" style={{ maxWidth: 1040, maxHeight: "92vh" }} onClick={(event) => event.stopPropagation()}>
        {closeButton ? (
          <button type="button" className="absolute right-3 top-3 z-10 grid size-9 place-items-center rounded-full bg-white/90 hover:bg-muted" onClick={onClose} aria-label="Fermer">
            <X className="size-5" />
          </button>
        ) : null}
        {children}
      </div>
    </div>,
    document.body,
  );
}

/** Colissimo sends names and streets in capitals: "62 RUE MATHIEU DUSSURGEY" reads better as "62 Rue Mathieu Dussurgey". */
const titleCase = (text: string) => text.toLowerCase().replace(/(^|[\s'’-])([a-zà-ÿ])/g, (_, before: string, letter: string) => before + letter.toUpperCase());

/** What kind of point it is, from the type Colissimo gives. */
function pointKind(type: string) {
  if (["BPR", "BDP", "ACP", "CDI"].includes(type)) return "Bureau de poste";
  if (["A2P", "CMT"].includes(type)) return "Commerçant partenaire";
  if (type === "PCS") return "Consigne Pickup";
  return "Point de retrait";
}

const MOBILE_PATTERN = /^\+?[0-9 ().-]{6,20}$/;

function openingLine(relay: ColissimoRelay) {
  if (relay.hours.length === 0) return "Horaires non communiqués";
  const today = (new Date().getDay() + 6) % 7; // 0 = Monday
  const slots = relay.hours.filter((hours) => hours.day === today);
  return slots.length ? `Ouvert aujourd’hui : ${slots.map((slot) => `${slot.from}-${slot.to}`).join(" et ")}` : "Fermé aujourd’hui";
}

type TravelMode = "walk" | "bike" | "car";
const TRAVEL: Record<TravelMode, { label: string; icon: LucideIcon; kmh: number }> = {
  walk: { label: "À pied", icon: PersonStanding, kmh: 4.5 },
  bike: { label: "À vélo", icon: Bike, kmh: 14 },
  car: { label: "En voiture", icon: Car, kmh: 28 },
};

/** The time to reach a point from the distance and the way of travelling ("5 min", "1 h 05"). */
function travelTime(km: number | null, mode: TravelMode) {
  if (km === null) return "";
  const minutes = Math.max(1, Math.round((km / TRAVEL[mode].kmh) * 60));
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")}`;
}

/** The "Temps de trajet" menu: walking, by bike or by car, as in the Colissimo widget. */
function TravelMenu({ mode, onMode }: { mode: TravelMode; onMode: (mode: TravelMode) => void }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (event: MouseEvent) => {
      if (box.current && !box.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  const Current = TRAVEL[mode].icon;
  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Temps de trajet : ${TRAVEL[mode].label}`}
        className="flex h-9 items-center gap-1 rounded-md border border-border bg-background px-2.5 hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring">
        <Current className="size-5" aria-hidden="true" />
        <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden="true" />
      </button>
      {open ? (
        <div role="menu" aria-label="Temps de trajet" className="absolute right-0 top-full z-20 mt-1 w-48 overflow-hidden rounded-lg border border-border bg-background shadow-lg">
          <p className="border-b border-border px-4 py-2.5 text-sm font-semibold">Temps de trajet</p>
          {(Object.keys(TRAVEL) as TravelMode[]).map((key) => {
            const Icon = TRAVEL[key].icon;
            return (
              <button
                key={key}
                type="button"
                role="menuitemradio"
                aria-checked={mode === key}
                onClick={() => {
                  onMode(key);
                  setOpen(false);
                }}
                className={cn("flex w-full items-center gap-3 border-b border-border px-4 py-2.5 text-left text-sm last:border-b-0 hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring", mode === key ? "bg-primary/5 font-semibold" : "")}>
                <Icon className="size-5" aria-hidden="true" />
                {TRAVEL[key].label}
                {mode === key ? <Check className="ml-auto size-4 text-primary" aria-hidden="true" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function distanceLabel(km: number | null) {
  if (km === null) return "";
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1).replace(".", ",")} km`;
}

/** A point of the native Colissimo widget, in the shape the rest of the checkout uses. */
function fromWidgetPoint(point: ColissimoPoint): ColissimoRelay {
  return {
    id: String(point.identifiant),
    name: point.nom ?? "",
    street: [point.adresse1, point.adresse2].filter(Boolean).join(" "),
    zip: point.codePostal ?? "",
    city: point.localite ?? "",
    country: (point.codePays ?? "FR").toUpperCase(),
    lat: null,
    lng: null,
    distance: null,
    phone: "",
    pointType: (point.typeDePoint ?? "").toUpperCase(),
    hours: [],
  };
}

/** The map of the "OpenStreetMap" widget: the pickup points as markers, a click picks one. */
function RelayMap({ relays, chosen, onPick }: { relays: ColissimoRelay[]; chosen: string | undefined; onPick: (relay: ColissimoRelay) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const pick = useRef(onPick);
  useEffect(() => {
    pick.current = onPick;
  }, [onPick]);

  useEffect(() => {
    let map: LeafletMap | null = null;
    let cancelled = false;
    const located = relays.filter((relay) => relay.lat !== null && relay.lng !== null);
    if (located.length === 0) return undefined;
    Promise.all([loadStyle("https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"), loadScript("https://unpkg.com/leaflet@1.9.4/dist/leaflet.js")])
      .then(() => {
        const L = window.L;
        if (cancelled || !L || !box.current) return;
        map = L.map(box.current);
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap", maxZoom: 19 }).addTo(map);
        const points: Array<[number, number]> = [];
        for (const relay of located) {
          const position: [number, number] = [relay.lat as number, relay.lng as number];
          points.push(position);
          const marker = L.marker(position, { title: relay.name, opacity: relay.id === chosen ? 1 : 0.75 }).addTo(map);
          marker.on("click", () => pick.current(relay));
          marker.bindTooltip(relay.name);
        }
        map.fitBounds(L.latLngBounds(points), { padding: [24, 24], maxZoom: 15 });
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [relays, chosen]);

  if (failed) return null;
  if (!relays.some((relay) => relay.lat !== null)) return null;
  return <div ref={box} className="h-64 w-full rounded-md border border-border" role="application" aria-label="Carte des points de retrait" />;
}

/**
 * What a Colissimo carrier needs from the customer. "Point de retrait": the pickup point, chosen either with the
 * native Colissimo widget (settings of the module) or with the map widget; a mobile number (optional or not, as set
 * in the module); for a home delivery, the door codes when the module has them on.
 */
export function ColissimoDelivery({
  type,
  country,
  defaultZip,
  defaultCity,
  defaultStreet,
  relay,
  onRelay,
  mobile,
  onMobile,
  defaultMobile,
  doorCodes,
  onDoorCodes,
  onPhoneRequired,
}: {
  type: "HOME" | "HOME_SIGN" | "RELAY";
  country: string;
  defaultZip: string;
  defaultCity: string;
  defaultStreet: string;
  relay: ColissimoRelay | null;
  onRelay: (relay: ColissimoRelay | null) => void;
  mobile: string;
  onMobile: (value: string) => void;
  /** The customer's own number (account or address), offered as the mobile number when the field is empty. */
  defaultMobile: string;
  doorCodes: { code1: string; code2: string };
  onDoorCodes: (codes: { code1: string; code2: string }) => void;
  onPhoneRequired: (required: boolean) => void;
}) {
  const [config, setConfig] = useState<ColissimoWidgetConfig | null>(null);
  const [zip, setZip] = useState(defaultZip);
  const [city, setCity] = useState(defaultCity);
  const [results, setResults] = useState<ColissimoRelay[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState("");
  const [open, setOpen] = useState(false);
  const [nativeError, setNativeError] = useState("");
  const [travel, setTravel] = useState<TravelMode>("walk");
  const [device] = useState<"desktop" | "mobile">(() => (typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches ? "mobile" : "desktop"));

  useEffect(() => {
    let cancelled = false;
    getColissimoWidgetConfig(device)
      .then((loaded) => {
        if (cancelled) return;
        setConfig(loaded);
        onPhoneRequired(type === "RELAY" && !loaded.phoneOptional);
      })
      .catch(() => !cancelled && setConfig(null));
    return () => {
      cancelled = true;
    };
  }, [device, type, onPhoneRequired]);

  const prefilled = useRef(false);
  useEffect(() => {
    if (prefilled.current || type !== "RELAY") return;
    if (!mobile && defaultMobile.trim()) {
      prefilled.current = true;
      onMobile(defaultMobile.trim());
    }
  }, [type, mobile, defaultMobile, onMobile]);

  const search = useCallback(async () => {
    if (!zip.trim()) {
      setMessage("Indiquez un code postal pour chercher un point de retrait.");
      return;
    }
    setSearching(true);
    setMessage("");
    try {
      const found = await searchColissimoRelays({ zip: zip.trim(), city: city.trim(), street: defaultStreet, country, device });
      setResults(found);
      if (found.length === 0) setMessage("Aucun point de retrait Colissimo trouvé dans cette zone. Élargissez la recherche, par exemple sans la ville.");
    } catch (error) {
      setResults(null);
      setMessage(error instanceof Error ? error.message : "La recherche de points de retrait a échoué. Réessayez dans un instant.");
    } finally {
      setSearching(false);
    }
  }, [city, country, defaultStreet, device, zip]);

  /** The native Colissimo widget: its own script from ws.colissimo.fr, opened with the token the shop fetched. */
  async function openNative() {
    if (!config?.token) return;
    setNativeError("");
    setOpen(true);
    try {
      await loadScript("https://code.jquery.com/jquery-3.7.1.min.js");
      await Promise.all([loadStyle("https://api.mapbox.com/mapbox-gl-js/v2.3.1/mapbox-gl.css"), loadScript("https://api.mapbox.com/mapbox-gl-js/v2.3.1/mapbox-gl.js")]);
      await loadScript("https://ws.colissimo.fr/widget-colissimo/js/jquery.plugin.colissimo.js");
      const jq = window.jQuery;
      if (!jq) throw new Error("jQuery");
      window.callBackFrame = (point) => {
        onRelay(fromWidgetPoint(point));
        jq("#colissimo-widget-container").frameColissimoClose();
        setOpen(false);
      };
      const mobileView = device === "mobile";
      jq("#colissimo-widget-container").frameColissimoOpen({
        ceLang: "fr",
        callBackFrame: "callBackFrame",
        URLColissimo: "https://ws.colissimo.fr",
        ceCountryList: country,
        ceCountry: country,
        dyPreparationTime: config.preparationTime,
        ceAddress: defaultStreet.toUpperCase(),
        ceZipCode: zip,
        ceTown: city,
        filterRelay: config.relayFilter,
        token: config.token,
        couleur1: config.color1,
        couleur2: config.color2,
        font: config.font,
        ...(mobileView ? {} : {}),
      });
    } catch {
      setNativeError("Le widget Colissimo n’a pas pu être chargé. Utilisez la recherche ci-dessous.");
      setOpen(false);
      await search();
    }
  }

  const closeNative = useCallback(() => {
    window.jQuery?.("#colissimo-widget-container").frameColissimoClose();
    setOpen(false);
  }, []);

  const useNative = Boolean(config?.native && config.token);
  const phoneOptional = config?.phoneOptional ?? true;

  const list = (
    <>
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          void search();
        }}>
        <div className="space-y-1">
          <Label htmlFor="colissimo-zip">Code postal</Label>
          <Input id="colissimo-zip" value={zip} onChange={(event) => setZip(event.target.value)} inputMode="numeric" autoComplete="postal-code" className="w-36" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="colissimo-city">Ville (facultatif)</Label>
          <Input id="colissimo-city" value={city} onChange={(event) => setCity(event.target.value)} autoComplete="address-level2" className="w-48" />
        </div>
        <Button type="submit" variant="outline" disabled={searching}>
          <Search className="size-4" aria-hidden="true" />
          {searching ? "Recherche…" : "Chercher"}
        </Button>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Temps de trajet</span>
          <TravelMenu mode={travel} onMode={setTravel} />
        </div>
      </form>
      {message ? <p className="text-sm text-muted-foreground" role="status">{message}</p> : null}
      {results && results.length > 0 ? (
        <div className={cn("grid gap-3", config && !config.mobile?.superposed && device === "desktop" ? "md:grid-cols-2" : "")}>
          {device === "mobile" && config?.mobile && !config.mobile.displayMap ? null : (
            <RelayMap relays={results} chosen={relay?.id} onPick={(picked) => { onRelay(picked); setOpen(false); }} />
          )}
          <ul className="grid max-h-80 gap-2 overflow-auto" aria-label="Points de retrait Colissimo proches">
            {results.map((item) => {
              const chosen = relay?.id === item.id;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => { onRelay(item); setOpen(false); }}
                    aria-pressed={chosen}
                    className={cn(
                      "w-full rounded-md border bg-background px-3 py-2 text-left text-sm transition-colors hover:border-primary/60 focus-visible:outline-2 focus-visible:outline-ring",
                      chosen ? "border-primary ring-2 ring-primary/30" : "border-border",
                    )}>
                    <span className="flex items-start justify-between gap-3">
                      <span className="font-semibold">{item.name}</span>
                      <span className="shrink-0 text-right text-xs">
                        {item.distance !== null ? (
                          <span className="flex items-center justify-end gap-1 font-semibold">
                            {travelTime(item.distance, travel)}
                            {(() => {
                              const Icon = TRAVEL[travel].icon;
                              return <Icon className="size-4" aria-label={TRAVEL[travel].label} />;
                            })()}
                          </span>
                        ) : null}
                        <span className="text-muted-foreground">{distanceLabel(item.distance)}</span>
                      </span>
                    </span>
                    <span className="block text-muted-foreground">{item.street}, {item.zip} {item.city}</span>
                    <span className="block text-xs text-muted-foreground">{openingLine(item)}</span>
                    {chosen ? <span className="mt-1 inline-block text-xs font-semibold text-primary">Point de retrait choisi</span> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </>
  );

  const hasPicker = useNative || Boolean(config?.modal);
  const openPicker = () => {
    if (useNative) void openNative();
    else {
      setOpen(true);
      void search();
    }
  };
  const mobileValid = MOBILE_PATTERN.test(mobile.trim());
  const mobileInvalid = mobile.trim() !== "" && !mobileValid;
  const fromAccount = mobile.trim() !== "" && mobile.trim() === defaultMobile.trim();

  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      {type === "RELAY" ? (
        <>
          <section className="space-y-4 p-4 sm:p-5" aria-labelledby="colissimo-pickup-title">
            <header className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-[#fff1e6] text-[#e4620b]">
                <MapPin className="size-5" aria-hidden="true" />
              </span>
              <div>
                <h3 id="colissimo-pickup-title" className="text-base font-semibold leading-tight">Point de retrait Colissimo</h3>
                <p className="text-sm text-muted-foreground">Votre colis vous attend dans le commerce ou le bureau de poste de votre choix.</p>
              </div>
            </header>

            {relay ? (
              <div className="flex items-start gap-3 rounded-lg border border-primary/40 bg-primary/5 p-3" role="status">
                <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"><Check className="size-4" aria-hidden="true" /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="text-sm">{titleCase(relay.name)}</strong>
                    {relay.pointType ? <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{pointKind(relay.pointType)}</span> : null}
                  </div>
                  <p className="text-sm text-muted-foreground">{titleCase(relay.street)}, {relay.zip} {titleCase(relay.city)}</p>
                </div>
                {hasPicker ? <button type="button" className="shrink-0 rounded text-sm font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-ring" onClick={openPicker}>Changer</button> : null}
              </div>
            ) : hasPicker ? (
              <button
                type="button"
                onClick={openPicker}
                className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-primary/50 bg-primary/5 px-4 py-4 text-sm font-semibold text-primary transition-colors hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-ring">
                <MapPin className="size-4" aria-hidden="true" />
                Choisir un point de retrait
              </button>
            ) : null}
            {nativeError ? <p className="text-sm text-muted-foreground" role="status">{nativeError}</p> : null}

            {useNative && open ? (
              <Overlay label="Choix du point de retrait Colissimo" onClose={closeNative} closeButton={false}>
                <div id="colissimo-widget-container" style={{ width: "100%", minHeight: 560 }} />
              </Overlay>
            ) : null}
            {!useNative && config?.modal && open ? (
              <Overlay label="Choix du point de retrait Colissimo" onClose={() => setOpen(false)}>
                <div className="space-y-3 p-5 pr-14">{list}</div>
              </Overlay>
            ) : null}
            {!hasPicker ? list : null}
          </section>

          <section className="space-y-1.5 border-t border-border bg-muted/20 p-4 sm:p-5">
            <Label htmlFor="colissimo-mobile">Mobile pour le SMS de retrait{phoneOptional ? " (facultatif)" : ""}</Label>
            <div className="relative max-w-xs">
              <Smartphone className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                id="colissimo-mobile"
                value={mobile}
                onChange={(event) => onMobile(event.target.value)}
                inputMode="tel"
                autoComplete="tel-national"
                placeholder="06 12 34 56 78"
                className="pl-9 pr-9"
                aria-invalid={mobileInvalid}
                aria-describedby="colissimo-mobile-help"
                required={!phoneOptional}
              />
              {mobileValid ? <Check className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-green-600" aria-label="Numéro valide" /> : null}
            </div>
            <p id="colissimo-mobile-help" className={cn("text-xs", mobileInvalid ? "text-destructive" : "text-muted-foreground")} role={mobileInvalid ? "alert" : undefined}>
              {mobileInvalid ? "Ce numéro ne semble pas valide : vérifiez-le (chiffres, espaces et + uniquement)." : fromAccount ? "Numéro repris de votre compte : modifiez-le si besoin. Colissimo vous prévient par SMS dès que le colis est disponible." : "Colissimo vous prévient par SMS dès que votre colis est disponible."}
            </p>
          </section>
        </>
      ) : null}

      {type !== "RELAY" && config?.doorCodes ? (
        <fieldset className="space-y-2 p-4 sm:p-5">
          <legend className="px-0 text-sm font-semibold">Codes de porte (facultatif)</legend>
          <div className="flex flex-wrap gap-3">
            <div className="space-y-1">
              <Label htmlFor="colissimo-door1">Code de porte 1</Label>
              <Input id="colissimo-door1" value={doorCodes.code1} maxLength={8} onChange={(event) => onDoorCodes({ ...doorCodes, code1: event.target.value })} className="w-36" autoComplete="off" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="colissimo-door2">Code de porte 2</Label>
              <Input id="colissimo-door2" value={doorCodes.code2} maxLength={8} onChange={(event) => onDoorCodes({ ...doorCodes, code2: event.target.value })} className="w-36" autoComplete="off" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Ces codes sont transmis au livreur pour accéder à votre immeuble.</p>
        </fieldset>
      ) : null}

    </div>
  );
}
