"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Pencil, Trash2 } from "lucide-react";
import { Banner, Button, Card, Text } from "@shopify/polaris";
import { createOrderRefund, RefundRequestError, type OrderRefund, type RefundContext, type RefundInput } from "@/lib/api/order-refunds";
import { toast } from "sonner";
import { updateOrderProducts, type OrderDetail, type OrderPreview, type StoredOrderProduct } from "@/lib/api/orders";

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

/** Rounds to the cent. */
const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

/** "469", "469,00" or "469.00" → 469. Empty or invalid → NaN. */
function parseInput(value: string) {
  const text = value.trim().replace(",", ".");
  return text === "" ? NaN : Number(text);
}

/** The tax rate of a line as a fraction: its own, else what its prices say, else the product's current rate. */
function lineVat(product: StoredOrderProduct, preview: OrderPreview | null) {
  if (Number(product.taxRate) > 0) return Number(product.taxRate) / 100;
  const ttc = Number(product.unitPrice);
  const ht = Number(product.unitPriceHt);
  if (ttc > 0 && ht > 0) return Math.max(0, ttc / ht - 1);
  const rate = product.id ? preview?.products?.[product.id]?.taxRate : undefined;
  return rate && rate > 0 ? (rate > 1 ? rate / 100 : rate) : 0;
}

type EditForm = { quantity: string; ht: string; ttc: string };

export function OrderProductsCard({ order, preview, onCancelRefund, onRefundSaved, refundContext, refundLoadError, canEdit, editBlockedReason, onEditingChange, onProductsSaved }: {
  order: OrderDetail;
  preview: OrderPreview | null;
  /** Whether the pencil on a line may open the edit form. */
  canEdit?: boolean;
  /** Why the lines cannot be edited, shown above the table. */
  editBlockedReason?: string;
  /** Tells the page that a line is being edited, so it can give this card the full width. */
  onEditingChange?: (editing: boolean) => void;
  /** The order as the server saved it after a change. */
  onProductsSaved?: (order: OrderDetail) => void;
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
  // Editing one line: quantity and unit price (HT and TTC follow each other through the tax rate).
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ quantity: "1", ht: "", ttc: "" });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");
  // Removing a line asks first, in the line itself.
  const [removeIndex, setRemoveIndex] = useState<number | null>(null);
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

  const editing = editIndex !== null;
  useEffect(() => {
    onEditingChange?.(editing);
    return () => onEditingChange?.(false);
  }, [editing, onEditingChange]);

  function startEdit(index: number) {
    const product = products[index];
    const vat = lineVat(product, preview);
    const ttc = round2(Number(product.unitPrice) || 0);
    const ht = Number(product.unitPriceHt) > 0 ? round2(Number(product.unitPriceHt)) : round2(ttc / (1 + vat));
    setEditForm({ quantity: String(Math.max(1, Math.floor(Number(product.quantity) || 1))), ht: ht.toFixed(2), ttc: ttc.toFixed(2) });
    setEditError("");
    setEditIndex(index);
  }

  async function removeLine(index: number) {
    setEditSaving(true);
    setEditError("");
    try {
      const updated = await updateOrderProducts(order.id, [{ index, remove: true }]);
      onProductsSaved?.(updated);
      setRemoveIndex(null);
      toast.success("Produit retiré : les montants de la commande ont été recalculés.");
    } catch (error) {
      setEditError(error instanceof Error ? error.message : "Impossible de retirer le produit.");
    } finally {
      setEditSaving(false);
    }
  }

  function cancelEdit() {
    setEditIndex(null);
    setEditError("");
  }

  async function saveEdit() {
    if (editIndex === null) return;
    const quantity = Math.floor(parseInput(editForm.quantity));
    const unitPriceTtc = round2(parseInput(editForm.ttc));
    setEditSaving(true);
    setEditError("");
    try {
      const updated = await updateOrderProducts(order.id, [{ index: editIndex, quantity, unitPriceTtc }]);
      onProductsSaved?.(updated);
      setEditIndex(null);
      toast.success("Produits modifiés : les montants de la commande ont été recalculés.");
    } catch (error) {
      setEditError(error instanceof Error ? error.message : "Impossible d’enregistrer la modification.");
    } finally {
      setEditSaving(false);
    }
  }

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
        {!refunding && !canEdit && editBlockedReason ? (
          <p role="status" className="mx-3 mt-3 rounded border border-[#e3e8ec] bg-[#f7f9fa] px-3 py-2 text-xs text-[#536b78]">
            Modification des produits désactivée. {editBlockedReason}
          </p>
        ) : null}
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
                          <p className="font-medium text-[#087e9a]">
                            {product.id ? (
                              // Opens the product's edit page.
                              <Link href={`/admin_ben/products/add_product?id=${encodeURIComponent(product.id)}`} className="underline-offset-2 hover:underline focus-visible:underline focus-visible:outline-none">
                                {name}
                              </Link>
                            ) : name}
                          </p>
                          <p className="mt-1 text-[#087e9a]">Référence : {reference}</p>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-2">
                      {editIndex === index ? (
                        <div className="grid w-48 gap-2">
                          <div className="flex border border-[#bacdd7]">
                            <input aria-label={`Prix unitaire HT de ${name}`} inputMode="decimal" className={fieldClass} value={editForm.ht} disabled={editSaving}
                              onChange={(event) => {
                                const ht = parseInput(event.target.value);
                                setEditForm((form) => ({ ...form, ht: event.target.value, ttc: Number.isFinite(ht) ? round2(ht * (1 + lineVat(product, preview))).toFixed(2) : form.ttc }));
                              }} />
                            <span aria-hidden="true" className={suffixClass}>€ HT</span>
                          </div>
                          <div className="flex border border-[#bacdd7]">
                            <input aria-label={`Prix unitaire TTC de ${name}`} inputMode="decimal" className={fieldClass} value={editForm.ttc} disabled={editSaving}
                              onChange={(event) => {
                                const ttc = parseInput(event.target.value);
                                setEditForm((form) => ({ ...form, ttc: event.target.value, ht: Number.isFinite(ttc) ? round2(ttc / (1 + lineVat(product, preview))).toFixed(2) : form.ht }));
                              }} />
                            <span aria-hidden="true" className={suffixClass}>€ TTC</span>
                          </div>
                        </div>
                      ) : formatMoney(product.unitPrice)}
                    </td>
                    <td className="px-2 text-center">
                      {editIndex === index ? (
                        <input aria-label={`Quantité de ${name}`} type="number" min={1} step={1} className={`${fieldClass} w-20 border border-[#bacdd7]`} value={editForm.quantity} disabled={editSaving}
                          onChange={(event) => setEditForm((form) => ({ ...form, quantity: event.target.value }))} />
                      ) : <span className={refunding ? "" : "inline-flex min-w-6 justify-center rounded-full bg-[#718b91] px-1.5 py-1 font-semibold text-white"}>{product.quantity ?? 0}</span>}
                    </td>
                    <td className="px-2 text-center">—</td>
                    <td className="whitespace-nowrap px-2">
                      {editIndex === index
                        ? formatMoney(Number.isFinite(parseInput(editForm.ttc)) && Number.isFinite(parseInput(editForm.quantity)) ? round2(parseInput(editForm.ttc) * Math.floor(parseInput(editForm.quantity))) : 0)
                        : formatMoney(product.totalPrice)}
                    </td>
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
                      ) : editIndex === index ? (
                        <div className="flex flex-col items-end gap-2">
                          <div className="flex gap-2">
                            <Button disabled={editSaving} onClick={cancelEdit}>Annuler</Button>
                            <Button variant="primary" loading={editSaving} disabled={editSaving || !(Math.floor(parseInput(editForm.quantity)) >= 1) || !(parseInput(editForm.ttc) >= 0) ||
                              (Math.floor(parseInput(editForm.quantity)) === Math.floor(Number(product.quantity) || 0) && round2(parseInput(editForm.ttc)) === round2(Number(product.unitPrice) || 0))} onClick={() => void saveEdit()}>Enregistrer</Button>
                          </div>
                          {editError ? <p role="alert" className="max-w-64 text-right text-[#b42318]">{editError}</p> : null}
                        </div>
                      ) : removeIndex === index ? (
                        <div role="alertdialog" aria-label={`Retirer ${name} de la commande`} className="flex flex-col items-end gap-2">
                          <p className="text-right font-medium text-[#344054]">Retirer ce produit de la commande ?</p>
                          <div className="flex gap-2">
                            <Button disabled={editSaving} onClick={() => { setRemoveIndex(null); setEditError(""); }}>Annuler</Button>
                            <Button variant="primary" tone="critical" loading={editSaving} disabled={editSaving} onClick={() => void removeLine(index)}>Retirer</Button>
                          </div>
                          {editError ? <p role="alert" className="max-w-64 text-right text-[#b42318]">{editError}</p> : null}
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-1">
                          <button type="button" onClick={() => startEdit(index)} disabled={!canEdit || editing || removeIndex !== null}
                            aria-label={`Modifier ${name}`} title={canEdit ? "Modifier la quantité ou le prix" : "Modification impossible : commande déjà payée ou droits insuffisants"}
                            className="grid size-8 cursor-pointer place-items-center rounded text-[#536b78] transition-colors hover:bg-[#e6f4f8] hover:text-[#087e9a] focus-visible:outline-2 focus-visible:outline-[#087e9a] disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-[#536b78]">
                            <Pencil className="size-4" aria-hidden="true" />
                          </button>
                          <button type="button" onClick={() => { setEditError(""); setRemoveIndex(index); }} disabled={!canEdit || editing || removeIndex !== null || products.length <= 1}
                            aria-label={`Retirer ${name}`}
                            title={products.length <= 1 ? "Une commande doit garder au moins un produit" : canEdit ? "Retirer ce produit de la commande" : "Modification impossible : commande déjà payée ou droits insuffisants"}
                            className="grid size-8 cursor-pointer place-items-center rounded text-[#536b78] transition-colors hover:bg-[#fdecea] hover:text-[#b42318] focus-visible:outline-2 focus-visible:outline-[#b42318] disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-[#536b78]">
                            <Trash2 className="size-4" aria-hidden="true" />
                          </button>
                        </div>
                      )}
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
