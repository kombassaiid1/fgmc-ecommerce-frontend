"use client";

import { useState } from "react";
import { BlockStack, Button, ButtonGroup, FormLayout, InlineStack, Modal, Text, TextField, Tooltip } from "@shopify/polaris";
import { CheckIcon, ExportIcon, GlobeIcon, PlusCircleIcon, RefreshIcon, XIcon } from "@shopify/polaris-icons";
import { toast } from "sonner";
import { shippingAdmin, type Zone, type ZoneInput } from "@/lib/api/shipping-admin";
import { AdminList, type ListColumn } from "../admin-list";

type Row = Zone & { number: number };

const EMPTY: ZoneInput = { name: "", active: true };

function exportCsv(rows: Row[]) {
  const lines = [["ID", "Zone", "Pays", "États", "Activé"], ...rows.map((row) => [row.number, row.name, row.countryCodes.length, row.stateCount, row.active ? "Oui" : "Non"])];
  const csv = lines.map((columns) => columns.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "zones.csv";
  link.click();
  URL.revokeObjectURL(url);
}

export function ZonesTab({ zones, reload }: { zones: Zone[]; reload: () => Promise<void> }) {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" }>({ key: "number", dir: "asc" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<{ id: string | null; input: ZoneInput } | null>(null);
  const [toDelete, setToDelete] = useState<Zone[]>([]);
  const [busy, setBusy] = useState("");

  // Numbered in creation order, like PrestaShop's ID column.
  const ranked: Row[] = [...zones]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
    .map((zone, index) => ({ ...zone, number: index + 1 }));

  const name = (filters.name ?? "").trim().toLocaleLowerCase("fr");
  const filtered = ranked
    .filter((row) => (!filters.number?.trim() || String(row.number) === filters.number.trim()) && (!name || row.name.toLocaleLowerCase("fr").includes(name)) && (!filters.active || (filters.active === "on") === row.active))
    .sort((a, b) => {
      const direction = sort.dir === "asc" ? 1 : -1;
      if (sort.key === "name") return a.name.localeCompare(b.name, "fr") * direction;
      if (sort.key === "active") return (Number(a.active) - Number(b.active)) * direction;
      return (a.number - b.number) * direction;
    });
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pages);
  const visible = filtered.slice((current - 1) * pageSize, current * pageSize);

  async function run(key: string, action: () => Promise<unknown>, success: string) {
    setBusy(key);
    try {
      await action();
      toast.success(success);
      await reload();
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action impossible.");
      return false;
    } finally {
      setBusy("");
    }
  }

  const setActive = (rows: Zone[], active: boolean) =>
    run("bulk", async () => {
      for (const zone of rows) if (zone.active !== active) await shippingAdmin.updateZone(zone.id, { name: zone.name, active });
      setSelected(new Set());
    }, active ? "Zone(s) activée(s)." : "Zone(s) désactivée(s).");

  async function save() {
    if (!editing) return;
    if (!editing.input.name.trim()) return toast.error("Donnez un nom à la zone.");
    const ok = await run("save", () => (editing.id ? shippingAdmin.updateZone(editing.id, editing.input) : shippingAdmin.createZone(editing.input)), editing.id ? "Zone enregistrée." : "Zone créée. Rattachez-lui des pays depuis l’onglet Pays.");
    if (ok) setEditing(null);
  }

  const selectedZones = zones.filter((zone) => selected.has(zone.id));

  const columns: Array<ListColumn<Row>> = [
    { key: "number", header: "ID", width: "90px", sortable: true, filter: { kind: "text", width: 80 }, cell: (row) => <Text as="span" variant="bodyMd" numeric>{row.number}</Text> },
    {
      key: "name",
      header: "Zone",
      sortable: true,
      filter: { kind: "text" },
      cell: (row) => (
        <BlockStack gap="0">
          <Text as="span" variant="bodyMd" fontWeight="semibold">{row.name}</Text>
          <Text as="span" variant="bodySm" tone="subdued">{row.countryCodes.length} pays · {row.stateCount} état(s)</Text>
        </BlockStack>
      ),
    },
    {
      key: "active",
      header: "Activé",
      align: "center",
      width: "140px",
      sortable: true,
      filter: { kind: "select", options: [{ label: "—", value: "" }, { label: "Oui", value: "on" }, { label: "Non", value: "off" }] },
      cell: (row) => (
        <Tooltip content={row.active ? "Activée : cliquer pour désactiver" : "Désactivée : cliquer pour activer"}>
          <Button
            variant="tertiary"
            tone={row.active ? "success" : "critical"}
            icon={row.active ? CheckIcon : XIcon}
            accessibilityLabel={row.active ? `Désactiver ${row.name}` : `Activer ${row.name}`}
            disabled={Boolean(busy)}
            onClick={() => void setActive([row], !row.active)}
          />
        </Tooltip>
      ),
    },
  ];

  return (
    <>
      <AdminList<Row>
        title="Zones"
        icon={GlobeIcon}
        count={filtered.length}
        toolbar={
          <>
            <Tooltip content="Ajouter une zone"><Button variant="tertiary" icon={PlusCircleIcon} accessibilityLabel="Ajouter une zone" onClick={() => setEditing({ id: null, input: EMPTY })} /></Tooltip>
            <Tooltip content="Actualiser"><Button variant="tertiary" icon={RefreshIcon} accessibilityLabel="Actualiser la liste" onClick={() => void reload()} /></Tooltip>
            <Tooltip content="Exporter en CSV"><Button variant="tertiary" icon={ExportIcon} accessibilityLabel="Exporter les zones en CSV" onClick={() => exportCsv(filtered)} /></Tooltip>
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
        bulkActions={[
          { content: "Activer la sélection", onAction: () => void setActive(selectedZones, true) },
          { content: "Désactiver la sélection", onAction: () => void setActive(selectedZones, false) },
          { content: "Supprimer la sélection", destructive: true, onAction: () => setToDelete(selectedZones) },
        ]}
        rowAction={(row) => ({
          content: "Modifier",
          onAction: () => setEditing({ id: row.id, input: { name: row.name, active: row.active } }),
          menu: [
            { content: row.active ? "Désactiver" : "Activer", onAction: () => void setActive([row], !row.active) },
            { content: "Supprimer", destructive: true, onAction: () => setToDelete([row]) },
          ],
        })}
        page={current}
        pages={pages}
        onPage={setPage}
        pageSize={pageSize}
        pageSizes={[20, 50, 100, 300]}
        onPageSize={(size) => { setPageSize(size); setPage(1); }}
        emptyText={zones.length === 0 ? "Aucune zone pour le moment. Créez-en une, par exemple « France » ou « Union européenne »." : "Aucune zone ne correspond à ces filtres."}
      />

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing?.id ? "Modifier la zone" : "Nouvelle zone"}
        primaryAction={{ content: "Enregistrer la zone", loading: busy === "save", onAction: () => void save() }}
        secondaryActions={[{ content: "Annuler", onAction: () => setEditing(null) }]}>
        <Modal.Section>
          {editing ? (
            <FormLayout>
              <TextField label="Nom" autoComplete="off" value={editing.input.name} maxLength={60} placeholder="France métropolitaine" onChange={(value) => setEditing({ ...editing, input: { ...editing.input, name: value } })} />
              <BlockStack gap="100">
                <Text as="span" variant="bodyMd">Actif</Text>
                <InlineStack>
                  <ButtonGroup variant="segmented">
                    <Button pressed={editing.input.active} onClick={() => setEditing({ ...editing, input: { ...editing.input, active: true } })}>Oui</Button>
                    <Button pressed={!editing.input.active} onClick={() => setEditing({ ...editing, input: { ...editing.input, active: false } })}>Non</Button>
                  </ButtonGroup>
                </InlineStack>
                <Text as="span" variant="bodySm" tone="subdued">Une zone désactivée n’est plus desservie.</Text>
              </BlockStack>
            </FormLayout>
          ) : null}
        </Modal.Section>
      </Modal>

      <Modal
        open={toDelete.length > 0}
        onClose={() => setToDelete([])}
        title={toDelete.length === 1 ? `Supprimer la zone « ${toDelete[0].name} » ?` : `Supprimer ${toDelete.length} zones ?`}
        primaryAction={{
          content: "Supprimer",
          destructive: true,
          loading: busy === "delete",
          onAction: () => {
            const targets = toDelete;
            void run("delete", async () => {
              for (const zone of targets) await shippingAdmin.deleteZone(zone.id);
              setSelected(new Set());
            }, targets.length === 1 ? "Zone supprimée." : "Zones supprimées.").then(() => setToDelete([]));
          },
        }}
        secondaryActions={[{ content: "Annuler", onAction: () => setToDelete([]) }]}>
        <Modal.Section>
          <Text as="p" variant="bodyMd">Les tarifs de {toDelete.length === 1 ? "cette zone seront supprimés" : "ces zones seront supprimés"} dans tous les transporteurs, et leurs états n’auront plus de zone. Cette action est définitive.</Text>
        </Modal.Section>
      </Modal>
    </>
  );
}
