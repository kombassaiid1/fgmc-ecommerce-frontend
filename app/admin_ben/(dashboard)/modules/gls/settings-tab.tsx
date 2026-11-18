"use client";

import { useEffect, useState } from "react";
import { Banner, BlockStack, Button, Card, Checkbox, FormLayout, InlineGrid, SkeletonBodyText, Text, TextField } from "@shopify/polaris";
import { toast } from "sonner";
import { glsCall, type GlsSettings } from "./gls-api";

const RELAY_TYPES: Array<{ value: GlsSettings["relayTypes"][number]; label: string; help: string }> = [
  { value: "SHOP", label: "Commerces partenaires", help: "Tabacs, boulangeries, supérettes : les points relais classiques." },
  { value: "LOCKER", label: "Consignes automatiques", help: "Casiers en libre-service, accessibles avec un code." },
  { value: "KEEPER", label: "GLS Keeper", help: "Points relais tenus par un particulier." },
];

export function SettingsTab() {
  const [settings, setSettings] = useState<GlsSettings | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    let cancelled = false;
    glsCall<GlsSettings>("/settings")
      .then((loaded) => {
        if (!cancelled) setSettings(loaded);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Chargement impossible.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <Banner tone="critical" title="Impossible de charger les réglages">{error}</Banner>;
  if (!settings) return <Card><SkeletonBodyText lines={8} /></Card>;

  const update = (next: GlsSettings) => {
    setSettings(next);
    setDirty(true);
  };
  const alt = settings.alternativeShipper;
  const setAlt = (patch: Partial<GlsSettings["alternativeShipper"]>) => update({ ...settings, alternativeShipper: { ...alt, ...patch } });

  async function save() {
    if (!settings) return;
    setSaving(true);
    try {
      setSettings(await glsCall<GlsSettings>("/settings", { method: "PATCH", body: JSON.stringify(settings) }));
      setDirty(false);
      toast.success("Réglages GLS enregistrés.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <BlockStack gap="400">
      <Card>
        <BlockStack gap="300">
          <BlockStack gap="050">
            <Text as="h3" variant="headingMd">Points relais proposés au client</Text>
            <Text as="p" variant="bodySm" tone="subdued">Limitez la recherche aux types de points relais que vous voulez offrir.</Text>
          </BlockStack>
          {RELAY_TYPES.map((type) => (
            <Checkbox
              key={type.value}
              label={type.label}
              helpText={type.help}
              checked={settings.relayTypes.includes(type.value)}
              onChange={(on) => update({ ...settings, relayTypes: on ? [...settings.relayTypes, type.value] : settings.relayTypes.filter((value) => value !== type.value) })}
            />
          ))}
          <Text as="p" variant="bodySm" tone="subdued">L’option « Afficher uniquement les relais XL » se règle dans l’onglet Transporteurs, avec le service Relais.</Text>
        </BlockStack>
      </Card>

      <Card>
        <BlockStack gap="300">
          <BlockStack gap="050">
            <Text as="h3" variant="headingMd">Adresse d’expéditeur sur les étiquettes</Text>
            <Text as="p" variant="bodySm" tone="subdued">Par défaut, GLS imprime l’adresse de votre compte. Activez ceci pour en imprimer une autre, par exemple celle de votre entrepôt.</Text>
          </BlockStack>
          <Checkbox label="Utiliser une autre adresse d’expéditeur" checked={alt.enabled} onChange={(on) => setAlt({ enabled: on })} />
          {alt.enabled ? (
            <FormLayout>
              <FormLayout.Group>
                <TextField label="Nom" autoComplete="off" maxLength={40} value={alt.name} onChange={(value) => setAlt({ name: value })} />
                <TextField label="Complément de nom" autoComplete="off" maxLength={40} value={alt.name2} onChange={(value) => setAlt({ name2: value })} />
              </FormLayout.Group>
              <TextField label="Adresse" autoComplete="off" maxLength={40} value={alt.street} onChange={(value) => setAlt({ street: value })} />
              <InlineGrid columns={{ xs: 1, sm: 3 }} gap="300">
                <TextField label="Code postal" autoComplete="off" maxLength={10} value={alt.zip} onChange={(value) => setAlt({ zip: value })} />
                <TextField label="Ville" autoComplete="off" maxLength={40} value={alt.city} onChange={(value) => setAlt({ city: value })} />
                <TextField label="Pays (2 lettres)" autoComplete="off" maxLength={2} value={alt.country} onChange={(value) => setAlt({ country: value })} />
              </InlineGrid>
              <FormLayout.Group>
                <TextField label="E-mail" type="email" autoComplete="off" maxLength={80} value={alt.email} onChange={(value) => setAlt({ email: value })} />
                <TextField label="Personne à contacter" autoComplete="off" maxLength={40} value={alt.contact} onChange={(value) => setAlt({ contact: value })} />
              </FormLayout.Group>
              <FormLayout.Group>
                <TextField label="Téléphone" autoComplete="off" maxLength={35} value={alt.phone} onChange={(value) => setAlt({ phone: value })} />
                <TextField label="Mobile" autoComplete="off" maxLength={35} value={alt.mobile} onChange={(value) => setAlt({ mobile: value })} />
              </FormLayout.Group>
            </FormLayout>
          ) : null}
        </BlockStack>
      </Card>

      <div>
        <Button variant="primary" onClick={() => void save()} loading={saving} disabled={!dirty}>Enregistrer les réglages</Button>
      </div>
    </BlockStack>
  );
}
