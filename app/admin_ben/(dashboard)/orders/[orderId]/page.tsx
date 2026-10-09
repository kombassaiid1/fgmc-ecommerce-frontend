"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Banner, BlockStack, Button, Card, Spinner, Text } from "@shopify/polaris";
import { getOrder, updateOrderPaymentStatus, updateOrderStatus, type OrderDetail, type StoredOrderProduct } from "@/lib/api/orders";
import { getAdminSettings } from "@/lib/api/settings";
import { mergeOrderStatusColors, ORDER_STATUS_OPTIONS } from "@/lib/order-statuses";
import { toast } from "sonner";

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

function getProducts(order: OrderDetail): StoredOrderProduct[] {
  return Array.isArray(order.products) ? order.products as StoredOrderProduct[] : [];
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
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [statusColors, setStatusColors] = useState(mergeOrderStatusColors());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [nextStatus, setNextStatus] = useState("");
  const [nextPaymentStatus, setNextPaymentStatus] = useState("");
  const [error, setError] = useState<string | null>(null);

  const loadOrder = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getOrder(orderId);
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
    void loadOrder();
    void getAdminSettings().then((settings) => setStatusColors(mergeOrderStatusColors(settings.orderStatusColors))).catch(() => {});
  }, [loadOrder]);

  const saveStatus = async (kind: "etat" | "paymentStatus") => {
    if (!order) return;
    setSaving(true);
    try {
      if (kind === "etat") await updateOrderStatus(order.id, nextStatus);
      else await updateOrderPaymentStatus(order.id, nextPaymentStatus);
      toast.success(kind === "etat" ? "Statut de commande mis à jour." : "Statut de paiement mis à jour.");
      await loadOrder();
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : "Impossible de mettre à jour la commande.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center py-16"><Spinner accessibilityLabel="Chargement de la commande" size="large" /></div>;
  if (error || !order) return <BlockStack gap="400"><Button onClick={() => router.push("/admin_ben/orders")}>← Retour aux commandes</Button><Banner tone="critical" title={error ?? "Commande introuvable."} /></BlockStack>;

  const customerName = order.Client
    ? `${order.Client.Titre === "Mme" ? "Mme" : "M"} ${order.Client.firstName} ${order.Client.lastName}`.trim()
    : order.guestName || "Client invité";
  const customerEmail = order.Client?.email ?? order.guestEmail;
  const customerPhone = order.Client?.phoneNumber ?? order.guestPhone;
  const address = order.Address;
  const productsTotal = getProducts(order).reduce((sum, product) => sum + (Number(product.totalPrice) || 0), 0);
  const shipping = Number(order.deliveryFee ?? 0);

  const addressLines = address
    ? [customerName, order.Client?.company, address.street, `${address.zipCode} ${address.City}`, address.state, address.country, customerPhone].filter(Boolean)
    : [order.guestAddress || "Aucune adresse enregistrée."];
  const invoiceLines = address
    ? [customerName, order.Client?.company, address.street, `${address.zipCode} ${address.City}`, address.state, address.country].filter(Boolean)
    : ["Identique à l'adresse de livraison"];

  return (
    <BlockStack gap="300">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#dce4ea] pb-3">
        <div>
          <button type="button" onClick={() => router.push("/admin_ben/orders")} className="mb-1 text-sm text-[#64748b] hover:text-[#168ca8]">Commandes</button>
          <h1 className="text-xl font-semibold text-[#344054]">#{order.id.slice(-8)} <span className="text-[#344054]">{order.id.slice(0, 10).toUpperCase()}</span> <span className="font-normal text-[#667085]">de {customerName}</span> <span className="mx-1 rounded bg-[#344054] px-2 py-1 text-sm font-semibold text-white">{formatMoney(order.total)}</span> <span className="text-base font-normal text-[#667085]">{formatDate(order.createdAt)}</span></h1>
        </div>
        <Button onClick={() => router.push("/admin_ben/orders")}>Retour</Button>
      </div>

      <div className="flex flex-wrap items-center gap-2 border border-[#d9dde1] bg-[#e9eaec] p-2">
        <select aria-label="Statut de paiement" value={nextPaymentStatus} onChange={(event) => setNextPaymentStatus(event.target.value)} className="h-9 min-w-52 rounded border border-[#cbd6de] bg-white px-3 text-sm font-semibold text-[#344054]">
          {[...PAYMENT_STATUS_OPTIONS, ...(!PAYMENT_STATUS_OPTIONS.some((option) => option.value === nextPaymentStatus) ? [{ label: nextPaymentStatus, value: nextPaymentStatus }] : [])].map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <Button disabled={saving} onClick={() => void saveStatus("paymentStatus")}>Mettre à jour</Button>
        <select aria-label="Statut de la commande" value={nextStatus} onChange={(event) => setNextStatus(event.target.value)} style={{ backgroundColor: statusColors[nextStatus]?.backgroundColor, color: statusColors[nextStatus]?.textColor }} className="h-9 min-w-56 rounded border border-black/10 px-3 text-sm font-semibold">
          {ORDER_STATUS_OPTIONS.filter((option) => option.value).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          {!ORDER_STATUS_OPTIONS.some((option) => option.value === nextStatus) ? <option value={nextStatus}>{nextStatus}</option> : null}
        </select>
        <Button disabled={saving} onClick={() => void saveStatus("etat")}>Mettre à jour le statut</Button>
        {order.dolibarrInvoice?.invoiceUrl ? (
          <a href={order.dolibarrInvoice.invoiceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center rounded-md border border-[#cbd6de] bg-white px-3 text-sm font-medium text-[#344054] hover:bg-[#f7f8f9]">
            Voir la facture Dolibarr
          </a>
        ) : <Button disabled>Lien public indisponible</Button>}
        <Button onClick={() => window.print()}>▣ Imprimer la commande</Button>
        <Button disabled>Connecter au compte client</Button>
        <Button disabled>↔ Remboursement partiel</Button>
        <span className="ml-auto flex gap-2"><Button disabled accessibilityLabel="Commande précédente">←</Button><Button disabled accessibilityLabel="Commande suivante">→</Button></span>
      </div>

      <div className="grid items-start gap-3 xl:grid-cols-[minmax(350px,0.82fr)_minmax(0,1.65fr)]">
        <Card padding="0">
          <div className="border-b border-[#dce4ea] px-4 py-3"><Text as="h2" variant="headingMd">Client</Text></div>
          <div className="space-y-3 p-4">
            <div className="flex items-center justify-between gap-3 bg-[#f7f7f7] px-4 py-3">
              <div className="min-w-0"><p className="truncate font-semibold text-[#344054]">▣ {customerName} {order.Client ? <span className="ml-2 font-medium text-[#7c8996]">#{order.Client.id}</span> : null}</p>{!order.Client ? <p className="mt-1 text-xs text-[#667085]">Commande invitée</p> : null}</div>
              <Button disabled>Voir les détails</Button>
            </div>
            <div className="grid gap-x-5 gap-y-3 px-1 py-1 sm:grid-cols-2">
              <Detail label="E-mail :" value={customerEmail} />
              <Detail label="Commandes validées :" value={order.Client ? order.customerOrderCount : "—"} />
              <Detail label="Compte créé :" value={order.Client ? "Client enregistré" : "Invité"} />
              <Detail label="Total dépensé depuis inscription :" value={order.Client ? formatMoney(order.customerTotalSpent) : "—"} />
            </div>
            <div className="grid gap-3 bg-[#f7f7f7] p-4 sm:grid-cols-2">
              <div><h3 className="mb-2 text-sm font-semibold text-[#344054]">Adresse de livraison</h3><p className="whitespace-pre-line text-sm leading-5 text-[#526174]">{addressLines.join("\n")}</p></div>
              <div className="border-t border-[#dce4ea] pt-3 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0"><h3 className="mb-2 text-sm font-semibold text-[#344054]">Adresse de facturation</h3><p className="whitespace-pre-line text-sm leading-5 text-[#526174]">{invoiceLines.join("\n")}</p></div>
            </div>
            <div className="border border-[#e3e7eb] p-3">
              <div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-semibold text-[#344054]">Note privée</h3><span aria-hidden="true" className="text-[#748399]">−</span></div>
              <textarea aria-label="Note privée" disabled rows={3} className="w-full resize-y border border-[#cbd4dc] bg-white p-2 text-sm text-[#526174]" placeholder="Les notes privées pourront être ajoutées ici ultérieurement." />
              <div className="mt-2 text-right"><Button disabled>Enregistrer</Button></div>
            </div>
          </div>
        </Card>

        <BlockStack gap="300">
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

          <Card padding="0">
            <div className="border-b border-[#dce4ea] px-4 py-3"><Text as="h2" variant="headingMd">Produits ({getProducts(order).length})</Text></div>
            <div className="overflow-x-auto px-3">
              <table className="w-full min-w-[760px] border-collapse text-left text-xs text-[#344054]">
                <thead><tr className="border-b-2 border-[#22b6d1] font-semibold"><th className="py-3 pr-2">Produit</th><th className="px-2 py-3">Prix unitaire <small className="block font-normal text-[#8492a3]">TTC</small></th><th className="px-2 py-3 text-center">Quantité</th><th className="px-2 py-3 text-center">Disponible</th><th className="px-2 py-3">Total <small className="block font-normal text-[#8492a3]">TTC</small></th><th className="px-2 py-3">Facture</th><th className="px-2 py-3 text-center">Actions</th></tr></thead>
                <tbody>
                  {getProducts(order).map((product, index) => (
                    <tr key={`${product.id ?? product.title ?? "product"}-${index}`} className="border-b border-[#cbd7df]">
                      <td className="py-2 pr-2"><div className="flex min-w-64 items-center gap-3">{product.image ? <img src={product.image} alt="" className="size-11 shrink-0 object-cover" /> : <div className="flex size-11 shrink-0 items-center justify-center bg-[#f2f4f7] text-[10px] text-[#98a2b3]">IMG</div>}<div><p className="font-medium text-[#22a8c8]">{product.title || "Produit"}</p><p className="mt-1 text-[#22a8c8]">Référence : {product.slug || product.id || "—"}</p></div></div></td>
                      <td className="whitespace-nowrap px-2">{formatMoney(product.unitPrice)}</td>
                      <td className="px-2 text-center"><span className="inline-flex min-w-6 justify-center rounded-full bg-[#718b91] px-1.5 py-1 font-semibold text-white">{product.quantity ?? 0}</span></td>
                      <td className="px-2 text-center">—</td>
                      <td className="whitespace-nowrap px-2">{formatMoney(product.totalPrice)}</td>
                      <td className="whitespace-nowrap px-2">—</td>
                      <td className="px-2 text-center"><span className="text-[#718b91]">✎　▤</span></td>
                    </tr>
                  ))}
                  {getProducts(order).length === 0 ? <tr><td colSpan={7} className="py-8 text-center text-sm text-[#667085]">Aucun produit dans cette commande.</td></tr> : null}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-xs text-[#667085]">
              <label className="flex items-center gap-2">Articles par page : <select defaultValue="8" className="h-8 rounded border border-[#cbd6de] bg-white px-2"><option>8</option></select></label>
              <div className="flex gap-2"><Button disabled>⊕ Ajouter un produit</Button><Button disabled>▣ Ajouter une remise</Button></div>
            </div>
            <div className="grid gap-3 bg-[#f7f7f7] px-5 py-4 text-center sm:grid-cols-3">
              <div><p className="text-xs text-[#7c8996]">Produits</p><p className="mt-1 font-semibold">{formatMoney(productsTotal || order.priceTTC || order.total - shipping)}</p></div>
              <div><p className="text-xs text-[#7c8996]">Livraison</p><p className="mt-1 font-semibold">{formatMoney(shipping)}</p></div>
              <div><p className="text-xs text-[#7c8996]">Total</p><p className="mt-1 inline-flex rounded bg-[#344054] px-2 py-1 font-semibold text-white">{formatMoney(order.priceTTC ?? order.total)}</p></div>
            </div>
            <p className="px-4 py-3 text-center text-[11px] text-[#8492a3]">Les prix de cette commande incluent les taxes.</p>
          </Card>

          <Card padding="0">
            <div className="flex flex-wrap items-center gap-1 border-b border-[#dce4ea] px-3 pt-2 text-sm">
              <span className="border-t-2 border-[#22b6d1] bg-white px-3 py-3 font-medium text-[#344054]">◷ Statut (1)</span>
              <span className="px-3 py-3 text-[#7b8b97]">▰ Documents (0)</span>
              <span className="px-3 py-3 text-[#7b8b97]">▰ Transporteurs (0)</span>
              <span className="px-3 py-3 text-[#7b8b97]">↻ Retours (0)</span>
            </div>
            <div className="m-3 border-y border-[#cbd7df] px-1 py-2">
              <div className="flex flex-wrap items-center justify-between gap-3 py-1 text-xs">
                <span className="rounded px-1.5 py-0.5 font-semibold" style={{ backgroundColor: statusColors[order.etat]?.backgroundColor, color: statusColors[order.etat]?.textColor }}>{order.etat}</span>
                <span className="text-[#667085]">{formatDate(order.updatedAt)}</span>
                <button type="button" disabled className="text-[#22a8c8] disabled:cursor-not-allowed">Renvoyer l’e-mail</button>
              </div>
            </div>
            <div className="px-3 pb-3 text-xs text-[#667085]">Statut actuel : {order.etat} · Paiement : {order.paymentStatus}</div>
          </Card>
        </BlockStack>
      </div>
    </BlockStack>
  );
}
