"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { ArrowRight, LockKeyhole, Mail } from "lucide-react";

import { AuthShell } from "@/components/client-auth/auth-shell";
import { AuthError, AuthField, AuthPasswordField, AuthSubmit, StitchProgress } from "@/components/client-auth/auth-fields";
import { loginClient } from "@/lib/api/clients";
import { saveClientSession } from "@/lib/client-auth";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const done = (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? 1 : 0) + (password.length > 0 ? 1 : 0);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await loginClient({
        email: email.trim(),
        password,
      });
      const role = response.user?.role ?? response.client?.role;

      if (role && role !== "CLIENT") {
        throw new Error("Ce portail est réservé aux clients.");
      }

      saveClientSession(response);
      const requestedReturnTo = new URLSearchParams(window.location.search).get("returnTo");
      const returnTo = requestedReturnTo?.startsWith("/") && !requestedReturnTo.startsWith("//")
        ? requestedReturnTo
        : "/";
      router.push(returnTo);
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Impossible de vous connecter. Vérifiez vos informations.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Connexion"
      subtitle="Retrouvez vos commandes, vos devis et vos adresses pour continuer vos achats."
      panelTitle="Content de vous revoir à l’atelier."
      panelText="Réparation, vente, achat et location de machines à coudre : votre compte garde tout au même endroit."
      switchText="Pas encore de compte ?"
      switchHref="/signup"
      switchLabel="Créer un compte">
      <form onSubmit={handleSubmit} className="space-y-5" noValidate={false}>
        <StitchProgress done={done} total={2} label="Avancement de la connexion" />

        <AuthField
          id="client-login-email"
          label="Adresse e-mail"
          type="email"
          value={email}
          onChange={setEmail}
          autoComplete="email"
          placeholder="vous@exemple.com"
          icon={Mail}
          required
        />

        <AuthPasswordField
          id="client-login-password"
          label="Mot de passe"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          placeholder="Votre mot de passe"
          icon={LockKeyhole}
          visible={showPassword}
          onToggle={() => setShowPassword((value) => !value)}
          aside={
            <Link href="#" className="text-sm font-semibold text-[var(--auth-blue)] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-[var(--auth-blue)]">
              Mot de passe oublié ?
            </Link>
          }
        />

        <AuthError message={error} />

        <AuthSubmit pending={isSubmitting} pendingLabel="Connexion…">
          Se connecter
          <ArrowRight className="size-4" aria-hidden="true" />
        </AuthSubmit>
      </form>
    </AuthShell>
  );
}
