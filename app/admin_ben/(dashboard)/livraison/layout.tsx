"use client";

import { useRouter, usePathname } from "next/navigation";
import { BlockStack, Box, Text } from "@shopify/polaris";
import { TabBar } from "../tab-bar";

const TABS = [
  { id: "transporteurs", label: "Transporteurs", href: "/admin_ben/livraison/transporteurs" },
  { id: "preferences", label: "Préférences", href: "/admin_ben/livraison/preferences" },
  { id: "poids", label: "Poids des produits", href: "/admin_ben/livraison/poids" },
];

export default function LivraisonLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const selected = Math.max(0, TABS.findIndex((tab) => pathname === tab.href || pathname.startsWith(`${tab.href}/`)));

  return (
    <BlockStack gap="400">
      <BlockStack gap="100">
        <Text as="h1" variant="headingXl">Livraison</Text>
        <Box maxWidth="720px">
          <Text as="p" variant="bodyMd" tone="subdued">
            Définissez vos transporteurs et leurs tarifs. Chaque client ne voit que les transporteurs qui livrent son pays, au prix qui correspond à sa commande. Les zones se gèrent dans International, Zones géographiques.
          </Text>
        </Box>
      </BlockStack>
      <TabBar tabs={TABS} selected={selected} onSelect={(index) => router.push(TABS[index].href)} label="Livraison" panelId="livraison-panel" />
      <div id="livraison-panel" role="tabpanel" aria-labelledby={`livraison-panel-tab-${TABS[selected].id}`}>{children}</div>
    </BlockStack>
  );
}
