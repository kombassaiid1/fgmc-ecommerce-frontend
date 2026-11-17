"use client";

import { useCallback, useEffect, useState } from "react";
import { Banner, BlockStack, Card, SkeletonBodyText } from "@shopify/polaris";
import { shippingAdmin, type Zone } from "@/lib/api/shipping-admin";
import { PageHeader } from "../page-header";
import { CountriesTab } from "./countries-tab";
import { PrestashopImport } from "./prestashop-import";
import { StatesTab } from "./states-tab";
import { ZonesTab } from "./zones-tab";

const TABS = [
  { id: "zones", content: "Zones" },
  { id: "pays", content: "Pays" },
  { id: "etats", content: "États" },
];

/** Tab bar with an unmistakable active state: bold label and a thick underline in the accent colour. */
function TabBar({ selected, onSelect }: { selected: number; onSelect: (index: number) => void }) {
  return (
    <div
      role="tablist"
      aria-label="Zones géographiques"
      style={{ display: "flex", gap: "var(--p-space-200)", borderBottom: "1px solid var(--p-color-border)" }}
      onKeyDown={(event) => {
        const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
        if (!step) return;
        event.preventDefault();
        const next = (selected + step + TABS.length) % TABS.length;
        onSelect(next);
        document.getElementById(`geo-tab-${TABS[next].id}`)?.focus();
      }}>
      {TABS.map((tab, index) => {
        const active = index === selected;
        return (
          <button
            key={tab.id}
            id={`geo-tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls="geo-panel"
            tabIndex={active ? 0 : -1}
            onClick={() => onSelect(index)}
            style={{
              appearance: "none",
              background: active ? "var(--p-color-bg-surface-selected)" : "transparent",
              border: 0,
              borderBottom: `3px solid ${active ? "var(--p-color-border-focus)" : "transparent"}`,
              marginBottom: -1,
              borderTopLeftRadius: "var(--p-border-radius-200)",
              borderTopRightRadius: "var(--p-border-radius-200)",
              padding: "var(--p-space-300) var(--p-space-500)",
              cursor: "pointer",
              font: "inherit",
              fontSize: "var(--p-font-size-325)",
              fontWeight: active ? 650 : 450,
              color: active ? "var(--p-color-text)" : "var(--p-color-text-secondary)",
            }}>
            {tab.content}
          </button>
        );
      })}
    </div>
  );
}

export default function GeographicZonesPage() {
  const [tab, setTab] = useState(0);
  const [zones, setZones] = useState<Zone[] | null>(null);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    try {
      setZones(await shippingAdmin.zones());
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chargement impossible.");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    shippingAdmin
      .zones()
      .then((list) => {
        if (!cancelled) setZones(list);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Chargement impossible.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <BlockStack gap="400">
      <PageHeader
        title="Zones géographiques"
        description="Les zones servent à calculer les frais de livraison : chaque pays, et chaque état, est rattaché à une zone."
        action={<PrestashopImport onImported={reload} />}
      />
      <TabBar selected={tab} onSelect={setTab} />
      <div id="geo-panel" role="tabpanel" aria-labelledby={`geo-tab-${TABS[tab].id}`}>
        {error ? (
          <Banner tone="critical" title="Impossible de charger les zones">{error}</Banner>
        ) : !zones ? (
          <Card><SkeletonBodyText lines={8} /></Card>
        ) : tab === 0 ? (
          <ZonesTab zones={zones} reload={reload} />
        ) : tab === 1 ? (
          <CountriesTab zones={zones} reload={reload} />
        ) : (
          <StatesTab zones={zones} reload={reload} />
        )}
      </div>
    </BlockStack>
  );
}
