"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import {
  AlertCircle,
  Building2,
  CalendarDays,
  Eye,
  EyeOff,
  Fingerprint,
  Loader2,
  LockKeyhole,
  Mail,
  User,
} from "lucide-react";

import { AuthShell } from "@/components/client-auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (form.password.length < 6) {
      setError("Le mot de passe doit contenir au moins 6 caracteres.");
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
        throw new Error("Ce portail est reserve aux clients.");
      }

      saveClientSession(response);
      router.push("/");
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Impossible de creer le compte. Verifiez les informations.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell
      eyebrow="Nouveau client"
      title="Creer votre compte"
      subtitle="Renseignez vos informations pour commander plus vite et garder vos details client a jour."
      switchText="Vous avez deja un compte ?"
      switchHref="/login"
      switchLabel="Se connecter">
      <form onSubmit={handleSubmit} className="space-y-5">
        {error ? (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-[0.55fr_1fr_1fr]">
          <div className="space-y-2">
            <Label htmlFor="client-title">Titre</Label>
            <Select
              value={form.Titre}
              onValueChange={(value) =>
                updateField("Titre", value as ClientTitre)
              }>
              <SelectTrigger id="client-title" className="h-12 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="M">M</SelectItem>
                <SelectItem value="Mme">Mme</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <TextField
            id="client-first-name"
            label="Prenom"
            value={form.firstName}
            onChange={(value) => updateField("firstName", value)}
            autoComplete="given-name"
            icon={User}
            required
          />

          <TextField
            id="client-last-name"
            label="Nom"
            value={form.lastName}
            onChange={(value) => updateField("lastName", value)}
            autoComplete="family-name"
            icon={User}
            required
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            id="client-signup-email"
            label="Adresse e-mail"
            type="email"
            value={form.email}
            onChange={(value) => updateField("email", value)}
            autoComplete="email"
            icon={Mail}
            required
          />

          <TextField
            id="client-username"
            label="Nom utilisateur"
            value={form.username}
            onChange={(value) => updateField("username", value)}
            autoComplete="username"
            icon={User}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            id="client-company"
            label="Societe"
            value={form.company}
            onChange={(value) => updateField("company", value)}
            autoComplete="organization"
            icon={Building2}
          />

          <TextField
            id="client-tax-id"
            label="Matricule fiscal"
            value={form.numberIdFiscale}
            onChange={(value) => updateField("numberIdFiscale", value)}
            icon={Fingerprint}
          />
        </div>

        <TextField
          id="client-birth-date"
          label="Date de naissance"
          type="date"
          value={form.dateOfBirth}
          onChange={(value) => updateField("dateOfBirth", value)}
          autoComplete="bday"
          icon={CalendarDays}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <PasswordField
            id="client-signup-password"
            label="Mot de passe"
            value={form.password}
            onChange={(value) => updateField("password", value)}
            autoComplete="new-password"
            showPassword={showPassword}
            onTogglePassword={() => setShowPassword((value) => !value)}
          />

          <PasswordField
            id="client-confirm-password"
            label="Confirmer"
            value={form.confirmPassword}
            onChange={(value) => updateField("confirmPassword", value)}
            autoComplete="new-password"
            showPassword={showPassword}
            onTogglePassword={() => setShowPassword((value) => !value)}
          />
        </div>

        <Button
          type="submit"
          className="h-12 w-full bg-destructive text-base font-semibold hover:bg-destructive/90"
          disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Creation...
            </>
          ) : (
            "Creer mon compte"
          )}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          En creant un compte, vous acceptez de recevoir les informations liees
          a vos commandes FGMC.
        </p>
      </form>
    </AuthShell>
  );
}

function TextField({
  id,
  label,
  value,
  onChange,
  icon: Icon,
  type = "text",
  autoComplete,
  required = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  icon: typeof User;
  type?: string;
  autoComplete?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Icon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={id}
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          className="h-12 pl-10"
          required={required}
        />
      </div>
    </div>
  );
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  showPassword,
  onTogglePassword,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  showPassword: boolean;
  onTogglePassword: () => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <LockKeyhole className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={id}
          type={showPassword ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          className="h-12 pr-12 pl-10"
          required
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute top-1/2 right-1 size-10 -translate-y-1/2 text-muted-foreground"
          onClick={onTogglePassword}
          aria-label={
            showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"
          }>
          {showPassword ? (
            <EyeOff className="size-4" />
          ) : (
            <Eye className="size-4" />
          )}
        </Button>
      </div>
    </div>
  );
}

function nullableText(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}
