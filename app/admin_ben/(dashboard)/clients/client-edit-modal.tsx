"use client";

import { useEffect, useState } from "react";
import {
  Banner,
  BlockStack,
  Checkbox,
  InlineGrid,
  Modal,
  Select,
  TextField,
} from "@shopify/polaris";
import { updateAdminClient, type AdminClient } from "@/lib/api/admin-clients";

type Form = {
  Titre: "M" | "Mme" | "Autre";
  firstName: string;
  lastName: string;
  email: string;
  username: string;
  phoneNumber: string;
  company: string;
  numberIdFiscale: string;
  dateOfBirth: string;
  password: string;
  isActive: boolean;
  newsletter: boolean;
  partnerOffers: boolean;
};

function toForm(client: AdminClient): Form {
  return {
    Titre: client.Titre,
    firstName: client.firstName === "-" ? "" : client.firstName,
    lastName: client.lastName === "-" ? "" : client.lastName,
    email: client.email,
    username: client.username ?? "",
    phoneNumber: client.phoneNumber ?? "",
    company: client.company ?? "",
    numberIdFiscale: client.numberIdFiscale ?? "",
    dateOfBirth: client.dateOfBirth ?? "",
    password: "",
    isActive: client.isActive,
    newsletter: client.newsletter,
    partnerOffers: client.partnerOffers,
  };
}

export function ClientEditModal({
  client,
  onClose,
  onSaved,
}: {
  client: AdminClient | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm(client ? toForm(client) : null);
    setError(null);
  }, [client]);

  const set = <K extends keyof Form>(key: K, value: Form[K]) =>
    setForm((current) => (current ? { ...current, [key]: value } : current));

  const save = async () => {
    if (!client || !form) return;
    if (!form.email.trim()) {
      setError("L'adresse e-mail est obligatoire.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateAdminClient(client.id, {
        Titre: form.Titre,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        username: form.username.trim(),
        phoneNumber: form.phoneNumber.trim(),
        company: form.company.trim(),
        numberIdFiscale: form.numberIdFiscale.trim(),
        dateOfBirth: form.dateOfBirth.trim(),
        isActive: form.isActive,
        newsletter: form.newsletter,
        partnerOffers: form.partnerOffers,
        ...(form.password ? { password: form.password } : {}),
      });
      onSaved();
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={client !== null}
      size="large"
      title={client ? `Modifier le client #${client.id.slice(-6)}` : "Modifier le client"}
      onClose={() => !saving && onClose()}
      primaryAction={{ content: "Enregistrer", loading: saving, onAction: () => void save() }}
      secondaryActions={[{ content: "Annuler", onAction: onClose, disabled: saving }]}>
      <Modal.Section>
        {form ? (
          <BlockStack gap="300">
            {error ? <Banner tone="critical">{error}</Banner> : null}
            <InlineGrid columns={{ xs: 1, sm: "120px 1fr 1fr" }} gap="300">
              <Select
                label="Titre"
                options={[
                  { label: "M.", value: "M" },
                  { label: "Mme", value: "Mme" },
                  { label: "Autre", value: "Autre" },
                ]}
                value={form.Titre}
                onChange={(value) => set("Titre", value as "M" | "Mme" | "Autre")}
              />
              <TextField label="Prénom" value={form.firstName} autoComplete="off"
                onChange={(value) => set("firstName", value)} />
              <TextField label="Nom" value={form.lastName} autoComplete="off"
                onChange={(value) => set("lastName", value)} />
            </InlineGrid>
            <InlineGrid columns={{ xs: 1, sm: 2 }} gap="300">
              <TextField label="E-mail" type="email" value={form.email} autoComplete="off"
                onChange={(value) => set("email", value)} />
              <TextField label="Téléphone" value={form.phoneNumber} autoComplete="off"
                onChange={(value) => set("phoneNumber", value)} />
              <TextField label="Société" value={form.company} autoComplete="off"
                onChange={(value) => set("company", value)} />
              <TextField label="ID fiscal" value={form.numberIdFiscale} autoComplete="off"
                onChange={(value) => set("numberIdFiscale", value)} />
              <TextField label="Identifiant" value={form.username} autoComplete="off"
                onChange={(value) => set("username", value)} />
              <TextField label="Date de naissance" type="date" value={form.dateOfBirth} autoComplete="off"
                onChange={(value) => set("dateOfBirth", value)} />
            </InlineGrid>
            <TextField
              label="Nouveau mot de passe"
              type="password"
              value={form.password}
              autoComplete="new-password"
              helpText="Laissez vide pour conserver le mot de passe actuel."
              onChange={(value) => set("password", value)}
            />
            <BlockStack gap="100">
              <Checkbox label="Compte activé" checked={form.isActive}
                helpText="Un compte désactivé ne peut plus se connecter à la boutique."
                onChange={(value) => set("isActive", value)} />
              <Checkbox label="Inscrit à la newsletter" checked={form.newsletter}
                onChange={(value) => set("newsletter", value)} />
              <Checkbox label="Accepte les offres des partenaires" checked={form.partnerOffers}
                onChange={(value) => set("partnerOffers", value)} />
            </BlockStack>
          </BlockStack>
        ) : null}
      </Modal.Section>
    </Modal>
  );
}
