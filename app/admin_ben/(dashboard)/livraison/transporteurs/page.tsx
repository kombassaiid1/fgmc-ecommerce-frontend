"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Banner, BlockStack, Box, Button, Card, InlineStack, Modal, SkeletonBodyText, Text, Thumbnail, Tooltip } from "@shopify/polaris";
import { CheckIcon, ChevronDownIcon, ChevronUpIcon, DeliveryIcon, PlusCircleIcon, RefreshIcon, XIcon } from "@shopify/polaris-icons";
import { toast } from "sonner";
import { shippingAdmin, type Carrier, type Zone } from "@/lib/api/shipping-admin";
import { getImageUrl } from "@/lib/api";
import { AdminList, type ListColumn } from "../../international/admin-list";
import { PrestashopCarrierImport } from "./prestashop-carrier-import";

export default function CarriersPage() {
  const router = useRouter();
  const [carriers, setCarriers] = useState<Carrier[] | null>(null);
  const [zones, setZones] = useState<Zone[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [toDelete, setToDelete] = useState<Carrier[]>([]);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" }>({ key: "position", dir: "asc" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const reload = useCallback(async () => {
    try {
      const [list, zoneList] = await Promise.all([shippingAdmin.carriers(), shippingAdmin.zones()]);
      setCarriers(list);
      setZones(zoneList);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chargement impossible.");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([shippingAdmin.carriers(), shippingAdmin.zones()])
      .then(([list, zoneList]) => {
        if (cancelled) return;
        setCarriers(list);
        setZones(zoneList);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Chargement impossible.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function act(key: string, action: () => Promise<unknown>, success: string) {
    setBusy(key);
    try {
      await action();
      toast.success(success);
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action impossible.");
    } finally {
      setBusy("");
    }
  }

  const move = (id: string, direction: -1 | 1) => {
    if (!carriers) return;
    const index = carriers.findIndex((carrier) => carrier.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= carriers.length) return;
    const ids = carriers.map((carrier) => carrier.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    void act("move", () => shippingAdmin.reorderCarriers(ids), "Ordre mis à jour.");
  };

  const setActive = (targets: Carrier[], active: boolean) =>
    act(
      "bulk",
      async () => {
        for (const carrier of targets) if (carrier.active !== active) await shippingAdmin.setCarrierActive(carrier.id, active);
        setSelected(new Set());
      },
      active ? "Transporteur(s) activé(s)." : "Transporteur(s) désactivé(s).",
    );

  const list = carriers ?? [];
  const name = (filters.name ?? "").trim().toLocaleLowerCase("fr");
  const delay = (filters.delay ?? "").trim().toLocaleLowerCase("fr");
  const filtered = list
    .filter(
      (carrier) =>
        (!filters.id?.trim() || carrier.prestashopId.includes(filters.id.trim())) &&
        (!name || carrier.name.toLocaleLowerCase("fr").includes(name)) &&
        (!delay || (carrier.transitTime ?? "").toLocaleLowerCase("fr").includes(delay)) &&
        (!filters.active || (filters.active === "on") === carrier.active) &&
        (!filters.free || (filters.free === "on") === carrier.freeShipping),
    )
    .sort((a, b) => {
      const direction = sort.dir === "asc" ? 1 : -1;
      if (sort.key === "id") return ((Number(a.prestashopId) || Infinity) - (Number(b.prestashopId) || Infinity) || 0) * direction;
      if (sort.key === "name") return a.name.localeCompare(b.name, "fr") * direction;
      if (sort.key === "delay") return (a.transitTime ?? "").localeCompare(b.transitTime ?? "", "fr") * direction;
      if (sort.key === "active") return (Number(a.active) - Number(b.active)) * direction;
      if (sort.key === "free") return (Number(a.freeShipping) - Number(b.freeShipping)) * direction;
      return (a.position - b.position) * direction;
    });
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pages);
  const visible = filtered.slice((current - 1) * pageSize, current * pageSize);
  const selectedCarriers = list.filter((carrier) => selected.has(carrier.id));
  // Moving a carrier only makes sense when the list is shown in position order, unfiltered.
  const canReorder = sort.key === "position" && !Object.values(filters).some(Boolean) && !busy;
  const flip: 1 | -1 = sort.dir === "asc" ? 1 : -1;

  const yesNo = [
    { label: "—", value: "" },
    { label: "Oui", value: "on" },
    { label: "Non", value: "off" },
  ];
  const flag = (on: boolean, label: string, onClick?: () => void) => (
    <Tooltip content={label}>
      <Button variant="tertiary" tone={on ? "success" : "critical"} icon={on ? CheckIcon : XIcon} accessibilityLabel={label} disabled={!onClick || Boolean(busy)} onClick={onClick} />
    </Tooltip>
  );

  const columns: Array<ListColumn<Carrier>> = [
    { key: "id", header: "ID", width: "90px", sortable: true, filter: { kind: "text", width: 80 }, cell: (row) => (row.prestashopId ? <Text as="span" variant="bodyMd" numeric>{row.prestashopId}</Text> : <Text as="span" variant="bodySm" tone="subdued">—</Text>) },
    { key: "name", header: "Nom", sortable: true, filter: { kind: "text" }, cell: (row) => <Text as="span" variant="bodyMd" fontWeight="semibold">{row.name}</Text> },
    { key: "logo", header: "Logo", width: "90px", align: "center", cell: (row) => <Thumbnail source={row.logoUrl ? getImageUrl(row.logoUrl) : DeliveryIcon} alt="" size="small" /> },
    { key: "delay", header: "Délai", sortable: true, filter: { kind: "text" }, cell: (row) => (row.transitTime ? <Text as="span" variant="bodyMd">{row.transitTime}</Text> : <Text as="span" variant="bodySm" tone="subdued">Non renseigné</Text>) },
    {
      key: "active",
      header: "Statut",
      align: "center",
      width: "120px",
      sortable: true,
      filter: { kind: "select", options: yesNo },
      cell: (row) => flag(row.active, row.active ? "Actif : cliquer pour désactiver" : "Désactivé : cliquer pour activer", () => void setActive([row], !row.active)),
    },
    { key: "free", header: "Livraison gratuite", align: "center", width: "150px", sortable: true, filter: { kind: "select", options: yesNo }, cell: (row) => flag(row.freeShipping, row.freeShipping ? "Livraison gratuite" : "Livraison payante") },
    {
      key: "position",
      header: "Position",
      align: "center",
      width: "150px",
      sortable: true,
      cell: (row) => {
        const index = list.findIndex((carrier) => carrier.id === row.id);
        const first = flip === 1 ? index === 0 : index === list.length - 1;
        const last = flip === 1 ? index === list.length - 1 : index === 0;
        return (
          <InlineStack gap="100" blockAlign="center" align="center" wrap={false}>
            <Button variant="tertiary" size="slim" icon={ChevronUpIcon} accessibilityLabel={`Monter ${row.name}`} disabled={!canReorder || first} onClick={() => move(row.id, flip === 1 ? -1 : 1)} />
            <Text as="span" variant="bodyMd" numeric>{index + 1}</Text>
            <Button variant="tertiary" size="slim" icon={ChevronDownIcon} accessibilityLabel={`Descendre ${row.name}`} disabled={!canReorder || last} onClick={() => move(row.id, flip === 1 ? 1 : -1)} />
          </InlineStack>
        );
      },
    },
  ];

  if (error) return <Banner tone="critical" title="Impossible de charger les transporteurs">{error}</Banner>;
  if (!carriers) return <Card><SkeletonBodyText lines={6} /></Card>;

  return (
    <BlockStack gap="400">
      <InlineStack align="space-between" blockAlign="start" gap="400" wrap={false}>
        <Box maxWidth="640px">
          <Text as="p" variant="bodyMd" tone="subdued">
            Un transporteur par service, par exemple « Colissimo domicile » et « Colissimo express ». L’ordre de la liste est celui présenté au client quand le tri par position est choisi.
          </Text>
        </Box>
        <InlineStack gap="200" wrap={false}>
          <PrestashopCarrierImport onImported={reload} />
          <Button variant="primary" url="/admin_ben/livraison/transporteurs/nouveau">Ajouter un transporteur</Button>
        </InlineStack>
      </InlineStack>

      {zones.length === 0 ? (
        <Banner tone="warning" title="Créez d’abord vos zones" action={{ content: "Gérer les zones", url: "/admin_ben/international/zones" }}>
          <p>Les tarifs dépendent de la zone du client : sans zone, aucun prix ne peut être défini.</p>
        </Banner>
      ) : null}

      {carriers.length === 0 ? (
        <Card>
          <BlockStack gap="200" inlineAlign="center">
            <Box paddingBlock="400">
              <BlockStack gap="200" inlineAlign="center">
                <Text as="h2" variant="headingMd">Aucun transporteur</Text>
                <Box maxWidth="520px">
                  <Text as="p" variant="bodyMd" tone="subdued" alignment="center">
                    Tant qu’aucun transporteur n’est actif, la boutique garde l’ancien tarif fixe : 8 € en livraison standard, retrait gratuit. Dès que vous en activez un, le client voit vos transporteurs et vos tarifs.
                  </Text>
                </Box>
                <InlineStack gap="200">
                  <PrestashopCarrierImport onImported={reload} />
                  <Button variant="primary" url="/admin_ben/livraison/transporteurs/nouveau">Ajouter un transporteur</Button>
                </InlineStack>
              </BlockStack>
            </Box>
          </BlockStack>
        </Card>
      ) : (
        <AdminList<Carrier>
          title="Transporteurs"
          icon={DeliveryIcon}
          count={filtered.length}
          toolbar={
            <>
              <PrestashopCarrierImport onImported={reload} />
              <Tooltip content="Ajouter un transporteur"><Button variant="tertiary" icon={PlusCircleIcon} accessibilityLabel="Ajouter un transporteur" url="/admin_ben/livraison/transporteurs/nouveau" /></Tooltip>
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
          bulkActions={[
            { content: "Activer la sélection", onAction: () => void setActive(selectedCarriers, true) },
            { content: "Désactiver la sélection", onAction: () => void setActive(selectedCarriers, false) },
            { content: "Supprimer la sélection", destructive: true, onAction: () => setToDelete(selectedCarriers) },
          ]}
          rowAction={(row) => ({
            content: "Modifier",
            onAction: () => router.push(`/admin_ben/livraison/transporteurs/${row.id}`),
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
          emptyText="Aucun transporteur ne correspond à ces filtres."
        />
      )}

      <Modal
        open={toDelete.length > 0}
        onClose={() => setToDelete([])}
        title={toDelete.length === 1 ? `Supprimer « ${toDelete[0].name} » ?` : `Supprimer ${toDelete.length} transporteurs ?`}
        primaryAction={{
          content: "Supprimer",
          destructive: true,
          loading: busy === "del",
          onAction: () => {
            const targets = toDelete;
            void act(
              "del",
              async () => {
                for (const carrier of targets) await shippingAdmin.deleteCarrier(carrier.id);
                setSelected(new Set());
              },
              targets.length === 1 ? "Transporteur supprimé." : "Transporteurs supprimés.",
            ).then(() => setToDelete([]));
          },
        }}
        secondaryActions={[{ content: "Annuler", onAction: () => setToDelete([]) }]}>
        <Modal.Section>
          <Text as="p" variant="bodyMd">
            {toDelete.length === 1 ? "Le transporteur et tous ses tarifs seront supprimés" : "Ces transporteurs et tous leurs tarifs seront supprimés"}. Les commandes déjà passées gardent le nom du transporteur choisi.
          </Text>
        </Modal.Section>
      </Modal>
    </BlockStack>
  );
}
