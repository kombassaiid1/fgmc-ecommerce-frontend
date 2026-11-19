import { useEffect, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { getCreditNoteUrl, type OrderRefund } from "@/lib/api/order-refunds";
import { getDeliverySlipUrl, regenerateOrderProForma, saveProFormaComment, type OrderDetail, type OrderPreview, type ProFormaDocument } from "@/lib/api/orders";

const dateFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeZone: "Europe/Paris" });
const linkStyle = "text-[#087e9a] hover:underline";

function dateLabel(date: string | null) {
  return date && Number.isFinite(Date.parse(date)) ? dateFormat.format(new Date(date)) : "—";
}

function moneyLabel(amount: number | null | undefined, currency = "EUR") {
  if (amount == null || !Number.isFinite(amount)) return "—";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: /^[A-Z]{3}$/.test(currency) ? currency : "EUR",
  }).format(amount);
}

function invoiceNumber(reference: string) {
  return /^N[°º]/i.test(reference) ? reference : `N°${reference}`;
}

export function OrderDocuments({
  order,
  preview,
  onCommentSaved,
  canRegenerate,
  refunds,
  retryRefund,
}: {
  order: OrderDetail;
  preview: OrderPreview | null;
  onCommentSaved?: (document: ProFormaDocument) => void;
  canRegenerate: boolean;
  refunds: OrderRefund[];
  retryRefund?: (id: string) => Promise<void>;
}) {
  const [regenerating, setRegenerating] = useState(false);
  const [noteDraft, setNoteDraft] = useState<string | null>(null);
  const [noteError, setNoteError] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [retrying, setRetrying] = useState<string | null>(null);
  const noteField = useRef<HTMLTextAreaElement>(null);
  const noteButton = useRef<HTMLButtonElement>(null);
  const editingNote = noteDraft !== null;
  const invoice = order.dolibarrInvoice;
  const showDeliverySlip = Boolean(preview?.shipping || preview?.deliverySlip);
  const proFormaNumber = preview?.proForma?.reference;
  const savedComment = preview?.proForma?.comment ?? "";
  const deliveryReference = preview?.deliverySlip?.reference;

  useEffect(() => {
    if (editingNote) noteField.current?.focus();
  }, [editingNote]);

  function closeNote() {
    setNoteDraft(null);
    setNoteError("");
    noteButton.current?.focus();
  }

  async function saveNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (noteDraft === null || !onCommentSaved || savingNote) return;
    setSavingNote(true);
    setNoteError("");
    try {
      const result = await saveProFormaComment(order.id, noteDraft);
      onCommentSaved(result);
      closeNote();
      toast.success("Commentaire enregistré sur le PDF.");
    } catch (error) {
      setNoteError(error instanceof Error ? error.message : "Impossible d’enregistrer la note.");
    } finally {
      setSavingNote(false);
    }
  }

  async function regenerate() {
    setRegenerating(true);
    try {
      await regenerateOrderProForma(order.id);
      toast.success("Facture pro-forma actualisée.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossible d’actualiser le PDF.");
    } finally {
      setRegenerating(false);
    }
  }

  async function checkRefund(id: string) {
    if (!retryRefund || retrying) return;
    setRetrying(id);
    try {
      await retryRefund(id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossible de vérifier le remboursement.");
    } finally {
      setRetrying(null);
    }
  }

  const note = onCommentSaved && preview && (
    <button
      ref={noteButton}
      type="button"
      aria-expanded={editingNote}
      aria-controls={editingNote ? "order-document-note" : undefined}
      onClick={() => editingNote ? noteField.current?.focus() : setNoteDraft(savedComment)}
      className="whitespace-nowrap rounded-sm bg-[#117d97] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0c687e]"
    >
      {savedComment ? "Modifier la note" : "Ajouter une note"}
    </button>
  );

  const noteEditor = noteDraft !== null && (
    <tr id="order-document-note" className="border-b border-[#c6d5dd]">
      <td colSpan={5}>
        <form onSubmit={(event) => void saveNote(event)} className="flex items-start gap-2" aria-busy={savingNote}>
          <textarea
            ref={noteField}
            aria-label="Commentaire de la facture pro-forma"
            aria-describedby={noteError ? "order-document-note-error" : undefined}
            className="min-h-9 min-w-0 flex-1 resize-y rounded-sm border border-[#bacbd3] bg-white px-2 py-2 text-sm focus-visible:outline-2 focus-visible:outline-[#117d97]"
            rows={1}
            maxLength={4000}
            value={noteDraft}
            disabled={savingNote}
            onChange={(event) => setNoteDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape" && !savingNote) {
                event.preventDefault();
                closeNote();
              }
            }}
          />
          <button type="button" onClick={closeNote} disabled={savingNote} className="min-h-9 rounded-sm bg-[#536b78] px-3 text-xs font-semibold text-white hover:bg-[#405661] disabled:opacity-60">
            Annuler
          </button>
          <button type="submit" disabled={savingNote || noteDraft.trim() === savedComment} className="min-h-9 rounded-sm bg-[#117d97] px-3 text-xs font-semibold text-white hover:bg-[#0c687e] disabled:opacity-60">
            {savingNote ? "Enregistrement…" : "Enregistrer"}
          </button>
        </form>
        {noteError ? <p id="order-document-note-error" role="alert" className="mt-2 text-sm text-[#9b1c1c]">{noteError}</p> : null}
      </td>
    </tr>
  );

  return (
    <div role="tabpanel" id="order-panel-documents" aria-labelledby="order-tab-documents" className="bg-white px-4 pt-4 pb-10">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[530px] border-collapse text-left text-[13px] text-[#344054]">
          <colgroup>
            <col style={{ width: "16%" }} />
            <col style={{ width: "22%" }} />
            <col style={{ width: "21%" }} />
            <col style={{ width: "14%" }} />
            <col />
          </colgroup>
          <thead>
            <tr className="border-b-2 border-[#22b6d1] text-[#24364b]">
              <th scope="col" className="px-2 py-2.5">Date</th>
              <th scope="col" className="px-2 py-2.5">Document</th>
              <th scope="col" className="px-2 py-2.5">Numéro</th>
              <th scope="col" className="px-2 py-2.5">Montant</th>
              <th scope="col" className="px-2 py-2.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="[&_td]:px-2 [&_td]:py-2">
            {invoice && (
              <tr className="border-b border-[#c6d5dd]">
                <td className="whitespace-nowrap">{dateLabel(invoice.date)}</td>
                <td>Facture</td>
                <td>
                  {invoice.invoiceUrl ? (
                    <a href={invoice.invoiceUrl} target="_blank" rel="noopener noreferrer" className={linkStyle}>
                      {invoiceNumber(invoice.reference)}
                    </a>
                  ) : invoiceNumber(invoice.reference)}
                </td>
                <td className="whitespace-nowrap">{moneyLabel(invoice.totalTtc, invoice.currency ?? "EUR")}</td>
                <td />
              </tr>
            )}
            <tr className="border-b border-[#c6d5dd]">
              <td className="whitespace-nowrap">{dateLabel(order.createdAt)}</td>
              <td>Facture pro-forma</td>
              <td>
                <a
                  href={`/frontend-api/admin/orders/${encodeURIComponent(order.id)}/pro-forma`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={linkStyle}
                  aria-label={proFormaNumber ? `Ouvrir la facture pro-forma ${invoiceNumber(proFormaNumber)}` : "Ouvrir le PDF de la facture pro-forma"}
                >
                  {proFormaNumber ? invoiceNumber(proFormaNumber) : "Ouvrir le PDF"}
                </a>
              </td>
              <td className="whitespace-nowrap">{moneyLabel(order.total)}</td>
              <td className="text-right">
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {note}
                  {canRegenerate && proFormaNumber ? (
                    <button
                      type="button"
                      disabled={regenerating}
                      title="Recrée le PDF avec les données et le logo actuels"
                      className={`whitespace-nowrap text-xs font-semibold ${linkStyle} disabled:opacity-60`}
                      onClick={() => void regenerate()}
                    >
                      {regenerating ? "Actualisation…" : "Actualiser le PDF"}
                    </button>
                  ) : null}
                </div>
              </td>
            </tr>
            {noteEditor}
            {showDeliverySlip && (
              <tr className="border-b border-[#c6d5dd]">
                <td className="whitespace-nowrap">{dateLabel(order.createdAt)}</td>
                <td>Bon de livraison</td>
                <td>
                  <a
                    href={getDeliverySlipUrl(order.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={linkStyle}
                    aria-label={deliveryReference ? `Ouvrir le bon de livraison ${deliveryReference}` : "Ouvrir le PDF du bon de livraison"}
                  >
                    {deliveryReference ? `#${deliveryReference}` : "Ouvrir le PDF"}
                  </a>
                </td>
                <td className="whitespace-nowrap">{moneyLabel(order.deliveryFee)}</td>
                <td />
              </tr>
            )}
            {refunds.map((refund) => (
              <tr key={refund.id} className="border-b border-[#c6d5dd]">
                <td className="whitespace-nowrap">{dateLabel(refund.createdAt)}</td>
                <td>{refund.status === "succeeded" ? "Avoir" : "Remboursement"}{refund.stripeLivemode === false ? " · test Stripe" : ""}</td>
                <td>
                  {refund.status === "succeeded" && refund.reference ? (
                    <a href={getCreditNoteUrl(order.id, refund.id)} className={linkStyle} target="_blank" rel="noopener noreferrer"
                      aria-label={`Ouvrir l’avoir ${refund.reference}`}>{refund.reference}</a>
                  ) : refund.status === "pending" ? "En attente de Stripe" : "Échec du remboursement"}
                </td>
                <td className="whitespace-nowrap">{moneyLabel(-refund.amountCents / 100)}</td>
                <td className="text-right">
                  {refund.voucherCode ? <span>Bon de réduction <code className="select-all">{refund.voucherCode}</code></span> : null}
                  {refund.status === "pending" && retryRefund ? (
                    <button type="button" className={`${linkStyle} disabled:opacity-60`} disabled={Boolean(retrying)} onClick={() => void checkRefund(refund.id)}>
                      {retrying === refund.id ? "Vérification…" : "Vérifier le remboursement"}
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
