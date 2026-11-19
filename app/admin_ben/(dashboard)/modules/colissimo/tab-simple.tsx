"use client";

import { BlockStack, Button, Card, InlineStack, Text } from "@shopify/polaris";
import { ExternalIcon } from "@shopify/polaris-icons";
import { Group, Panel, Text as Field, useColissimo, useForm } from "./cm-kit";
import { patch, type ModuleConfig } from "./colissimo-api";

const LINKS = {
  delivery_details: "https://www.colissimo.entreprise.laposte.fr/fr/possibilites",
  subscribe: "https://www.colissimo.entreprise.laposte.fr/nos-contrats",
};

const STEPS: Array<{ title: string; text: string; points?: string[] }> = [
  { title: "Un contrat Colissimo", text: "Le module fonctionne avec les contrats « Facilité » et « Privilège »." },
  { title: "Connexion de la boutique", text: "Renseignez votre identifiant et votre mot de passe, ou votre clé de connexion, dans Compte et adresses." },
  { title: "Affichage des points de retrait", text: "Choisissez le widget, les couleurs et les filtres que vos clients voient au paiement." },
  {
    title: "Gestion des commandes",
    text: "Depuis votre back-office :",
    points: ["Éditer les étiquettes", "Exporter les commandes vers Coliship", "Imprimer les documents douaniers", "Activer les étiquettes retour", "Éditer le bordereau de dépôt"],
  },
];

/** Presentation section. */
export function TabIntro() {
  return (
    <Card>
      <BlockStack gap="500">
        <BlockStack gap="200">
          <Text as="h2" variant="headingLg">Colissimo, le service de livraison de La Poste</Text>
          <Text as="p" variant="bodyMd" tone="subdued">
            Proposez à vos clients la livraison à domicile ou en point de retrait, en France et à l’international, et gérez vos envois depuis la boutique.
          </Text>
          <InlineStack gap="200">
            <Button variant="primary" url={LINKS.subscribe} external icon={ExternalIcon}>Souscrire à Colissimo</Button>
            <Button url={LINKS.delivery_details} external icon={ExternalIcon}>Voir les solutions de livraison</Button>
          </InlineStack>
        </BlockStack>
        <ol className="cm-steps" aria-label="Pour démarrer">
          {STEPS.map((step) => (
            <li key={step.title}>
              <BlockStack gap="100">
                <Text as="h3" variant="headingSm">{step.title}</Text>
                <Text as="p" variant="bodyMd" tone="subdued">{step.text}</Text>
                {step.points ? <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>{step.points.map((point) => <li key={point}><Text as="span" variant="bodyMd">{point}</Text></li>)}</ul> : null}
              </BlockStack>
            </li>
          ))}
        </ol>
      </BlockStack>
    </Card>
  );
}

const VIDEOS: Array<[string, string, string]> = [
  ["Présentation générale du module", "https://www.youtube.com/watch?v=JlmFF34h4-g", "general"],
  ["Configuration des transporteurs", "https://www.youtube.com/watch?v=V5gujqhUXUY", "transporteurs"],
  ["Affranchissement des commandes", "https://www.youtube.com/watch?v=YzYycjQHGdk", "affranchissement"],
  ["Commande en point de retrait", "https://www.youtube.com/watch?v=O14Gmds1ZyM", "commande_pdr"],
  ["Commande avec CN23", "https://www.youtube.com/watch?v=XAQY6Lp3Cpw", "cn23"],
  ["Multi-colis", "https://www.youtube.com/watch?v=2bhA7i6AHLE", "multicolis"],
  ["Suivi des colis", "https://www.youtube.com/watch?v=YoZZJkqyR8k", "suivicolis"],
  ["Option DDP", "https://www.youtube.com/watch?v=31PmM0ScF6Q", "ddp"],
  ["Douane 2021", "https://www.youtube.com/watch?v=gTlHscCyH5M", "douane2021"],
  ["Générer un bordereau de dépôt", "https://www.youtube.com/watch?v=3wPvCovGBT0", "bordereaudepot"],
  ["Kit d’impression thermique", "https://www.youtube.com/watch?v=XqF4jtC9svU", "impression_thermique"],
  ["Retour Colissimo", "https://www.youtube.com/watch?v=zwVWXr7BM50", "retours"],
];

/** Tutorials section. */
export function TabVideos() {
  return (
    <Card>
      <BlockStack gap="400">
        <Text as="h2" variant="headingMd">Tutoriels vidéo</Text>
        <div className="cm-videos">
          {VIDEOS.map(([title, url, image]) => (
            <a key={image} className="cm-video" href={url} target="_blank" rel="noopener noreferrer" aria-label={`${title} (ouvre YouTube)`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/colissimo/videos/${image}.jpeg`} alt="" loading="lazy" width={320} height={180} />
              <Text as="span" variant="bodyMd" fontWeight="medium">{title}</Text>
            </a>
          ))}
        </div>
      </BlockStack>
    </Card>
  );
}

const formatBytes = (bytes: number) => (bytes >= 1048576 ? `${(bytes / 1048576).toFixed(2).replace(".", ",")} Mo` : bytes >= 1024 ? `${(bytes / 1024).toFixed(1).replace(".", ",")} Ko` : `${bytes} o`);

/** Files section. */
export function TabFiles() {
  const { config } = useColissimo();
  const form = useForm({ COLISSIMO_FILES_LIMIT: String(config.values.COLISSIMO_FILES_LIMIT), COLISSIMO_FILES_LIFETIME: String(config.values.COLISSIMO_FILES_LIFETIME) }, (values) => patch<ModuleConfig>("/config/files", values));
  return (
    <Panel
      title="Gestion des fichiers"
      description="Les étiquettes, documents douaniers et bordereaux prennent de la place. Réglez quand être alerté pour les supprimer. Les valeurs par défaut correspondent à environ 50 commandes par jour : l’alerte apparaît toutes les deux semaines, sur la page Affranchissement."
      onSave={() => void form.submit()}
      saving={form.saving}
      dirty={form.dirty}>
      <Group label="Nombre de fichiers déclenchant l’alerte" tip="Les fichiers comprennent les étiquettes, les documents douaniers et les bordereaux de dépôt" htmlFor="files-limit">
        <Field id="files-limit" size="sm" addon="fichiers" value={form.values.COLISSIMO_FILES_LIMIT} onChange={(value) => form.set("COLISSIMO_FILES_LIMIT", value)} />
      </Group>
      <Group label="Durée de conservation" tip="Nombre de jours pendant lesquels vous gardez les documents" htmlFor="files-life" help="Les documents plus anciens que cette durée seront supprimés.">
        <Field id="files-life" size="sm" addon="jours" value={form.values.COLISSIMO_FILES_LIFETIME} onChange={(value) => form.set("COLISSIMO_FILES_LIFETIME", value)} />
      </Group>
      <Group label="Espace utilisé par les documents">
        <Text as="p" variant="bodyMd"><span className="cm-num">{formatBytes(config.documents.bytes)}</span> dans {config.documents.count} fichier{config.documents.count > 1 ? "s" : ""}</Text>
      </Group>
    </Panel>
  );
}
