"use client";

import { BlockStack, Card, Text } from "@shopify/polaris";

const settingsSections = [
  {
    title: "Taxes",
    description: "Configurez les taux de TVA appliqués aux produits et gérez la taxe par défaut.",
    href: "/admin_ben/settings/taxes",
    action: "Gérer les taxes",
    icon: "%",
    tone: "#eaf2ff",
    iconColor: "#2456a6",
  },
  {
    title: "Statuts de commande",
    description: "Personnalisez les couleurs de fond et de texte affichées pour chaque statut.",
    href: "/admin_ben/settings/order-status-colors",
    action: "Configurer les couleurs",
    icon: "Aa",
    tone: "#f2edff",
    iconColor: "#7044a6",
  },
];

export default function AdminSettingsPage() {
  return (
    <BlockStack gap="500">
      <div className="flex flex-col gap-2 border-b border-[#dce4ea] pb-5">
        <Text as="h1" variant="heading2xl">Paramètres</Text>
        <Text as="p" tone="subdued">Gérez les réglages de votre boutique depuis un seul endroit.</Text>
      </div>

      <section>
        <div className="mb-3">
          <Text as="h2" variant="headingMd">Boutique</Text>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {settingsSections.map((section) => (
            <Card key={section.href}>
              <div className="flex h-full flex-col gap-5">
                <div className="flex items-start gap-4">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold" style={{ backgroundColor: section.tone, color: section.iconColor }} aria-hidden="true">
                    {section.icon}
                  </div>
                  <div className="min-w-0">
                    <Text as="h3" variant="headingMd">{section.title}</Text>
                    <p className="mt-1 text-sm leading-6 text-[#667085]">{section.description}</p>
                  </div>
                </div>
                <div className="mt-auto border-t border-[#edf0f3] pt-4">
                  <a href={section.href} className="inline-flex items-center gap-2 text-sm font-semibold text-[#2456a6] hover:text-[#173f82] focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2456a6]">
                    {section.action}
                    <span aria-hidden="true">→</span>
                  </a>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>
    </BlockStack>
  );
}
