"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { PiArrowRightBold, PiAtDuotone, PiBuildingsDuotone, PiCalendarBlankDuotone, PiEnvelopeSimpleDuotone, PiFingerprintDuotone, PiLockKeyDuotone, PiUserDuotone } from "react-icons/pi";

import { AuthShell } from "@/components/client-auth/auth-shell";
import {
  AuthChoice,
  AuthError,
  AuthField,
  AuthGroup,
  AuthPasswordField,
  AuthRule,
  AuthSubmit,
  StitchProgress,
} from "@/components/client-auth/auth-fields";
import {
  signupClient,
  type ClientTitre,
  type CreateClientPayload,
} from "@/lib/api/clients";
import { saveClientSession } from "@/lib/client-auth";

type SignupFormState = {
  Titre: ClientTitre;
  firstName: string;
  lastName: string;
  email: string;
  username: string;
  company: string;
  numberIdFiscale: string;
  dateOfBirth: string;
  password: string;
  confirmPassword: string;
};

const INITIAL_FORM: SignupFormState = {
  Titre: "M",
  firstName: "",
  lastName: "",
  email: "",
  username: "",
  company: "",
  numberIdFiscale: "",
  dateOfBirth: "",
  password: "",
  confirmPassword: "",
};

export function SignupForm() {
  const router = useRouter();
  const [form, setForm] = useState<SignupFormState>(INITIAL_FORM);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateField<K extends keyof SignupFormState>(
    key: K,
    value: SignupFormState[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  const required = [
    form.firstName.trim() !== "",
    form.lastName.trim() !== "",
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()),
    form.password.length >= 6,
    form.confirmPassword !== "" && form.confirmPassword === form.password,
  ];
  const done = required.filter(Boolean).length;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (form.password.length < 6) {
      setError("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    setIsSubmitting(true);

    const payload: CreateClientPayload = {
      Titre: form.Titre,
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim(),
      username: nullableText(form.username),
      company: nullableText(form.company),
      numberIdFiscale: nullableText(form.numberIdFiscale),
      dateOfBirth: nullableText(form.dateOfBirth),
      password: form.password,
    };

    try {
      const response = await signupClient(payload);
      const role = response.user?.role ?? response.client?.role;

      if (role && role !== "CLIENT") {
        throw new Error("Ce portail est réservé aux clients.");
      }

      saveClientSession(response);
      // Back to where they came from (the checkout), but only to a page of this site.
      const requestedReturnTo = new URLSearchParams(window.location.search).get("returnTo");
      router.push(requestedReturnTo?.startsWith("/") && !requestedReturnTo.startsWith("//") ? requestedReturnTo : "/");
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Impossible de créer le compte. Vérifiez les informations.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Créer votre compte"
      subtitle="Quelques informations suffisent pour commander plus vite et suivre vos colis."
      panelTitle="Ouvrez votre compte atelier."
      panelText="Particulier ou professionnel, commandez plus vite, suivez vos colis et gardez vos informations à jour."
      switchText="Vous avez déjà un compte ?"
      switchHref="/login"
      switchLabel="Se connecter"
      benefitsAt="top">
      <form onSubmit={handleSubmit} className="space-y-7">
        <StitchProgress done={done} total={required.length} label="Avancement de l’inscription" />

        <AuthGroup title="Vous">
          <AuthChoice
            label="Civilité"
            value={form.Titre}
            onChange={(value) => updateField("Titre", value)}
            options={[
              { value: "M", label: "M" },
              { value: "Mme", label: "Mme" },
              { value: "Autre", label: "Autre" },
            ]}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <AuthField id="client-first-name" label="Prénom" value={form.firstName} onChange={(value) => updateField("firstName", value)} autoComplete="given-name" icon={PiUserDuotone} required />
            <AuthField id="client-last-name" label="Nom" value={form.lastName} onChange={(value) => updateField("lastName", value)} autoComplete="family-name" icon={PiUserDuotone} required />
          </div>
        </AuthGroup>

        <AuthGroup title="Vos coordonnées">
          <div className="grid gap-4 sm:grid-cols-2">
            <AuthField id="client-signup-email" label="Adresse e-mail" type="email" value={form.email} onChange={(value) => updateField("email", value)} autoComplete="email" placeholder="vous@exemple.com" icon={PiEnvelopeSimpleDuotone} required />
            <AuthField id="client-username" label="Nom d’utilisateur" value={form.username} onChange={(value) => updateField("username", value)} autoComplete="username" icon={PiAtDuotone} optional />
          </div>
        </AuthGroup>

        <AuthGroup title="Votre société">
          <div className="grid gap-4 sm:grid-cols-2">
            <AuthField id="client-company" label="Société" value={form.company} onChange={(value) => updateField("company", value)} autoComplete="organization" icon={PiBuildingsDuotone} optional />
            <AuthField id="client-tax-id" label="Matricule fiscal" value={form.numberIdFiscale} onChange={(value) => updateField("numberIdFiscale", value)} icon={PiFingerprintDuotone} optional />
          </div>
          <AuthField id="client-birth-date" label="Date de naissance" type="date" value={form.dateOfBirth} onChange={(value) => updateField("dateOfBirth", value)} autoComplete="bday" icon={PiCalendarBlankDuotone} optional />
        </AuthGroup>

        <AuthGroup title="Votre mot de passe">
          <div className="grid gap-4 sm:grid-cols-2">
            <AuthPasswordField id="client-signup-password" label="Mot de passe" value={form.password} onChange={(value) => updateField("password", value)} autoComplete="new-password" icon={PiLockKeyDuotone} visible={showPassword} onToggle={() => setShowPassword((value) => !value)} />
            <AuthPasswordField id="client-confirm-password" label="Confirmer" value={form.confirmPassword} onChange={(value) => updateField("confirmPassword", value)} autoComplete="new-password" icon={PiLockKeyDuotone} visible={showPassword} onToggle={() => setShowPassword((value) => !value)} />
          </div>
          <ul className="space-y-1" aria-label="Règles du mot de passe">
            <AuthRule ok={form.password.length >= 6}>6 caractères minimum</AuthRule>
            <AuthRule ok={form.confirmPassword !== "" && form.confirmPassword === form.password}>Les deux mots de passe sont identiques</AuthRule>
          </ul>
        </AuthGroup>

        <AuthError message={error} />

        <div className="space-y-3">
          <AuthSubmit pending={isSubmitting} pendingLabel="Création…">
            Créer mon compte
            <PiArrowRightBold className="size-4" aria-hidden="true" />
          </AuthSubmit>
          <p className="text-center text-sm text-[var(--auth-muted)]">
            En créant un compte, vous acceptez de recevoir les informations liées à vos commandes FGMC.
          </p>
        </div>
      </form>
    </AuthShell>
  );
}

function nullableText(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}
