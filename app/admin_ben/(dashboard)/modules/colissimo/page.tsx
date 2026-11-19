"use client";

import { useEffect, useState } from "react";
import { BlockStack, Button, Card, Icon, InlineStack, ProgressBar, Text } from "@shopify/polaris";
import { CheckCircleIcon, DeliveryIcon, InfoIcon, NoteIcon, PlayIcon, SettingsIcon, StatusActiveIcon, PersonIcon } from "@shopify/polaris-icons";
import { shippingAdmin } from "@/lib/api/shipping-admin";
import { ColissimoFrame } from "./cm-shell";
import { ConfigProvider, useColissimo } from "./cm-kit";
import { colissimoCall } from "./colissimo-api";
import { TabAccount } from "./tab-account";
import { TabBack } from "./tab-back";
import { TabFront } from "./tab-front";
import { TabFiles, TabIntro, TabVideos } from "./tab-simple";

type SectionId = "intro" | "account" | "fo" | "bo" | "files" | "videos";

const SECTIONS: Array<{ id: SectionId; label: string; icon: typeof InfoIcon }> = [
  { id: "intro", label: "Présentation", icon: InfoIcon },
  { id: "account", label: "Compte et adresses", icon: PersonIcon },
  { id: "fo", label: "Boutique et clients", icon: DeliveryIcon },
  { id: "bo", label: "Expédition", icon: SettingsIcon },
  { id: "files", label: "Fichiers", icon: NoteIcon },
  { id: "videos", label: "Tutoriels", icon: PlayIcon },
];

/** Where the shop stands in setting Colissimo up, from real data: account, sender address, carriers, first label. */
function SetupRail({ go }: { go: (section: SectionId) => void }) {
  const { config } = useColissimo();
  const [carriers, setCarriers] = useState<boolean | null>(null);
  const [labels, setLabels] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    shippingAdmin.carriers().then((list) => !cancelled && setCarriers(list.some((carrier) => Boolean(carrier.colissimoType)))).catch(() => !cancelled && setCarriers(false));
    colissimoCall<unknown[]>("/shipments/open").then((list) => !cancelled && setLabels(list.length > 0)).catch(() => !cancelled && setLabels(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const sender = config.structured.sender;
  const steps: Array<{ title: string; text: string; done: boolean | null; action: string; onAction: () => void; url?: string }> = [
    { title: "Connecter le compte", text: "Votre contrat Colissimo, par identifiant ou par clé.", done: config.account.configured, action: "Connecter", onAction: () => go("account") },
    { title: "Adresse d’expédition", text: "Imprimée sur chaque étiquette.", done: Boolean(sender.address1 && sender.city && sender.zipcode && sender.email), action: "Renseigner", onAction: () => go("account") },
    { title: "Associer les transporteurs", text: "Domicile, avec signature, point de retrait.", done: carriers, action: "Associer", onAction: () => go("fo") },
    { title: "Créer une première étiquette", text: "Depuis une commande Colissimo.", done: labels, action: "Voir les commandes", onAction: () => undefined, url: "/admin_ben/modules/colissimo/orders" },
  ];
  const known = steps.filter((step) => step.done !== null);
  const doneCount = steps.filter((step) => step.done).length;
  if (known.length === steps.length && doneCount === steps.length) return null;
  const next = steps.findIndex((step) => step.done === false);

  return (
    <Card>
      <BlockStack gap="300">
        <InlineStack align="space-between" blockAlign="center" gap="300">
          <BlockStack gap="050">
            <Text as="h2" variant="headingMd">Mise en route</Text>
            <Text as="p" variant="bodySm" tone="subdued">{doneCount} étape{doneCount > 1 ? "s" : ""} sur {steps.length} terminée{doneCount > 1 ? "s" : ""}</Text>
          </BlockStack>
          <div style={{ width: 180 }}><ProgressBar progress={(doneCount / steps.length) * 100} size="small" tone="primary" ariaLabelledBy="cm-rail-title" /></div>
        </InlineStack>
        <ol className="cm-rail-steps" id="cm-rail-title" aria-label="Étapes de mise en route">
          {steps.map((step, index) => (
            <li key={step.title} className="cm-rail-step" data-done={step.done ? "true" : undefined} data-next={index === next ? "true" : undefined}>
              <span className="cm-rail-icon">
                <Icon source={step.done ? CheckCircleIcon : StatusActiveIcon} tone={step.done ? "success" : "subdued"} accessibilityLabel={step.done ? "Terminé" : "À faire"} />
              </span>
              <span className="cm-rail-body">
                <Text as="span" variant="bodyMd" fontWeight="semibold">{step.title}</Text>
                <Text as="span" variant="bodySm" tone="subdued">{step.text}</Text>
                {step.done ? null : <span><Button size="slim" variant={index === next ? "primary" : "secondary"} onClick={step.onAction} url={step.url}>{step.action}</Button></span>}
              </span>
            </li>
          ))}
        </ol>
      </BlockStack>
    </Card>
  );
}

function Sections() {
  const [active, setActive] = useState<SectionId>("account");
  return (
    <>
      <SetupRail go={setActive} />
      <div className="cm-split">
        <nav className="cm-side" role="tablist" aria-label="Sections de la configuration" aria-orientation="vertical">
          {SECTIONS.map((section) => (
            <button key={section.id} type="button" role="tab" id={`cm-tab-${section.id}`} aria-selected={active === section.id} aria-controls={`cm-panel-${section.id}`} onClick={() => setActive(section.id)}>
              <span className="cm-icon"><Icon source={section.icon} /></span>
              {section.label}
            </button>
          ))}
        </nav>
        <div className="cm-sections" role="tabpanel" id={`cm-panel-${active}`} aria-labelledby={`cm-tab-${active}`}>
          {active === "intro" ? <TabIntro /> : null}
          {active === "account" ? <TabAccount /> : null}
          {active === "fo" ? <TabFront /> : null}
          {active === "bo" ? <TabBack /> : null}
          {active === "files" ? <TabFiles /> : null}
          {active === "videos" ? <TabVideos /> : null}
        </div>
      </div>
    </>
  );
}

function Frame() {
  const { config } = useColissimo();
  return (
    <ColissimoFrame current="configuration" colishipEnabled={config.values.COLISSIMO_GENERATE_LABEL_PRESTASHOP === false}>
      <Sections />
    </ColissimoFrame>
  );
}

export default function ColissimoConfigurationPage() {
  return (
    <ConfigProvider>
      <Frame />
    </ConfigProvider>
  );
}
