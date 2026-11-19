"use client";

import { useEffect, useState } from "react";
import { PackageCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api/http-client";
import { getBackendBaseUrl } from "@/lib/backend-url";
import { getClientSession } from "@/lib/client-auth";

type Parcel = { id: string; trackId: string; status: string | null; delivered: boolean; createdAt: string };
type Info = { reference: string | null; parcels: Parcel[]; returnLabels: Array<{ id: string; trackId: string; createdAt: string }>; canGenerateReturn: boolean };
type TrackEvent = { date: string; time: string; description: string; place: string };

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

/** The Colissimo part of a customer's order: parcels, tracking timeline, and the return label when the shop allows it. */
export function ColissimoOrderPanel({ orderId }: { orderId: string }) {
  const [info, setInfo] = useState<Info | null>(null);
  const [events, setEvents] = useState<Record<string, TrackEvent[]>>({});
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const token = getClientSession()?.token;
    if (!token) return undefined;
    let cancelled = false;
    apiRequest<Info>({ path: `/colissimo/my/orders/${orderId}`, method: "GET", headers: bearer(token) })
      .then((loaded) => !cancelled && setInfo(loaded))
      .catch(() => !cancelled && setInfo(null));
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  async function openLabel(shipmentId: string) {
    const token = getClientSession()?.token;
    if (!token) return;
    const win = window.open("", "_blank");
    try {
      const response = await fetch(`${getBackendBaseUrl()}/colissimo/my/labels/${shipmentId}`, { headers: bearer(token) });
      if (!response.ok) throw new Error("Étiquette indisponible.");
      const url = URL.createObjectURL(await response.blob());
      if (win) win.location.href = url;
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      win?.close();
      setMessage(error instanceof Error ? error.message : "Étiquette indisponible.");
    }
  }

  async function track(parcel: Parcel) {
    const token = getClientSession()?.token;
    if (!token) return;
    setBusy(`track-${parcel.id}`);
    setMessage("");
    try {
      const result = await apiRequest<{ events: TrackEvent[] }>({ path: `/colissimo/my/orders/${orderId}/tracking/${parcel.id}`, method: "GET", headers: bearer(token) });
      setEvents((old) => ({ ...old, [parcel.id]: result.events }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Suivi indisponible pour le moment.");
    } finally {
      setBusy("");
    }
  }

  async function createReturn() {
    const token = getClientSession()?.token;
    if (!token) return;
    setBusy("return");
    setMessage("");
    try {
      const created = await apiRequest<{ id: string }>({ path: `/colissimo/my/orders/${orderId}/return`, method: "POST", headers: bearer(token) });
      setInfo(await apiRequest<Info>({ path: `/colissimo/my/orders/${orderId}`, method: "GET", headers: bearer(token) }));
      await openLabel(created.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Création de l’étiquette impossible.");
    } finally {
      setBusy("");
    }
  }

  if (!info || (info.parcels.length === 0 && info.returnLabels.length === 0)) return null;

  return (
    <section className="border-t border-border p-4 sm:p-5" aria-label="Colis Colissimo">
      <div className="mb-3 flex items-center gap-2 text-sm font-bold text-[#101828]">
        <PackageCheck className="size-4 text-primary" aria-hidden="true" />
        Suivi Colissimo
      </div>
      <ul className="grid gap-3">
        {info.parcels.map((parcel) => (
          <li key={parcel.id} className="rounded-md border border-border bg-[#fbfcfe] p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>
                Colis <strong>{parcel.trackId}</strong>
                {parcel.delivered ? <span className="ml-2 rounded bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">Livré</span> : parcel.status ? <span className="ml-2 text-muted-foreground">{parcel.status}</span> : null}
              </span>
              <span className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => void track(parcel)} disabled={busy === `track-${parcel.id}`}>{busy === `track-${parcel.id}` ? "Chargement…" : "Suivre mon colis"}</Button>
                <a className="inline-flex h-8 items-center rounded-md border border-border px-3 text-xs font-medium hover:bg-muted" href={`https://www.laposte.fr/outils/suivre-vos-envois?code=${encodeURIComponent(parcel.trackId)}`} target="_blank" rel="noopener noreferrer">laposte.fr</a>
              </span>
            </div>
            {events[parcel.id]?.length ? (
              <ol className="mt-3 space-y-1 border-l-2 border-border pl-3 text-xs text-muted-foreground">
                {events[parcel.id].map((event, index) => (
                  <li key={`${event.date}-${event.time}-${index}`}>
                    <span className="font-medium text-foreground">{event.date} {event.time}</span> · {event.description}{event.place ? ` · ${event.place}` : ""}
                  </li>
                ))}
              </ol>
            ) : null}
          </li>
        ))}
      </ul>

      {info.returnLabels.length > 0 ? (
        <ul className="mt-3 grid gap-2 text-sm">
          {info.returnLabels.map((label) => (
            <li key={label.id} className="flex flex-wrap items-center justify-between gap-2">
              <span>Étiquette retour <strong>{label.trackId}</strong></span>
              <Button type="button" size="sm" variant="outline" onClick={() => void openLabel(label.id)}>Imprimer l’étiquette retour</Button>
            </li>
          ))}
        </ul>
      ) : null}

      {info.canGenerateReturn ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-dashed border-border p-3 text-sm">
          <span>Un retour à faire ? Imprimez votre étiquette retour Colissimo, gratuite pour vous, et déposez le colis dans un point de retrait.</span>
          <Button type="button" size="sm" onClick={() => void createReturn()} disabled={busy === "return"}>{busy === "return" ? "Création…" : "Créer mon étiquette retour"}</Button>
        </div>
      ) : null}
      {message ? <p className="mt-2 text-sm text-destructive" role="alert">{message}</p> : null}
    </section>
  );
}
