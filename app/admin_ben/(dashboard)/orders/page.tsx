"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Banner, BlockStack, Box, Button, Card, InlineStack, Modal, Pagination, Text } from "@shopify/polaris";
import { DeleteIcon, ExportIcon, RefreshIcon } from "@shopify/polaris-icons";

import { getAdminOrders, updateOrderPaymentStatus, updateOrderStatus, type OrderListItem, type StoredOrderProduct } from "@/lib/api/orders";
import { paymentLabel } from "@/lib/payment-label";
import { useOrderStates } from "@/lib/use-order-states";
import { OrderPreviewPanel } from "./order-preview";
import { StatusPicker } from "./status-picker";
import { toast } from "sonner";

const PAGE_SIZE = 20;
const PAYMENT_STATUS_LABELS: Record<string, string> = { En_attente: "En attente", "Payé": "Payée", "échoué": "Échec" };
type RowFilters = {
  id: string;
  reference: string;
  newClient: string;
  delivery: string;
  customer: string;
  company: string;
  payment: string;
  total: string;
  dateFrom: string;
  dateTo: string;
};

const EMPTY_FILTERS: RowFilters = {
  id: "", reference: "", newClient: "", delivery: "", customer: "", company: "", payment: "", total: "", dateFrom: "", dateTo: "",
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
  const { options: stateOptions } = useOrderStates();
  const ORDER_STATUS_OPTIONS = useMemo(() => [{ label: "Tous les statuts", value: "", backgroundColor: "#ffffff", textColor: "#1f2937" }, ...stateOptions], [stateOptions]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [etat, setEtat] = useState("");
  const [filters, setFilters] = useState<RowFilters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [savingFields, setSavingFields] = useState<string[]>([]);
  const [activeOrder, setActiveOrder] = useState<OrderListItem | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggleExpanded = (id: string) => setExpanded((current) => { const next = new Set(current); if (!next.delete(id)) next.add(id); return next; });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [skipped, setSkipped] = useState<Array<{ id: string; reason: string }>>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: PAGE_SIZE, totalPages: 1, hasNextPage: false, hasPreviousPage: false });

  const loadOrders = () => {
    setLoading(true);
    setError(null);
    void getAdminOrders({ page, limit: PAGE_SIZE, etat: etat || undefined })
      .then((response) => { setItems(response.data); setMeta(response.meta); })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Impossible de charger les commandes."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const timeout = window.setTimeout(loadOrders, 0);
    return () => window.clearTimeout(timeout);
    // loadOrders uses the filter and paging state as request inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etat, page]);

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
    const paymentMatch = !filters.payment || paymentLabel(order).toLowerCase().includes(query(filters.payment));
    const totalMatch = !filters.total || String(order.total ?? "").includes(filters.total.replace(",", "."));
    const newClientMatch = !filters.newClient || (filters.newClient === "yes" ? !order.Client : Boolean(order.Client));
    const fromMatch = !filters.dateFrom || (!Number.isNaN(created.getTime()) && created >= new Date(`${filters.dateFrom}T00:00:00`));
    const toMatch = !filters.dateTo || (!Number.isNaN(created.getTime()) && created <= new Date(`${filters.dateTo}T23:59:59`));
    return idMatch && refMatch && customerMatch && companyMatch && deliveryMatch && paymentMatch && totalMatch && newClientMatch && fromMatch && toMatch;
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

  // Only the orders that are on screen are deleted: a selection hidden by a filter is never removed by surprise.
  const selectedVisible = useMemo(() => filteredItems.filter((item) => selectedIds.includes(item.id)), [filteredItems, selectedIds]);

  const deleteSelected = async () => {
    setDeleting(true);
    try {
      const response = await fetch("/frontend-api/admin/orders/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedVisible.map((item) => item.id) }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(Array.isArray(data.message) ? data.message.join(" ") : data.message || "Suppression impossible.");
      const result = data as { deleted: number; skipped: Array<{ id: string; reason: string }> };
      if (result.deleted > 0) toast.success(`${result.deleted} commande(s) supprimée(s).`);
      setSkipped(result.skipped);
      setConfirmDelete(false);
      setSelectedIds([]);
      if (page > 1 && result.deleted >= items.length) setPage((current) => Math.max(1, current - 1));
      else loadOrders();
    } catch (deleteError) {
      toast.error(deleteError instanceof Error ? deleteError.message : "Suppression impossible.");
    } finally {
      setDeleting(false);
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
        {skipped.length ? (
          <Box padding="300">
            <Banner tone="warning" title={`${skipped.length} commande(s) n’ont pas été supprimées`} onDismiss={() => setSkipped([])}>
              <ul className="list-disc pl-5">{skipped.map((item) => <li key={item.id}><strong>…{item.id.slice(-8)}</strong> : {item.reason}</li>)}</ul>
            </Banner>
          </Box>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <InlineStack gap="200" blockAlign="center">
            <Button icon={ExportIcon} disabled={selectedIds.length === 0} onClick={exportSelected}>Exporter la selection{selectedIds.length ? ` (${selectedIds.length})` : ""}</Button>
            <Button icon={DeleteIcon} tone="critical" disabled={selectedVisible.length === 0} onClick={() => setConfirmDelete(true)}>Supprimer la sélection{selectedVisible.length ? ` (${selectedVisible.length})` : ""}</Button>
            <Badge tone="info">{`${filteredItems.length} affichees sur ${meta.total}`}</Badge>
          </InlineStack>
          <Button onClick={() => { setFilters(EMPTY_FILTERS); setEtat(""); setPage(1); }}>Effacer les filtres</Button>
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
                <th className="px-1.5 py-2"><FilterInput value={filters.payment} onChange={(value) => setFilter("payment", value)} placeholder="Rechercher paiement" /></th>
                <th className="px-1.5 py-2"><select aria-label="Filtrer par statut" value={etat} onChange={(event) => { setPage(1); setEtat(event.target.value); }} className="h-9 w-full rounded-sm border border-[#c7d1da] bg-white px-2 text-xs">{ORDER_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value} style={{ backgroundColor: option.backgroundColor, color: option.textColor }}>{option.label}</option>)}</select></th>
                <th className="px-1.5 py-2"><div className="grid gap-1"><FilterInput type="date" value={filters.dateFrom} onChange={(value) => setFilter("dateFrom", value)} placeholder="Du" /><FilterInput type="date" value={filters.dateTo} onChange={(value) => setFilter("dateTo", value)} placeholder="Au" /></div></th>
                <th className="px-3 py-2 text-center"><span className="text-[#8a98a6]">Voir</span></th>
              </tr>
            </thead>
            <tbody>
              {loading && items.length === 0 ? <tr><td colSpan={12} className="px-4 py-10 text-center text-sm text-[#748395]">Chargement des commandes...</td></tr> : null}
              {!loading && filteredItems.length === 0 ? <tr><td colSpan={12} className="px-4 py-10 text-center text-sm text-[#748395]">Aucune commande ne correspond aux filtres.</td></tr> : null}
              {filteredItems.map((item) => (
                <Fragment key={item.id}>
                <tr
                  onClick={(event) => {
                    // A click on the row opens the order; buttons, fields and the status menu keep their own action.
                    if ((event.target as HTMLElement).closest("button, a, input, select, label, .Polaris-Popover")) return;
                    router.push(`/admin_ben/orders/${encodeURIComponent(item.id)}`);
                  }}
                  className={`h-10 cursor-pointer border-b border-[#d5dfe6] transition-colors hover:bg-[#f6fbfc] ${expanded.has(item.id) ? "bg-[#eef7fa]" : ""}`}>
                  <td className="px-3"><input type="checkbox" aria-label={`Selectionner la commande ${item.id}`} checked={selectedIds.includes(item.id)} onChange={() => toggleOne(item.id)} className="size-4 accent-[#169bb5]" /></td>
                  <td className="px-3 font-medium" title={item.id}>
                    <span className="inline-flex items-center gap-1">
                      {item.id.slice(-8)}
                      <button type="button" onClick={() => toggleExpanded(item.id)} aria-expanded={expanded.has(item.id)} aria-label={expanded.has(item.id) ? `Masquer les détails de la commande ${item.id.slice(-8)}` : `Afficher les détails de la commande ${item.id.slice(-8)}`} className="inline-flex size-6 items-center justify-center rounded text-[#168ca8] hover:bg-[#dff1f6] focus-visible:outline-2 focus-visible:outline-[#169bb5]">
                        <svg aria-hidden="true" viewBox="0 0 20 20" className={`size-4 transition-transform ${expanded.has(item.id) ? "rotate-180" : ""}`} fill="currentColor"><path d="M5.5 7.5 10 12l4.5-4.5z" /></svg>
                      </button>
                    </span>
                  </td>
                  <td className="px-3 font-medium text-[#168ca8]">{item.reference ?? item.id.slice(0, 10).toUpperCase()}</td>
                  <td className="px-3">{item.Client ? "Non" : "Oui"}</td>
                  <td className="max-w-40 truncate px-3" title={getDeliveryAddress(item)}>{getDeliveryAddress(item)}</td>
                  <td className="px-3"><div className="min-w-32"><div className="font-medium text-[#168ca8]">{getCustomerName(item)}</div><div className="max-w-44 truncate text-[11px] text-[#8190a0]">{getCustomerDetail(item)}</div></div></td>
                  <td className="max-w-40 truncate px-3" title={getCompany(item)}>{getCompany(item)}</td>
                  <td className="px-3"><span className="inline-flex rounded-sm bg-[#75b98a] px-1.5 py-1 font-semibold text-white">{formatEuro(item.total)}</span></td>
                  <td className="px-3">
                    <div className="min-w-36 max-w-48">
                      <div className="font-medium text-[#344054]">{paymentLabel(item)}</div>
                      <div className={`text-[11px] ${paymentTone(item.paymentStatus) === "success" ? "text-[#267443]" : paymentTone(item.paymentStatus) === "critical" ? "text-[#b4232d]" : "text-[#8391a0]"}`}>{PAYMENT_STATUS_LABELS[item.paymentStatus] ?? readableStatus(item.paymentStatus)}</div>
                    </div>
                  </td>
                  <td className="px-1.5">
                    <StatusPicker label={`Statut de la commande ${item.id.slice(-8)}`} value={item.etat} options={stateOptions} disabled={savingFields.includes(`${item.id}:etat`)} onChange={(value) => void updateRowField(item.id, "etat", value)} />
                  </td>
                  <td className="whitespace-nowrap px-3 tabular-nums">{formatDate(item.createdAt)}</td>
                  <td className="px-3 text-center"><button type="button" onClick={() => router.push(`/admin_ben/orders/${encodeURIComponent(item.id)}`)} aria-label={`Voir la commande ${item.id}`} title="Voir la commande" className="inline-flex size-8 items-center justify-center rounded text-[#688294] hover:bg-[#eaf4f7] hover:text-[#087f99] focus-visible:outline-2 focus-visible:outline-[#169bb5]"><svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m16 16 4 4M11 8v6m-3-3h6" /></svg></button></td>
                </tr>
                {expanded.has(item.id) ? (
                  <tr className="border-b border-[#d5dfe6] bg-[#f7fbfc]">
                    <td colSpan={12} className="p-0"><OrderPreviewPanel order={item} onOpen={() => router.push(`/admin_ben/orders/${encodeURIComponent(item.id)}`)} /></td>
                  </tr>
                ) : null}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Text as="span" tone="subdued">Page {meta.page} sur {Math.max(1, meta.totalPages)}</Text>
          <Pagination hasPrevious={meta.hasPreviousPage} hasNext={meta.hasNextPage} onPrevious={() => { setSelectedIds([]); setPage((current) => Math.max(1, current - 1)); }} onNext={() => { setSelectedIds([]); setPage((current) => Math.min(Math.max(1, meta.totalPages), current + 1)); }} />
        </div>
      </Card>

      <Modal
        open={confirmDelete}
        onClose={() => { if (!deleting) setConfirmDelete(false); }}
        title={`Supprimer ${selectedVisible.length} commande(s) ?`}
        primaryAction={{ content: "Supprimer définitivement", destructive: true, loading: deleting, onAction: () => void deleteSelected() }}
        secondaryActions={[{ content: "Annuler", onAction: () => setConfirmDelete(false), disabled: deleting }]}>
        <Modal.Section>
          <BlockStack gap="300">
            <Text as="p" variant="bodyMd">Les commandes sélectionnées seront supprimées avec leurs données de livraison et de suivi GLS. <strong>Cette action est irréversible.</strong></Text>
            <Text as="p" variant="bodySm" tone="subdued">Sont gardées et signalées : les commandes avec une étiquette GLS active (annulez-la d’abord) et celles payées en ligne. Les factures Dolibarr ne sont pas supprimées.</Text>
            <ul className="max-h-40 list-disc overflow-y-auto pl-5 text-sm text-[#344054]">
              {selectedVisible.slice(0, 50).map((item) => <li key={item.id}>…{item.id.slice(-8)} · {getCustomerName(item)} · {formatEuro(item.total)}</li>)}
              {selectedVisible.length > 50 ? <li>… et {selectedVisible.length - 50} autre(s)</li> : null}
            </ul>
          </BlockStack>
        </Modal.Section>
      </Modal>

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
