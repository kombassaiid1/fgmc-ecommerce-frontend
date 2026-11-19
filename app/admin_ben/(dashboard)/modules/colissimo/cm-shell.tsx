"use client";

import { useMemo, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, InlineStack, Tabs, Text } from "@shopify/polaris";
import { ChevronLeftIcon, ExternalIcon } from "@shopify/polaris-icons";
import { useColissimo } from "./cm-kit";
import "./colissimo.css";

export const BASE = "/admin_ben/modules/colissimo";
const PORTAL = "https://www.colissimo.entreprise.laposte.fr/fr";

export type PageId = "orders" | "dashboard" | "postage" | "coliship" | "deposit-slip" | "documents" | "import" | "configuration";

type Props = {
  current: PageId;
  title?: string;
  /** Show Coliship instead of Postage (the original does it when labels are not printed from the back office). */
  colishipEnabled?: boolean;
  children: ReactNode;
};

/** The frame every Colissimo page lives in: back link, wordmark, account state, and the page navigation. */
export function ColissimoFrame({ current, title = "Configuration", colishipEnabled = false, children }: Props) {
  const router = useRouter();
  const { config } = useColissimo();

  const pages = useMemo(
    () =>
      [
        { id: "orders", href: `${BASE}/orders`, label: "Commandes" },
        { id: "dashboard", href: `${BASE}/dashboard`, label: "Suivi des colis" },
        colishipEnabled ? { id: "coliship", href: `${BASE}/import`, label: "Coliship" } : { id: "postage", href: `${BASE}/postage`, label: "Affranchissement" },
        { id: "deposit-slip", href: `${BASE}/deposit-slip`, label: "Bordereau de dépôt" },
        { id: "documents", href: `${BASE}/documents`, label: "Documents douaniers" },
        { id: "import", href: `${BASE}/import?importCsv=1`, label: "Import de numéros" },
        { id: "configuration", href: BASE, label: "Configuration" },
      ] as Array<{ id: PageId; href: string; label: string }>,
    [colishipEnabled],
  );
  const selected = Math.max(0, pages.findIndex((page) => page.id === current || (current === "coliship" && page.id === "import")));

  return (
    <div className="cm">
      <div>
        <Button variant="plain" icon={ChevronLeftIcon} url="/admin_ben/modules" accessibilityLabel="Retour à la liste des modules">Modules</Button>
      </div>

      <header className="cm-head">
        <div className="cm-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/colissimo/Colissimo_Logo_H.png" alt="Colissimo" width={150} height={36} />
          <div className="cm-brand-title">
            <Text as="h1" variant="headingLg">{title}</Text>
            <Text as="p" variant="bodySm" tone="subdued">Étiquettes, points de retrait et suivi de vos colis</Text>
          </div>
        </div>
        <div className="cm-links">
          <Badge tone={config.account.configured ? "success" : "attention"} progress={config.account.configured ? "complete" : "incomplete"}>
            {config.account.configured ? "Compte connecté" : "Compte à connecter"}
          </Badge>
          <InlineStack gap="100">
            <Button variant="tertiary" icon={ExternalIcon} url={PORTAL} external>Étiquettes et emballages</Button>
            <Button variant="tertiary" icon={ExternalIcon} url="https://status.colissimo.fr/" external>État des services</Button>
          </InlineStack>
        </div>
      </header>

      <nav className="cm-nav" aria-label="Pages du module Colissimo">
        <Tabs
          tabs={pages.map((page) => ({ id: page.id, content: page.label, accessibilityLabel: page.label, panelID: `cm-main-${page.id}` }))}
          selected={selected}
          onSelect={(index) => {
            if (pages[index].id !== current) router.push(pages[index].href);
          }}
        />
      </nav>

      <main id={`cm-main-${current}`} style={{ display: "grid", gap: "var(--p-space-500)" }}>{children}</main>
    </div>
  );
}
