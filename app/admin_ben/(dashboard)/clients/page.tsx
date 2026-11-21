"use client";

import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Badge,
  Banner,
  BlockStack,
  Box,
  Button,
  ButtonGroup,
  Card,
  Icon,
  DataTable,
  Checkbox,
  InlineGrid,
  InlineStack,
  Modal,
  Pagination,
  Select,
  Text,
  TextField,
  Tooltip,
} from "@shopify/polaris";
import {
  CalendarIcon,
  CartIcon,
  CheckIcon,
  DeleteIcon,
  EditIcon,
  ExternalIcon,
  EmailIcon,
  PersonIcon,
  RefreshIcon,
  SearchIcon,
  XIcon,
} from "@shopify/polaris-icons";

import { useAdminSession } from "@/components/admin/admin-session";
import {
  deleteAdminClient,
  EMPTY_CLIENT_FILTERS,
  getAdminClientStats,
  listAdminClients,
  openClientAccount,
  updateAdminClient,
  type AdminClient,
  type AdminClientFilters,
  type AdminClientUpdate,
} from "@/lib/api/admin-clients";
import { ClientEditModal } from "./client-edit-modal";

const PAGE_SIZE = 20;

const YES_NO = [
  { label: "Tous", value: "" },
  { label: "Oui", value: "true" },
  { label: "Non", value: "false" },
];

/** Table column index -> backend sort key (columns without a key are not sortable). */
const HEADINGS = [
  "", "Titre", "Prénom", "Nom", "E-mail", "Société", "Ventes",
  "Activé", "Newsletter", "Offres partenaires", "Inscription", "Dernière visite", "Actions",
];
const SORT_KEYS: Array<string | null> = [
  null, null, "firstName", "lastName", "email", "company", null, null, null, null, "createdAt", "lastVisitAt", null,
];

function formatDate(value: string | null) {
  if (!value) return "--";
  return new Date(value).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

function StatTile({
  icon,
  label,
  value,
  tone,
}: {
  icon: typeof PersonIcon;
  label: string;
  value: string;
  tone: "info" | "critical" | "success" | "caution";
}) {
  return (
    <InlineStack gap="300" blockAlign="center" wrap={false}>
      <Icon source={icon} tone={tone === "caution" ? "warning" : tone === "info" ? "info" : tone} />
      <BlockStack gap="050">
        <Text as="span" variant="bodySm" tone="subdued">{label}</Text>
        <Text as="span" variant="headingLg" tone={tone === "info" ? undefined : tone}>{value}</Text>
      </BlockStack>
    </InlineStack>
  );
}

function FlagToggle({
  value,
  label,
  disabled,
  onToggle,
}: {
  value: boolean;
  label: string;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <Tooltip content={disabled ? label : `${label} : cliquer pour ${value ? "désactiver" : "activer"}`}>
      <Button
        variant="monochromePlain"
        accessibilityLabel={`${label} : ${value ? "oui" : "non"}`}
        disabled={disabled}
        icon={<Icon source={value ? CheckIcon : XIcon} tone={value ? "success" : "critical"} />}
        onClick={onToggle}
      />
    </Tooltip>
  );
}

export default function AdminClientsPage() {
  const { can } = useAdminSession();
  const canEdit = can("clients.edit");
  const queryClient = useQueryClient();

  const [filters, setFilters] = useState<AdminClientFilters>(EMPTY_CLIENT_FILTERS);
  const [debouncedFilters, setDebouncedFilters] = useState<AdminClientFilters>(EMPTY_CLIENT_FILTERS);
  const [page, setPage] = useState(1);
  const [sortColumn, setSortColumn] = useState(10);
  const [sortDir, setSortDir] = useState<"ascending" | "descending">("descending");
  const [editing, setEditing] = useState<AdminClient | null>(null);
  const [toDelete, setToDelete] = useState<AdminClient[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedFilters(filters);
      setPage(1);
    }, 300);
    return () => clearTimeout(timeout);
  }, [filters]);

  const sortBy = SORT_KEYS[sortColumn] ?? "createdAt";

  const listQuery = useQuery({
    queryKey: ["admin-clients", debouncedFilters, page, sortBy, sortDir],
    queryFn: () =>
      listAdminClients({
        page,
        limit: PAGE_SIZE,
        filters: debouncedFilters,
        sortBy,
        sortDir: sortDir === "ascending" ? "asc" : "desc",
      }),
    placeholderData: keepPreviousData,
  });
  const statsQuery = useQuery({ queryKey: ["admin-clients-stats"], queryFn: getAdminClientStats });

  const clients = useMemo(() => listQuery.data?.data ?? [], [listQuery.data]);
  const total = listQuery.data?.meta.total ?? statsQuery.data?.total ?? 0;
  const totalPages = Math.max(1, listQuery.data?.meta.totalPages ?? 1);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  useEffect(() => setSelectedIds([]), [clients]);
  const allSelected = clients.length > 0 && selectedIds.length === clients.length;

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin-clients"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-clients-stats"] });
  };

  const patchMutation = useMutation({
    mutationFn: ({ ids, payload }: { ids: string[]; payload: AdminClientUpdate }) =>
      Promise.all(ids.map((id) => updateAdminClient(id, payload))),
    onSuccess: refresh,
    onError: (mutationError) =>
      setError(mutationError instanceof Error ? mutationError.message : "Modification impossible."),
  });

  const deleteMutation = useMutation({
    mutationFn: (ids: string[]) => Promise.all(ids.map((id) => deleteAdminClient(id))),
    onSuccess: () => {
      setToDelete([]);
      setSelectedIds([]);
      refresh();
    },
    onError: (mutationError) => {
      setToDelete([]);
      setError(mutationError instanceof Error ? mutationError.message : "Suppression impossible.");
    },
  });

  const setFilter = (key: keyof AdminClientFilters) => (value: string) =>
    setFilters((current) => ({ ...current, [key]: value }));

  const hasFilters = Object.values(filters).some(Boolean);
  const stats = statsQuery.data;

  const input = (key: keyof AdminClientFilters, label: string, width = 130) => (
    <div style={{ minWidth: width }}>
      <TextField label={label} labelHidden placeholder={label} value={filters[key]}
        onChange={setFilter(key)} autoComplete="off" />
    </div>
  );
  const select = (key: keyof AdminClientFilters, label: string, options: { label: string; value: string }[], width = 90) => (
    <div style={{ minWidth: width }}>
      <Select label={label} labelHidden options={options} value={filters[key]} onChange={setFilter(key)} />
    </div>
  );

  const headings = HEADINGS.map((title, index) =>
    index === 0 ? (
      <Checkbox
        key="all"
        label="Tout sélectionner"
        labelHidden
        disabled={!canEdit || clients.length === 0}
        checked={allSelected}
        onChange={(checked) => setSelectedIds(checked ? clients.map((client) => client.id) : [])}
      />
    ) : (
      title
    ),
  );

  const filterRow = [
    "",
    select("titre", "Titre", [{ label: "", value: "" }, { label: "M.", value: "M" }, { label: "Mme", value: "Mme" }, { label: "Autre", value: "Autre" }]),
    input("firstName", "Rechercher prénom"),
    input("lastName", "Rechercher nom"),
    input("email", "Rechercher e-mail", 170),
    input("company", "Rechercher société"),
    "",
    select("isActive", "Activé", [{ label: "", value: "" }, { label: "Oui", value: "true" }, { label: "Non", value: "false" }]),
    select("newsletter", "Newsletter", [{ label: "", value: "" }, { label: "Oui", value: "true" }, { label: "Non", value: "false" }]),
    select("partnerOffers", "Offres partenaires", [{ label: "", value: "" }, { label: "Oui", value: "true" }, { label: "Non", value: "false" }]),
    <div key="dates" style={{ minWidth: 150 }}>
      <BlockStack gap="100">
        <TextField label="Du" labelHidden prefix="Du" type="date" value={filters.createdFrom}
          onChange={setFilter("createdFrom")} autoComplete="off" />
        <TextField label="Au" labelHidden prefix="Au" type="date" value={filters.createdTo}
          onChange={setFilter("createdTo")} autoComplete="off" />
      </BlockStack>
    </div>,
    "",
    <Button key="reset" icon={SearchIcon} disabled={!hasFilters} onClick={() => setFilters(EMPTY_CLIENT_FILTERS)}>
      Effacer
    </Button>,
  ];

  const clientRows = clients.map((client) => [
    <Checkbox
      key={`sel-${client.id}`}
      label={`Sélectionner ${client.email}`}
      labelHidden
      disabled={!canEdit}
      checked={selectedIds.includes(client.id)}
      onChange={(checked) =>
        setSelectedIds((current) =>
          checked ? [...current, client.id] : current.filter((id) => id !== client.id),
        )
      }
    />,
    client.Titre === "M" ? "M." : client.Titre,
    client.firstName,
    client.lastName,
    client.email,
    client.company || "",
    client.sales > 0 ? (
      <Badge key="sales" tone="success">
        {client.sales.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}
      </Badge>
    ) : (
      "--"
    ),
    <FlagToggle key="a" value={client.isActive} label="Activé" disabled={!canEdit} onToggle={() => toggle(client, "isActive")} />,
    <FlagToggle key="n" value={client.newsletter} label="Newsletter" disabled={!canEdit} onToggle={() => toggle(client, "newsletter")} />,
    <FlagToggle key="p" value={client.partnerOffers} label="Offres partenaires" disabled={!canEdit} onToggle={() => toggle(client, "partnerOffers")} />,
    formatDate(client.createdAt),
    formatDate(client.lastVisitAt),
    canEdit ? (
      <ButtonGroup key="act" variant="segmented">
        <Tooltip content="Se connecter en tant que ce client">
          <Button icon={ExternalIcon} accessibilityLabel="Se connecter en tant que ce client"
            disabled={!client.isActive} onClick={() => void loginAsClient(client)} />
        </Tooltip>
        <Button icon={EditIcon} accessibilityLabel="Modifier" onClick={() => setEditing(client)} />
        <Button icon={DeleteIcon} tone="critical" accessibilityLabel="Supprimer" onClick={() => setToDelete([client])} />
      </ButtonGroup>
    ) : (
      ""
    ),
  ]);

  const loginAsClient = async (client: AdminClient) => {
    try {
      await openClientAccount(client.id);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Connexion au compte impossible.");
    }
  };

  const toggle = (client: AdminClient, key: "isActive" | "newsletter" | "partnerOffers") =>
    patchMutation.mutate({ ids: [client.id], payload: { [key]: !client[key] } });

  return (
    <BlockStack gap="400">
      {/* KPI band */}
      <Card>
        <InlineStack align="space-between" blockAlign="start" wrap={false} gap="300">
          <div style={{ flex: 1 }}>
            <InlineGrid columns={{ xs: 1, sm: 2, lg: 4 }} gap="400">
              <StatTile icon={PersonIcon} tone="info" label="Clients (total)"
                value={stats ? `${stats.femalePercent} % de clientes` : "…"} />
              <StatTile icon={CalendarIcon} tone="critical" label="Âge moyen"
                value={stats ? (stats.averageAge !== null ? `${stats.averageAge} ans` : "n/d") : "…"} />
              <StatTile icon={CartIcon} tone="info" label="Commandes par client"
                value={stats ? String(stats.ordersPerCustomer) : "…"} />
              <StatTile icon={EmailIcon} tone="success" label="Inscrits newsletter"
                value={stats ? String(stats.newsletterRegistrations) : "…"} />
            </InlineGrid>
          </div>
          <Button
            icon={RefreshIcon}
            variant="primary"
            accessibilityLabel="Actualiser"
            loading={listQuery.isFetching || statsQuery.isFetching}
            onClick={refresh}
          />
        </InlineStack>
      </Card>

      {error ? <Banner tone="critical" onDismiss={() => setError(null)}>{error}</Banner> : null}

      <Card padding="0">
        <Box padding="400" borderBlockEndWidth="025" borderColor="border">
          <InlineStack align="space-between" blockAlign="center">
            <Text as="h2" variant="headingMd">{`Gérer vos clients (${total})`}</Text>
            {hasFilters ? (
              <Button onClick={() => setFilters(EMPTY_CLIENT_FILTERS)}>Effacer les filtres</Button>
            ) : null}
          </InlineStack>
        </Box>

        {selectedIds.length > 0 && canEdit ? (
          <Box padding="300" background="bg-surface-selected" borderBlockEndWidth="025" borderColor="border">
            <InlineStack gap="300" blockAlign="center">
              <Text as="span" fontWeight="semibold">{`${selectedIds.length} sélectionné(s)`}</Text>
              <Button onClick={() => patchMutation.mutate({ ids: selectedIds, payload: { isActive: true } })}>Activer</Button>
              <Button onClick={() => patchMutation.mutate({ ids: selectedIds, payload: { isActive: false } })}>Désactiver</Button>
              <Button tone="critical" onClick={() => setToDelete(clients.filter((client) => selectedIds.includes(client.id)))}>
                Supprimer
              </Button>
            </InlineStack>
          </Box>
        ) : null}

        <DataTable
          columnContentTypes={HEADINGS.map(() => "text" as const)}
          headings={headings}
          rows={[filterRow, ...clientRows]}
          sortable={SORT_KEYS.map((key) => key !== null)}
          initialSortColumnIndex={10}
          defaultSortDirection="descending"
          onSort={(index, direction) => {
            setSortColumn(index);
            setSortDir(direction === "ascending" ? "ascending" : "descending");
            setPage(1);
          }}
          increasedTableDensity
          verticalAlign="middle"
        />
        {!listQuery.isLoading && clients.length === 0 ? (
          <Box padding="400">
            <Text as="p" tone="subdued" alignment="center">Aucun client ne correspond aux filtres.</Text>
          </Box>
        ) : null}

        {totalPages > 1 ? (
          <Box padding="300" borderBlockStartWidth="025" borderColor="border">
            <InlineStack align="center" gap="300" blockAlign="center">
              <Pagination
                hasPrevious={page > 1}
                hasNext={page < totalPages}
                onPrevious={() => setPage((current) => current - 1)}
                onNext={() => setPage((current) => current + 1)}
              />
              <Text as="span" tone="subdued">{`Page ${page} / ${totalPages}`}</Text>
            </InlineStack>
          </Box>
        ) : null}
      </Card>

      <ClientEditModal client={editing} onClose={() => setEditing(null)} onSaved={refresh} />

      <Modal
        open={toDelete.length > 0}
        title={`Supprimer ${toDelete.length} client${toDelete.length > 1 ? "s" : ""} ?`}
        onClose={() => setToDelete([])}
        primaryAction={{
          content: "Supprimer",
          destructive: true,
          loading: deleteMutation.isPending,
          onAction: () => deleteMutation.mutate(toDelete.map((client) => client.id)),
        }}
        secondaryActions={[{ content: "Annuler", onAction: () => setToDelete([]) }]}>
        <Modal.Section>
          <Text as="p">
            Cette action est irréversible. Les commandes passées restent conservées, mais ne seront plus
            rattachées à un compte client.
          </Text>
        </Modal.Section>
      </Modal>
    </BlockStack>
  );
}
