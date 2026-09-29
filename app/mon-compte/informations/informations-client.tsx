"use client";

import Link from "next/link";
import { FormEvent, useState, useSyncExternalStore } from "react";
import type { ComponentType, ReactNode, SVGProps } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  CalendarDays,
  CheckCircle2,
  Fingerprint,
  Loader2,
  Mail,
  Phone,
  Save,
  User,
} from "lucide-react";

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
  updateClient,
  type ClientAuthUser,
  type ClientTitre,
  type UpdateClientPayload,
} from "@/lib/api/clients";
import {
  getClientSession,
  saveClientSession,
  subscribeToClientSession,
  type ClientSession,
} from "@/lib/client-auth";

type InformationFormState = {
  Titre: ClientTitre;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  email: string;
  username: string;
  company: string;
  numberIdFiscale: string;
  dateOfBirth: string;
};

const EMPTY_FORM: InformationFormState = {
  Titre: "M",
  firstName: "",
  lastName: "",
  phoneNumber: "",
  email: "",
  username: "",
  company: "",
  numberIdFiscale: "",
  dateOfBirth: "",
};

let cachedSession: ClientSession | null = null;
let cachedSessionKey = "";

function getServerSessionSnapshot() {
  return null;
}

function getClientSessionSnapshot() {
  const nextSession = getClientSession();
  const nextKey = nextSession
    ? `${nextSession.token}:${JSON.stringify(nextSession.user)}`
    : "";

  if (nextKey === cachedSessionKey) {
    return cachedSession;
  }

  cachedSession = nextSession;
  cachedSessionKey = nextKey;
  return cachedSession;
}

function nullableText(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeDate(value: string | null | undefined) {
  if (!value) return "";
  return value.slice(0, 10);
}

function formFromUser(user: ClientAuthUser | null | undefined) {
  if (!user) return EMPTY_FORM;

  return {
    Titre: user.Titre ?? "M",
    firstName: user.firstName ?? "",
    lastName: user.lastName ?? "",
    phoneNumber: user.phoneNumber ?? "",
    email: user.email ?? "",
    username: user.username ?? "",
    company: user.company ?? "",
    numberIdFiscale: user.numberIdFiscale ?? "",
    dateOfBirth: normalizeDate(user.dateOfBirth),
  };
}

function displayName(user: ClientAuthUser | null | undefined) {
  const fullName = [user?.firstName, user?.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();

  return fullName || user?.username || user?.email || "Client FGMC";
}

export function InformationsClient() {
  const session = useSyncExternalStore(
    subscribeToClientSession,
    getClientSessionSnapshot,
    getServerSessionSnapshot,
  );
  const [form, setForm] = useState<InformationFormState>(() =>
    formFromUser(getClientSessionSnapshot()?.user),
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateField<K extends keyof InformationFormState>(
    key: K,
    value: InformationFormState[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
    setError(null);
    setSuccess(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!session?.user?.id) {
      setError("Connectez-vous pour modifier vos informations.");
      return;
    }

    if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim()) {
      setError("Le prenom, le nom et l'adresse e-mail sont obligatoires.");
      return;
    }

    const payload: UpdateClientPayload = {
      Titre: form.Titre,
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      phoneNumber: nullableText(form.phoneNumber),
      email: form.email.trim(),
      username: nullableText(form.username),
      company: nullableText(form.company),
      numberIdFiscale: nullableText(form.numberIdFiscale),
      dateOfBirth: nullableText(form.dateOfBirth),
    };

    setIsSubmitting(true);

    try {
      const updatedClient = await updateClient(session.user.id, payload);
      saveClientSession({
        token: session.token,
        client: {
          ...session.user,
          ...updatedClient,
        },
      });
      setForm(formFromUser(updatedClient));
      setSuccess("Vos informations ont ete mises a jour.");
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Impossible de mettre a jour vos informations.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f5f6f8] text-[#172033]">
      <div className="border-t-2 border-destructive bg-[#ededed]">
        <nav
          aria-label="Fil d'Ariane"
          className="mx-auto flex min-h-11 w-full max-w-[1320px] flex-wrap items-center gap-2 px-4 text-sm text-[#172033] sm:px-8">
          <Link href="/" className="hover:text-primary hover:underline">
            Accueil
          </Link>
          <BreadcrumbSeparator />
          <Link href="/mon-compte" className="hover:text-primary hover:underline">
            Mon compte
          </Link>
          <BreadcrumbSeparator />
          <span aria-current="page">Informations</span>
        </nav>
      </div>

      <section className="mx-auto w-full max-w-[1320px] px-4 pt-6 pb-16 sm:px-8">
        <Link
          href="/mon-compte"
          className="inline-flex min-h-10 items-center gap-2 rounded-md text-sm font-semibold text-primary hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
          <ArrowLeft className="size-4" />
          Retour a mon compte
        </Link>

        <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <section className="overflow-hidden rounded-md border border-border bg-white shadow-[0_12px_28px_rgba(16,24,40,0.08)]">
            <div className="border-b border-border bg-linear-to-r from-primary/10 via-white to-destructive/10 px-5 py-6 sm:px-8">
              <p className="text-xs font-bold uppercase text-primary">
                Informations personnelles
              </p>
              <h1 className="mt-2 text-2xl font-bold text-[#101828] sm:text-3xl">
                Modifier mes informations
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#667085]">
                Gardez vos coordonnees a jour pour simplifier vos commandes,
                factures et livraisons.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6 p-5 sm:p-8">
              {error ? (
                <StatusMessage tone="error" icon={AlertCircle}>
                  {error}
                </StatusMessage>
              ) : null}

              {success ? (
                <StatusMessage tone="success" icon={CheckCircle2}>
                  {success}
                </StatusMessage>
              ) : null}

              {!session ? (
                <StatusMessage tone="error" icon={AlertCircle}>
                  Vous n&apos;etes pas connecte. Vous pouvez consulter la page,
                  mais la sauvegarde necessite une session client.
                </StatusMessage>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-[0.55fr_1fr_1fr]">
                <div className="space-y-2">
                  <Label htmlFor="information-title">Titre</Label>
                  <Select
                    value={form.Titre}
                    onValueChange={(value) =>
                      updateField("Titre", value as ClientTitre)
                    }>
                    <SelectTrigger id="information-title" className="h-12 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="M">M</SelectItem>
                      <SelectItem value="Mme">Mme</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <TextField
                  id="information-first-name"
                  label="Prenom"
                  value={form.firstName}
                  onChange={(value) => updateField("firstName", value)}
                  autoComplete="given-name"
                  icon={User}
                  required
                />

                <TextField
                  id="information-last-name"
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
                  id="information-email"
                  label="Adresse e-mail"
                  type="email"
                  value={form.email}
                  onChange={(value) => updateField("email", value)}
                  autoComplete="email"
                  icon={Mail}
                  required
                />

                <TextField
                  id="information-username"
                  label="Nom utilisateur"
                  value={form.username}
                  onChange={(value) => updateField("username", value)}
                  autoComplete="username"
                  icon={User}
                />
              </div>

              <TextField
                id="information-phone"
                label="Numero de telephone"
                type="tel"
                value={form.phoneNumber}
                onChange={(value) => updateField("phoneNumber", value)}
                autoComplete="tel"
                icon={Phone}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  id="information-company"
                  label="Societe"
                  value={form.company}
                  onChange={(value) => updateField("company", value)}
                  autoComplete="organization"
                  icon={Building2}
                />

                <TextField
                  id="information-tax-id"
                  label="Matricule fiscal"
                  value={form.numberIdFiscale}
                  onChange={(value) => updateField("numberIdFiscale", value)}
                  icon={Fingerprint}
                />
              </div>

              <TextField
                id="information-birth-date"
                label="Date de naissance"
                type="date"
                value={form.dateOfBirth}
                onChange={(value) => updateField("dateOfBirth", value)}
                autoComplete="bday"
                icon={CalendarDays}
              />

              <div className="flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-[#667085]">
                  Les champs marques avec * sont obligatoires.
                </p>
                <Button
                  type="submit"
                  className="h-12 px-6 text-sm font-semibold"
                  disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Enregistrement...
                    </>
                  ) : (
                    <>
                      <Save className="size-4" />
                      Enregistrer
                    </>
                  )}
                </Button>
              </div>
            </form>
          </section>

          <aside className="h-fit rounded-md border border-border bg-white p-5 shadow-[0_12px_28px_rgba(16,24,40,0.08)] sm:p-6">
            <div className="grid size-12 place-items-center rounded-md bg-primary/10 text-primary">
              <User className="size-6" />
            </div>
            <h2 className="mt-4 text-lg font-bold text-[#101828]">
              {displayName(session?.user)}
            </h2>
            <p className="mt-2 break-words text-sm text-[#667085]">
              {session?.user?.email ?? "Connectez-vous pour charger vos donnees."}
            </p>
            <div className="mt-5 rounded-md border border-primary/15 bg-primary/5 p-4 text-sm leading-6 text-[#344054]">
              Ces informations servent a preparer vos documents de commande et
              a pre-remplir vos prochaines commandes.
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}

function BreadcrumbSeparator() {
  return (
    <span aria-hidden className="text-[#667085]">
      /
    </span>
  );
}

function StatusMessage({
  children,
  icon: Icon,
  tone,
}: {
  children: ReactNode;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  tone: "error" | "success";
}) {
  const isError = tone === "error";

  return (
    <div
      role={isError ? "alert" : "status"}
      className={
        isError
          ? "flex items-start gap-3 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          : "flex items-start gap-3 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
      }>
      <Icon className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

function TextField({
  id,
  label,
  value,
  onChange,
  icon: Icon,
  type = "text",
  required = false,
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  type?: string;
  required?: boolean;
  autoComplete?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label}
        {required ? <span className="text-destructive">*</span> : null}
      </Label>
      <div className="relative">
        <Icon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={id}
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          required={required}
          className="h-12 bg-white pl-10"
        />
      </div>
    </div>
  );
}
