"use client";

import { useEffect, useState } from "react";
import { Banner, BlockStack, Box, Checkbox, ChoiceList, InlineGrid, SkeletonBodyText, Text, TextField } from "@shopify/polaris";
import { shippingAdmin, type Carrier, type ProductShippingInput } from "@/lib/api/shipping-admin";

export const EMPTY_PRODUCT_SHIPPING: ProductShippingInput = {
  widthCm: 0,
  heightCm: 0,
  depthCm: 0,
  weightKg: 0,
  deliveryMode: "DEFAULT",
  deliveryInStock: "",
  deliveryOutOfStock: "",
  extraFee: 0,
  carrierIds: [],
};

/** Text fields hold what is typed; the numbers are parsed when the value goes up. */
function NumberField({ label, unit, value, onChange }: { label: string; unit: string; value: number; onChange: (value: number) => void }) {
  const [text, setText] = useState(String(value));
  const [seen, setSeen] = useState(value);
  // A value loaded from the server replaces what is displayed; typing does not.
  if (value !== seen) {
    setSeen(value);
    if (Number(text.replace(",", ".")) !== value) setText(String(value));
  }
  return (
    <TextField
      label={label}
      autoComplete="off"
      inputMode="decimal"
      suffix={unit}
      value={text}
      onChange={(next) => {
        setText(next);
        const parsed = Number(next.replace(",", "."));
        const clean = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
        setSeen(clean);
        onChange(clean);
      }}
    />
  );
}

/** The Livraison tab of a product, laid out like PrestaShop's Shipping tab. The parent saves it with the product. */
export function ProductShippingTab({ value, onChange, loading }: { value: ProductShippingInput; onChange: (value: ProductShippingInput) => void; loading: boolean }) {
  const [carriers, setCarriers] = useState<Carrier[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    shippingAdmin
      .carriers()
      .then((list) => {
        if (!cancelled) setCarriers(list);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Chargement des transporteurs impossible.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const set = <K extends keyof ProductShippingInput>(key: K, next: ProductShippingInput[K]) => onChange({ ...value, [key]: next });
  const toggleCarrier = (id: string, on: boolean) => set("carrierIds", on ? [...value.carrierIds, id] : value.carrierIds.filter((existing) => existing !== id));

  if (loading) return <SkeletonBodyText lines={8} />;

  return (
    <BlockStack gap="600">
      <BlockStack gap="300">
        <BlockStack gap="100">
          <Text as="h3" variant="headingMd">Dimensions du colis</Text>
          <Text as="p" variant="bodySm" tone="subdued">Ajustez vos frais de livraison en renseignant les dimensions et le poids du produit.</Text>
        </BlockStack>
        <InlineGrid columns={{ xs: 1, sm: 2, lg: 4 }} gap="400">
          <NumberField label="Largeur" unit="cm" value={value.widthCm} onChange={(n) => set("widthCm", n)} />
          <NumberField label="Hauteur" unit="cm" value={value.heightCm} onChange={(n) => set("heightCm", n)} />
          <NumberField label="Profondeur" unit="cm" value={value.depthCm} onChange={(n) => set("depthCm", n)} />
          <NumberField label="Poids" unit="kg" value={value.weightKg} onChange={(n) => set("weightKg", n)} />
        </InlineGrid>
      </BlockStack>

      <BlockStack gap="300">
        <Text as="h3" variant="headingMd">Délai de livraison</Text>
        <ChoiceList
          title="Délai de livraison"
          titleHidden
          choices={[
            { label: "Aucun", value: "NONE" },
            { label: "Délai du transporteur choisi", value: "DEFAULT" },
            { label: "Délai spécifique à ce produit", value: "CUSTOM" },
          ]}
          selected={[value.deliveryMode]}
          onChange={(selected) => set("deliveryMode", (selected[0] as ProductShippingInput["deliveryMode"]) ?? "DEFAULT")}
        />
        {value.deliveryMode === "CUSTOM" ? (
          <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
            <TextField label="Délai des produits en stock" autoComplete="off" maxLength={120} placeholder="Livré sous 3 à 4 jours" value={value.deliveryInStock} onChange={(v) => set("deliveryInStock", v)} helpText="Laissez vide pour ne rien afficher." />
            <TextField label="Délai des produits en rupture avec commande autorisée" autoComplete="off" maxLength={120} placeholder="Livré sous 5 à 7 jours" value={value.deliveryOutOfStock} onChange={(v) => set("deliveryOutOfStock", v)} helpText="Laissez vide pour ne rien afficher." />
          </InlineGrid>
        ) : null}
      </BlockStack>

      <BlockStack gap="300">
        <Text as="h3" variant="headingMd">Frais de livraison</Text>
        <Box maxWidth="320px">
          <NumberField label="Ce produit entraîne-t-il des frais de livraison supplémentaires ?" unit="€" value={value.extraFee} onChange={(n) => set("extraFee", n)} />
        </Box>
        <Text as="p" variant="bodySm" tone="subdued">Ce montant s’ajoute au prix du transporteur pour chaque exemplaire commandé, sauf si la livraison est gratuite.</Text>
      </BlockStack>

      <BlockStack gap="300">
        <Text as="h3" variant="headingMd">Transporteurs disponibles</Text>
        {error ? (
          <Banner tone="critical" title="Transporteurs indisponibles"><p>{error}</p></Banner>
        ) : !carriers ? (
          <SkeletonBodyText lines={4} />
        ) : carriers.length === 0 ? (
          <Banner tone="info" title="Aucun transporteur" action={{ content: "Ajouter un transporteur", url: "/admin_ben/livraison/transporteurs/nouveau" }}>
            <p>Créez d’abord vos transporteurs dans Livraison.</p>
          </Banner>
        ) : (
          <BlockStack gap="100">
            {carriers.map((carrier) => (
              <Checkbox
                key={carrier.id}
                label={carrier.transitTime ? `${carrier.name} (${carrier.transitTime})` : carrier.name}
                checked={value.carrierIds.includes(carrier.id)}
                onChange={(on) => toggleCarrier(carrier.id, on)}
              />
            ))}
          </BlockStack>
        )}
        <Banner tone="warning"><p>Si aucun transporteur n’est coché, tous les transporteurs sont disponibles pour les commandes de ce produit.</p></Banner>
      </BlockStack>
    </BlockStack>
  );
}
