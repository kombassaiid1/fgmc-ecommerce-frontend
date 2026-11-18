"use client";

import { Badge, BlockStack, Card, InlineStack, Text } from "@shopify/polaris";

const AVAILABLE = [
  "Mise en place des offres GLS sur votre boutique : Chez vous, Relais, Chez vous + et Avant 13h, chacune sur le transporteur de votre choix (onglet Transporteurs).",
  "Chargement des points relais GLS en temps réel au paiement, grâce au webservice GLS : le client cherche près de chez lui et choisit son point relais.",
  "Numéro de mobile demandé pour les livraisons en point relais et Chez vous +, afin que GLS prévienne le client par SMS.",
  "Création des étiquettes de livraison directement depuis chaque commande, avec le point relais déjà renseigné, et annulation d’une expédition.",
  "Suivi des colis : dernier statut et historique des événements, depuis la commande.",
  "Journal des échanges avec GLS pour comprendre une erreur (onglet Journal).",
];

const PLANNED = [
  "Export des commandes pour la solution d’étiquetage WinExpé et import du suivi par FTP.",
  "Liste de colisage (bordereau de remise) en PDF.",
  "Changement automatique du statut de la commande selon l’avancement du colis, et page de suivi pour le client.",
  "Frais supplémentaires selon la destination (Corse, îles, montagne) et délais de livraison par code postal.",
];

export function PresentationTab() {
  return (
    <Card>
      <BlockStack gap="500">
        <BlockStack gap="150">
          <Text as="h2" variant="headingLg">Bienvenue dans le module GLS</Text>
          <Text as="p" variant="bodyMd" tone="subdued">
            GLS, votre expert de la livraison : toutes les offres GLS France disponibles pour vos clients, qui choisissent le mode de livraison qui leur convient.
          </Text>
        </BlockStack>

        <BlockStack gap="200">
          <InlineStack gap="200" blockAlign="center">
            <Text as="h3" variant="headingMd">Disponible</Text>
            <Badge tone="success">En service</Badge>
          </InlineStack>
          <ul style={{ margin: 0, paddingLeft: "1.25rem", display: "grid", gap: "0.5rem" }}>
            {AVAILABLE.map((line) => (
              <li key={line}><Text as="span" variant="bodyMd">{line}</Text></li>
            ))}
          </ul>
        </BlockStack>

        <BlockStack gap="200">
          <InlineStack gap="200" blockAlign="center">
            <Text as="h3" variant="headingMd">Pas encore disponible</Text>
            <Badge>À venir</Badge>
          </InlineStack>
          <ul style={{ margin: 0, paddingLeft: "1.25rem", display: "grid", gap: "0.5rem" }}>
            {PLANNED.map((line) => (
              <li key={line}><Text as="span" variant="bodyMd" tone="subdued">{line}</Text></li>
            ))}
          </ul>
        </BlockStack>

        <Text as="p" variant="bodySm" tone="subdued">Pour commencer : renseignez votre compte dans l’onglet Compte GLS, puis indiquez le type GLS de vos transporteurs dans l’onglet Transporteurs.</Text>
      </BlockStack>
    </Card>
  );
}
