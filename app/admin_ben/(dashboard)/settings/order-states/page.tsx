"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Banner, BlockStack, Button, Card, InlineStack, List, Modal, SkeletonBodyText, Text, Tooltip } from "@shopify/polaris";
import { CheckIcon, OrderIcon, PlusCircleIcon, RefreshIcon, XIcon } from "@shopify/polaris-icons";
import { toast } from "sonner";
import { orderStatesApi, toInput, type OrderStateRow } from "@/lib/api/order-states";
import { getImageUrl } from "@/lib/api";
import { AdminList, type ListColumn } from "../../international/admin-list";
import { PrestashopOrderStateImport } from "./prestashop-order-state-import";

const YES_NO = [
  { label: "—", value: "" },
  { label: "Oui", value: "on" },
  { label: "Non", value: "off" },
];

/** Paramètres, Commandes, États de commandes: the order statuses, laid out like PrestaShop's. */
export default function OrderStatesPage() {
  const router = useRouter();
  const [states, setStates] = useState<OrderStateRow[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [toDelete, setToDelete] = useState<OrderStateRow[]>([]);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" }>({ key: "id", dir: "asc" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const reload = useCallback(async () => {
    try {
      setStates(await orderStatesApi.list());
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chargement impossible.");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    orderStatesApi
      .list()
      .then((rows) => {
        if (!cancelled) setStates(rows);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Chargement impossible.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /** Clicking a ✓ or ✗ in the list switches that option, as in PrestaShop. */
  async function toggle(row: OrderStateRow, field: "sendEmail" | "delivery" | "invoice") {
    setBusy(`${row.id}:${field}`);
    try {
      await orderStatesApi.update(row.id, { ...toInput(row), [field]: !row[field] });
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Modification impossible.");
    } finally {
      setBusy("");
    }
  }

  async function remove(targets: OrderStateRow[]) {
    setBusy("delete");
    try {
      const result = await orderStatesApi.remove(targets.map((target) => target.id));
      if (result.deleted) toast.success(`${result.deleted} statut(s) supprimé(s).`);
      if (result.skipped.length) toast.error(`${result.skipped.map((item) => item.name).join(", ")} : statut nécessaire à la boutique, non supprimé.`);
      setToDelete([]);
      setSelected(new Set());
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Suppression impossible.");
    } finally {
      setBusy("");
    }
  }

  if (error) return <Banner tone="critical" title="Impossible de charger les états de commandes">{error}</Banner>;
  if (!states) return <Card><SkeletonBodyText lines={8} /></Card>;

  const text = (value: string | null | undefined) => (value ?? "").toLocaleLowerCase("fr");
  const flagMatch = (filter: string | undefined, on: boolean) => !filter || (filter === "on" ? on : !on);
  const filtered = states
    .filter((row) =>
      (!filters.id || text(row.prestashopId).includes(text(filters.id))) &&
      (!filters.name || text(row.name).includes(text(filters.name))) &&
      flagMatch(filters.sendEmail, row.sendEmail) &&
      flagMatch(filters.delivery, row.delivery) &&
      flagMatch(filters.invoice, row.invoice) &&
      (!filters.template || text(row.template).includes(text(filters.template))))
    .sort((a, b) => {
      const direction = sort.dir === "asc" ? 1 : -1;
      if (sort.key === "name") return a.name.localeCompare(b.name, "fr") * direction;
      if (sort.key === "template") return (a.template ?? "").localeCompare(b.template ?? "", "fr") * direction;
      return ((Number(a.prestashopId) || Infinity) - (Number(b.prestashopId) || Infinity) || a.name.localeCompare(b.name, "fr")) * direction;
    });
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pages);
  const visible = filtered.slice((current - 1) * pageSize, current * pageSize);
  const selectedRows = states.filter((row) => selected.has(row.id));

  const flag = (row: OrderStateRow, field: "sendEmail" | "delivery" | "invoice", label: string) => {
    const on = row[field];
    return (
      <Tooltip content={`${label} : ${on ? "oui, cliquer pour désactiver" : "non, cliquer pour activer"}`}>
        <Button variant="tertiary" tone={on ? "success" : "critical"} icon={on ? CheckIcon : XIcon} accessibilityLabel={`${label} : ${on ? "oui" : "non"}`} disabled={Boolean(busy)} onClick={() => void toggle(row, field)} />
      </Tooltip>
    );
  };

  const columns: Array<ListColumn<OrderStateRow>> = [
    { key: "id", header: "ID", width: "90px", sortable: true, filter: { kind: "text", width: 80 }, cell: (row) => (row.prestashopId ? <Text as="span" variant="bodyMd" numeric>{row.prestashopId}</Text> : <Text as="span" variant="bodySm" tone="subdued">—</Text>) },
    {
      key: "name",
      header: "Nom",
      sortable: true,
      filter: { kind: "text" },
      cell: (row) => <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 3, backgroundColor: row.color, color: row.textColor, fontSize: 13, lineHeight: 1.5 }}>{row.name}</span>,
    },
    {
      key: "icon",
      header: "Icône",
      width: "90px",
      align: "center",
      // eslint-disable-next-line @next/next/no-img-element
      cell: (row) => (row.iconUrl ? <img src={getImageUrl(row.iconUrl)} alt="" width={22} height={22} style={{ objectFit: "contain" }} /> : <Text as="span" variant="bodySm" tone="subdued">—</Text>),
    },
    { key: "sendEmail", header: "Envoyer un e-mail au client", align: "center", width: "190px", filter: { kind: "select", options: YES_NO }, cell: (row) => flag(row, "sendEmail", "E-mail au client") },
    { key: "delivery", header: "Livraison", align: "center", width: "120px", filter: { kind: "select", options: YES_NO }, cell: (row) => flag(row, "delivery", "Bon de livraison") },
    { key: "invoice", header: "Facture", align: "center", width: "120px", filter: { kind: "select", options: YES_NO }, cell: (row) => flag(row, "invoice", "Facture") },
    { key: "template", header: "Modèle d’e-mail", sortable: true, filter: { kind: "text" }, cell: (row) => (row.template ? <Text as="span" variant="bodyMd">{row.template}</Text> : <Text as="span" variant="bodySm" tone="subdued">—</Text>) },
  ];

  return (
    <BlockStack gap="400">
      <InlineStack align="space-between" blockAlign="start" gap="400" wrap={false}>
        <Text as="p" variant="bodyMd" tone="subdued">
          Les états de commandes servent à suivre chaque commande, de l’attente de paiement à la livraison. Les options d’un état décident de ce qui se passe quand une commande le reçoit.
        </Text>
        <InlineStack gap="200" wrap={false}>
          <PrestashopOrderStateImport onImported={reload} />
          <Button variant="primary" url="/admin_ben/settings/order-states/nouveau">Ajouter un état de commande</Button>
        </InlineStack>
      </InlineStack>

      <AdminList<OrderStateRow>
        title="États de commandes"
        icon={OrderIcon}
        count={filtered.length}
        toolbar={
          <>
            <Tooltip content="Ajouter un état de commande"><Button variant="tertiary" icon={PlusCircleIcon} accessibilityLabel="Ajouter un état de commande" url="/admin_ben/settings/order-states/nouveau" /></Tooltip>
            <Tooltip content="Actualiser"><Button variant="tertiary" icon={RefreshIcon} accessibilityLabel="Actualiser la liste" onClick={() => void reload()} /></Tooltip>
          </>
        }
        columns={columns}
        rows={visible}
        rowId={(row) => row.id}
        filters={filters}
        onApplyFilters={(next) => { setFilters(next); setPage(1); setSelected(new Set()); }}
        sort={sort}
        onSort={(key, dir) => setSort({ key, dir })}
        selectable
        selected={selected}
        onSelect={setSelected}
        bulkActions={[{ content: "Supprimer la sélection", destructive: true, onAction: () => setToDelete(selectedRows) }]}
        rowAction={(row) => ({
          content: "Modifier",
          onAction: () => router.push(`/admin_ben/settings/order-states/${row.id}`),
          menu: row.unremovable ? [] : [{ content: "Supprimer", destructive: true, onAction: () => setToDelete([row]) }],
        })}
        page={current}
        pages={pages}
        onPage={setPage}
        pageSize={pageSize}
        pageSizes={[20, 50, 100, 300]}
        onPageSize={(size) => { setPageSize(size); setPage(1); }}
        emptyText={states.length === 0 ? "Aucun état de commande pour le moment. Importez-les depuis PrestaShop ou ajoutez-en un." : "Aucun état de commande ne correspond à ces filtres."}
      />

      <Modal
        open={toDelete.length > 0}
        onClose={() => setToDelete([])}
        title={toDelete.length === 1 ? `Supprimer « ${toDelete[0].name} » ?` : `Supprimer ${toDelete.length} états de commandes ?`}
        primaryAction={{ content: "Supprimer", destructive: true, loading: busy === "delete", onAction: () => void remove(toDelete) }}
        secondaryActions={[{ content: "Annuler", onAction: () => setToDelete([]), disabled: busy === "delete" }]}>
        <Modal.Section>
          <BlockStack gap="300">
            <Text as="p" variant="bodyMd">Un état supprimé disparaît des listes, mais les commandes qui l’ont déjà gardent leur état. Les états nécessaires à la boutique ne sont pas supprimés.</Text>
            <List>{toDelete.slice(0, 20).map((row) => <List.Item key={row.id}>{row.name}</List.Item>)}</List>
          </BlockStack>
        </Modal.Section>
      </Modal>
    </BlockStack>
  );
}
