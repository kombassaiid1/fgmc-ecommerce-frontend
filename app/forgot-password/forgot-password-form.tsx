"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { PiArrowLeftBold, PiArrowRightBold, PiCheckCircleDuotone, PiEnvelopeSimpleDuotone, PiLockKeyDuotone } from "react-icons/pi";

import { AuthShell } from "@/components/client-auth/auth-shell";
import { AuthError, AuthField, AuthPasswordField, AuthRule, AuthSubmit } from "@/components/client-auth/auth-fields";
import { CodeInput } from "@/components/client-auth/code-input";
import { requestPasswordResetCode, resetClientPassword, verifyPasswordResetCode } from "@/lib/api/clients";
import { cn } from "@/lib/utils";

type Step = "email" | "code" | "password" | "done";

const MIN_PASSWORD = 8;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STEPS: Array<{ id: Exclude<Step, "done">; label: string }> = [
  { id: "email", label: "Votre e-mail" },
  { id: "code", label: "Le code" },
  { id: "password", label: "Nouveau mot de passe" },
];

const COPY: Record<Step, { title: string; subtitle: string }> = {
  email: { title: "Mot de passe oublié", subtitle: "Indiquez l’adresse e-mail de votre compte. Nous vous envoyons un code à 6 chiffres pour en choisir un nouveau." },
  code: { title: "Saisissez le code", subtitle: "Entrez le code à 6 chiffres reçu par e-mail. Il est valable 10 minutes." },
  password: { title: "Nouveau mot de passe", subtitle: "Choisissez un mot de passe que vous n’utilisez nulle part ailleurs." },
  done: { title: "Mot de passe modifié", subtitle: "Votre compte est de nouveau accessible." },
};

function message(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function ForgotPasswordForm() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [wait, setWait] = useState(0);
  // The one-time token a correct code gives. It stays in memory only: never in the address bar, never stored.
  const resetToken = useRef<string | null>(null);

  useEffect(() => {
    if (wait <= 0) return;
    const timer = window.setTimeout(() => setWait((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [wait]);

  const sendCode = useCallback(async () => {
    setError(null);
    setInfo(null);
    setPending(true);
    try {
      const result = await requestPasswordResetCode(email.trim());
      setWait(result.resendAfterSeconds);
      return true;
    } catch (e) {
      setError(message(e, "Impossible d’envoyer le code. Réessayez dans un instant."));
      return false;
    } finally {
      setPending(false);
    }
  }, [email]);

  async function submitEmail(event: FormEvent) {
    event.preventDefault();
    if (await sendCode()) {
      setCode("");
      setStep("code");
    }
  }

  async function checkCode(value: string) {
    if (pending) return;
    setError(null);
    setPending(true);
    try {
      const result = await verifyPasswordResetCode(email.trim(), value);
      resetToken.current = result.resetToken;
      setStep("password");
    } catch (e) {
      setError(message(e, "Vérification impossible. Réessayez."));
      setCode("");
    } finally {
      setPending(false);
    }
  }

  async function resend() {
    if (wait > 0 || pending) return;
    if (await sendCode()) {
      setCode("");
      setInfo("Un nouveau code vient d’être envoyé. Le précédent ne fonctionne plus.");
    }
  }

  async function submitPassword(event: FormEvent) {
    event.preventDefault();
    if (!resetToken.current) {
      setStep("email");
      return;
    }
    setError(null);
    setPending(true);
    try {
      await resetClientPassword(resetToken.current, password);
      resetToken.current = null;
      setPassword("");
      setConfirm("");
      setStep("done");
    } catch (e) {
      setError(message(e, "Impossible de modifier le mot de passe."));
    } finally {
      setPending(false);
    }
  }

  const long = password.length >= MIN_PASSWORD;
  const same = confirm !== "" && confirm === password;
  const index = STEPS.findIndex((item) => item.id === step);

  return (
    <AuthShell
      title={COPY[step].title}
      subtitle={COPY[step].subtitle}
      panelTitle="On vous remet sur le fil."
      panelText="Un code à usage unique, valable 10 minutes, protège votre compte : sans lui, personne ne peut changer votre mot de passe."
      switchText="Vous vous en souvenez ?"
      switchHref="/login"
      switchLabel="Se connecter">
      {step !== "done" ? (
        <ol className="mb-7 flex items-center gap-2" aria-label="Étapes">
          {STEPS.map((item, position) => (
            <li key={item.id} className="flex min-w-0 flex-1 flex-col gap-1.5" aria-current={position === index ? "step" : undefined}>
              <span className={cn("h-1.5 rounded-full transition-colors", position <= index ? "bg-[var(--auth-red)]" : "bg-[var(--auth-line)]")} />
              <span className={cn("truncate text-xs font-semibold", position === index ? "text-[var(--auth-ink)]" : "text-[var(--auth-muted)]")}>{item.label}</span>
            </li>
          ))}
        </ol>
      ) : null}

      {step === "email" ? (
        <form onSubmit={submitEmail} className="space-y-5">
          <AuthField id="forgot-email" label="Adresse e-mail" type="email" value={email} onChange={setEmail} autoComplete="email" placeholder="vous@exemple.com" icon={PiEnvelopeSimpleDuotone} required />
          <AuthError message={error} />
          <AuthSubmit pending={pending} pendingLabel="Envoi du code…">
            Recevoir un code
            <PiArrowRightBold className="size-4" aria-hidden="true" />
          </AuthSubmit>
          {!EMAIL.test(email.trim()) && email ? <p className="text-xs text-[var(--auth-muted)]">Vérifiez que l’adresse est complète.</p> : null}
        </form>
      ) : null}

      {step === "code" ? (
        <div className="space-y-5">
          <p className="rounded-xl bg-[var(--auth-wash)] px-4 py-3 text-sm leading-6 text-[var(--auth-ink)]">
            Si un compte existe avec <strong className="break-all">{email.trim()}</strong>, un code vient d’y être envoyé. Pensez à regarder les courriers indésirables.
          </p>
          <div className="space-y-2">
            <label htmlFor="forgot-code" className="block text-sm font-semibold text-[var(--auth-ink)]">Code à 6 chiffres</label>
            <CodeInput id="forgot-code" value={code} onChange={setCode} onComplete={(value) => void checkCode(value)} disabled={pending} invalid={Boolean(error)} />
          </div>
          <div aria-live="polite" className="space-y-3">
            <AuthError message={error} />
            {info ? <p className="rounded-xl bg-[#e7f7ef] px-4 py-3 text-sm font-medium text-[#17703a]">{info}</p> : null}
          </div>
          <button
            type="button"
            onClick={() => void checkCode(code)}
            disabled={code.length !== 6 || pending}
            className="flex h-13 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[var(--auth-red)] px-6 text-base font-bold text-white shadow-[0_10px_24px_-10px_rgba(211,32,43,0.8)] transition-all hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--auth-red)]">
            {pending ? "Vérification…" : "Vérifier le code"}
          </button>
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <button
              type="button"
              onClick={() => void resend()}
              disabled={wait > 0 || pending}
              className="min-h-11 cursor-pointer font-semibold text-[var(--auth-blue)] underline-offset-4 hover:underline disabled:cursor-not-allowed disabled:text-[var(--auth-muted)] disabled:no-underline focus-visible:outline-2 focus-visible:outline-[var(--auth-blue)]">
              {wait > 0 ? `Renvoyer un code dans ${wait} s` : "Renvoyer un code"}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep("email");
                setError(null);
                setInfo(null);
                setCode("");
              }}
              className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 font-semibold text-[var(--auth-ink)] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-[var(--auth-blue)]">
              <PiArrowLeftBold className="size-3.5" aria-hidden="true" />
              Changer d’adresse
            </button>
          </div>
        </div>
      ) : null}

      {step === "password" ? (
        <form onSubmit={submitPassword} className="space-y-5">
          <AuthPasswordField id="forgot-password" label="Nouveau mot de passe" value={password} onChange={setPassword} autoComplete="new-password" icon={PiLockKeyDuotone} visible={showPassword} onToggle={() => setShowPassword((value) => !value)} />
          <AuthPasswordField id="forgot-confirm" label="Confirmez le mot de passe" value={confirm} onChange={setConfirm} autoComplete="new-password" icon={PiLockKeyDuotone} visible={showPassword} onToggle={() => setShowPassword((value) => !value)} />
          <ul className="space-y-1.5">
            <AuthRule ok={long}>{MIN_PASSWORD} caractères minimum</AuthRule>
            <AuthRule ok={same}>Les deux mots de passe sont identiques</AuthRule>
          </ul>
          <AuthError message={error} />
          {error && /expiré|recommencez/i.test(error) ? (
            <button type="button" onClick={() => { setStep("email"); setError(null); }} className="min-h-11 cursor-pointer text-sm font-semibold text-[var(--auth-blue)] underline-offset-4 hover:underline">Recommencer depuis le début</button>
          ) : null}
          <button
            type="submit"
            disabled={!long || !same || pending}
            className="flex h-13 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[var(--auth-red)] px-6 text-base font-bold text-white shadow-[0_10px_24px_-10px_rgba(211,32,43,0.8)] transition-all hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--auth-red)]">
            {pending ? "Enregistrement…" : "Enregistrer le mot de passe"}
          </button>
        </form>
      ) : null}

      {step === "done" ? (
        <div className="space-y-6">
          <p role="status" className="flex items-start gap-3 rounded-xl bg-[#e7f7ef] px-4 py-4 text-[15px] leading-6 text-[#17703a]">
            <PiCheckCircleDuotone className="mt-0.5 size-6 shrink-0" aria-hidden="true" />
            <span>Votre mot de passe a été modifié. Un e-mail de confirmation vous a été envoyé.</span>
          </p>
          <Link
            href="/login"
            className="flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-[var(--auth-red)] px-6 text-base font-bold text-white shadow-[0_10px_24px_-10px_rgba(211,32,43,0.8)] transition-all hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--auth-red)]">
            Se connecter
            <PiArrowRightBold className="size-4" aria-hidden="true" />
          </Link>
        </div>
      ) : null}
    </AuthShell>
  );
}
