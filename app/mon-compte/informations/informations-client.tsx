"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import {
  PiAddressBookDuotone,
  PiArrowCounterClockwiseBold,
  PiArrowRightBold,
  PiAtDuotone,
  PiBuildingsDuotone,
  PiCalendarBlankDuotone,
  PiCheckCircleDuotone,
  PiEnvelopeSimpleDuotone,
  PiFingerprintDuotone,
  PiFloppyDiskBold,
  PiLockKeyDuotone,
  PiMapPinAreaDuotone,
  PiPackageDuotone,
  PiPhoneDuotone,
  PiSealCheckDuotone,
  PiSpinnerGapBold,
  PiUserCircleDuotone,
  PiUserDuotone,
  PiWarningCircleDuotone,
} from "react-icons/pi";

import "@/components/client-auth/auth.css";
import { AuthChoice, AuthField } from "@/components/client-auth/auth-fields";
import { updateClient, type ClientAuthUser, type ClientTitre, type UpdateClientPayload } from "@/lib/api/clients";
import { getClientSession, saveClientSession, subscribeToClientSession, type ClientSession } from "@/lib/client-auth";

import "../account.css";
import "./infos.css";

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
  const nextKey = nextSession ? `${nextSession.token}:${JSON.stringify(nextSession.user)}` : "";

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

function formFromUser(user: ClientAuthUser | null | undefined): InformationFormState {
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
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim();

  return fullName || user?.username || user?.email || "Client FGMC";
}

function initials(user: ClientAuthUser | null | undefined) {
  const letters = [user?.firstName, user?.lastName].filter(Boolean).map((part) => part!.trim()[0]).join("");
  return (letters || user?.username?.[0] || user?.email?.[0] || "?").toUpperCase().slice(0, 2);
}

export function InformationsClient() {
  const session = useSyncExternalStore(subscribeToClientSession, getClientSessionSnapshot, getServerSessionSnapshot);
  // The server and the first client render both have no session, so the form starts empty and is filled once the
  // customer's session is known (reading it earlier would make the page differ between server and browser).
  const [form, setForm] = useState<InformationFormState>(EMPTY_FORM);
  const [saved, setSaved] = useState<InformationFormState>(EMPTY_FORM);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  if (session?.user?.id && loadedFor !== session.user.id) {
    const initial = formFromUser(session.user);
    setLoadedFor(session.user.id);
    setForm(initial);
    setSaved(initial);
  }
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(saved), [form, saved]);

  function updateField<K extends keyof InformationFormState>(key: K, value: InformationFormState[K]) {
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
      setError("Le prénom, le nom et l’adresse e-mail sont obligatoires.");
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
      const next = formFromUser(updatedClient);
      setForm(next);
      setSaved(next);
      setSuccess("Vos informations ont été mises à jour.");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Impossible de mettre à jour vos informations.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const user = session?.user;
  const since = user?.createdAt && Number.isFinite(Date.parse(user.createdAt)) ? new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(new Date(user.createdAt)) : "";

  return (
    <main className="ac">
      <div className="ac-wrap">
        <nav aria-label="Fil d’Ariane" className="ac-crumbs">
          <Link href="/">Accueil</Link>
          <span aria-hidden="true">/</span>
          <Link href="/mon-compte">Mon compte</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">Mes informations</span>
        </nav>

        {/* ------------------------------------------------------------ the mat */}
        <section className="ac-hero" aria-labelledby="ai-title">
          <div className="ai-hero-row">
            <span className="ac-avatar" aria-hidden="true">{initials(user)}</span>
            <div className="min-w-0">
              <h1 id="ai-title" className="ai-title">Mes informations</h1>
              <p className="ai-sub">Gardez vos coordonnées à jour pour simplifier vos commandes, vos factures et vos livraisons.</p>
            </div>
          </div>
        </section>

        <div className="ai-layout">
          <form onSubmit={handleSubmit} className="ai-form" noValidate>
            {error ? <Alert tone="bad" icon={PiWarningCircleDuotone}>{error}</Alert> : null}
            {success ? <Alert tone="ok" icon={PiCheckCircleDuotone}>{success}</Alert> : null}
            {!session ? (
              <Alert tone="info" icon={PiWarningCircleDuotone}>
                Vous n’êtes pas connecté. Vous pouvez consulter la page, mais l’enregistrement demande une session client.{" "}
                <Link href="/login?returnTo=/mon-compte/informations" className="underline">Se connecter</Link>
              </Alert>
            ) : null}

            <Card icon={PiUserCircleDuotone} title="Identité" text="Comment nous nous adressons à vous.">
              <div className="ai-row is-civ auth-scope">
                <AuthChoice
                  label="Civilité"
                  value={form.Titre}
                  onChange={(value) => updateField("Titre", value)}
                  options={[
                    { value: "M", label: "M" },
                    { value: "Mme", label: "Mme" },
                  ]}
                />
                <AuthField id="information-first-name" label="Prénom" value={form.firstName} onChange={(value) => updateField("firstName", value)} autoComplete="given-name" icon={PiUserDuotone} required />
                <AuthField id="information-last-name" label="Nom" value={form.lastName} onChange={(value) => updateField("lastName", value)} autoComplete="family-name" icon={PiUserDuotone} required />
              </div>
              <div className="ai-row is-two auth-scope">
                <AuthField id="information-birth-date" label="Date de naissance" type="date" value={form.dateOfBirth} onChange={(value) => updateField("dateOfBirth", value)} autoComplete="bday" icon={PiCalendarBlankDuotone} optional />
                <AuthField id="information-username" label="Nom d’utilisateur" value={form.username} onChange={(value) => updateField("username", value)} autoComplete="username" icon={PiAtDuotone} optional />
              </div>
            </Card>

            <Card icon={PiAddressBookDuotone} tone="red" title="Coordonnées" text="Pour vous écrire et vous joindre à propos d’une livraison.">
              <div className="ai-row is-two auth-scope">
                <AuthField id="information-email" label="Adresse e-mail" type="email" value={form.email} onChange={(value) => updateField("email", value)} autoComplete="email" icon={PiEnvelopeSimpleDuotone} required />
                <AuthField id="information-phone" label="Téléphone" type="tel" value={form.phoneNumber} onChange={(value) => updateField("phoneNumber", value)} autoComplete="tel" icon={PiPhoneDuotone} optional hint="Le transporteur peut l’utiliser pour vous joindre à la livraison." />
              </div>
            </Card>

            <Card icon={PiBuildingsDuotone} tone="green" title="Société" text="Pour les achats professionnels : ces informations figurent sur vos factures.">
              <div className="ai-row is-two auth-scope">
                <AuthField id="information-company" label="Société" value={form.company} onChange={(value) => updateField("company", value)} autoComplete="organization" icon={PiBuildingsDuotone} optional />
                <AuthField id="information-tax-id" label="Matricule fiscal" value={form.numberIdFiscale} onChange={(value) => updateField("numberIdFiscale", value)} icon={PiFingerprintDuotone} optional />
              </div>
            </Card>

            {dirty ? (
              <div className="ai-savebar" role="region" aria-label="Enregistrer les modifications">
                <span className="ai-savebar-text">Modifications non enregistrées</span>
                <button type="button" className="ai-bar-btn is-quiet" onClick={() => { setForm(saved); setError(null); }} disabled={isSubmitting}>
                  <PiArrowCounterClockwiseBold className="size-4" aria-hidden="true" />Annuler
                </button>
                <button type="submit" className="ai-bar-btn is-save" disabled={isSubmitting}>
                  {isSubmitting ? <PiSpinnerGapBold className="animate-spin size-4" aria-hidden="true" /> : <PiFloppyDiskBold className="size-4" aria-hidden="true" />}
                  {isSubmitting ? "Enregistrement…" : "Enregistrer"}
                </button>
              </div>
            ) : null}
          </form>

          {/* ------------------------------------------------------------ the client card */}
          <aside className="ai-aside" aria-label="Ma fiche client">
            <div className="ai-id">
              <div className="ai-id-top">
                <span className="ac-avatar" aria-hidden="true">{initials(user)}</span>
                <p className="ai-id-name">{displayName(user)}</p>
                <p className="ai-id-mail">{user?.email ?? "Connectez-vous pour charger vos données."}</p>
              </div>
              <dl className="ai-id-facts">
                {saved.company ? <Fact icon={PiBuildingsDuotone} label="Société" value={saved.company} /> : null}
                {saved.phoneNumber ? <Fact icon={PiPhoneDuotone} label="Téléphone" value={saved.phoneNumber} /> : null}
                {since ? <Fact icon={PiSealCheckDuotone} label="Client depuis" value={since} /> : null}
              </dl>
              <div className="ai-id-links">
                <Link href="/mon-compte/commandes" className="ai-pill"><PiPackageDuotone className="size-5" aria-hidden="true" />Mes commandes</Link>
                <Link href="/mon-compte/adresses" className="ai-pill"><PiMapPinAreaDuotone className="size-5" aria-hidden="true" />Mes adresses<PiArrowRightBold className="size-3.5" aria-hidden="true" /></Link>
              </div>
            </div>
            <p className="ai-note">
              <PiLockKeyDuotone className="size-5" aria-hidden="true" />
              <span>Ces informations servent à préparer vos documents de commande et à pré-remplir vos prochaines commandes. Elles restent chez FGMC.</span>
            </p>
          </aside>
        </div>
      </div>
    </main>
  );
}

function Card({ icon: Icon, tone = "blue", title, text, children }: { icon: typeof PiUserDuotone; tone?: "blue" | "red" | "green"; title: string; text: string; children: ReactNode }) {
  const id = `ai-${title.toLowerCase().replace(/\W+/g, "-")}`;
  return (
    <section className="ai-card" aria-labelledby={id}>
      <div className="ai-card-head">
        <span className={`ai-card-icon ${tone === "blue" ? "" : `is-${tone}`}`} aria-hidden="true"><Icon className="size-7" /></span>
        <div>
          <h2 id={id} className="ai-card-title">{title}</h2>
          <p className="ai-card-text">{text}</p>
        </div>
      </div>
      <div className="ai-seam" aria-hidden="true" />
      <div className="ai-fields">{children}</div>
    </section>
  );
}

function Fact({ icon: Icon, label, value }: { icon: typeof PiUserDuotone; label: string; value: string }) {
  return (
    <div className="ai-id-fact">
      <Icon className="size-6" aria-hidden="true" />
      <div>
        <dt>{label}</dt>
        <dd>{value}</dd>
      </div>
    </div>
  );
}

function Alert({ tone, icon: Icon, children }: { tone: "ok" | "bad" | "info"; icon: typeof PiUserDuotone; children: ReactNode }) {
  return (
    <div role={tone === "bad" ? "alert" : "status"} className={`ai-alert is-${tone}`}>
      <Icon className="size-5" aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}
