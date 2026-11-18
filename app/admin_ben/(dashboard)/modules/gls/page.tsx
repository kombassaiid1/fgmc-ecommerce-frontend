"use client";

import { useState } from "react";
import { Badge, BlockStack, Text } from "@shopify/polaris";
import { TabBar } from "../../tab-bar";
import { CarriersTab } from "./carriers-tab";
import GlsConfigForm from "./gls-config-form";
import { LogsTab } from "./logs-tab";
import { OrdersTab } from "./orders-tab";
import { PresentationTab } from "./presentation-tab";
import { SettingsTab } from "./settings-tab";
import { SupportTab } from "./support-tab";
import "./gls-module.css";

const TABS = [
  { id: "presentation", label: "Présentation" },
  { id: "carriers", label: "Transporteurs" },
  { id: "account", label: "Compte GLS" },
  { id: "orders", label: "Commandes" },
  { id: "settings", label: "Réglages" },
  { id: "support", label: "Support" },
  { id: "logs", label: "Journal" },
];

export default function GlsModulePage() {
  const [tab, setTab] = useState(0);
  const current = TABS[tab].id;

  return (
    <div className="gls-module">
      <BlockStack gap="400">
        <header className="gls-module-head">
          <div className="gls-module-title">
            <Text as="h1" variant="heading2xl">GLS France</Text>
            <Badge tone="info">Expédition et suivi de colis</Badge>
          </div>
          <p>Créez les étiquettes GLS depuis chaque commande, proposez les points relais à vos clients et suivez les colis.</p>
        </header>

        <TabBar tabs={TABS} selected={tab} onSelect={setTab} label="Sections du module GLS" panelId="gls-panel" />

        <div id="gls-panel" role="tabpanel" aria-labelledby={`gls-panel-tab-${current}`}>
          {current === "presentation" ? <PresentationTab /> : null}
          {current === "carriers" ? <CarriersTab /> : null}
          {current === "account" ? <GlsConfigForm /> : null}
          {current === "orders" ? <OrdersTab /> : null}
          {current === "settings" ? <SettingsTab /> : null}
          {current === "support" ? <SupportTab /> : null}
          {current === "logs" ? <LogsTab /> : null}
        </div>
      </BlockStack>
    </div>
  );
}
