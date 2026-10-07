"use client";

import { Badge, BlockStack, Button, Text } from '@shopify/polaris';
import DolibarrConfigForm from '../dolibarr-config-form';

export default function DolibarrModulePage() {
  return <BlockStack gap="500">
    <div className="border-b border-[#dce4ea] pb-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap items-center gap-3"><Text as="h1" variant="heading2xl">Dolibarr</Text><Badge tone="info">ERP · Synchronisation REST</Badge></div><Button url="/downloads/fgmcsync-1.0.7.zip">Installer le module Dolibarr 1.0.7</Button></div>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-[#667085]">Reliez FGMC à Dolibarr pour synchroniser le catalogue, les variantes, les clients, les commandes, le stock et les factures.</p>
    </div>
    <DolibarrConfigForm />
  </BlockStack>;
}
