"use client";

import { useEffect, useState } from "react";
import type { ComponentType, ReactNode } from "react";
import { Button } from "@shopify/polaris";
import { PiArrowSquareOutBold, PiFilePdfDuotone, PiFilesDuotone, PiPackageDuotone, PiReceiptDuotone, PiTruckDuotone } from "react-icons/pi";

import { getDeliverySlipUrl, getOrderPreview, getProFormaUrl, type OrderListItem, type OrderPreview, type StoredOrderProduct } from "@/lib/api/orders";
import { paymentLabel } from "@/lib/payment-label";

type Address = { street?: string; zipCode?: string; City?: string; state?: string; country?: string };
type Client = { firstName?: string; lastName?: string; email?: string; phoneNumber?: string | null; company?: string | null };

const euro = (value: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number.isFinite(value) ? value : 0);
const shortDate = (value: string) => (Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeZone: "Europe/Paris" }).format(new Date(value)) : "—");
const invoiceNumber = (reference: string) => (/^N[°º]/i.test(reference) ? reference : `N°${reference}`);
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

/** One block of the preview: an icon, a title and its content, on a white card. */
function Block({ icon: Icon, title, children, className = "" }: { icon: ComponentType<{ className?: string }>; title: string; children: ReactNode; className?: string }) {
  return (
    <section aria-label={title} className={`rounded-xl border border-[#dce4ea] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)] ${className}`}>
      <h3 className="mb-3 flex items-center gap-2.5 text-[13px] font-bold text-[#1d2433]">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#e8f4f8] text-[#087f99]"><Icon className="size-[18px]" aria-hidden="true" /></span>
        {title}
      </h3>
      {children}
    </section>
  );
}

/** A document of the order: what it is, its number, and a button that opens the PDF. */
function DocRow({ title, number, detail, href, state }: { title: string; number?: string | null; detail?: string; href?: string | null; state?: string }) {
  return (
    <li className="flex items-center gap-3 rounded-lg bg-[#f5f8fa] px-3 py-2.5 ring-1 ring-inset ring-[#e3e9ee]">
      <PiFilePdfDuotone className={`size-7 shrink-0 ${href ? "text-[#c0392b]" : "text-[#a3afbc]"}`} aria-hidden="true" />
      <div className="min-w-0 flex-1 text-[13px] leading-5">
        <div className="font-semibold text-[#1d2433]">{title}</div>
        {state ? (
          <div className="text-[#526174]">{state}</div>
        ) : (
          <>
            <div className="break-words font-medium text-[#087f99]">{number ?? "PDF"}</div>
            {detail ? <div className="text-xs text-[#6b7a8c]">{detail}</div> : null}
          </>
        )}
      </div>
      {href ? (
        <a href={href} target="_blank" rel="noopener noreferrer" aria-label={`Ouvrir : ${title}${number ? ` ${number}` : ""}`} className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md bg-white px-3 text-xs font-semibold text-[#087f99] ring-1 ring-inset ring-[#c6d5dd] hover:bg-[#e8f4f8] focus-visible:outline-2 focus-visible:outline-[#169bb5]">
          Ouvrir<PiArrowSquareOutBold className="size-3.5" aria-hidden="true" />
        </a>
      ) : null}
    </li>
  );
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

  // The same rules as the order page: the pro-forma always exists; the delivery slip once a carrier was chosen.
  const proFormaNumber = preview?.proForma?.reference;
  const deliveryReference = preview?.deliverySlip?.reference;
  const hasDeliverySlip = Boolean(preview?.shipping || preview?.deliverySlip);
  const invoice = order.dolibarrInvoice;

  return (
    <div className="space-y-4 px-5 py-5">
      {/* The three short blocks sit side by side, and wrap only when the list is really narrow. */}
      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(250px,1fr))]">
        <Block icon={PiTruckDuotone} title="Livraison">
          <div className="text-[13px] leading-5 text-[#344054]">
            <div><strong>Transporteur :</strong> {current ? preview?.carrierName ?? "—" : "…"}</div>
            <div>
              <strong>Numéro de suivi :</strong>{" "}
              {!current ? "…" : !preview?.trackingNumbers.length ? "-" : preview.trackingLink ? <a href={preview.trackingLink} target="_blank" rel="noopener noreferrer" className="text-[#087f99] underline">{preview.trackingNumbers.join(",")}</a> : preview.trackingNumbers.join(", ")}
            </div>
            <div className="mt-1"><strong>Détails de livraison :</strong></div>
            <Lines lines={customerLines(order, false)} />
          </div>
        </Block>

        <Block icon={PiReceiptDuotone} title="Facturation">
          <div className="text-[13px] leading-5 text-[#344054]">
            <strong>Détails de la facture :</strong>
            <Lines lines={customerLines(order, true)} />
          </div>
        </Block>

        <Block icon={PiFilesDuotone} title="Documents">
          <ul className="space-y-2">
            <DocRow
              title="Facture pro-forma"
              number={proFormaNumber ? invoiceNumber(proFormaNumber) : null}
              detail={`${shortDate(order.createdAt)} · ${euro(order.total)}`}
              href={getProFormaUrl(order.id)}
            />
            <DocRow
              title="Bon de livraison"
              number={deliveryReference ? `#${deliveryReference}` : null}
              detail={shortDate(order.createdAt)}
              href={hasDeliverySlip ? getDeliverySlipUrl(order.id) : null}
              state={!current ? "…" : hasDeliverySlip ? undefined : "Disponible dès qu’un transporteur est choisi"}
            />
            {invoice ? (
              <DocRow title="Facture Dolibarr" number={invoiceNumber(invoice.reference)} detail={invoice.totalTtc != null ? euro(invoice.totalTtc) : undefined} href={invoice.invoiceUrl} state={invoice.invoiceUrl ? undefined : `${invoiceNumber(invoice.reference)} · PDF non disponible`} />
            ) : null}
          </ul>
        </Block>
      </div>

      <Block icon={PiPackageDuotone} title={`Produits (${products.length})`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-left text-[13px] text-[#344054]">
            <thead>
              <tr className="bg-[#f2f5f7] font-semibold">
                <th className="rounded-l-md px-2 py-2">Produit</th>
                <th className="px-2 py-2">Référence</th>
                <th className="px-2 py-2 text-right">Taxe</th>
                <th className="px-2 py-2 text-right">Quantité</th>
                <th className="rounded-r-md px-2 py-2 text-right">Total <span className="text-[10px] font-normal">HT</span></th>
              </tr>
            </thead>
            <tbody>
              {products.map((product, index) => {
                const extra = product.id ? preview?.products[product.id] : undefined;
                const total = Number(product.totalPrice) || 0;
                const exclTax = total / (1 + (extra?.taxRate ?? 0) / 100);
                return (
                  <tr key={`${product.id ?? product.title}-${index}`} className="border-b border-[#e3e8ec] last:border-b-0">
                    <td className="px-2 py-2.5 font-medium text-[#1d2433]">{product.title ?? "Produit"}</td>
                    <td className="px-2 py-2.5 text-[#526174]">{extra?.reference ?? (current ? "—" : "…")}</td>
                    <td className="whitespace-nowrap px-2 py-2.5 text-right">{extra ? euro(total - exclTax) : "—"}</td>
                    <td className="px-2 py-2.5 text-right">{product.quantity ?? 0}</td>
                    <td className="whitespace-nowrap px-2 py-2.5 text-right font-semibold">{extra ? euro(exclTax) : euro(total)}</td>
                  </tr>
                );
              })}
              {products.length === 0 ? <tr><td colSpan={5} className="px-2 py-4 text-center text-[#8492a3]">Aucun produit dans cette commande.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </Block>

      <div className="flex flex-wrap items-center justify-between gap-3 text-[13px] text-[#344054]">
        <div className="space-y-1">
          {preview?.transactionId ? <div><strong>Transaction Stripe :</strong> <span className="font-mono text-[#087f99]">{preview.transactionId}</span></div> : null}
          <div><strong>Dernier statut :</strong> {order.etat} · {paymentLabel(order)} ({PAYMENT_STATUS[order.paymentStatus] ?? order.paymentStatus})</div>
          {current?.error ? <div role="alert" className="text-[#b42318]">{current.error} Le transporteur et les références produit ne sont pas affichés.</div> : null}
        </div>
        <Button variant="primary" onClick={onOpen}>Ouvrir les détails →</Button>
      </div>
    </div>
  );
}
