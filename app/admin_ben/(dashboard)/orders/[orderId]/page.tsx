"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Banner, BlockStack, Button, Card, InlineGrid, Spinner, Text } from "@shopify/polaris";
import { useAdminSession } from "@/components/admin/admin-session";
import { openClientAccount } from "@/lib/api/admin-clients";
import { getAdminOrder, getOrderPreview, updateOrderPaymentStatus, updateOrderStatus, type OrderDetail, type OrderPreview } from "@/lib/api/orders";
import { useOrderStates } from "@/lib/use-order-states";
import { toast } from "sonner";
import { File, History, RotateCcw, Truck } from "lucide-react";
import { GlsShippingCard } from "./gls-shipping-card";
import { ColissimoShippingCard } from "./colissimo-shipping-card";
import { CustomerCard } from "./customer-card";
import { OrderDocuments } from "./order-documents";
import { getOrderRefunds, retryOrderRefund, type OrderRefund, type RefundContext } from "@/lib/api/order-refunds";
import { OrderPaymentsCard } from "./order-payments-card";
import { OrderProductsCard } from "./order-products-card";

const PAYMENT_STATUS_OPTIONS = [
  { label: "En attente", value: "En_attente" },
  { label: "Paiement accepté", value: "Payé" },
  { label: "Échoué", value: "échoué" },
];

function formatMoney(value: number | null | undefined) {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number.isFinite(amount) ? amount : 0);
}

function formatDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

const GLS_LABELS: Record<string, string> = { HOME: "GLS En entreprise", RELAY: "GLS En Relais", FLEX: "GLS À domicile", EXPRESS: "GLS Express" };

/** A date as PrestaShop shows it in the status history: 2026-11-18 15:22:22. */
function historyDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const two = (number: number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())} ${two(date.getHours())}:${two(date.getMinutes())}:${two(date.getSeconds())}`;
}

function Detail({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div>
      <p className="text-xs font-semibold text-[#667085]">{label}</p>
      <p className="mt-1 break-words text-sm text-[#24364b]">{value || "—"}</p>
    </div>
  );
}

export default function AdminOrderDetailPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = use(params);
  const router = useRouter();
  const { can } = useAdminSession();
  const canOpenClientAccount = can("clients.edit");
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const { options: statusOptions, colors: statusColors } = useOrderStates();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [openingClientAccount, setOpeningClientAccount] = useState(false);
  const [nextStatus, setNextStatus] = useState("");
  const [nextPaymentStatus, setNextPaymentStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"status" | "documents" | "carriers" | "returns">("status");
  const [refundOrderId, setRefundOrderId] = useState<string | null>(null);
  const [refunds, setRefunds] = useState<{ orderId: string; context: RefundContext | null; error?: string } | null>(null);
  const [preview, setPreview] = useState<{ id: string; data?: OrderPreview } | null>(null);

  const loadOrder = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAdminOrder(orderId);
      setOrder(data);
      setNextStatus(data.etat);
      setNextPaymentStatus(data.paymentStatus);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Impossible de charger cette commande.");
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    let cancelled = false;
    getOrderPreview(orderId)
      .then((data) => {
        if (!cancelled) setPreview({ id: orderId, data });
      })
      .catch(() => {
        if (!cancelled) setPreview({ id: orderId });
      });
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  useEffect(() => {
    void loadOrder();
  }, [loadOrder]);

  const refreshPreview = useCallback(() => getOrderPreview(orderId).then((data) => setPreview({ id: orderId, data })).catch(() => undefined), [orderId]);

  useEffect(() => {
    let cancelled = false;
    getOrderRefunds(orderId).then((context) => {
      if (!cancelled) setRefunds({ orderId, context });
    }).catch((error: unknown) => {
      if (!cancelled) setRefunds({ orderId, context: null, error: error instanceof Error ? error.message : "Impossible de charger les remboursements." });
    });
    return () => { cancelled = true; };
  }, [orderId, order?.paymentStatus]);

  useEffect(() => {
    if (tab !== "documents") return;
    const refresh = () => void refreshPreview();
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [tab, refreshPreview]);

  const saveStatus = async (kind: "etat" | "paymentStatus") => {
    if (!order) return;
    setSaving(true);
    try {
      if (kind === "etat") await updateOrderStatus(order.id, nextStatus);
      else await updateOrderPaymentStatus(order.id, nextPaymentStatus);
      toast.success(kind === "etat" ? "Statut de commande mis à jour." : "Statut de paiement mis à jour.");
      await loadOrder();
      if (kind === "etat") await refreshPreview();
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : "Impossible de mettre à jour la commande.");
    } finally {
      setSaving(false);
    }
  };

  const currentPreview = preview?.id === orderId ? (preview.data ?? null) : null;
  const onNoteSaved = can("orders.edit") ? (privateNote: string | null) => {
    setOrder((current) => current?.id === orderId ? { ...current, privateNote } : current);
  } : undefined;

  async function loginAsClient() {
    const clientId = order?.Client?.id;
    if (!clientId || !canOpenClientAccount || openingClientAccount) return;

    setOpeningClientAccount(true);
    try {
      await openClientAccount(clientId);
    } catch (loginError) {
      toast.error(loginError instanceof Error ? loginError.message : "Connexion au compte impossible.");
    } finally {
      setOpeningClientAccount(false);
    }
  }

  if (loading) return <div className="flex justify-center py-16"><Spinner accessibilityLabel="Chargement de la commande" size="large" /></div>;
  if (error || !order) return <BlockStack gap="400"><Button onClick={() => router.push("/admin_ben/orders")}>← Retour aux commandes</Button><Banner tone="critical" title={error ?? "Commande introuvable."} /></BlockStack>;

  const customerName = order.Client
    ? `${order.Client.Titre === "Mme" ? "Mme" : "M"} ${order.Client.firstName} ${order.Client.lastName}`.trim()
    : order.guestName || "Client invité";
  const refunding = refundOrderId === orderId;
  const refundContext = refunds?.orderId === orderId ? refunds.context : null;
  const orderRefunds = refundContext?.refunds ?? [];

  function updateRefund(refund: OrderRefund) {
    setRefunds((current) => {
      if (!current?.context || current.orderId !== orderId) return current;
      const previous = current.context.refunds.find((row) => row.id === refund.id);
      const previouslyReserved = previous && previous.status !== "failed" ? previous.amountCents : 0;
      const reserved = refund.status !== "failed" ? refund.amountCents : 0;
      return { orderId, context: {
        ...current.context,
        remainingCents: Math.max(0, current.context.remainingCents + previouslyReserved - reserved),
        refunds: [refund, ...current.context.refunds.filter((row) => row.id !== refund.id)],
      } };
    });
  }

  function onRefundSaved(refund: OrderRefund) {
    updateRefund(refund);
    setRefundOrderId(null);
    setTab("documents");
    requestAnimationFrame(() => document.getElementById("order-tab-documents")?.focus());
  }

  function cancelRefund() {
    setRefundOrderId(null);
    requestAnimationFrame(() => document.getElementById("order-partial-refund-action")?.focus());
  }

  const invoiceCard = (
    <Card padding="0">
      <div className="border-b border-[#dce4ea] px-4 py-3"><Text as="h2" variant="headingMd">Facture Dolibarr</Text></div>
      <div className="flex flex-wrap items-center justify-between gap-4 p-4">
        {order.dolibarrInvoice ? (
          <div className="grid flex-1 gap-4 sm:grid-cols-3">
            <Detail label="Référence" value={order.dolibarrInvoice.reference} />
            <Detail label="Statut" value={order.dolibarrInvoice.status} />
            <Detail label="Date" value={formatDate(order.dolibarrInvoice.date ?? undefined)} />
            <Detail label="Total TTC" value={order.dolibarrInvoice.totalTtc == null ? "—" : `${formatMoney(order.dolibarrInvoice.totalTtc)}${order.dolibarrInvoice.currency && order.dolibarrInvoice.currency !== "EUR" ? ` (${order.dolibarrInvoice.currency})` : ""}`} />
          </div>
        ) : (
          <p className="text-sm text-[#667085]">Aucune facture Dolibarr n’est encore liée à cette commande.</p>
        )}
        {order.dolibarrInvoice?.invoiceUrl ? (
          <a href={order.dolibarrInvoice.invoiceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center rounded-md border border-[#cbd6de] bg-white px-3 text-sm font-medium text-[#344054] hover:bg-[#f7f8f9]">
            Ouvrir le PDF
          </a>
        ) : order.dolibarrInvoice ? <p className="text-xs text-[#667085]">Lien public non disponible. Vérifiez que le PDF a été généré après l’activation du partage externe.</p> : null}
      </div>
    </Card>
  );

  return (
    <BlockStack gap="300">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#dce4ea] pb-3">
        <div>
          <button type="button" onClick={() => router.push("/admin_ben/orders")} className="mb-1 text-sm text-[#64748b] hover:text-[#168ca8]">Commandes</button>
          <h1 className="text-xl font-semibold text-[#344054]">#{order.id.slice(-8)} <span className="text-[#344054]">{order.reference ?? order.id.slice(0, 10).toUpperCase()}</span> <span className="font-normal text-[#667085]">de {customerName}</span> <span className="mx-1 rounded bg-[#344054] px-2 py-1 text-sm font-semibold text-white">{formatMoney(order.total)}</span> <span className="text-base font-normal text-[#667085]">{formatDate(order.createdAt)}</span></h1>
        </div>
        <Button onClick={() => router.push("/admin_ben/orders")}>Retour</Button>
      </div>

      <div className="flex flex-wrap items-center gap-2 border border-[#d9dde1] bg-[#e9eaec] p-2">
        <select aria-label="Statut de paiement" value={nextPaymentStatus} onChange={(event) => setNextPaymentStatus(event.target.value)} className="h-9 min-w-52 rounded border border-[#cbd6de] bg-white px-3 text-sm font-semibold text-[#344054]">
          {[...PAYMENT_STATUS_OPTIONS, ...(!PAYMENT_STATUS_OPTIONS.some((option) => option.value === nextPaymentStatus) ? [{ label: nextPaymentStatus, value: nextPaymentStatus }] : [])].map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <Button disabled={saving} onClick={() => void saveStatus("paymentStatus")}>Mettre à jour</Button>
        <select aria-label="Statut de la commande" value={nextStatus} onChange={(event) => setNextStatus(event.target.value)} style={{ backgroundColor: statusColors[nextStatus]?.backgroundColor, color: statusColors[nextStatus]?.textColor }} className="h-9 min-w-56 rounded border border-black/10 px-3 text-sm font-semibold">
          {statusOptions.map((option) => <option key={option.value} value={option.value} style={{ backgroundColor: option.backgroundColor, color: option.textColor }}>{option.label}</option>)}
          {!statusOptions.some((option) => option.value === nextStatus) ? <option value={nextStatus} hidden>{nextStatus}</option> : null}
        </select>
        <Button disabled={saving} onClick={() => void saveStatus("etat")}>Mettre à jour le statut</Button>
        {order.dolibarrInvoice?.invoiceUrl ? (
          <a href={order.dolibarrInvoice.invoiceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center rounded-md border border-[#cbd6de] bg-white px-3 text-sm font-medium text-[#344054] hover:bg-[#f7f8f9]">
            Voir la facture Dolibarr
          </a>
        ) : <Button disabled>Lien public indisponible</Button>}
        <Button onClick={() => window.print()}>▣ Imprimer la commande</Button>
        <Button
          disabled={!order.Client || !canOpenClientAccount}
          loading={openingClientAccount}
          onClick={() => void loginAsClient()}
        >
          Connecter au compte client
        </Button>
        <Button
          id="order-partial-refund-action"
          ariaControls="order-products"
          ariaExpanded={refunding}
          disabled={refunding || !can("orders.edit")}
          onClick={() => {
            setRefundOrderId(orderId);
            void getOrderRefunds(orderId).then((context) => setRefunds({ orderId, context })).catch((error: unknown) => {
              setRefunds({ orderId, context: null, error: error instanceof Error ? error.message : "Impossible de charger les remboursements." });
            });
          }}
        >
          ↔ Remboursement partiel
        </Button>
        <span className="ml-auto flex gap-2"><Button disabled accessibilityLabel="Commande précédente">←</Button><Button disabled accessibilityLabel="Commande suivante">→</Button></span>
      </div>

      {refunding ? (
        <div className="mb-8">
          <OrderProductsCard key={order.id} order={order} preview={currentPreview} onCancelRefund={cancelRefund}
            onRefundSaved={onRefundSaved} refundContext={refundContext} refundLoadError={refunds?.orderId === orderId ? refunds.error : undefined} />
        </div>
      ) : null}

      <div className="grid items-start gap-3 xl:grid-cols-[minmax(350px,0.82fr)_minmax(0,1.65fr)]">
        <CustomerCard key={order.id} order={order} onUpdated={setOrder} onNoteSaved={onNoteSaved} />

        <BlockStack gap="300">
          {!refunding ? invoiceCard : null}
          {!refunding ? <OrderProductsCard key={`products-${order.id}`} order={order} preview={currentPreview} /> : null}

          <Card padding="0">
            <div role="tablist" aria-label="Détails de la commande" className="flex flex-wrap items-end gap-1 border-b border-[#dce4ea] bg-[#e9eaec] px-3 pt-2 text-sm">
              {([
                ["status", "État", History, currentPreview ? currentPreview.history.length : 1],
                ["documents", "Documents", File, 1 + Number(Boolean(order.dolibarrInvoice)) + Number(Boolean(currentPreview?.shipping || currentPreview?.deliverySlip)) + orderRefunds.filter((refund) => refund.status === "succeeded").length],
                ["carriers", "Transporteurs", Truck, currentPreview ? (currentPreview.shipping ? 1 : 0) : null],
                ["returns", "Retours produit", RotateCcw, 0],
              ] as const).map(([id, label, Icon, count]) => (
                <button key={id} id={`order-tab-${id}`} type="button" role="tab" aria-selected={tab === id} aria-controls={`order-panel-${id}`} onClick={() => setTab(id)} className={`-mb-px inline-flex items-center gap-1.5 rounded-t-sm border-t-2 px-3 py-3 ${tab === id ? "border-[#22b6d1] bg-white font-medium text-[#344054]" : "border-transparent text-[#536b78] hover:text-[#344054]"}`}>
                  <Icon size={17} aria-hidden="true" />
                  {label} ({count ?? "…"})
                </button>
              ))}
            </div>

            {tab === "status" ? (
              <div role="tabpanel" id="order-panel-status" aria-labelledby="order-tab-status" className="p-3">
                <ul aria-label="Historique des statuts" className="border-y border-[#cbd7df]">
                  {(currentPreview?.history ?? [{ etat: order.etat, by: null, at: order.updatedAt }]).map((entry, index) => (
                    <li key={`${entry.at}-${index}`} className="grid grid-cols-1 items-center gap-1 border-b border-[#e3e8ec] px-2 py-2 text-sm last:border-b-0 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]">
                      <span><span className="inline-block rounded px-2 py-0.5 text-xs font-semibold" style={{ backgroundColor: statusColors[entry.etat]?.backgroundColor ?? "#e5e7eb", color: statusColors[entry.etat]?.textColor ?? "#1f2937" }}>{entry.etat}</span></span>
                      <span className="text-[#344054] sm:text-center">{entry.by ?? ""}</span>
                      <span className="tabular-nums text-[#344054] sm:text-right">{historyDate(entry.at)}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
                  <select aria-label="Nouveau statut de la commande" value={nextStatus} onChange={(event) => setNextStatus(event.target.value)} className="h-9 min-w-64 rounded border border-[#cbd6de] bg-white px-2 text-sm">
                    {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    {!statusOptions.some((option) => option.value === nextStatus) ? <option value={nextStatus} hidden>{nextStatus}</option> : null}
                  </select>
                  <Button variant="primary" disabled={saving || nextStatus === order.etat} onClick={() => void saveStatus("etat")}>Mettre à jour le statut</Button>
                </div>
              </div>
            ) : null}

            {tab === "documents" ? (
              <OrderDocuments
                key={order.id}
                order={order}
                preview={currentPreview}
                refunds={orderRefunds}
                retryRefund={can("orders.edit") ? async (id) => updateRefund(await retryOrderRefund(orderId, id)) : undefined}
                canRegenerate={can("orders.edit")}
                onCommentSaved={can("orders.edit") ? (proForma) => {
                  setPreview((current) => current?.id === orderId && current.data
                    ? { id: orderId, data: { ...current.data, proForma } }
                    : current);
                } : undefined}
              />
            ) : null}

            {tab === "carriers" ? (
              <div role="tabpanel" id="order-panel-carriers" aria-labelledby="order-tab-carriers" className="p-4 text-sm text-[#344054]">
                {!currentPreview ? <p className="text-[#667085]">Chargement…</p> : !currentPreview.shipping ? (
                  <p className="text-[#667085]">Le client n’a pas choisi de transporteur pour cette commande.</p>
                ) : (
                  <div className="space-y-4">
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[640px] border-collapse text-left text-[13px]">
                        <thead>
                          <tr className="border-b-2 border-[#22b6d1] font-semibold">
                            <th className="py-2 pr-3">Date</th><th className="py-2 pr-3">Transporteur choisi</th><th className="py-2 pr-3">Zone</th><th className="py-2 pr-3 text-right">Poids</th><th className="py-2 pr-3 text-right">Frais de port <span className="text-[10px] font-normal">HT</span></th><th className="py-2">Numéro de suivi</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b border-[#e3e8ec]">
                            <td className="whitespace-nowrap py-2 pr-3">{formatDate(currentPreview.shipping.createdAt)}</td>
                            <td className="py-2 pr-3 font-semibold">{currentPreview.shipping.carrierName}</td>
                            <td className="py-2 pr-3">{currentPreview.shipping.zoneName ?? "—"} ({currentPreview.shipping.countryCode})</td>
                            <td className="whitespace-nowrap py-2 pr-3 text-right">{currentPreview.shipping.weightKg} kg</td>
                            <td className="whitespace-nowrap py-2 pr-3 text-right">{formatMoney(currentPreview.shipping.fee + currentPreview.shipping.handlingFee)}</td>
                            <td className="py-2">
                              {currentPreview.trackingNumbers.length ? (
                                currentPreview.trackingLink ? <a href={currentPreview.trackingLink} target="_blank" rel="noopener noreferrer" className="text-[#168ca8] underline hover:text-[#0e6f87]">{currentPreview.trackingNumbers.join(",")}</a> : currentPreview.trackingNumbers.join(", ")
                              ) : "—"}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <p className="text-xs text-[#667085]">Payé par le client pour la livraison : <strong className="text-[#344054]">{formatMoney(order.deliveryFee ?? 0)}</strong> TTC{currentPreview.shipping.handlingFee ? ` (dont ${formatMoney(currentPreview.shipping.handlingFee)} HT de frais de manutention)` : ""}.</p>
                    {currentPreview.delivery ? (
                      <div className="rounded border border-[#dce4ea] bg-[#f7fafc] p-3 text-[13px]">
                        <div><strong>Livraison GLS :</strong> {GLS_LABELS[currentPreview.delivery.glsType] ?? currentPreview.delivery.glsType}</div>
                        {currentPreview.delivery.relay?.name ? <div><strong>Point relais choisi :</strong> {currentPreview.delivery.relay.name}, {currentPreview.delivery.relay.street}, {currentPreview.delivery.relay.zip} {currentPreview.delivery.relay.city}{currentPreview.delivery.parcelShopId ? ` (${currentPreview.delivery.parcelShopId})` : ""}</div> : null}
                        {currentPreview.delivery.customerMobile ? <div><strong>Mobile du client :</strong> {currentPreview.delivery.customerMobile}</div> : null}
                      </div>
                    ) : null}
                    {currentPreview.colissimoDelivery ? (
                      <div className="rounded border border-[#dce4ea] bg-[#f7fafc] p-3 text-[13px]">
                        <div><strong>Livraison Colissimo :</strong> {({ HOME: "Domicile sans signature", HOME_SIGN: "Domicile avec signature", RELAY: "Point de retrait" } as Record<string, string>)[currentPreview.colissimoDelivery.colissimoType] ?? currentPreview.colissimoDelivery.colissimoType}</div>
                        {currentPreview.colissimoDelivery.relay?.name ? <div><strong>Point de retrait choisi :</strong> {currentPreview.colissimoDelivery.relay.name}, {currentPreview.colissimoDelivery.relay.street}, {currentPreview.colissimoDelivery.relay.zip} {currentPreview.colissimoDelivery.relay.city}{currentPreview.colissimoDelivery.pickupPointId ? ` (${currentPreview.colissimoDelivery.pickupPointId})` : ""}</div> : null}
                        {currentPreview.colissimoDelivery.customerMobile ? <div><strong>Mobile du client :</strong> {currentPreview.colissimoDelivery.customerMobile}</div> : null}
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            ) : null}

            {tab === "returns" ? <div role="tabpanel" id="order-panel-returns" aria-labelledby="order-tab-returns" className="p-4 text-sm text-[#667085]">Aucun retour pour cette commande.</div> : null}
          </Card>

          <OrderPaymentsCard key={order.id} order={order} canEdit={can("orders.edit")} />
          {refunding ? invoiceCard : null}

          <InlineGrid columns={{ xs: 1, lg: 2 }} gap="400" alignItems="start">
            <GlsShippingCard order={order} disabledReason={currentPreview?.carrierKind === "COLISSIMO" ? "Cette commande a été passée avec un transporteur Colissimo : l’expédition GLS est désactivée." : undefined} />
            <ColissimoShippingCard order={order} disabledReason={currentPreview?.carrierKind === "GLS" ? "Cette commande a été passée avec un transporteur GLS : l’expédition Colissimo est désactivée." : undefined} />
          </InlineGrid>
        </BlockStack>
      </div>
    </BlockStack>
  );
}
