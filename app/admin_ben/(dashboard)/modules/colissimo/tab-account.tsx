"use client";

import Link from "next/link";
import { BlockStack, Button, Checkbox, ChoiceList, FormLayout, InlineStack, Select as PolarisSelect, Text as PolarisText, TextField } from "@shopify/polaris";
import { Alert, Group, Panel, YesNo, asBool, asText, useColissimo, useForm } from "./cm-kit";
import { COUNTRY_NAMES, patch, type Address, type ColissimoAccount, type ModuleConfig } from "./colissimo-api";
import { BASE } from "./cm-shell";

const ACCOUNT_TYPES: Array<{ key: string; label: string; help?: string }> = [
  { key: "FRANCE", label: "France (domicile, point de retrait, retour)" },
  { key: "OM", label: "Outre-mer (domicile)" },
  { key: "ECOOM", label: "Éco Outre-mer", help: "Offre réservée aux clients qui déposent ou récupèrent directement leurs colis sur les plateformes Colissimo. Contactez votre interlocuteur commercial pour en savoir plus." },
  { key: "EUROPE", label: "Europe" },
  { key: "WORLDWIDE", label: "International" },
];

const COUNTRIES = Object.entries(COUNTRY_NAMES).sort((a, b) => a[1].localeCompare(b[1], "fr")).map(([value, label]) => ({ value, label }));
const KEY_LINK = "https://www.colissimo.entreprise.laposte.fr/fr";

function AddressForm({ kind, title, description, initial }: { kind: "sender" | "return"; title: string; description: string; initial: Address }) {
  const form = useForm<Address>(initial, (values) => patch<ModuleConfig>(`/address/${kind}`, values));
  const v = form.values;
  const field = (key: keyof Address, label: string, max: number, extra?: { required?: boolean; autoComplete?: string; type?: string }) => (
    <TextField
      label={label}
      value={v[key]}
      onChange={(value) => form.set(key, value as never)}
      maxLength={max}
      showCharacterCount={max >= 30}
      requiredIndicator={extra?.required}
      autoComplete={extra?.autoComplete ?? "off"}
      type={(extra?.type as "text") ?? "text"}
    />
  );
  return (
    <Panel title={title} description={description} onSave={() => void form.submit()} saving={form.saving} dirty={form.dirty}>
      <FormLayout>
        <FormLayout.Group>
          {field("company", "Société", 35)}
          {field("lastname", "Nom", 35)}
        </FormLayout.Group>
        {field("firstname", "Prénom", 35)}
        {field("address1", "Numéro et libellé de voie", 35, { required: true, autoComplete: "address-line1" })}
        <FormLayout.Group>
          {field("address2", "Complément d’adresse 1", 35)}
          {field("address3", "Complément d’adresse 2", 35)}
        </FormLayout.Group>
        {field("address4", "Complément d’adresse 3", 35)}
        <FormLayout.Group>
          {field("zipcode", "Code postal", 10, { required: true, autoComplete: "postal-code" })}
          {field("city", "Ville", 30, { required: true, autoComplete: "address-level2" })}
        </FormLayout.Group>
        <PolarisSelect label="Pays" requiredIndicator options={COUNTRIES} value={v.country} onChange={(value) => form.set("country", value)} />
        <FormLayout.Group>
          {field("phone", "Téléphone", 20, { required: true, autoComplete: "tel", type: "tel" })}
          {field("email", "E-mail", 80, { required: true, autoComplete: "email", type: "email" })}
        </FormLayout.Group>
      </FormLayout>
    </Panel>
  );
}

/** Account and addresses section. */
export function TabAccount() {
  const { config, toast } = useColissimo();
  const account: ColissimoAccount = config.account;
  const values = config.values;

  const form = useForm(
    {
      logs: asBool(values.COLISSIMO_LOGS),
      key: asBool(values.COLISSIMO_CONNEXION_KEY),
      login: account.contractNumber,
      password: "",
      parent: asText(values.COLISSIMO_ACCOUNT_PARENT_ID) || account.parentAccount,
      apiKey: "",
      contract: asText(values.COLISSIMO_ACCOUNT_CONTRACT_NUMBER),
      types: Object.keys(config.structured.accountType),
    },
    async (draft) => {
      // The credentials first: they are checked and encrypted; the other values follow.
      const hasCredentials = draft.key ? Boolean(draft.apiKey || account.apiKeySet) : Boolean(draft.login && (draft.password || account.passwordSet));
      if (hasCredentials) {
        await patch<ColissimoAccount>("", { authMode: draft.key ? "KEY" : "LOGIN", contractNumber: draft.login, password: draft.password, apiKey: draft.apiKey, parentAccount: draft.parent });
      }
      await patch<ModuleConfig>("/account-type", { types: draft.types });
      return patch<ModuleConfig>("/config/account", { COLISSIMO_LOGS: draft.logs, COLISSIMO_CONNEXION_KEY: draft.key, COLISSIMO_ACCOUNT_CONTRACT_NUMBER: draft.contract, COLISSIMO_ACCOUNT_PARENT_ID: draft.parent });
    },
  );
  const v = form.values;
  const toggleType = (key: string, on: boolean) => form.set("types", on ? [...v.types, key] : v.types.filter((type) => type !== key));

  const returnAddress = useForm({ use: asBool(values.COLISSIMO_USE_RETURN_ADDRESS) }, async (draft) => patch<ModuleConfig>("/config/address", { COLISSIMO_USE_RETURN_ADDRESS: draft.use }));

  async function check() {
    try {
      const response = await fetch("/frontend-api/admin/colissimo-integration/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}", cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(Array.isArray(data.message) ? data.message.join(" ") : data.message || "Vérification impossible.");
      toast("Connexion au webservice Colissimo réussie");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Vérification impossible.", true);
    }
  }

  return (
    <>
      <Panel
        title="Connexion à Colissimo"
        description="Colissimo n’a pas d’environnement de test : les étiquettes créées sont facturées selon votre contrat."
        onSave={() => void form.submit()}
        saving={form.saving}
        dirty={form.dirty}>
        <ChoiceList
          title="Mode de connexion"
          choices={[
            { label: "Compte Colissimo", value: "LOGIN", helpText: "Numéro de contrat et mot de passe de votre compte Colissimo Entreprise." },
            { label: "Clé de connexion", value: "KEY", helpText: "Clé générée dans votre espace Colissimo Entreprise (compte avancé)." },
          ]}
          selected={[v.key ? "KEY" : "LOGIN"]}
          onChange={([choice]) => form.set("key", choice === "KEY")}
        />
        <Alert tone="warning">
          <PolarisText as="p" variant="bodyMd">En 2026, la connexion par clé sera le seul mode disponible. <a href={KEY_LINK} target="_blank" rel="noopener noreferrer">Récupérer ou générer ma clé</a></PolarisText>
        </Alert>

        {v.key ? (
          <FormLayout>
            <TextField label="Clé du compte" type="password" value={v.apiKey} onChange={(value) => form.set("apiKey", value)} placeholder={account.apiKeySet ? "Clé enregistrée" : ""} autoComplete="new-password" helpText={account.apiKeySet ? "Laissez vide pour garder la clé enregistrée. Elle est chiffrée et jamais réaffichée." : undefined} />
            <TextField label="Numéro de contrat" value={v.contract} onChange={(value) => form.set("contract", value)} maxLength={20} autoComplete="off" />
          </FormLayout>
        ) : (
          <FormLayout>
            <FormLayout.Group>
              <TextField label="Identifiant" value={v.login} onChange={(value) => form.set("login", value.trim())} maxLength={20} autoComplete="off" helpText="Votre numéro de compte, indiqué sur votre contrat." />
              <TextField label="Mot de passe" type="password" value={v.password} onChange={(value) => form.set("password", value)} placeholder={account.passwordSet ? "Mot de passe enregistré" : ""} autoComplete="new-password" helpText={account.passwordSet ? "Laissez vide pour le garder. Il est chiffré et jamais réaffiché." : "Envoyé par e-mail à l’adresse du contrat."} />
            </FormLayout.Group>
            <TextField label="Identifiant du compte parent" value={v.parent} onChange={(value) => form.set("parent", value)} maxLength={20} autoComplete="off" helpText="Pour les comptes avancés. Renseignez aussi le numéro de compte pour utiliser les documents douaniers." />
          </FormLayout>
        )}

        <BlockStack gap="200">
          <PolarisText as="h3" variant="headingSm">Type de compte</PolarisText>
          <PolarisText as="p" variant="bodySm" tone="subdued">Cochez les offres de votre contrat : une destination non couverte n’est pas proposée à vos clients.</PolarisText>
          {ACCOUNT_TYPES.map((type) => (
            <Checkbox key={type.key} label={type.label} helpText={type.help} checked={v.types.includes(type.key)} onChange={(on) => toggleType(type.key, on)} />
          ))}
        </BlockStack>

        <Group label="Journaux" tip="Les journaux gardent la trace des échanges avec Colissimo" help={<>Consultez le journal en cours dans la <Link href={`${BASE}/logs`}>page des journaux</Link>.</>}>
          <YesNo name="COLISSIMO_LOGS" value={v.logs} onChange={(on) => form.set("logs", on)} />
        </Group>

        <InlineStack gap="200" blockAlign="center">
          <Button onClick={() => void check()} disabled={form.dirty || !account.configured}>Tester la connexion</Button>
          {form.dirty ? <PolarisText as="span" variant="bodySm" tone="subdued">Enregistrez d’abord vos modifications.</PolarisText> : null}
        </InlineStack>
      </Panel>

      <Panel
        title="Adresse de retour"
        description="Adresse physique où reviennent les colis non distribués (les CEDEX ne sont pas acceptés). Par défaut, c’est l’adresse d’expédition.">
        <Group label="Utiliser une adresse différente pour la réception des retours">
          <YesNo name="COLISSIMO_USE_RETURN_ADDRESS" value={returnAddress.values.use} onChange={(on) => returnAddress.set("use", on)} />
        </Group>
        {returnAddress.dirty ? <div><Button onClick={() => void returnAddress.submit()} loading={returnAddress.saving}>Enregistrer ce choix</Button></div> : null}
      </Panel>

      <AddressForm kind="sender" title="Adresse d’expédition" description="Imprimée sur chaque étiquette, et utilisée comme adresse de retour si vous n’en indiquez pas d’autre. Le numéro et libellé de voie est obligatoire." initial={config.structured.sender} />
      {returnAddress.values.use && !returnAddress.dirty ? <AddressForm kind="return" title="Adresse des retours" description="Où vos clients renvoient les colis." initial={config.structured.returnAddress} /> : null}
    </>
  );
}
