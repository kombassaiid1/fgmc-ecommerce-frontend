"use client";

import { useEffect, useState } from "react";
import { PiArrowSquareOutBold, PiFilePdfDuotone, PiSpinnerGapBold } from "react-icons/pi";

import { getMyOrderDocuments, openMyOrderDocument, type MyOrderDocuments, type OrderListItem } from "@/lib/api/orders";
import { getClientSession } from "@/lib/client-auth";

type Kind = "pro-forma" | "delivery-slip" | "invoice";

const invoiceNumber = (reference: string) => (/^N[°º]/i.test(reference) ? reference : `N°${reference}`);

/**
 * The documents of one of the customer's orders: the pro-forma invoice, the delivery slip and, when it exists, the
 * final invoice. The PDFs are fetched with the customer's own sign-in, so only they can open them.
 */
export function OrderDocuments({ order }: { order: OrderListItem }) {
  const [docs, setDocs] = useState<MyOrderDocuments | null | "failed">(null);
  const [opening, setOpening] = useState<Kind | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const token = getClientSession()?.token;
    if (!token) return undefined;
    let cancelled = false;
    getMyOrderDocuments(token, order.id)
      .then((loaded) => !cancelled && setDocs(loaded))
      .catch(() => !cancelled && setDocs("failed"));
    return () => {
      cancelled = true;
    };
  }, [order.id]);

  async function open(kind: Kind) {
    const token = getClientSession()?.token;
    if (!token) return;
    setOpening(kind);
    setMessage("");
    try {
      await openMyOrderDocument(token, order.id, kind);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Le document n’est pas disponible pour le moment.");
    } finally {
      setOpening(null);
    }
  }

  const loaded = docs !== null && docs !== "failed" ? docs : null;
  const invoice = order.dolibarrInvoice;

  return (
    <section className="oc-docs" aria-label="Documents de la commande">
      <h3 className="oc-docs-title">Documents</h3>
      {docs === null ? (
        <ul className="oc-doc-list" aria-busy="true">
          <li className="oc-skeleton-row" />
          <li className="oc-skeleton-row" />
        </ul>
      ) : (
        <ul className="oc-doc-list">
          <DocRow
            title="Facture pro-forma"
            text={loaded?.proForma.reference ? invoiceNumber(loaded.proForma.reference) : "PDF"}
            busy={opening === "pro-forma"}
            onOpen={() => void open("pro-forma")}
          />
          <DocRow
            title="Bon de livraison"
            text={loaded?.deliverySlip ? (loaded.deliverySlip.reference ? `#${loaded.deliverySlip.reference}` : "PDF") : "Disponible à l’expédition"}
            busy={opening === "delivery-slip"}
            onOpen={loaded?.deliverySlip ? () => void open("delivery-slip") : undefined}
          />
          {invoice ? (
            // Opened through the shop, with the customer's sign-in: it does not depend on a share link made in Dolibarr.
            loaded?.invoice ? (
              <DocRow title="Facture" text={invoiceNumber(loaded.invoice.reference)} busy={opening === "invoice"} onOpen={() => void open("invoice")} />
            ) : (
              <DocRow title="Facture" text={invoiceNumber(invoice.reference)} soon={docs === "failed" ? undefined : "En attente de validation"} />
            )
          ) : null}
        </ul>
      )}
      {message ? <p className="oc-msg" role="alert">{message}</p> : null}
    </section>
  );
}

function DocRow({ title, text, onOpen, href, busy, soon }: { title: string; text: string; onOpen?: () => void; href?: string; busy?: boolean; soon?: string }) {
  const available = Boolean(onOpen || href);
  return (
    <li className="oc-doc">
      <PiFilePdfDuotone className={`oc-doc-icon size-7 ${available ? "is-on" : ""}`} aria-hidden="true" />
      <span className="oc-doc-text">
        <strong>{title}</strong>
        <span>{soon ?? text}</span>
      </span>
      {href ? (
        <a className="oc-doc-btn" href={href} target="_blank" rel="noopener noreferrer" aria-label={`Ouvrir : ${title}`}>
          Ouvrir<PiArrowSquareOutBold className="size-4" aria-hidden="true" />
        </a>
      ) : onOpen ? (
        <button type="button" className="oc-doc-btn" onClick={onOpen} disabled={busy} aria-label={`Ouvrir : ${title}`}>
          {busy ? <PiSpinnerGapBold className="oc-spin size-4" aria-hidden="true" /> : null}
          Ouvrir{busy ? null : <PiArrowSquareOutBold className="size-4" aria-hidden="true" />}
        </button>
      ) : null}
    </li>
  );
}
