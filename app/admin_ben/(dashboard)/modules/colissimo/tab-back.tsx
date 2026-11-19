"use client";

import { useEffect, useState } from "react";
import { BlockStack, ChoiceList, FormLayout, Select as PolarisSelect, Text as PolarisText, TextField } from "@shopify/polaris";
import { orderStatesApi } from "@/lib/api/order-states";
import { Alert, Group, Panel, YesNo, asBool, asText, useColissimo, useForm } from "./cm-kit";
import { COUNTRY_NAMES, patch, type ModuleConfig } from "./colissimo-api";

const money = (label: string, value: string, onChange: (value: string) => void, suffix: string, help?: string) => (
  <TextField label={label} suffix={suffix} value={value} onChange={onChange} autoComplete="off" inputMode="decimal" helpText={help} />
);

/* ---------------------------------------------------------------- */

function OrdersForm() {
  const { config } = useColissimo();
  const c = config.values;
  const [states, setStates] = useState<Array<{ value: string; label: string }>>(config.orderStates.map((key) => ({ value: key, label: key })));
  useEffect(() => {
    let cancelled = false;
    orderStatesApi.list().then((rows) => !cancelled && setStates(rows.map((row) => ({ value: row.key, label: row.name })))).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const form = useForm(
    {
      COLISSIMO_ORDER_PREPARATION_TIME: asText(c.COLISSIMO_ORDER_PREPARATION_TIME),
      statuses: config.structured.generateLabelStatuses,
      COLISSIMO_USE_SHIPPING_IN_PROGRESS: asBool(c.COLISSIMO_USE_SHIPPING_IN_PROGRESS),
      COLISSIMO_USE_HANDLED_BY_CARRIER: asBool(c.COLISSIMO_USE_HANDLED_BY_CARRIER),
      COLISSIMO_USE_DELIVERED_PICKUP_ORDER: asBool(c.COLISSIMO_USE_DELIVERED_PICKUP_ORDER),
      COLISSIMO_ENABLE_PNA_MAIL: asBool(c.COLISSIMO_ENABLE_PNA_MAIL),
      COLISSIMO_DISPLAY_TRACKING_NUMBER: asBool(c.COLISSIMO_DISPLAY_TRACKING_NUMBER),
    },
    async ({ statuses, ...rest }) => {
      await patch<ModuleConfig>("/generate-statuses", { statuses });
      return patch<ModuleConfig>("/config/orders", rest);
    },
  );
  const v = form.values;
  return (
    <Panel title="Commandes et statuts" description="Quand une commande peut recevoir une étiquette, et comment son statut évolue." onSave={() => void form.submit()} saving={form.saving} dirty={form.dirty}>
      <TextField label="Délai de préparation" suffix="jours" value={v.COLISSIMO_ORDER_PREPARATION_TIME} onChange={(value) => form.set("COLISSIMO_ORDER_PREPARATION_TIME", value)} autoComplete="off" inputMode="numeric" helpText="Le temps dont vous avez besoin pour préparer une commande." />
      <BlockStack gap="150">
        <PolarisText as="h3" variant="headingSm">Statuts autorisant l’étiquette</PolarisText>
        <PolarisText as="p" variant="bodySm" tone="subdued">Si aucun statut n’est coché, tous les statuts sont autorisés.</PolarisText>
        <div style={{ maxHeight: 260, overflow: "auto", padding: "var(--p-space-100)" }}>
          <ChoiceList allowMultiple title="Statuts" titleHidden choices={states} selected={v.statuses} onChange={(selected) => form.set("statuses", selected)} />
        </div>
      </BlockStack>
      <Group label="Passer la commande en « Expédition en cours » après l’étiquette" tip="Au moment de la première étiquette générée">
        <YesNo name="COLISSIMO_USE_SHIPPING_IN_PROGRESS" value={v.COLISSIMO_USE_SHIPPING_IN_PROGRESS} onChange={(on) => form.set("COLISSIMO_USE_SHIPPING_IN_PROGRESS", on)} />
      </Group>
      <Group label="Passer en « Pris en charge par le transporteur » après le bordereau de dépôt" tip="Au moment du premier bordereau généré">
        <YesNo name="COLISSIMO_USE_HANDLED_BY_CARRIER" value={v.COLISSIMO_USE_HANDLED_BY_CARRIER} onChange={(on) => form.set("COLISSIMO_USE_HANDLED_BY_CARRIER", on)} />
      </Group>
      <Group label="Passer en « Livré au point de retrait » à la livraison au point choisi">
        <YesNo name="COLISSIMO_USE_DELIVERED_PICKUP_ORDER" value={v.COLISSIMO_USE_DELIVERED_PICKUP_ORDER} onChange={(on) => form.set("COLISSIMO_USE_DELIVERED_PICKUP_ORDER", on)} />
      </Group>
      <Group label="Envoyer au client le lien de suivi après l’étiquette" help="E-mail avec l’adresse de la page de suivi non authentifiée.">
        <YesNo name="COLISSIMO_ENABLE_PNA_MAIL" value={v.COLISSIMO_ENABLE_PNA_MAIL} onChange={(on) => form.set("COLISSIMO_ENABLE_PNA_MAIL", on)} />
      </Group>
      <Group label="Afficher le numéro de suivi sur la page de la commande">
        <YesNo name="COLISSIMO_DISPLAY_TRACKING_NUMBER" value={v.COLISSIMO_DISPLAY_TRACKING_NUMBER} onChange={(on) => form.set("COLISSIMO_DISPLAY_TRACKING_NUMBER", on)} />
      </Group>
    </Panel>
  );
}

function PrintForm() {
  const { config } = useColissimo();
  const c = config.values;
  const form = useForm(
    {
      COLISSIMO_GENERATE_LABEL_PRESTASHOP: asBool(c.COLISSIMO_GENERATE_LABEL_PRESTASHOP),
      COLISSIMO_POSTAGE_MODE_MANUAL: asBool(c.COLISSIMO_POSTAGE_MODE_MANUAL),
      COLISSIMO_USE_THERMAL_PRINTER: asBool(c.COLISSIMO_USE_THERMAL_PRINTER),
      COLISSIMO_LABEL_FORMAT: asText(c.COLISSIMO_LABEL_FORMAT),
      COLISSIMO_CN23_FORMAT: asText(c.COLISSIMO_CN23_FORMAT),
      COLISSIMO_CN23_NUMBER: asText(c.COLISSIMO_CN23_NUMBER),
      COLISSIMO_ENABLE_QZ_TRAY: asBool(c.COLISSIMO_ENABLE_QZ_TRAY),
      COLISSIMO_USE_ETHERNET: asBool(c.COLISSIMO_USE_ETHERNET),
      COLISSIMO_USB_PROTOCOLE: asText(c.COLISSIMO_USB_PROTOCOLE),
      COLISSIMO_PRINTER_IP_ADDR: asText(c.COLISSIMO_PRINTER_IP_ADDR),
      COLISSIMO_LABEL_DISPLAY_REFERENCE: asBool(c.COLISSIMO_LABEL_DISPLAY_REFERENCE),
    },
    (values) => patch<ModuleConfig>("/config/print", values),
  );
  const v = form.values;
  const formatOptions = (ids: string[]) => ids.map((id) => ({ value: id, label: id.replace(/_/g, " ") }));
  return (
    <Panel title="Impression des étiquettes" description="Où et comment vous éditez vos étiquettes." onSave={() => void form.submit()} saving={form.saving} dirty={form.dirty}>
      <ChoiceList
        title="Mode d’impression"
        choices={[{ label: "Depuis la boutique", value: "shop", helpText: "Les étiquettes se créent dans ce module." }, { label: "Coliship", value: "coliship", helpText: "Vous exportez les commandes vers Coliship et importez les numéros d’expédition." }]}
        selected={[v.COLISSIMO_GENERATE_LABEL_PRESTASHOP ? "shop" : "coliship"]}
        onChange={([choice]) => form.set("COLISSIMO_GENERATE_LABEL_PRESTASHOP", choice === "shop")}
      />
      {v.COLISSIMO_GENERATE_LABEL_PRESTASHOP ? (
        <>
          <ChoiceList
            title="Affranchissement"
            choices={[{ label: "Manuel", value: "manual", helpText: "Vous choisissez les commandes dans la page Affranchissement." }, { label: "Automatique", value: "auto" }]}
            selected={[v.COLISSIMO_POSTAGE_MODE_MANUAL ? "manual" : "auto"]}
            onChange={([choice]) => form.set("COLISSIMO_POSTAGE_MODE_MANUAL", choice === "manual")}
          />
          <Group label="Imprimante thermique">
            <YesNo name="COLISSIMO_USE_THERMAL_PRINTER" value={v.COLISSIMO_USE_THERMAL_PRINTER} onChange={(on) => form.set("COLISSIMO_USE_THERMAL_PRINTER", on)} />
          </Group>
          <FormLayout>
            <FormLayout.Group>
              <PolarisSelect label="Format de l’étiquette" value={v.COLISSIMO_LABEL_FORMAT} onChange={(value) => form.set("COLISSIMO_LABEL_FORMAT", value)} options={formatOptions(config.lists.labelFormats)} />
              <PolarisSelect label="Format du CN23" value={v.COLISSIMO_CN23_FORMAT} onChange={(value) => form.set("COLISSIMO_CN23_FORMAT", value)} options={formatOptions(config.lists.cn23Formats)} />
              <PolarisSelect label="Nombre de CN23" value={v.COLISSIMO_CN23_NUMBER} onChange={(value) => form.set("COLISSIMO_CN23_NUMBER", value)} options={[1, 2, 3, 4].map((n) => ({ value: String(n), label: String(n) }))} />
            </FormLayout.Group>
          </FormLayout>
          <Group label="QZ Tray" help={<>Imprime en format thermique ou PDF avec vos propres pilotes d’imprimante. <a href="https://qz.io/download/" target="_blank" rel="noopener noreferrer">Télécharger QZ Tray</a>.{v.COLISSIMO_ENABLE_QZ_TRAY ? " La gestion du certificat de signature n’est pas encore disponible dans ce module." : ""}</>}>
            <YesNo name="COLISSIMO_ENABLE_QZ_TRAY" value={v.COLISSIMO_ENABLE_QZ_TRAY} onChange={(on) => form.set("COLISSIMO_ENABLE_QZ_TRAY", on)} />
          </Group>
          {v.COLISSIMO_USE_THERMAL_PRINTER && !v.COLISSIMO_ENABLE_QZ_TRAY ? (
            <BlockStack gap="300">
              <ChoiceList
                title="Port de l’imprimante"
                choices={[{ label: "Ethernet", value: "ethernet" }, { label: "USB", value: "usb" }]}
                selected={[v.COLISSIMO_USE_ETHERNET ? "ethernet" : "usb"]}
                onChange={([choice]) => form.set("COLISSIMO_USE_ETHERNET", choice === "ethernet")}
              />
              {v.COLISSIMO_USE_ETHERNET ? (
                <TextField label="Adresse IP de l’imprimante" value={v.COLISSIMO_PRINTER_IP_ADDR} onChange={(value) => form.set("COLISSIMO_PRINTER_IP_ADDR", value)} maxLength={60} autoComplete="off" />
              ) : (
                <PolarisSelect label="Protocole" value={v.COLISSIMO_USB_PROTOCOLE} onChange={(value) => form.set("COLISSIMO_USB_PROTOCOLE", value)} options={config.lists.usbProtocols.map((p) => ({ value: p, label: p }))} helpText="Si vous ne savez pas lequel choisir, consultez le manuel de votre imprimante." />
              )}
            </BlockStack>
          ) : null}
        </>
      ) : null}
      <Group label="Référence de la commande sur l’étiquette" help="Sinon, l’identifiant de la commande est imprimé.">
        <YesNo name="COLISSIMO_LABEL_DISPLAY_REFERENCE" value={v.COLISSIMO_LABEL_DISPLAY_REFERENCE} onChange={(on) => form.set("COLISSIMO_LABEL_DISPLAY_REFERENCE", on)} />
      </Group>
    </Panel>
  );
}

function InternationalForm() {
  const { config } = useColissimo();
  const c = config.values;
  const form = useForm(
    {
      COLISSIMO_DEFAULT_ORIGIN_COUNTRY: asText(c.COLISSIMO_DEFAULT_ORIGIN_COUNTRY),
      COLISSIMO_DEFAULT_HS_CODE: asText(c.COLISSIMO_DEFAULT_HS_CODE),
      COLISSIMO_EORI_NUMBER: asText(c.COLISSIMO_EORI_NUMBER),
      COLISSIMO_EORI_NUMBER_UK: asText(c.COLISSIMO_EORI_NUMBER_UK),
      COLISSIMO_MID_CODE: asText(c.COLISSIMO_MID_CODE),
      COLISSIMO_CUSTOMS_REFERENCE: asText(c.COLISSIMO_CUSTOMS_REFERENCE),
      partners: config.structured.postalPartnerSelected,
    },
    async ({ partners, ...rest }) => {
      await patch<ModuleConfig>("/postal-partners", { countries: partners });
      return patch<ModuleConfig>("/config/international", rest);
    },
  );
  const v = form.values;
  const countries = Object.entries(COUNTRY_NAMES).sort((a, b) => a[1].localeCompare(b[1], "fr")).map(([value, label]) => ({ value, label }));
  const partnerChoices = config.lists.postalPartnerCountries.map((iso) => ({ value: iso, label: COUNTRY_NAMES[iso] ?? iso }));
  return (
    <Panel title="Envois internationaux" description="Les informations douanières imprimées sur le CN23 des envois hors Union européenne et outre-mer." onSave={() => void form.submit()} saving={form.saving} dirty={form.dirty}>
      <PolarisSelect label="Pays d’origine par défaut" value={v.COLISSIMO_DEFAULT_ORIGIN_COUNTRY} onChange={(value) => form.set("COLISSIMO_DEFAULT_ORIGIN_COUNTRY", value)} options={[{ value: "", label: "Choisir un pays" }, ...countries]} />
      <TextField label="Code SH par défaut de vos produits" value={v.COLISSIMO_DEFAULT_HS_CODE} onChange={(value) => form.set("COLISSIMO_DEFAULT_HS_CODE", value)} maxLength={12} autoComplete="off" helpText={<>Par exemple 620411. <a href="https://www.douane.gouv.fr/" target="_blank" rel="noopener noreferrer">douane.gouv.fr</a></>} />
      <FormLayout>
        <FormLayout.Group>
          <TextField label="Numéro EORI" value={v.COLISSIMO_EORI_NUMBER} onChange={(value) => form.set("COLISSIMO_EORI_NUMBER", value)} maxLength={30} autoComplete="off" helpText="Numéro EORI de l’expéditeur." />
          <TextField label="Numéro EORI Royaume-Uni" value={v.COLISSIMO_EORI_NUMBER_UK} onChange={(value) => form.set("COLISSIMO_EORI_NUMBER_UK", value)} maxLength={30} autoComplete="off" />
        </FormLayout.Group>
        <FormLayout.Group>
          <TextField label="Code MID" value={v.COLISSIMO_MID_CODE} onChange={(value) => form.set("COLISSIMO_MID_CODE", value)} maxLength={30} autoComplete="off" />
          <TextField label="Référence douanière" value={v.COLISSIMO_CUSTOMS_REFERENCE} onChange={(value) => form.set("COLISSIMO_CUSTOMS_REFERENCE", value)} maxLength={60} autoComplete="off" />
        </FormLayout.Group>
      </FormLayout>
      <BlockStack gap="150">
        <PolarisText as="h3" variant="headingSm">Partenaire postal par pays</PolarisText>
        <PolarisText as="p" variant="bodySm" tone="subdued">Pays pour lesquels le colis (offre DOS) est confié à un partenaire postal plutôt qu’à DPD.</PolarisText>
        <ChoiceList allowMultiple title="Pays" titleHidden choices={partnerChoices} selected={v.partners} onChange={(selected) => form.set("partners", selected)} />
      </BlockStack>
    </Panel>
  );
}

function PostageForm() {
  const { config } = useColissimo();
  const c = config.values;
  const form = useForm(
    {
      COLISSIMO_USE_WEIGHT_TARE: asBool(c.COLISSIMO_USE_WEIGHT_TARE),
      COLISSIMO_DEFAULT_WEIGHT_TARE: asText(c.COLISSIMO_DEFAULT_WEIGHT_TARE),
      COLISSIMO_INSURE_SHIPMENTS: asBool(c.COLISSIMO_INSURE_SHIPMENTS),
      COLISSIMO_DELIVERY_BLOCKING_CODE: asBool(c.COLISSIMO_DELIVERY_BLOCKING_CODE),
      COLISSIMO_BLOCKING_CODE_TOTAL_MIN: asText(c.COLISSIMO_BLOCKING_CODE_TOTAL_MIN),
      COLISSIMO_BLOCKING_CODE_TOTAL_MAX: asText(c.COLISSIMO_BLOCKING_CODE_TOTAL_MAX),
    },
    (values) => patch<ModuleConfig>("/config/postage", values),
  );
  const v = form.values;
  return (
    <Panel title="Affranchissement" description="Poids, assurance et livraison sécurisée appliqués à vos envois." onSave={() => void form.submit()} saving={form.saving} dirty={form.dirty}>
      <Group label="Ajouter une tare par défaut" help="Le poids de l’emballage, ajouté au poids des produits.">
        <YesNo name="COLISSIMO_USE_WEIGHT_TARE" value={v.COLISSIMO_USE_WEIGHT_TARE} onChange={(on) => form.set("COLISSIMO_USE_WEIGHT_TARE", on)} />
      </Group>
      {v.COLISSIMO_USE_WEIGHT_TARE ? money("Tare par défaut", v.COLISSIMO_DEFAULT_WEIGHT_TARE, (value) => form.set("COLISSIMO_DEFAULT_WEIGHT_TARE", value), "kg") : null}
      <Group label="Assurer les envois" tip="Assurance ad valorem : la valeur des produits">
        <YesNo name="COLISSIMO_INSURE_SHIPMENTS" value={v.COLISSIMO_INSURE_SHIPMENTS} onChange={(on) => form.set("COLISSIMO_INSURE_SHIPMENTS", on)} />
      </Group>
      <Group label="Code sécurisé à la livraison" help="Le client reçoit un code par e-mail la veille ou par SMS le matin de la livraison, et le donne au livreur pour récupérer son colis.">
        <YesNo name="COLISSIMO_DELIVERY_BLOCKING_CODE" value={v.COLISSIMO_DELIVERY_BLOCKING_CODE} onChange={(on) => form.set("COLISSIMO_DELIVERY_BLOCKING_CODE", on)} />
      </Group>
      {v.COLISSIMO_DELIVERY_BLOCKING_CODE ? (
        <>
          <Alert>Par défaut, la tranche de prix va de 0 € à 100 000 €.</Alert>
          <FormLayout>
            <FormLayout.Group>
            {money("Valeur minimale de commande", v.COLISSIMO_BLOCKING_CODE_TOTAL_MIN, (value) => form.set("COLISSIMO_BLOCKING_CODE_TOTAL_MIN", value), "€")}
            {money("Valeur maximale de commande", v.COLISSIMO_BLOCKING_CODE_TOTAL_MAX, (value) => form.set("COLISSIMO_BLOCKING_CODE_TOTAL_MAX", value), "€")}
            </FormLayout.Group>
          </FormLayout>
        </>
      ) : null}
    </Panel>
  );
}

function ReturnsForm() {
  const { config } = useColissimo();
  const c = config.values;
  const form = useForm(
    {
      COLISSIMO_ENABLE_RETURN: asBool(c.COLISSIMO_ENABLE_RETURN),
      COLISSIMO_AUTO_PRINT_RETURN_LABEL: asBool(c.COLISSIMO_AUTO_PRINT_RETURN_LABEL),
      COLISSIMO_DISPLAY_RETURN_LABEL_CUSTOMER: asBool(c.COLISSIMO_DISPLAY_RETURN_LABEL_CUSTOMER),
      COLISSIMO_GENERATE_RETURN_LABEL_CUSTOMER: asBool(c.COLISSIMO_GENERATE_RETURN_LABEL_CUSTOMER),
      COLISSIMO_ENABLE_MAILBOX_RETURN: asBool(c.COLISSIMO_ENABLE_MAILBOX_RETURN),
      COLISSIMO_ENABLE_SECURE_RETURN: asBool(c.COLISSIMO_ENABLE_SECURE_RETURN),
    },
    (values) => patch<ModuleConfig>("/config/returns", values),
  );
  const v = form.values;
  return (
    <Panel title="Retours" description="Les étiquettes retour, pour vous et pour vos clients." onSave={() => void form.submit()} saving={form.saving} dirty={form.dirty}>
      <Alert>Avec le retour sécurisé, vous ne pouvez plus générer d’étiquettes retour : votre client génère un QR code à scanner au bureau de poste.</Alert>
      <Group label="Activer le retour de marchandises Colissimo">
        <YesNo name="COLISSIMO_ENABLE_RETURN" value={v.COLISSIMO_ENABLE_RETURN} onChange={(on) => form.set("COLISSIMO_ENABLE_RETURN", on)} />
      </Group>
      <Group label="Imprimer une étiquette retour pour chaque envoi" tip="Seuls les colis scannés sont facturés" help="Pour glisser l’étiquette retour dans le colis.">
        <YesNo name="COLISSIMO_AUTO_PRINT_RETURN_LABEL" value={v.COLISSIMO_AUTO_PRINT_RETURN_LABEL} onChange={(on) => form.set("COLISSIMO_AUTO_PRINT_RETURN_LABEL", on)} />
      </Group>
      <Group label="Afficher les étiquettes retour dans le compte du client">
        <YesNo name="COLISSIMO_DISPLAY_RETURN_LABEL_CUSTOMER" value={v.COLISSIMO_DISPLAY_RETURN_LABEL_CUSTOMER} onChange={(on) => form.set("COLISSIMO_DISPLAY_RETURN_LABEL_CUSTOMER", on)} />
      </Group>
      <Group label="Laisser les clients créer leur étiquette retour" help="Ils peuvent la générer et l’imprimer eux-mêmes depuis leur commande.">
        <YesNo name="COLISSIMO_GENERATE_RETURN_LABEL_CUSTOMER" value={v.COLISSIMO_GENERATE_RETURN_LABEL_CUSTOMER} onChange={(on) => form.set("COLISSIMO_GENERATE_RETURN_LABEL_CUSTOMER", on)} />
      </Group>
      <Group label="Activer le retour en boîte aux lettres" help="Impossible à enregistrer si le retour sécurisé est activé.">
        <YesNo name="COLISSIMO_ENABLE_MAILBOX_RETURN" value={v.COLISSIMO_ENABLE_MAILBOX_RETURN} onChange={(on) => form.set("COLISSIMO_ENABLE_MAILBOX_RETURN", on)} />
      </Group>
      <Group label="Activer le retour sécurisé" tip="Génère un QR code à scanner au bureau de poste pour créer l’étiquette. Format PDF uniquement." help="Soumis à l’activation du service dans votre espace client Colissimo.">
        <YesNo name="COLISSIMO_ENABLE_SECURE_RETURN" value={v.COLISSIMO_ENABLE_SECURE_RETURN} onChange={(on) => form.set("COLISSIMO_ENABLE_SECURE_RETURN", on)} />
      </Group>
    </Panel>
  );
}

/** Shipping section: orders, printing, customs, postage and returns. */
export function TabBack() {
  return (
    <>
      <OrdersForm />
      <PrintForm />
      <InternationalForm />
      <PostageForm />
      <ReturnsForm />
    </>
  );
}

