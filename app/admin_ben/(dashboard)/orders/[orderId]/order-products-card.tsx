"use client";

import { useEffect, useRef, useState } from "react";
import { Banner, Button, Card, Text } from "@shopify/polaris";
import { createOrderRefund, RefundRequestError, type OrderRefund, type RefundContext, type RefundInput } from "@/lib/api/order-refunds";
import type { OrderDetail, OrderPreview, StoredOrderProduct } from "@/lib/api/orders";

const euro = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const fieldClass = "h-9 w-full min-w-0 bg-white px-2 text-[13px] text-[#344054] focus-visible:outline-2 focus-visible:outline-[#087e9a]";
const suffixClass = "grid shrink-0 place-items-center border-l border-[#bacdd7] bg-[#f6f8f9] px-2 text-xs text-[#536b78]";
type RefundLine = { quantity: string; amount: string };
const emptyLine = { quantity: "0", amount: "0.00" };

function formatMoney(value?: number | null) {
  const amount = Number(value ?? 0);
  return euro.format(Number.isFinite(amount) ? amount : 0);
}

function cents(value: number | string | null | undefined) {
  const amount = Number(typeof value === "string" ? value.trim().replace(",", ".") : value);
  return Number.isFinite(amount) ? Math.max(0, Math.round(amount * 100)) : 0;
}

function amountText(value: number) {
  return (value / 100).toFixed(2);
}

function refundQuantity(value: string, limit: number) {
  return Math.min(limit, Math.max(0, Math.floor(Number(value) || 0)));
}

function MoneyField({ label, value, max, disabled, onChange }: {
  label: string;
  value: string;
  max: number;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="text-left">
      <div className="flex border border-[#bacdd7]">
        <input
          aria-label={label}
          inputMode="decimal"
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          onBlur={() => onChange(amountText(Math.min(cents(value), max)))}
          className={fieldClass}
        />
        <span aria-hidden="true" className={suffixClass}>€</span>
      </div>
      <p className="mt-0.5 whitespace-nowrap text-[11px] text-[#536b78]">Max. {formatMoney(max / 100)} TTC</p>
    </div>
  );
}

export function OrderProductsCard({ order, preview, onCancelRefund, onRefundSaved, refundContext, refundLoadError }: {
  order: OrderDetail;
  preview: OrderPreview | null;
  onCancelRefund?: () => void;
  onRefundSaved?: (refund: OrderRefund) => void;
  refundContext?: RefundContext | null;
  refundLoadError?: string;
}) {
  const refunding = Boolean(onCancelRefund);
  const focusTarget = useRef<HTMLDivElement>(null);
  const [refundLines, setRefundLines] = useState<Record<number, RefundLine>>({});
  const [refundShipping, setRefundShipping] = useState("0.00");
  const [restock, setRestock] = useState(true);
  const [voucher, setVoucher] = useState(false);
  const [externalDone, setExternalDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [locked, setLocked] = useState(false);
  const request = useRef<RefundInput | null>(null);
  const products = Array.isArray(order.products) ? order.products as StoredOrderProduct[] : [];
  const productsTotal = products.reduce((sum, product) => sum + (Number(product.totalPrice) || 0), 0);
  const shipping = Number(order.deliveryFee ?? 0);
  const prior = refundContext?.refunds.filter((refund) => refund.status !== "failed") ?? [];
  const priorLines = prior.flatMap((refund) => refund.lines);
  const shippingLimit = Math.max(0, cents(shipping) - prior.reduce((sum, refund) => sum + refund.shippingCents, 0));
  const invoiceReference = order.dolibarrInvoice?.reference ?? preview?.proForma?.reference;
  const productLimits = products.map((product, index) => {
    const refunded = priorLines.filter((line) => line.index === index);
    return {
      quantity: Math.max(0, Math.floor(Number(product.quantity) || 0) - refunded.reduce((sum, line) => sum + line.quantity, 0)),
      amount: Math.max(0, cents(product.totalPrice) - refunded.reduce((sum, line) => sum + line.amountCents, 0)),
    };
  });
  const lines = productLimits.map((limit, index) => ({
    index,
    quantity: refundQuantity(refundLines[index]?.quantity ?? "0", limit.quantity),
    amountCents: Math.min(cents(refundLines[index]?.amount), limit.amount),
  })).filter((line) => line.quantity || line.amountCents);
  const shippingCents = Math.min(cents(refundShipping), shippingLimit);
  const refundTotal = lines.reduce((sum, line) => sum + line.amountCents, shippingCents);
  const payment = refundContext?.payment;
  const fieldsDisabled = submitting || locked;
  const canSubmit = Boolean(payment && !refundLoadError && refundTotal > 0 && refundTotal <= (refundContext?.remainingCents ?? 0) &&
    (voucher || payment.method === "stripe" || externalDone));

  useEffect(() => {
    if (refunding) focusTarget.current?.focus();
  }, [refunding]);

  function setLine(index: number, fields: Partial<RefundLine>) {
    setRefundLines((current) => ({ ...current, [index]: { ...emptyLine, ...current[index], ...fields } }));
  }

  async function submitRefund() {
    if (submitting || (!request.current && (!canSubmit || !payment))) return;
    const input = request.current ?? {
      requestId: crypto.randomUUID(),
      method: voucher ? "voucher" : payment!.method,
      lines, shippingCents, restock,
    };
    request.current = input;
    setSubmitting(true);
    setSubmitError("");
    try {
      const refund = await createOrderRefund(order.id, input);
      request.current = null;
      onRefundSaved?.(refund);
    } catch (error) {
      const rejected = error instanceof RefundRequestError && error.status >= 400 && error.status < 500;
      if (rejected) request.current = null;
      setLocked(!rejected);
      setSubmitError(rejected ? error.message : "Le résultat est inconnu. Réessayez la même demande pour vérifier le remboursement.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div id="order-products" ref={focusTarget} tabIndex={-1} role="region" aria-label={refunding ? "Produits · Remboursement partiel" : "Produits"} className="min-w-0 focus:outline-none">
      <Card padding="0">
        <div className="border-b border-[#dce4ea] px-4 py-3">
          <Text as="h2" variant="headingMd">Produits ({products.length})</Text>
        </div>
        <div className={refunding ? "overflow-x-auto px-5" : "overflow-x-auto px-3"}>
          <table className={`w-full border-collapse text-left text-xs text-[#344054] ${refunding ? "min-w-[1100px]" : "min-w-[760px]"}`}>
            <thead>
              <tr className="border-b-2 border-[#22b6d1] font-semibold">
                <th scope="col" className="py-3 pr-2">Produit</th>
                <th scope="col" className="px-2 py-3">Prix unitaire <small className="block font-normal text-[#8492a3]">TTC</small></th>
                <th scope="col" className="px-2 py-3 text-center">Quantité</th>
                <th scope="col" className="px-2 py-3 text-center">Disponible</th>
                <th scope="col" className="px-2 py-3">Total <small className="block font-normal text-[#8492a3]">TTC</small></th>
                <th scope="col" className="px-2 py-3">Facture</th>
                <th scope="col" className="px-2 py-3 text-center">{refunding ? "À rembourser" : "Actions"}</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product, index) => {
                const name = product.title || "Produit";
                const reference = (product.id && preview?.products?.[product.id]?.reference) || product.slug || product.id || "—";
                const { quantity: quantityLimit, amount: amountLimit } = productLimits[index];
                const line = refundLines[index] ?? emptyLine;
                return (
                  <tr key={`${product.id ?? name}-${index}`} className="border-b border-[#cbd7df]">
                    <td className="py-2 pr-2">
                      <div className="flex min-w-64 items-center gap-3">
                        {product.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={product.image} alt="" className="size-11 shrink-0 object-cover" />
                        ) : <div className="grid size-11 shrink-0 place-items-center bg-[#f2f4f7] text-[10px] text-[#98a2b3]">IMG</div>}
                        <div>
                          <p className="font-medium text-[#087e9a]">{name}</p>
                          <p className="mt-1 text-[#087e9a]">Référence : {reference}</p>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-2">{formatMoney(product.unitPrice)}</td>
                    <td className="px-2 text-center"><span className={refunding ? "" : "inline-flex min-w-6 justify-center rounded-full bg-[#718b91] px-1.5 py-1 font-semibold text-white"}>{product.quantity ?? 0}</span></td>
                    <td className="px-2 text-center">—</td>
                    <td className="whitespace-nowrap px-2">{formatMoney(product.totalPrice)}</td>
                    <td className="whitespace-nowrap px-2">{refunding ? invoiceReference ?? "—" : "—"}</td>
                    <td className="px-2 py-2">
                      {refunding ? (
                        <div className="flex min-w-[368px] items-start justify-center gap-3">
                          <div className="flex items-start gap-2">
                            <span aria-hidden="true" className="pt-2.5 font-semibold">Quantité</span>
                            <div className="flex w-24 border border-[#bacdd7]">
                              <input
                                aria-label={`Quantité à rembourser pour ${name}`}
                                type="number"
                                min={0}
                                max={quantityLimit}
                                step={1}
                                className={fieldClass}
                                value={line.quantity}
                                disabled={fieldsDisabled}
                                onChange={(event) => {
                                  const quantity = event.target.value;
                                  const selected = refundQuantity(quantity, quantityLimit);
                                  // Prorate the recorded line total so a full quantity matches the original charge.
                                  const originalQuantity = Math.max(1, Number(product.quantity) || 1);
                                  const amount = selected === quantityLimit && selected > 0 ? amountLimit :
                                    Math.min(amountLimit, Math.round(cents(product.totalPrice) * selected / originalQuantity));
                                  setLine(index, { quantity, amount: amountText(amount) });
                                }}
                                onBlur={() => setLine(index, { quantity: String(refundQuantity(line.quantity, quantityLimit)) })}
                              />
                              <span aria-hidden="true" className={suffixClass}>/ {quantityLimit}</span>
                            </div>
                          </div>
                          <div className="flex items-start gap-2">
                            <span aria-hidden="true" className="whitespace-nowrap pt-2.5 font-semibold">Montant (TTC)</span>
                            <div className="w-28">
                              <MoneyField label={`Montant à rembourser pour ${name}`} value={line.amount} max={amountLimit} disabled={fieldsDisabled} onChange={(amount) => setLine(index, { amount })} />
                            </div>
                          </div>
                        </div>
                      ) : <div className="text-center text-[#718b91]">✎　▤</div>}
                    </td>
                  </tr>
                );
              })}
              {!products.length ? <tr><td colSpan={7} className="py-8 text-center text-sm text-[#667085]">Aucun produit dans cette commande.</td></tr> : null}
            </tbody>
          </table>
        </div>
        {!refunding ? (
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-xs text-[#667085]">
            <label className="flex items-center gap-2">Articles par page : <select defaultValue="8" className="h-8 rounded border border-[#cbd6de] bg-white px-2"><option>8</option></select></label>
            <div className="flex gap-2"><Button disabled>⊕ Ajouter un produit</Button><Button disabled>▣ Ajouter une remise</Button></div>
          </div>
        ) : null}
        <div className={`grid gap-3 bg-[#f7f7f7] px-5 text-center sm:grid-cols-3 ${refunding ? "mx-5 mt-8 py-6" : "py-4"}`}>
          <div>
            <p className="text-xs text-[#536b78]">Produits</p>
            <p className="mt-1 font-semibold">{formatMoney(productsTotal || order.priceTTC || order.total - shipping)}</p>
          </div>
          <div>
            <p className="text-xs text-[#536b78]">Livraison</p>
            <p className="mt-1 font-semibold">{formatMoney(shipping)}</p>
            {refunding ? (
              <div className="mx-auto mt-3 max-w-52">
                <MoneyField label="Montant des frais de livraison à rembourser" value={refundShipping} max={shippingLimit} disabled={fieldsDisabled} onChange={setRefundShipping} />
              </div>
            ) : null}
          </div>
          <div>
            <p className="text-xs text-[#536b78]">Total</p>
            <p className="mt-1 inline-flex rounded bg-[#344054] px-2 py-1 font-semibold text-white">{formatMoney(refunding ? order.total : order.priceTTC ?? order.total)}</p>
          </div>
        </div>
        <p className="px-4 py-3 text-center text-[11px] text-[#536b78]">Les prix de cette commande incluent les taxes.</p>
        {refunding ? (
          <div className="space-y-4 px-5 pb-5">
            {refundLoadError || submitError ? <Banner tone="critical" title={submitError || refundLoadError} /> : null}
            {!refundLoadError && !refundContext ? <p role="status">Vérification du paiement…</p> : null}
            {refundContext && !payment ? <Banner tone="warning" title={refundContext.paymentError ?? "Aucun paiement remboursable n’a été enregistré pour cette commande."} /> : null}
            <div className="mx-auto flex w-fit flex-col gap-3 text-sm text-[#344054]">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={restock} disabled={fieldsDisabled} onChange={(event) => setRestock(event.target.checked)} className="size-4 accent-[#087e9a]" />
                Remettre les produits en stock
              </label>
              {payment?.livemode !== false ? <label className="flex items-center gap-2">
                <input type="checkbox" checked={voucher} disabled={fieldsDisabled} onChange={(event) => setVoucher(event.target.checked)} className="size-4 accent-[#087e9a]" />
                Rembourser sous forme de bon de réduction
              </label> : null}
              {payment?.method === "external" && !voucher ? <label className="flex items-center gap-2">
                <input type="checkbox" checked={externalDone} disabled={fieldsDisabled} onChange={(event) => setExternalDone(event.target.checked)} className="size-4 accent-[#087e9a]" />
                Le remboursement a été effectué en dehors de la boutique
              </label> : null}
              {payment?.method === "stripe" && !voucher ? <p>{payment.livemode ? "Le remboursement sera envoyé au moyen de paiement d’origine via Stripe." : "Le remboursement sera traité par Stripe en mode test."}</p> : null}
              <p>Un avoir PDF sera disponible dans Documents.</p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-3">
              <p aria-live="polite" className="mr-auto text-xs text-[#536b78]">
                Remboursement · <strong>{formatMoney(refundTotal / 100)}</strong>
                {refundContext && payment ? ` · Solde remboursable ${formatMoney(refundContext.remainingCents / 100)}` : ""}
              </p>
              <Button onClick={onCancelRefund} disabled={fieldsDisabled}>Annuler</Button>
              <Button variant="primary" loading={submitting} disabled={!locked && !canSubmit} onClick={() => void submitRefund()}>
                {locked ? "Réessayer la même demande" : "Remboursement partiel"}
              </Button>
            </div>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
