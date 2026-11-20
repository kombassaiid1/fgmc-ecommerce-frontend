"use client";

import { BlockStack, Banner, Card, InlineGrid, Link, Text } from "@shopify/polaris";

const SECTIONS = [
  {
    title: "Page builder",
    description:
      "Composez la page d'accueil avec des blocs : hero, offres du jour, produits en vedette et disposition des images.",
    url: "/admin_ben/page-builder",
  },
  {
    title: "Header",
    description: "Logo, liens de navigation et réseaux sociaux de l'en-tête.",
    url: "/admin_ben/apparence/header",
  },
  {
    title: "Footer",
    description: "Couleurs, colonnes de liens, bandeau d'appel et mentions du pied de page.",
    url: "/admin_ben/apparence/footer",
  },
  {
    title: "Médiathèque",
    description: "Images, PDF et autres fichiers utilisés sur la boutique.",
    url: "/admin_ben/apparence/media",
  },
];

export default function AdminAppearancePage() {
  return (
    <BlockStack gap="400">
      <BlockStack gap="100">
        <Text as="h1" variant="headingLg">Apparence</Text>
        <Text as="p" tone="subdued">Personnalisez l&apos;aspect de la boutique.</Text>
      </BlockStack>

      <Banner tone="info" title="La disposition des images d'accueil et les produits en vedette sont dans le page builder">
        <p>
          Ajoutez les blocs « Disposition des images » et « Produits en vedette » depuis le{" "}
          <Link url="/admin_ben/page-builder">page builder</Link>.
        </p>
      </Banner>

      <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
        {SECTIONS.map((section) => (
          <Card key={section.url}>
            <BlockStack gap="150">
              <Text as="h2" variant="headingMd">
                <Link url={section.url} removeUnderline>{section.title}</Link>
              </Text>
              <Text as="p" tone="subdued">{section.description}</Text>
            </BlockStack>
          </Card>
        ))}
      </InlineGrid>
    </BlockStack>
  );
}
