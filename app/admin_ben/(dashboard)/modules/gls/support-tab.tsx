"use client";

import { useEffect, useState } from "react";
import { Badge, BlockStack, Button, Card, InlineStack, Text } from "@shopify/polaris";
import { glsCall } from "./gls-api";

type Status = { mode: "sandbox" | "live"; configured: boolean; sandbox: { server: string; authMode: string }; live: { server: string; authMode: string } };

const PROBLEMS: Array<{ problem: string; answer: string }> = [
  { problem: "« Identifiant et/ou mot de passe Web API incorrect(s) »", answer: "Reprenez l’identifiant et le mot de passe Web API du compte GLS (onglet Compte GLS). Laissez le serveur sur « Automatique » : le bon serveur est trouvé au premier test." },
  { problem: "« Le Contact ID est invalide »", answer: "Vérifiez le Contact ID de votre compte expéditeur dans l’onglet Compte GLS, puis utilisez « Valider un envoi test »." },
  { problem: "« Le point relais choisi n’est plus disponible »", answer: "Le point relais a fermé ou changé : demandez au client de choisir un autre point, ou saisissez un autre identifiant dans l’étiquette de la commande." },
  { problem: "« L’adresse e-mail de la commande est invalide ou manquante »", answer: "GLS exige un e-mail pour les livraisons en point relais en France. Complétez-le dans le formulaire d’expédition de la commande." },
  { problem: "Le client ne voit pas le choix du point relais", answer: "Vérifiez dans l’onglet Transporteurs que le transporteur est du type « GLS Relais », qu’il est actif et que la zone du client est desservie." },
  { problem: "Une étiquette de test a été créée par erreur", answer: "Ouvrez la commande et cliquez sur Annuler dans la carte « Expédition GLS » : le colis n’est plus pris en charge." },
];

export function SupportTab() {
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => {
    let cancelled = false;
    glsCall<Status>("")
      .then((loaded) => {
        if (!cancelled) setStatus(loaded);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const active = status ? status[status.mode] : null;

  return (
    <BlockStack gap="400">
      <Card>
        <BlockStack gap="300">
          <Text as="h3" variant="headingMd">Besoin d’aide ?</Text>
          <Text as="p" variant="bodyMd">Pour un problème de compte, de contrat ou d’activation du webservice, contactez votre interlocuteur GLS : c’est GLS qui active l’accès. Pour une erreur affichée par ce module, regardez d’abord l’onglet Journal.</Text>
          <InlineStack gap="200">
            <Button url="https://gls-group.eu/EU/en/contact-form" external>Contacter GLS</Button>
            <Button url="https://shipit.gls-group.eu/" external>Documentation ShipIT</Button>
          </InlineStack>
        </BlockStack>
      </Card>

      <Card>
        <BlockStack gap="200">
          <Text as="h3" variant="headingMd">État du module</Text>
          {status && active ? (
            <InlineStack gap="200" blockAlign="center">
              <Badge tone={status.configured ? "success" : "warning"}>{status.configured ? "Compte configuré" : "Compte incomplet"}</Badge>
              <Badge tone={status.mode === "live" ? "success" : "attention"}>{status.mode === "live" ? "Production" : "Test"}</Badge>
              <Text as="span" variant="bodySm" tone="subdued">
                Connexion : {active.authMode === "PORTAL" ? "clé du portail GLS" : "identifiant ShipIT"}
                {active.authMode !== "PORTAL" ? ` · serveur ${active.server ? (active.server === "fr02" ? "2 (fr02)" : "1 (fr01)") : "à détecter au premier test"}` : ""}
              </Text>
            </InlineStack>
          ) : (
            <Text as="p" variant="bodySm" tone="subdued">Chargement…</Text>
          )}
        </BlockStack>
      </Card>

      <Card>
        <BlockStack gap="300">
          <Text as="h3" variant="headingMd">Problèmes fréquents</Text>
          {PROBLEMS.map((item) => (
            <BlockStack key={item.problem} gap="050">
              <Text as="p" variant="bodyMd" fontWeight="semibold">{item.problem}</Text>
              <Text as="p" variant="bodyMd" tone="subdued">{item.answer}</Text>
            </BlockStack>
          ))}
        </BlockStack>
      </Card>
    </BlockStack>
  );
}
