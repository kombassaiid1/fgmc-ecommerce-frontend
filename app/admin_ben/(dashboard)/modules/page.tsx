"use client";

import Link from "next/link";
import { Badge, BlockStack, Card, Text } from "@shopify/polaris";

const modules = [
  {
    name: "Dolibarr",
    category: "ERP · Synchronisation",
    description:
      "Synchronisez produits, stocks et factures depuis Dolibarr. Envoyez les commandes et les clients de la boutique vers Dolibarr.",
    status: "Package disponible",
    initials: "D",
    background: "#e9f2ff",
    foreground: "#164b91",
    download: "/downloads/fgmcsync-1.0.7.zip",
    features: [
      "Produits, stock et factures · Dolibarr vers boutique",
      "Commandes et clients · boutique vers Dolibarr",
    ],
  },
];

export default function AdminModulesPage() {
  return (
    <BlockStack gap="500">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#dce4ea] pb-5">
        <div>
          <Text as="h1" variant="heading2xl">Modules</Text>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#667085]">
            Gere les connexions entre la boutique et vos outils metier.
          </p>
        </div>
        <Badge tone="info">{`${modules.length} module disponible`}</Badge>
      </div>

      <section aria-label="Modules disponibles" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {modules.map((module) => (
          <Card key={module.name}>
            <div className="flex h-full min-h-72 flex-col gap-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-xl text-lg font-bold" style={{ backgroundColor: module.background, color: module.foreground }} aria-hidden="true">
                  {module.initials}
                </div>
                <Badge tone="success">{module.status}</Badge>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[#667085]">{module.category}</p>
                <h2 className="mt-2 text-lg font-semibold text-[#24364b]">{module.name}</h2>
                <p className="mt-2 text-sm leading-6 text-[#667085]">{module.description}</p>
              </div>
              <ul className="space-y-2 border-t border-[#edf0f3] pt-4 text-sm leading-5 text-[#475467]">
                {module.features.map((feature) => <li key={feature}>• {feature}</li>)}
              </ul>
              <div className="mt-auto flex flex-wrap items-center gap-3 border-t border-[#edf0f3] pt-4">
                <Link className="inline-flex items-center justify-center rounded-lg bg-[#1457a6] px-4 py-2 text-sm font-semibold text-white hover:bg-[#104987]" href="/admin_ben/modules/dolibarr">
                  Configurer Dolibarr
                </Link>
                <a className="text-sm font-medium text-[#1457a6] underline" href={module.download} download>
                  Telecharger le module
                </a>
              </div>
            </div>
          </Card>
        ))}
        <div className="flex min-h-72 flex-col items-center justify-center rounded-xl border border-dashed border-[#cbd5df] bg-[#f8fafc] px-6 py-8 text-center">
          <span className="flex size-10 items-center justify-center rounded-full bg-white text-xl text-[#667085] shadow-sm" aria-hidden="true">+</span>
          <h2 className="mt-3 text-sm font-semibold text-[#344054]">D'autres modules arrivent</h2>
          <p className="mt-1 max-w-xs text-sm leading-5 text-[#667085]">Les prochaines integrations apparaitront ici au fur et a mesure.</p>
        </div>
      </section>
    </BlockStack>
  );
}
