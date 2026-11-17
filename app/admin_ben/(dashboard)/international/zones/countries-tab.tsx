"use client";

import { useState } from "react";
import { Box, Icon, Button, Select, Text, Tooltip } from "@shopify/polaris";
import { CheckIcon, LocationIcon, RefreshIcon, XIcon } from "@shopify/polaris-icons";
import { toast } from "sonner";
import { shippingAdmin, type Zone } from "@/lib/api/shipping-admin";
import { AdminList, type ListColumn } from "../admin-list";
import { COUNTRIES, type CountryInfo } from "../geo";

/** Every country with the zone it belongs to; the zone can be changed on the row, as in PrestaShop. */
export function CountriesTab({ zones, reload }: { zones: Zone[]; reload: () => Promise<void> }) {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" }>({ key: "name", dir: "asc" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [busy, setBusy] = useState("");

  const zoneOf = new Map<string, Zone>();
  zones.forEach((zone) => zone.countryCodes.forEach((code) => zoneOf.set(code, zone)));

  const name = (filters.name ?? "").trim().toLocaleLowerCase("fr");
  const code = (filters.code ?? "").trim().toLowerCase();
  const filtered = COUNTRIES.filter((country) => {
    if (name && !country.name.toLocaleLowerCase("fr").includes(name)) return false;
    if (code && !country.code.toLowerCase().includes(code)) return false;
    const zone = zoneOf.get(country.code);
    if (filters.prefix && !country.prefix.replace("+", "").startsWith(filters.prefix.trim().replace("+", ""))) return false;
    if (filters.status && (filters.status === "on") !== Boolean(zone?.active)) return false;
    if (filters.zone === "none") return !zone;
    if (filters.zone) return zone?.id === filters.zone;
    return true;
  }).sort((a, b) => {
    const direction = sort.dir === "asc" ? 1 : -1;
    if (sort.key === "code") return a.code.localeCompare(b.code) * direction;
    if (sort.key === "prefix") return a.prefix.localeCompare(b.prefix, "fr", { numeric: true }) * direction;
    if (sort.key === "status") return (Number(Boolean(zoneOf.get(a.code)?.active)) - Number(Boolean(zoneOf.get(b.code)?.active))) * direction;
    if (sort.key === "zone") return (zoneOf.get(a.code)?.name ?? "￿").localeCompare(zoneOf.get(b.code)?.name ?? "￿", "fr") * direction;
    return a.name.localeCompare(b.name, "fr") * direction;
  });

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pages);
  const visible = filtered.slice((current - 1) * pageSize, current * pageSize);

  async function assign(countryCode: string, zoneId: string) {
    setBusy(countryCode);
    try {
      await shippingAdmin.setCountryZone(countryCode, zoneId || null);
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Affectation impossible.");
    } finally {
      setBusy("");
    }
  }

  const zoneOptions = [{ label: "Aucune zone", value: "" }, ...zones.map((zone) => ({ label: zone.active ? zone.name : `${zone.name} (désactivée)`, value: zone.id }))];

  const columns: Array<ListColumn<CountryInfo>> = [
    { key: "name", header: "Pays", sortable: true, filter: { kind: "text" }, cell: (row) => <Text as="span" variant="bodyMd" fontWeight="semibold">{row.name}</Text> },
    { key: "code", header: "Code ISO", width: "130px", sortable: true, filter: { kind: "text", width: 100 }, cell: (row) => <Text as="span" variant="bodyMd" tone="subdued">{row.code}</Text> },
    {
      key: "zone",
      header: "Zone",
      width: "300px",
      sortable: true,
      filter: { kind: "select", options: [{ label: "—", value: "" }, { label: "Sans zone", value: "none" }, ...zones.map((zone) => ({ label: zone.name, value: zone.id }))] },
      cell: (row) => (
        <Box minWidth="240px">
          <Select label={`Zone de ${row.name}`} labelHidden options={zoneOptions} value={zoneOf.get(row.code)?.id ?? ""} disabled={busy === row.code} onChange={(value) => void assign(row.code, value)} />
        </Box>
      ),
    },
    { key: "prefix", header: "Indicatif téléphonique", width: "200px", sortable: true, filter: { kind: "text", width: 90 }, cell: (row) => <Text as="span" variant="bodyMd" numeric>{row.prefix || "—"}</Text> },
    {
      key: "status",
      header: "Activé",
      align: "center",
      width: "140px",
      sortable: true,
      filter: { kind: "select", options: [{ label: "—", value: "" }, { label: "Oui", value: "on" }, { label: "Non", value: "off" }] },
      cell: (row) => {
        const zone = zoneOf.get(row.code);
        const on = Boolean(zone?.active);
        return (
          <Tooltip content={!zone ? "Aucune zone : non desservi" : on ? "Desservi" : "Zone désactivée"}>
            <Text as="span" tone={on ? "success" : "critical"}><Icon source={on ? CheckIcon : XIcon} tone={on ? "success" : "critical"} /></Text>
          </Tooltip>
        );
      },
    },
  ];

  return (
    <AdminList<CountryInfo>
      title="Pays"
      icon={LocationIcon}
      count={filtered.length}
      toolbar={<Tooltip content="Actualiser"><Button variant="tertiary" icon={RefreshIcon} accessibilityLabel="Actualiser la liste" onClick={() => void reload()} /></Tooltip>}
      columns={columns}
      rows={visible}
      rowId={(row) => row.code}
      filters={filters}
      onApplyFilters={(next) => { setFilters(next); setPage(1); }}
      sort={sort}
      onSort={(key, dir) => setSort({ key, dir })}
      page={current}
      pages={pages}
      onPage={setPage}
      pageSize={pageSize}
      pageSizes={[20, 50, 100, 300]}
      onPageSize={(size) => { setPageSize(size); setPage(1); }}
      emptyText="Aucun pays ne correspond à ces filtres."
    />
  );
}
