"use client";

import { useEffect, useState } from "react";
import { Banner, Button, FormLayout, Modal, Select, Text, TextField, Tooltip } from "@shopify/polaris";
import { CheckIcon, LocationIcon, PlusCircleIcon, RefreshIcon, XIcon } from "@shopify/polaris-icons";
import { toast } from "sonner";
import { shippingAdmin, type GeoState, type GeoStateInput, type GeoStatePage, type Zone } from "@/lib/api/shipping-admin";
import { AdminList, type ListColumn } from "../admin-list";
import { COUNTRY_OPTIONS, countryName } from "../geo";

const emptyState = (countryCode: string): GeoStateInput => ({ name: "", isoCode: "", countryCode, zoneId: "", active: true });

/** States, regions or départements (for example the French départements), each tied to a country and a zone. */
export function StatesTab({ zones, reload }: { zones: Zone[]; reload: () => Promise<void> }) {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" }>({ key: "name", dir: "asc" });
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [result, setResult] = useState<GeoStatePage | null>(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<{ id: string | null; input: GeoStateInput } | null>(null);
  const [toDelete, setToDelete] = useState<GeoState[]>([]);
  const [busy, setBusy] = useState("");

  useEffect(() => {
    let cancelled = false;
    shippingAdmin
      .states({ search: filters.name ?? "", countryCode: filters.country ?? "", zoneId: filters.zone ?? "", active: filters.active ?? "", sort: sort.key, dir: sort.dir, page })
      .then((data) => {
        if (cancelled) return;
        setResult(data);
        setError("");
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Chargement impossible.");
      });
    return () => {
      cancelled = true;
    };
  }, [filters, sort, page, refresh]);

  async function run(key: string, action: () => Promise<unknown>, success: string) {
    setBusy(key);
    try {
      await action();
      toast.success(success);
      setRefresh((n) => n + 1);
      await reload(); // zone state counts changed
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action impossible.");
      return false;
    } finally {
      setBusy("");
    }
  }

  const rows = result?.data ?? [];
  const setActive = (targets: GeoState[], active: boolean) =>
    run("bulk", async () => {
      for (const state of targets) if (state.active !== active) await shippingAdmin.setStateActive(state.id, active);
      setSelected(new Set());
    }, active ? "État(s) activé(s)." : "État(s) désactivé(s).");
  const selectedRows = rows.filter((row) => selected.has(row.id));

  async function save() {
    if (!editing) return;
    if (!editing.input.name.trim()) return toast.error("Le nom est requis.");
    const ok = await run("save", () => (editing.id ? shippingAdmin.updateState(editing.id, editing.input) : shippingAdmin.createState(editing.input)), "État enregistré.");
    if (ok) setEditing(null);
  }

  const zoneOptions = [{ label: "Aucune zone", value: "" }, ...zones.map((zone) => ({ label: zone.name, value: zone.id }))];

  const columns: Array<ListColumn<GeoState>> = [
    { key: "name", header: "Nom", sortable: true, filter: { kind: "text" }, cell: (row) => <Text as="span" variant="bodyMd" fontWeight="semibold">{row.name}</Text> },
    { key: "code", header: "Code", width: "100px", sortable: true, cell: (row) => <Text as="span" variant="bodyMd" tone="subdued">{row.isoCode || "—"}</Text> },
    { key: "country", header: "Pays", width: "220px", sortable: true, filter: { kind: "select", options: [{ label: "—", value: "" }, ...COUNTRY_OPTIONS] }, cell: (row) => countryName(row.countryCode) },
    {
      key: "zone",
      header: "Zone",
      width: "220px",
      sortable: true,
      filter: { kind: "select", options: [{ label: "—", value: "" }, { label: "Sans zone", value: "none" }, ...zones.map((zone) => ({ label: zone.name, value: zone.id }))] },
      cell: (row) => (row.zoneName ? row.zoneName : <Text as="span" variant="bodySm" tone="subdued">Aucune zone</Text>),
    },
    {
      key: "active",
      header: "Activé",
      align: "center",
      width: "140px",
      sortable: true,
      filter: { kind: "select", options: [{ label: "—", value: "" }, { label: "Oui", value: "on" }, { label: "Non", value: "off" }] },
      cell: (row) => (
        <Tooltip content={row.active ? "Activé : cliquer pour désactiver" : "Désactivé : cliquer pour activer"}>
          <Button variant="tertiary" tone={row.active ? "success" : "critical"} icon={row.active ? CheckIcon : XIcon} accessibilityLabel={row.active ? `Désactiver ${row.name}` : `Activer ${row.name}`} disabled={Boolean(busy)} onClick={() => void setActive([row], !row.active)} />
        </Tooltip>
      ),
    },
  ];

  if (error) return <Banner tone="critical" title="Impossible de charger les états">{error}</Banner>;

  return (
    <>
      <AdminList<GeoState>
        title="États"
        icon={LocationIcon}
        count={result?.meta.total ?? "…"}
        loading={!result}
        toolbar={
          <>
            <Tooltip content="Ajouter un état"><Button variant="tertiary" icon={PlusCircleIcon} accessibilityLabel="Ajouter un état" onClick={() => setEditing({ id: null, input: emptyState(filters.country || "FR") })} /></Tooltip>
            <Tooltip content="Actualiser"><Button variant="tertiary" icon={RefreshIcon} accessibilityLabel="Actualiser la liste" onClick={() => setRefresh((n) => n + 1)} /></Tooltip>
          </>
        }
        columns={columns}
        rows={rows}
        rowId={(row) => row.id}
        filters={filters}
        onApplyFilters={(next) => { setFilters(next); setPage(1); setSelected(new Set()); }}
        sort={sort}
        onSort={(key, dir) => { setSort({ key, dir }); setPage(1); }}
        selectable
        selected={selected}
        onSelect={setSelected}
        bulkActions={[
          { content: "Activer la sélection", onAction: () => void setActive(selectedRows, true) },
          { content: "Désactiver la sélection", onAction: () => void setActive(selectedRows, false) },
          { content: "Supprimer la sélection", destructive: true, onAction: () => setToDelete(selectedRows) },
        ]}
        rowAction={(row) => ({
          content: "Modifier",
          onAction: () => setEditing({ id: row.id, input: { name: row.name, isoCode: row.isoCode, countryCode: row.countryCode, zoneId: row.zoneId, active: row.active } }),
          menu: [
            { content: row.active ? "Désactiver" : "Activer", onAction: () => void setActive([row], !row.active) },
            { content: "Supprimer", destructive: true, onAction: () => setToDelete([row]) },
          ],
        })}
        page={page}
        pages={result?.meta.totalPages ?? 1}
        onPage={(next) => { setPage(next); setSelected(new Set()); }}
        pageSize={result?.meta.limit ?? 25}
        emptyText={Object.values(filters).some(Boolean) ? "Aucun état ne correspond à ces filtres." : "Aucun état pour le moment. Ajoutez-en un, par exemple un département, ou importez-les depuis PrestaShop."}
      />

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing?.id ? "Modifier l’état" : "Nouvel état"}
        primaryAction={{ content: "Enregistrer", loading: busy === "save", onAction: () => void save() }}
        secondaryActions={[{ content: "Annuler", onAction: () => setEditing(null) }]}>
        <Modal.Section>
          {editing ? (
            <FormLayout>
              <FormLayout.Group>
                <TextField label="Nom" autoComplete="off" value={editing.input.name} maxLength={80} placeholder="Ain" onChange={(value) => setEditing({ ...editing, input: { ...editing.input, name: value } })} />
                <TextField label="Code" autoComplete="off" value={editing.input.isoCode} maxLength={10} placeholder="01" onChange={(value) => setEditing({ ...editing, input: { ...editing.input, isoCode: value } })} helpText="Facultatif : code du département ou de l’état." />
              </FormLayout.Group>
              <FormLayout.Group>
                <Select label="Pays" options={COUNTRY_OPTIONS} value={editing.input.countryCode} onChange={(value) => setEditing({ ...editing, input: { ...editing.input, countryCode: value } })} />
                <Select label="Zone" options={zoneOptions} value={editing.input.zoneId} onChange={(value) => setEditing({ ...editing, input: { ...editing.input, zoneId: value } })} />
              </FormLayout.Group>
              <Select label="Statut" options={[{ label: "Actif", value: "on" }, { label: "Désactivé", value: "off" }]} value={editing.input.active ? "on" : "off"} onChange={(value) => setEditing({ ...editing, input: { ...editing.input, active: value === "on" } })} />
            </FormLayout>
          ) : null}
        </Modal.Section>
      </Modal>

      <Modal
        open={toDelete.length > 0}
        onClose={() => setToDelete([])}
        title={toDelete.length === 1 ? `Supprimer « ${toDelete[0].name} » ?` : `Supprimer ${toDelete.length} états ?`}
        primaryAction={{
          content: "Supprimer",
          destructive: true,
          loading: busy === "delete",
          onAction: () => {
            const targets = toDelete;
            void run("delete", async () => {
              for (const state of targets) await shippingAdmin.deleteState(state.id);
              setSelected(new Set());
            }, targets.length === 1 ? "État supprimé." : "États supprimés.").then(() => setToDelete([]));
          },
        }}
        secondaryActions={[{ content: "Annuler", onAction: () => setToDelete([]) }]}>
        <Modal.Section>
          <Text as="p" variant="bodyMd">{toDelete.length === 1 ? "Cet état sera supprimé" : "Ces états seront supprimés"} définitivement.</Text>
        </Modal.Section>
      </Modal>
    </>
  );
}
