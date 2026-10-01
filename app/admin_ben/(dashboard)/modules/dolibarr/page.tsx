"use client";

import Link from "next/link";
import { Badge, BlockStack, Text } from "@shopify/polaris";
import DolibarrConfigForm from "../dolibarr-config-form";

export default function DolibarrModulePage() {
  return (
    <BlockStack gap="500">
      <div className="border-b border-[#dce4ea] pb-5">
        <Link href="/admin_ben/modules" className="text-sm font-medium text-[#1457a6] hover:underline">← Modules</Link>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Text as="h1" variant="heading2xl">Dolibarr</Text>
          <Badge tone="info">ERP · Synchronisation</Badge>
        </div>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#667085]">
          Configurez l'URL, la cle Web Services et les identifiants de connexion Dolibarr, puis choisissez les donnees a synchroniser.
        </p>
      </div>

      <DolibarrConfigForm />

      <aside className="rounded-xl border border-[#dce4ea] bg-[#f8fafc] p-4 text-sm leading-6 text-[#475467]">
        <h2 className="font-semibold text-[#24364b]">Configuration initiale dans Dolibarr</h2>
        <p className="mt-1">Installez le module FGMC Sync, puis collez l'URL API de la boutique et le meme token dans ses parametres. Le module recuperera ensuite les identifiants et les choix de synchronisation depuis cette page.</p>
      </aside>
    </BlockStack>
  );
}
