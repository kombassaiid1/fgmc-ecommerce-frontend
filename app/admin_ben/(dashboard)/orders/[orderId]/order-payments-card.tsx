"use client";

import { Fragment, useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Card, Text } from "@shopify/polaris";
import { toast } from "sonner";
import { getOrderPaymentDetails, getOrderPayments, recordOrderPayment, type OrderDetail, type OrderPayment, type OrderPayments, type PaymentCardDetails, type PaymentInvoiceKind } from "@/lib/api/orders";

const fieldClass = "h-9 w-full min-w-0 border border-[#bacdd7] bg-white px-2 text-[13px] text-[#24364b] focus-visible:outline-2 focus-visible:outline-[#087e9a] disabled:bg-[#f4f6f7]";
const primaryClass = "inline-flex h-8 items-center justify-center bg-[#087e9a] px-3 text-xs font-semibold text-white hover:bg-[#09687f] disabled:opacity-60";
const dateFormat = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit", month: "2-digit", year: "numeric",
  hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Europe/Paris",
});

const initialDraft = { paidAt: "", method: "", transactionId: "", amount: "" };
const cardBrands: Record<string, string> = {
  visa: "Visa", mastercard: "Mastercard", amex: "American Express",
  cartes_bancaires: "CB", discover: "Discover", jcb: "JCB",
  diners: "Diners Club", unionpay: "UnionPay",
};
type CardLookup = { loading: true } | { error: true } | { card: PaymentCardDetails | null };

function formatDate(value: string) {
  return dateFormat.format(new Date(value)).replace(" à ", " ").replace(", ", " ");
}

function formatAmount(payment: OrderPayment) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: payment.currency }).format(payment.amountCents / 100);
}

function formatReference(reference: string) {
  return /^N[°º]/i.test(reference) ? reference : `N°${reference}`;
}

function toCents(value: string) {
  const normalized = value.trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return 0;
  const [units, decimals = ""] = normalized.split(".");
  return Number(units) * 100 + Number(decimals.padEnd(2, "0"));
}

function cardType(card: PaymentCardDetails | null) {
  if (card?.network === "cartes_bancaires") return "CB";
  const brand = card?.brand ?? card?.network;
  return brand && brand !== "unknown" ? cardBrands[brand] ?? brand : "Non défini";
}

export function OrderPaymentsCard({ order, canEdit, statusControl }: { order: OrderDetail; canEdit: boolean; statusControl?: ReactNode }) {
  const [data, setData] = useState<OrderPayments | null>(null);
  const [loadError, setLoadError] = useState("");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [draft, setDraft] = useState(initialDraft);
  const [invoiceKind, setInvoiceKind] = useState<PaymentInvoiceKind | "" | null>(null);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [cardLookups, setCardLookups] = useState<Record<string, CardLookup>>({});
  const requestId = useRef<string | null>(null);
  const formId = useId();
  const orderId = order.id;

  useEffect(() => {
    let active = true;
    getOrderPayments(orderId).then((result) => {
      if (active) setData(result);
    }).catch((error: unknown) => {
      if (active) setLoadError(error instanceof Error ? error.message : "Impossible de charger les paiements.");
    });
    return () => { active = false; };
  }, [orderId, loadAttempt]);

  const invoiceChoice = invoiceKind ?? data?.invoices[0]?.kind ?? "";
  const setField = (field: keyof typeof initialDraft, value: string) => {
    requestId.current = null;
    setDraft((current) => ({ ...current, [field]: value }));
  };

  async function loadCard(paymentId: string) {
    setCardLookups((current) => ({ ...current, [paymentId]: { loading: true } }));
    try {
      const { card } = await getOrderPaymentDetails(orderId, paymentId);
      setCardLookups((current) => ({ ...current, [paymentId]: { card } }));
    } catch {
      setCardLookups((current) => ({ ...current, [paymentId]: { error: true } }));
    }
  }

  function toggleDetails(payment: OrderPayment) {
    const open = expandedId !== payment.id;
    setExpandedId(open ? payment.id : null);
    if (open && payment.source !== "manual" && !cardLookups[payment.id]) {
      void loadCard(payment.id);
    }
  }

  function paymentDetails(payment: OrderPayment) {
    const lookup = cardLookups[payment.id];
    if (payment.source !== "manual" && lookup && "loading" in lookup) {
      return <p role="status">Chargement des détails…</p>;
    }
    if (lookup && "error" in lookup) {
      return (
        <div className="flex flex-wrap items-center gap-x-3">
          <p role="alert">Détails de la carte indisponibles.</p>
          <button type="button" className="text-[#087e9a] hover:underline" onClick={() => void loadCard(payment.id)}>Réessayer</button>
        </div>
      );
    }
    const card = lookup && "card" in lookup ? lookup.card : null;
    const details = payment.source === "manual"
      ? [
          ["Origine", "Saisie manuelle"],
          ["ID de la transaction", payment.transactionId ?? "Non défini"],
        ]
      : [
          ["Numéro de carte", card ? `•••• ${card.last4}` : "Non défini"],
          ["Type de carte", cardType(card)],
          ["Date d’expiration", card?.expiry ?? "Non définie"],
          ["Nom du titulaire de la carte", card?.billingName ?? "Non défini"],
        ];
    return (
      <dl className="space-y-0.5 leading-5">
        {details.map(([label, value]) => (
          <div key={label} className="flex flex-wrap gap-x-1.5">
            <dt className="font-semibold">{label}</dt>
            <dd className="min-w-0 break-all">{value}</dd>
          </div>
        ))}
      </dl>
    );
  }

  async function addPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || !canEdit || !data?.canRecord) return;
    const amountCents = toCents(draft.amount);
    const paidAt = new Date(draft.paidAt);
    const method = draft.method.trim();
    if (!method || !Number.isFinite(paidAt.getTime())) {
      setFormError("Indiquez une date et un moyen de paiement.");
      return;
    }
    if (!Number.isInteger(amountCents) || amountCents <= 0 || amountCents > 2_147_483_647) {
      setFormError("Indiquez un montant positif avec deux décimales au maximum.");
      return;
    }
    requestId.current ??= crypto.randomUUID();
    setSaving(true);
    setFormError("");
    try {
      setData(await recordOrderPayment(orderId, {
        id: requestId.current,
        paidAt: paidAt.toISOString(),
        method,
        transactionId: draft.transactionId.trim() || undefined,
        amountCents,
        currency: "EUR",
        invoiceKind: invoiceChoice || undefined,
      }));
      requestId.current = null;
      setDraft(initialDraft);
      setInvoiceKind(null);
      toast.success("Paiement enregistré.");
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Impossible d’enregistrer le paiement.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card padding="0">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#dce4ea] bg-[#f6f8f9] px-3 py-3">
        <Text as="h2" variant="headingMd">Paiement{data ? ` (${data.payments.length})` : ""}</Text>
        {statusControl}
      </div>
      <div className="px-5 pt-9 pb-12">
        {loadError ? (
          <div role="alert" className="flex flex-wrap items-center gap-3 text-sm">
            <span className="text-[#9b1c1c]">{loadError}</span>
            <button type="button" className="text-[#087e9a] hover:underline" onClick={() => {
              setLoadError("");
              setLoadAttempt((current) => current + 1);
            }}>Réessayer</button>
          </div>
        ) : !data ? <p role="status" className="text-sm text-[#667085]">Chargement des paiements…</p> : (
          <>
            <form id={formId} onSubmit={(event) => void addPayment(event)} />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] table-fixed border-collapse text-left text-[13px] text-[#24364b]">
                <colgroup>
                  <col className="w-[19%]" /><col className="w-[16%]" /><col className="w-[16%]" />
                  <col className="w-[22%]" /><col /><col className="w-[85px]" />
                </colgroup>
                <thead>
                  <tr className="border-b-2 border-[#22b6d1] [&_th]:px-1.5 [&_th]:py-2.5">
                    <th scope="col">Date</th>
                    <th scope="col">Moyen de paiement</th>
                    <th scope="col">ID de la transaction</th>
                    <th scope="col">Montant</th>
                    <th scope="col">Facture</th>
                    <th scope="col" aria-label="Actions" />
                  </tr>
                </thead>
                <tbody className="[&_td]:px-1.5 [&_td]:py-1.5">
                  {data.payments.map((payment) => {
                    const expanded = expandedId === payment.id;
                    const detailsId = `${formId}-details-${encodeURIComponent(payment.id)}`;
                    return (
                      <Fragment key={payment.id}>
                        <tr className="border-b border-[#c1d2da]">
                          <td className="whitespace-nowrap">{formatDate(payment.paidAt)}</td>
                          <td className="break-words">
                            {payment.method}
                            {payment.source === "stripe-test" ? <span className="ml-1 text-xs text-[#667085]">(test)</span> : null}
                          </td>
                          <td><span className="block truncate" title={payment.transactionId ?? undefined}>{payment.transactionId ?? "—"}</span></td>
                          <td>{formatAmount(payment)}</td>
                          <td className="break-words">{payment.invoiceReference ? formatReference(payment.invoiceReference) : "—"}</td>
                          <td className="text-right">
                            <button
                              type="button"
                              aria-expanded={expanded}
                              aria-controls={expanded ? detailsId : undefined}
                              onClick={() => toggleDetails(payment)}
                              className="h-8 border border-[#7c929e] bg-white px-2.5 text-xs text-[#425c69] hover:bg-[#f0f5f7]"
                            >
                              Détails
                            </button>
                          </td>
                        </tr>
                        {expanded ? (
                          <tr id={detailsId} className="border-b border-[#c1d2da]">
                            <td colSpan={6}>{paymentDetails(payment)}</td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })}
                  {!data.payments.length ? (
                    <tr className="border-b border-[#c1d2da]"><td colSpan={6} className="text-[#667085]">Aucun paiement enregistré.</td></tr>
                  ) : null}
                  {canEdit && data.canRecord ? (
                    <tr className="border-b border-[#c1d2da]">
                      <td><input form={formId} type="datetime-local" step={1} aria-label="Date du paiement" required value={draft.paidAt} onChange={(event) => setField("paidAt", event.target.value)} className={fieldClass} disabled={saving} /></td>
                      <td><input form={formId} aria-label="Moyen de paiement" autoComplete="off" required maxLength={100} value={draft.method} onChange={(event) => setField("method", event.target.value)} className={fieldClass} disabled={saving} /></td>
                      <td><input form={formId} aria-label="ID de la transaction" autoComplete="off" maxLength={160} value={draft.transactionId} onChange={(event) => setField("transactionId", event.target.value)} className={fieldClass} disabled={saving} /></td>
                      <td>
                        <div className="flex">
                          <input form={formId} aria-label="Montant" inputMode="decimal" autoComplete="off" required maxLength={12} value={draft.amount} onChange={(event) => setField("amount", event.target.value)} className={fieldClass} disabled={saving} />
                          <select aria-label="Devise" defaultValue="EUR" className={`${fieldClass} max-w-16 border-l-0`} disabled={saving}><option value="EUR">€</option></select>
                        </div>
                      </td>
                      <td>
                        <select form={formId} aria-label="Facture" value={invoiceChoice} onChange={(event) => {
                          requestId.current = null;
                          setInvoiceKind(event.target.value as PaymentInvoiceKind | "");
                        }} className={fieldClass} disabled={saving}>
                          <option value="">Sans facture</option>
                          {data.invoices.map(({ kind, reference }) => (
                            <option value={kind} key={kind}>{formatReference(reference)}{kind === "pro-forma" ? " · Pro forma" : ""}</option>
                          ))}
                        </select>
                      </td>
                      <td className="text-right"><button type="submit" form={formId} className={primaryClass} disabled={saving}>{saving ? "Ajout…" : "Ajouter"}</button></td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            {formError ? <p role="alert" className="mt-3 text-sm text-[#9b1c1c]">{formError}</p> : null}
            {canEdit && !data.canRecord ? <p className="mt-3 text-sm text-[#667085]">L’ajout manuel sera disponible après la mise à jour de la base.</p> : null}
          </>
        )}
      </div>
    </Card>
  );
}
