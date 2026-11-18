"use client";

import { useState } from "react";
import { MapPin, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { searchGlsRelays, type GlsRelay } from "@/lib/api/shipping";
import { cn } from "@/lib/utils";


function openingLine(relay: GlsRelay) {
  if (relay.hours.length === 0) return "Horaires non communiqués";
  const today = (new Date().getDay() + 6) % 7; // 0 = Monday
  const slot = relay.hours.find((hours) => hours.day === today);
  return slot ? `Ouvert aujourd’hui de ${slot.from} à ${slot.to}` : "Fermé aujourd’hui";
}

function distanceLabel(km: number | null) {
  if (km === null) return "";
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1).replace(".", ",")} km`;
}

/**
 * What a GLS carrier needs from the customer: for relay delivery, a pick-up point near them; for relay and
 * "Chez vous +", a mobile number (GLS sends a text message). The server checks both again when the order is placed.
 */
export function GlsDelivery({
  glsType,
  country,
  defaultZip,
  defaultCity,
  defaultStreet,
  relay,
  onRelay,
  mobile,
  onMobile,
}: {
  glsType: string;
  country: string;
  defaultZip: string;
  defaultCity: string;
  defaultStreet: string;
  relay: GlsRelay | null;
  onRelay: (relay: GlsRelay | null) => void;
  mobile: string;
  onMobile: (value: string) => void;
}) {
  const [zip, setZip] = useState(defaultZip);
  const [city, setCity] = useState(defaultCity);
  const [results, setResults] = useState<GlsRelay[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState("");

  const needsMobile = glsType === "RELAY" || glsType === "FLEX";

  async function search() {
    if (!zip.trim()) {
      setMessage("Indiquez un code postal pour chercher un point relais.");
      return;
    }
    setSearching(true);
    setMessage("");
    try {
      const found = await searchGlsRelays({ zip: zip.trim(), city: city.trim(), street: defaultStreet, country });
      setResults(found);
      if (found.length === 0) setMessage("Aucun point relais GLS trouvé dans cette zone. Élargissez la recherche, par exemple sans la ville.");
    } catch (error) {
      setResults(null);
      setMessage(error instanceof Error ? error.message : "La recherche de points relais a échoué. Réessayez dans un instant.");
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="mt-4 space-y-4 rounded-lg border border-border bg-muted/30 p-4">
      {glsType === "RELAY" ? (
        <div className="space-y-3">
          <div>
            <p className="text-sm font-semibold">Choisissez votre point relais GLS</p>
            <p className="text-sm text-muted-foreground">Votre colis vous attend dans le commerce que vous choisissez. Vous serez prévenu par SMS dès son arrivée.</p>
          </div>

          {relay ? (
            <p className="flex items-start gap-2 rounded-md border border-primary/40 bg-primary/5 px-3 py-2 text-sm" role="status">
              <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>
                <strong>{relay.name}</strong>
                <br />
                {relay.street}, {relay.zip} {relay.city}
              </span>
            </p>
          ) : null}

          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              void search();
            }}>
            <div className="space-y-1">
              <Label htmlFor="gls-zip">Code postal</Label>
              <Input id="gls-zip" value={zip} onChange={(event) => setZip(event.target.value)} inputMode="numeric" autoComplete="postal-code" className="w-36" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="gls-city">Ville (facultatif)</Label>
              <Input id="gls-city" value={city} onChange={(event) => setCity(event.target.value)} autoComplete="address-level2" className="w-48" />
            </div>
            <Button type="submit" variant="outline" disabled={searching}>
              <Search className="size-4" aria-hidden="true" />
              {searching ? "Recherche…" : "Chercher"}
            </Button>
          </form>

          {message ? <p className="text-sm text-muted-foreground" role="status">{message}</p> : null}

          {results && results.length > 0 ? (
            <ul className="grid gap-2" aria-label="Points relais GLS proches">
              {results.map((item) => {
                const chosen = relay?.id === item.id;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => onRelay(item)}
                      aria-pressed={chosen}
                      className={cn(
                        "w-full rounded-md border bg-background px-3 py-2 text-left text-sm transition-colors hover:border-primary/60 focus-visible:outline-2 focus-visible:outline-ring",
                        chosen ? "border-primary ring-2 ring-primary/30" : "border-border",
                      )}>
                      <span className="flex items-start justify-between gap-3">
                        <span className="font-semibold">{item.name}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">{distanceLabel(item.distance)}</span>
                      </span>
                      <span className="block text-muted-foreground">
                        {item.street}, {item.zip} {item.city}
                      </span>
                      <span className="block text-xs text-muted-foreground">{openingLine(item)}</span>
                      {chosen ? <span className="mt-1 inline-block text-xs font-semibold text-primary">Point relais choisi</span> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      ) : null}

      {needsMobile ? (
        <div className="space-y-1">
          <Label htmlFor="gls-mobile">Numéro de mobile</Label>
          <Input id="gls-mobile" value={mobile} onChange={(event) => onMobile(event.target.value)} inputMode="tel" autoComplete="tel-national" placeholder="06 12 34 56 78" className="max-w-xs" aria-describedby="gls-mobile-help" />
          <p id="gls-mobile-help" className="text-xs text-muted-foreground">GLS vous envoie un SMS pour vous prévenir ou vous laisser choisir le jour de livraison.</p>
        </div>
      ) : null}
    </div>
  );
}
