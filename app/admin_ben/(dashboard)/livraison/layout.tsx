"use client";

import { useRouter, usePathname } from "next/navigation";
import { BlockStack, Box, Divider, Tabs, Text } from "@shopify/polaris";

const TABS = [
  { id: "transporteurs", content: "Transporteurs", href: "/admin_ben/livraison/transporteurs", accessibilityLabel: "Transporteurs", panelID: "livraison-panel" },
  { id: "preferences", content: "Préférences", href: "/admin_ben/livraison/preferences", accessibilityLabel: "Préférences", panelID: "livraison-panel" },
  { id: "poids", content: "Poids des produits", href: "/admin_ben/livraison/poids", accessibilityLabel: "Poids des produits", panelID: "livraison-panel" },
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
      <Tabs tabs={TABS} selected={selected} onSelect={(index) => router.push(TABS[index].href)} />
      <Divider />
      <div id="livraison-panel" role="tabpanel">{children}</div>
    </BlockStack>
  );
}
