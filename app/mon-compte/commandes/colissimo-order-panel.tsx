"use client";

import { useEffect, useState } from "react";
import { PiArrowSquareOutBold, PiArrowUUpLeftDuotone, PiSpinnerGapBold, PiTruckDuotone } from "react-icons/pi";

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
    <section aria-label="Colis Colissimo">
      <h3 className="oc-block-title"><PiTruckDuotone className="size-5" aria-hidden="true" />Suivi Colissimo</h3>
      <ul className="oc-parcels">
        {info.parcels.map((parcel) => (
          <li key={parcel.id} className="oc-parcel">
            <div className="oc-parcel-head">
              <span className="oc-parcel-id">
                Colis <strong>{parcel.trackId}</strong>
                {parcel.delivered ? <span className="oc-delivered" style={{ marginLeft: 8 }}>Livré</span> : parcel.status ? <span style={{ marginLeft: 8 }}>{parcel.status}</span> : null}
              </span>
              <span className="oc-parcel-actions">
                <button type="button" className="oc-btn is-small" onClick={() => void track(parcel)} disabled={busy === `track-${parcel.id}`}>
                  {busy === `track-${parcel.id}` ? <PiSpinnerGapBold className="oc-spin size-4" aria-hidden="true" /> : null}
                  {busy === `track-${parcel.id}` ? "Chargement…" : "Suivre mon colis"}
                </button>
                <a className="oc-btn is-line is-small" href={`https://www.laposte.fr/outils/suivre-vos-envois?code=${encodeURIComponent(parcel.trackId)}`} target="_blank" rel="noopener noreferrer">
                  laposte.fr<PiArrowSquareOutBold className="size-4" aria-hidden="true" />
                </a>
              </span>
            </div>
            {events[parcel.id]?.length ? (
              <ol className="oc-timeline">
                {events[parcel.id].map((event, index) => (
                  <li key={`${event.date}-${event.time}-${index}`}>
                    <strong>{event.date} {event.time}</strong> · {event.description}
                    {event.place ? ` · ${event.place}` : ""}
                  </li>
                ))}
              </ol>
            ) : null}
          </li>
        ))}
      </ul>

      {info.returnLabels.length > 0 ? (
        <ul className="oc-parcels" style={{ marginTop: 12 }}>
          {info.returnLabels.map((label) => (
            <li key={label.id} className="oc-return">
              <span>Étiquette retour <strong>{label.trackId}</strong></span>
              <button type="button" className="oc-btn is-line is-small" onClick={() => void openLabel(label.id)}>Imprimer l’étiquette retour</button>
            </li>
          ))}
        </ul>
      ) : null}

      {info.canGenerateReturn ? (
        <div className="oc-return" style={{ marginTop: 12 }}>
          <span><PiArrowUUpLeftDuotone className="inline size-5" aria-hidden="true" style={{ marginRight: 6, verticalAlign: "-4px" }} />Un retour à faire ? Imprimez votre étiquette retour Colissimo, gratuite pour vous, et déposez le colis dans un point de retrait.</span>
          <button type="button" className="oc-btn is-small" onClick={() => void createReturn()} disabled={busy === "return"}>{busy === "return" ? "Création…" : "Créer mon étiquette retour"}</button>
        </div>
      ) : null}
      {message ? <p className="oc-msg" role="alert" style={{ marginTop: 10 }}>{message}</p> : null}
    </section>
  );
}
