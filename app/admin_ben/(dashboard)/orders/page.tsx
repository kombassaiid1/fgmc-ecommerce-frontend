"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Banner, BlockStack, Box, Button, Card, InlineStack, Pagination, Text } from "@shopify/polaris";
import { ExportIcon, RefreshIcon } from "@shopify/polaris-icons";

import { getOrders, updateOrderPaymentStatus, updateOrderStatus, type OrderListItem, type StoredOrderProduct } from "@/lib/api/orders";
import { getAdminSettings } from "@/lib/api/settings";
import { mergeOrderStatusColors, type OrderStatusColors } from "@/lib/order-statuses";
import { toast } from "sonner";

const PAGE_SIZE = 20;
const ORDER_STATUS_OPTIONS = [
  { label: "Tous les statuts", value: "" },
  { label: "En cours", value: "En cours" },
  { label: "Confirm\u00e9es", value: "Confirm\u00e9es" },
  { label: "Exp\u00e9di\u00e9es", value: "Exp\u00e9di\u00e9es" },
  { label: "Annul\u00e9es", value: "Annul\u00e9es" },
  { label: "Retour", value: "Retour" },
  { label: "Annul\u00e9", value: "Annul\u00e9" },
  { label: "Autorisation accept\u00e9e par Braintree", value: "Autorisation accept\u00e9e par Braintree" },
  { label: "Autorisation accept\u00e9e par PayPal", value: "Autorisation accept\u00e9e par PayPal" },
  { label: "Autorisation a capturer par le marchand", value: "Autorisation. A capturer par le marchand" },
  { label: "Commande et pr\u00e9par\u00e9e en attente de retrait magasin", value: "commande et pr\u00e9par\u00e9e en attente de retrait magasin" },
  { label: "Delivered to your chosen pickup point (PO or relay)", value: "Delivered to your chosen pickup point (PO or relay)" },
  { label: "Demande de financement en cours", value: "Demande de financement en cours" },
  { label: "En attente d'autorisation", value: "En attente d'autorisation" },
  { label: "En attente de capture", value: "En attente de capture" },
  { label: "En attente de confirmation par PayPal", value: "En attente de confirmation par PayPal" },
  { label: "En attente de paiement", value: "En attente de paiement" },
  { label: "En attente de paiement \u00e0 la livraison", value: "En attente de paiement \u00e0 la livraison" },
  { label: "En attente de paiement Braintree", value: "En attente de paiement Braintree" },
  { label: "En attente de paiement par Carte de Cr\u00e9dit", value: "En attente de paiement par Carte de Cr\u00e9dit" },
  { label: "En attente de paiement par ch\u00e8que", value: "En attente de paiement par ch\u00e8que" },
  { label: "En attente de paiement par moyen local", value: "En attente de paiement par moyen de paiement local" },
  { label: "En attente de paiement par PayPal", value: "En attente de paiement par PayPal" },
  { label: "En attente de paiement PayPal", value: "En attente de paiement PayPal" },
  { label: "En attente de paiement PayPal.", value: "En attente de paiement PayPal." },
  { label: "En attente de r\u00e9approvisionnement (non pay\u00e9)", value: "En attente de r\u00e9approvisionnement (non pay\u00e9)" },
  { label: "En attente de r\u00e9approvisionnement (pay\u00e9)", value: "En attente de r\u00e9approvisionnement (pay\u00e9)" },
  { label: "En cours de pr\u00e9paration", value: "En cours de pr\u00e9paration" },
  { label: "En cours d'exp\u00e9dition", value: "En cours d'exp\u00e9dition" },
  { label: "Erreur de paiement", value: "Erreur de paiement" },
  { label: "Exp\u00e9di\u00e9", value: "Exp\u00e9di\u00e9" },
  { label: "Livr\u00e9", value: "Livr\u00e9" },
  { label: "Paiement \u00e0 distance accept\u00e9", value: "Paiement \u00e0 distance accept\u00e9" },
  { label: "Paiement en plusieurs fois (3x) (4 x)", value: "Paiement en plusieurs fois (3x) (4 x)" },
  { label: "Paiement VAD accept\u00e9", value: "Paiement VAD accept\u00e9" },
  { label: "Probleme avec colis", value: "Probleme avec colis" },
  { label: "Produit en Reliquat", value: "Produit en Reliquat" },
  { label: "Rembours\u00e9", value: "Rembours\u00e9" },
  { label: "Remboursement partiel", value: "Remboursement partiel" },
  { label: "Remis au transporteur", value: "Remis au transporteur" },
  { label: "Tout Livre au exp\u00e9di\u00e9", value: "Tout Livre au exp\u00e9di\u00e9" },
];
const PAYMENT_OPTIONS = [
  { label: "Tous les paiements", value: "" },
  { label: "En attente", value: "En_attente" },
  { label: "Pay\u00e9es", value: "Pay\u00e9" },
  { label: "\u00c9chec", value: "\u00e9chou\u00e9" },
];
const PAYMENT_STATUS_OPTIONS = [
  { label: "En attente", value: "En_attente" },
  { label: "Pay\u00e9es", value: "Pay\u00e9" },
  { label: "\u00c9chec", value: "\u00e9chou\u00e9" },
];
type RowFilters = {
  id: string;
  reference: string;
  newClient: string;
  delivery: string;
  customer: string;
  company: string;
  total: string;
  dateFrom: string;
  dateTo: string;
};

const EMPTY_FILTERS: RowFilters = {
  id: "", reference: "", newClient: "", delivery: "", customer: "", company: "", total: "", dateFrom: "", dateTo: "",
};

function formatEuro(value: number | null | undefined) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number.isFinite(value ?? NaN) ? Number(value) : 0);
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("fr-FR", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(date);
}

function readableStatus(value: string) {
  return value.replace(/_/g, " ").trim();
}

function getCustomerName(order: OrderListItem) {
  if (order.Client) return `${order.Client.firstName ?? ""} ${order.Client.lastName ?? ""}`.trim() || order.Client.email;
  return order.guestName?.trim() || "Invite";
}

function getCustomerDetail(order: OrderListItem) {
  return order.Client?.email || order.guestEmail || order.guestPhone || "-";
}

function getProducts(order: OrderListItem): StoredOrderProduct[] {
  return Array.isArray(order.products) ? order.products as StoredOrderProduct[] : [];
}

function getDeliveryAddress(order: OrderListItem) {
  const address = order.Address as (NonNullable<OrderListItem["Address"]> & { country?: string }) | null | undefined;
  if (address) return [address.City, address.state, address.country].filter(Boolean).join(", ") || "-";
  return order.guestAddress || "-";
}

function getCompany(order: OrderListItem) {
  return (order.Client as (NonNullable<OrderListItem["Client"]> & { company?: string }) | null | undefined)?.company || "-";
}

function statusTone(status: string): "success" | "attention" | "critical" | "info" {
  if (status.includes("Confirm") || status.includes("Exp") || status.includes("Livr")) return "success";
  if (status.includes("Annul") || status.includes("Retour") || status.includes("Erreur")) return "critical";
  if (status.includes("attente") || status.includes("cours")) return "attention";
  return "info";
}

function paymentTone(status: string): "success" | "attention" | "critical" | "info" {
  if (status.includes("Pay")) return "success";
  if (status.includes("Erreur") || status.includes("Refus")) return "critical";
  if (status.includes("attente")) return "attention";
  return "info";
}

function FilterInput({
  value,
  onChange,
  placeholder,
  type = "text",
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  className?: string;
}) {
  return <input type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} aria-label={placeholder} className={`h-9 w-full min-w-0 rounded-sm border border-[#c7d1da] bg-white px-2.5 text-xs text-[#334155] outline-none placeholder:text-[#8796a5] focus:border-[#1e93ad] focus:ring-2 focus:ring-[#1e93ad]/15 ${className}`} />;
}

export default function AdminOrdersPage() {
  const router = useRouter();
  const [items, setItems] = useState<OrderListItem[]>([]);
  const [orderStatusColors, setOrderStatusColors] = useState<OrderStatusColors>(mergeOrderStatusColors());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [etat, setEtat] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [filters, setFilters] = useState<RowFilters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [savingFields, setSavingFields] = useState<string[]>([]);
  const [activeOrder, setActiveOrder] = useState<OrderListItem | null>(null);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: PAGE_SIZE, totalPages: 1, hasNextPage: false, hasPreviousPage: false });

  const loadOrders = () => {
    setLoading(true);
    setError(null);
    void getOrders({ page, limit: PAGE_SIZE, etat: etat || undefined, paymentStatus: paymentStatus || undefined })
      .then((response) => { setItems(response.data); setMeta(response.meta); })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Impossible de charger les commandes."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const timeout = window.setTimeout(loadOrders, 0);
    return () => window.clearTimeout(timeout);
    // loadOrders uses the filter and paging state as request inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etat, page, paymentStatus]);

  useEffect(() => {
    void getAdminSettings().then((settings) => setOrderStatusColors(mergeOrderStatusColors(settings.orderStatusColors))).catch(() => {});
  }, []);

  const filteredItems = useMemo(() => items.filter((order) => {
    const clientName = getCustomerName(order).toLowerCase();
    const company = getCompany(order).toLowerCase();
    const delivery = getDeliveryAddress(order).toLowerCase();
    const created = new Date(order.createdAt);
    const query = (value: string) => value.trim().toLowerCase();
    const idMatch = !filters.id || order.id.toLowerCase().includes(query(filters.id));
    const refMatch = !filters.reference || order.id.toLowerCase().includes(query(filters.reference));
    const customerMatch = !filters.customer || `${clientName} ${getCustomerDetail(order).toLowerCase()}`.includes(query(filters.customer));
    const companyMatch = !filters.company || company.includes(query(filters.company));
    const deliveryMatch = !filters.delivery || delivery.includes(query(filters.delivery));
    const totalMatch = !filters.total || String(order.total ?? "").includes(filters.total.replace(",", "."));
    const newClientMatch = !filters.newClient || (filters.newClient === "yes" ? !order.Client : Boolean(order.Client));
    const fromMatch = !filters.dateFrom || (!Number.isNaN(created.getTime()) && created >= new Date(`${filters.dateFrom}T00:00:00`));
    const toMatch = !filters.dateTo || (!Number.isNaN(created.getTime()) && created <= new Date(`${filters.dateTo}T23:59:59`));
    return idMatch && refMatch && customerMatch && companyMatch && deliveryMatch && totalMatch && newClientMatch && fromMatch && toMatch;
  }), [items, filters]);

  const setFilter = (key: keyof RowFilters, value: string) => setFilters((current) => ({ ...current, [key]: value }));
  const allPageSelected = filteredItems.length > 0 && filteredItems.every((item) => selectedIds.includes(item.id));
  const toggleAll = () => setSelectedIds((current) => allPageSelected ? current.filter((id) => !filteredItems.some((item) => item.id === id)) : Array.from(new Set([...current, ...filteredItems.map((item) => item.id)])));
  const toggleOne = (id: string) => setSelectedIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);

  const updateRowField = async (orderId: string, field: "etat" | "paymentStatus", value: string) => {
    const fieldKey = `${orderId}:${field}`;
    setSavingFields((current) => [...current, fieldKey]);
    try {
      const updated = field === "etat"
        ? await updateOrderStatus(orderId, value)
        : await updateOrderPaymentStatus(orderId, value);
      setItems((current) => current.map((order) => order.id === orderId ? { ...order, ...updated } : order));
      toast.success(field === "etat" ? "Statut de commande mis a jour." : "Statut de paiement mis a jour.");
      loadOrders();
    } catch (updateError) {
      toast.error(updateError instanceof Error ? updateError.message : "Impossible de mettre a jour cette commande.");
    } finally {
      setSavingFields((current) => current.filter((key) => key !== fieldKey));
    }
  };

  const exportSelected = () => {
    const rows = items.filter((item) => selectedIds.includes(item.id));
    const csv = [
      ["ID", "Reference", "Client", "Adresse", "Total EUR", "Paiement", "Statut", "Date"],
      ...rows.map((item) => [item.id, item.id, getCustomerName(item), getDeliveryAddress(item), String(item.total), item.paymentStatus, item.etat, item.createdAt]),
    ].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "commandes.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <BlockStack gap="400">
      <Card padding="0">
        <div className="flex items-center justify-between border-b border-[#dce4ea] px-4 py-3">
          <Text as="h1" variant="headingMd">Commandes ({meta.total})</Text>
          <Button icon={RefreshIcon} accessibilityLabel="Actualiser les commandes" loading={loading} onClick={loadOrders} />
        </div>
        {error ? <Box padding="300"><Banner tone="critical" title={error} /></Box> : null}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <InlineStack gap="200" blockAlign="center">
            <Button icon={ExportIcon} disabled={selectedIds.length === 0} onClick={exportSelected}>Exporter la selection{selectedIds.length ? ` (${selectedIds.length})` : ""}</Button>
            <Badge tone="info">{`${filteredItems.length} affichees sur ${meta.total}`}</Badge>
          </InlineStack>
          <Button onClick={() => { setFilters(EMPTY_FILTERS); setEtat(""); setPaymentStatus(""); setPage(1); }}>Effacer les filtres</Button>
        </div>

        <div className="w-full overflow-x-auto border-t border-[#e1e8ed]">
          <table className="w-full min-w-[1550px] border-collapse text-left text-xs text-[#405166]">
            <thead>
              <tr className="h-10 border-b-2 border-[#21b4cf] bg-[#f8fafb] font-semibold text-[#263746]">
                <th className="w-10 px-3"><input type="checkbox" aria-label="Selectionner toutes les commandes de cette page" checked={allPageSelected} onChange={toggleAll} className="size-4 accent-[#169bb5]" /></th>
                <th className="px-3">ID</th><th className="px-3">Reference</th><th className="px-3">Nouveau client</th><th className="px-3">Livraison</th><th className="px-3">Client</th><th className="px-3">Societe</th><th className="px-3">Total</th><th className="px-3">Paiement</th><th className="px-3">Statut</th><th className="px-3">Date</th><th className="px-3 text-center">Actions</th>
              </tr>
              <tr className="border-b border-[#cbd6de] bg-white">
                <th className="px-3 py-2" />
                <th className="px-1.5 py-2"><FilterInput value={filters.id} onChange={(value) => setFilter("id", value)} placeholder="Rechercher ID" /></th>
                <th className="px-1.5 py-2"><FilterInput value={filters.reference} onChange={(value) => setFilter("reference", value)} placeholder="Rechercher reference" /></th>
                <th className="px-1.5 py-2"><select aria-label="Filtrer nouveaux clients" value={filters.newClient} onChange={(event) => setFilter("newClient", event.target.value)} className="h-9 w-full rounded-sm border border-[#c7d1da] bg-white px-2 text-xs"><option value="">Tous</option><option value="yes">Oui</option><option value="no">Non</option></select></th>
                <th className="px-1.5 py-2"><FilterInput value={filters.delivery} onChange={(value) => setFilter("delivery", value)} placeholder="Rechercher livraison" /></th>
                <th className="px-1.5 py-2"><FilterInput value={filters.customer} onChange={(value) => setFilter("customer", value)} placeholder="Rechercher client" /></th>
                <th className="px-1.5 py-2"><FilterInput value={filters.company} onChange={(value) => setFilter("company", value)} placeholder="Rechercher societe" /></th>
                <th className="px-1.5 py-2"><FilterInput value={filters.total} onChange={(value) => setFilter("total", value)} placeholder="Rechercher total" /></th>
                <th className="px-1.5 py-2"><select aria-label="Filtrer par paiement" value={paymentStatus} onChange={(event) => { setPage(1); setPaymentStatus(event.target.value); }} className="h-9 w-full rounded-sm border border-[#c7d1da] bg-white px-2 text-xs">{PAYMENT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></th>
                <th className="px-1.5 py-2"><select aria-label="Filtrer par statut" value={etat} onChange={(event) => { setPage(1); setEtat(event.target.value); }} className="h-9 w-full rounded-sm border border-[#c7d1da] bg-white px-2 text-xs">{ORDER_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></th>
                <th className="px-1.5 py-2"><div className="grid gap-1"><FilterInput type="date" value={filters.dateFrom} onChange={(value) => setFilter("dateFrom", value)} placeholder="Du" /><FilterInput type="date" value={filters.dateTo} onChange={(value) => setFilter("dateTo", value)} placeholder="Au" /></div></th>
                <th className="px-3 py-2 text-center"><span className="text-[#8a98a6]">Voir</span></th>
              </tr>
            </thead>
            <tbody>
              {loading && items.length === 0 ? <tr><td colSpan={12} className="px-4 py-10 text-center text-sm text-[#748395]">Chargement des commandes...</td></tr> : null}
              {!loading && filteredItems.length === 0 ? <tr><td colSpan={12} className="px-4 py-10 text-center text-sm text-[#748395]">Aucune commande ne correspond aux filtres.</td></tr> : null}
              {filteredItems.map((item) => (
                <tr key={item.id} className="h-10 border-b border-[#d5dfe6] transition-colors hover:bg-[#f6fbfc]">
                  <td className="px-3"><input type="checkbox" aria-label={`Selectionner la commande ${item.id}`} checked={selectedIds.includes(item.id)} onChange={() => toggleOne(item.id)} className="size-4 accent-[#169bb5]" /></td>
                  <td className="px-3 font-medium" title={item.id}>{item.id.slice(-8)}</td>
                  <td className="px-3 font-medium text-[#168ca8]">{item.id.slice(0, 10).toUpperCase()}</td>
                  <td className="px-3">{item.Client ? "Non" : "Oui"}</td>
                  <td className="max-w-40 truncate px-3" title={getDeliveryAddress(item)}>{getDeliveryAddress(item)}</td>
                  <td className="px-3"><div className="min-w-32"><div className="font-medium text-[#168ca8]">{getCustomerName(item)}</div><div className="max-w-44 truncate text-[11px] text-[#8190a0]">{getCustomerDetail(item)}</div></div></td>
                  <td className="max-w-40 truncate px-3" title={getCompany(item)}>{getCompany(item)}</td>
                  <td className="px-3"><span className="inline-flex rounded-sm bg-[#75b98a] px-1.5 py-1 font-semibold text-white">{formatEuro(item.total)}</span></td>
                  <td className="px-1.5">
                    <div className="grid gap-1">
                      <select aria-label={`Statut de paiement de la commande ${item.id}`} value={item.paymentStatus} disabled={savingFields.includes(`${item.id}:paymentStatus`)} onChange={(event) => void updateRowField(item.id, "paymentStatus", event.target.value)} className={`h-8 min-w-32 rounded-sm border border-[#cbd6de] px-2 text-xs font-semibold disabled:opacity-60 ${paymentTone(item.paymentStatus) === "success" ? "bg-[#e9f7ed] text-[#267443]" : paymentTone(item.paymentStatus) === "critical" ? "bg-[#fff0f0] text-[#b4232d]" : "bg-white text-[#425466]"}`}>
                        {PAYMENT_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                      <span className="text-[10px] text-[#8391a0]">{item.paymentMethod === "COD" ? "Paiement a la livraison" : item.paymentMethod === "En_ligne" ? "Paiement en ligne" : readableStatus(item.paymentMethod)}</span>
                    </div>
                  </td>
                  <td className="px-1.5">
                    <select aria-label={`Modifier le statut de la commande ${item.id}`} value={item.etat} disabled={savingFields.includes(`${item.id}:etat`)} onChange={(event) => void updateRowField(item.id, "etat", event.target.value)} style={{ backgroundColor: orderStatusColors[item.etat]?.backgroundColor, color: orderStatusColors[item.etat]?.textColor }} className="h-8 min-w-40 rounded-sm border border-black/10 px-2 text-xs font-semibold disabled:opacity-60">
                      {ORDER_STATUS_OPTIONS.filter((option) => option.value).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </td>
                  <td className="whitespace-nowrap px-3 tabular-nums">{formatDate(item.createdAt)}</td>
                  <td className="px-3 text-center"><button type="button" onClick={() => router.push(`/admin_ben/orders/${encodeURIComponent(item.id)}`)} aria-label={`Voir la commande ${item.id}`} title="Voir la commande" className="inline-flex size-8 items-center justify-center rounded text-[#688294] hover:bg-[#eaf4f7] hover:text-[#087f99] focus-visible:outline-2 focus-visible:outline-[#169bb5]"><svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m16 16 4 4M11 8v6m-3-3h6" /></svg></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Text as="span" tone="subdued">Page {meta.page} sur {Math.max(1, meta.totalPages)}</Text>
          <Pagination hasPrevious={meta.hasPreviousPage} hasNext={meta.hasNextPage} onPrevious={() => { setSelectedIds([]); setPage((current) => Math.max(1, current - 1)); }} onNext={() => { setSelectedIds([]); setPage((current) => Math.min(Math.max(1, meta.totalPages), current + 1)); }} />
        </div>
      </Card>

      {activeOrder ? (
        <div role="presentation" className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0b1c2c]/45 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setActiveOrder(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="order-detail-title" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#dce4ea] px-5 py-4"><h2 id="order-detail-title" className="text-lg font-semibold text-[#203142]">Commande {activeOrder.id}</h2><button type="button" onClick={() => setActiveOrder(null)} className="rounded px-3 py-1 text-lg text-[#607080] hover:bg-slate-100" aria-label="Fermer">×</button></div>
            <div className="grid gap-5 p-5 sm:grid-cols-2">
              <div><p className="text-xs font-semibold uppercase text-[#748395]">Client</p><p className="mt-1 font-medium">{getCustomerName(activeOrder)}</p><p className="text-sm text-[#718096]">{getCustomerDetail(activeOrder)}</p></div>
              <div><p className="text-xs font-semibold uppercase text-[#748395]">Livraison</p><p className="mt-1">{getDeliveryAddress(activeOrder)}</p></div>
              <div><p className="text-xs font-semibold uppercase text-[#748395]">Statut et paiement</p><p className="mt-1">{readableStatus(activeOrder.etat)} · {readableStatus(activeOrder.paymentStatus)}</p></div>
              <div><p className="text-xs font-semibold uppercase text-[#748395]">Date</p><p className="mt-1">{formatDate(activeOrder.createdAt)}</p></div>
              <div className="sm:col-span-2"><p className="text-xs font-semibold uppercase text-[#748395]">Produits</p><ul className="mt-2 divide-y divide-[#e6ebef]">{getProducts(activeOrder).map((product, index) => <li key={`${product.id ?? product.title ?? "product"}-${index}`} className="flex justify-between gap-4 py-2 text-sm"><span>{product.title ?? "Produit"} × {product.quantity ?? 0}</span><span className="whitespace-nowrap">{formatEuro(product.totalPrice)}</span></li>)}</ul><div className="mt-3 flex justify-between border-t border-[#dce4ea] pt-3 font-semibold"><span>Total</span><span>{formatEuro(activeOrder.total)}</span></div></div>
            </div>
          </section>
        </div>
      ) : null}
    </BlockStack>
  );
}
