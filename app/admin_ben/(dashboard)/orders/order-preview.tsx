"use client";

import { useEffect, useState } from "react";
import { Button } from "@shopify/polaris";
import { getOrderPreview, type OrderListItem, type OrderPreview, type StoredOrderProduct } from "@/lib/api/orders";
import { paymentLabel } from "@/lib/payment-label";

type Address = { street?: string; zipCode?: string; City?: string; state?: string; country?: string };
type Client = { firstName?: string; lastName?: string; email?: string; phoneNumber?: string | null; company?: string | null };

const euro = (value: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number.isFinite(value) ? value : 0);
const PAYMENT_STATUS: Record<string, string> = { En_attente: "En attente", "Payé": "Payée", "échoué": "Échec" };

/** The name, address and contact of the customer, one line each. Orders without an account keep their address in one line. */
function customerLines(order: OrderListItem, withEmail: boolean): string[] {
  const client = order.Client as Client | null | undefined;
  const address = order.Address as Address | null | undefined;
  const name = client ? `${client.firstName ?? ""} ${client.lastName ?? ""}`.trim() : order.guestName?.trim() ?? "";
  const phone = client?.phoneNumber ?? order.guestPhone ?? "";
  const email = client?.email ?? order.guestEmail ?? "";
  const place = address
    ? [address.street, [address.zipCode, address.City].filter(Boolean).join(" "), address.state, address.country]
    : (order.guestAddress ?? "").split(",").map((part) => part.trim());
  return [name, client?.company ?? "", ...place, phone, withEmail ? email : ""].filter((line): line is string => Boolean(line && line.trim()));
}

function Lines({ lines }: { lines: string[] }) {
  return <div className="mt-1 space-y-0.5 text-[13px] leading-5 text-[#344054]">{lines.length ? lines.map((line, index) => <div key={`${index}-${line}`}>{line}</div>) : <div className="text-[#8492a3]">Non renseigné</div>}</div>;
}

/** An order's details, shown under its row in the order list (like PrestaShop's order preview). */
export function OrderPreviewPanel({ order, onOpen }: { order: OrderListItem; onOpen: () => void }) {
  const [state, setState] = useState<{ id: string; preview?: OrderPreview; error?: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    getOrderPreview(order.id)
      .then((preview) => {
        if (!cancelled) setState({ id: order.id, preview });
      })
      .catch((e: unknown) => {
        if (!cancelled) setState({ id: order.id, error: e instanceof Error ? e.message : "Impossible de charger les détails." });
      });
    return () => {
      cancelled = true;
    };
  }, [order.id]);

  const current = state?.id === order.id ? state : null;
  const preview = current?.preview;
  const products = Array.isArray(order.products) ? (order.products as StoredOrderProduct[]) : [];

  return (
    <div className="grid gap-6 px-6 py-5 lg:grid-cols-[minmax(220px,1fr)_minmax(220px,1fr)_minmax(420px,2fr)]">
      <section aria-label="Livraison">
        <div className="flex items-start gap-3">
          <svg aria-hidden="true" viewBox="0 0 24 24" className="mt-0.5 size-6 shrink-0 text-[#3a4a5c]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M1 3h15v13H1z" /><path d="M16 8h4l3 3v5h-7z" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" /></svg>
          <div className="text-[13px] leading-5 text-[#344054]">
            <div><strong>Transporteur :</strong> {current ? preview?.carrierName ?? "—" : "…"}</div>
            <div>
              <strong>Numéro de suivi :</strong>{" "}
              {!current ? "…" : !preview?.trackingNumbers.length ? "-" : preview.trackingLink ? <a href={preview.trackingLink} target="_blank" rel="noopener noreferrer" className="text-[#168ca8] underline">{preview.trackingNumbers.join(",")}</a> : preview.trackingNumbers.join(", ")}
            </div>
            <div className="mt-1"><strong>Détails de livraison :</strong></div>
            <Lines lines={customerLines(order, false)} />
          </div>
        </div>
      </section>

      <section aria-label="Facturation">
        <div className="flex items-start gap-3">
          <svg aria-hidden="true" viewBox="0 0 24 24" className="mt-0.5 size-6 shrink-0 text-[#3a4a5c]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2z" /><path d="M9 8h6M9 12h6" /></svg>
          <div className="text-[13px] leading-5 text-[#344054]">
            <strong>Détails de la facture :</strong>
            <Lines lines={customerLines(order, true)} />
          </div>
        </div>
      </section>

      <section aria-label="Produits">
        <table className="w-full border-collapse text-left text-[13px] text-[#344054]">
          <thead>
            <tr className="bg-[#f2f5f7] font-semibold">
              <th className="px-2 py-2">Produits ({products.length})</th>
              <th className="px-2 py-2">Référence</th>
              <th className="px-2 py-2 text-right">Taxe</th>
              <th className="px-2 py-2 text-right">Quantité</th>
              <th className="px-2 py-2 text-right">Total <span className="text-[10px] font-normal">HT</span></th>
            </tr>
          </thead>
          <tbody>
            {products.map((product, index) => {
              const extra = product.id ? preview?.products[product.id] : undefined;
              const total = Number(product.totalPrice) || 0;
              const exclTax = total / (1 + (extra?.taxRate ?? 0) / 100);
              return (
                <tr key={`${product.id ?? product.title}-${index}`} className="border-b border-[#e3e8ec]">
                  <td className="px-2 py-2">{product.title ?? "Produit"}</td>
                  <td className="px-2 py-2 text-[#526174]">{extra?.reference ?? (current ? "—" : "…")}</td>
                  <td className="whitespace-nowrap px-2 py-2 text-right">{extra ? euro(total - exclTax) : "—"}</td>
                  <td className="px-2 py-2 text-right">{product.quantity ?? 0}</td>
                  <td className="whitespace-nowrap px-2 py-2 text-right">{extra ? euro(exclTax) : euro(total)}</td>
                </tr>
              );
            })}
            {products.length === 0 ? <tr><td colSpan={5} className="px-2 py-4 text-center text-[#8492a3]">Aucun produit dans cette commande.</td></tr> : null}
          </tbody>
        </table>
        <div className="mt-4 flex justify-end">
          <Button variant="primary" onClick={onOpen}>Ouvrir les détails →</Button>
        </div>
      </section>

      <div className="space-y-1 text-[13px] text-[#344054] lg:col-span-3">
        {preview?.transactionId ? <div><strong>Transaction Stripe :</strong> <span className="font-mono text-[#168ca8]">{preview.transactionId}</span></div> : null}
        <div><strong>Dernier statut :</strong> {order.etat} · {paymentLabel(order)} ({PAYMENT_STATUS[order.paymentStatus] ?? order.paymentStatus})</div>
        {current?.error ? <div role="alert" className="text-[#b42318]">{current.error} Le transporteur et les références produit ne sont pas affichés.</div> : null}
      </div>
    </div>
  );
}
