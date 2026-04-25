"use client";

import Image from "next/image";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { AppProvider, Icon, TextField } from "@shopify/polaris";
import { HideIcon, ViewIcon } from "@shopify/polaris-icons";
import en from "@shopify/polaris/locales/en.json";

import { adminLoginAction, type AdminLoginFormState } from "./actions";
import styles from "./login.module.css";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button type="submit" className={styles.submitButton} disabled={pending}>
      {pending ? "Connexion..." : "Se connecter"}
    </button>
  );
}

export function AdminLoginForm() {
  const [state, formAction] = useActionState<AdminLoginFormState, FormData>(
    adminLoginAction,
    {},
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  return (
    <AppProvider i18n={en}>
      <div className={styles.page}>
        <div className={styles.logoWrap}>
          <Image
            src="/logo.png"
            alt="Logo FGMC"
            width={250}
            height={180}
            priority
          />
        </div>

        <div className={styles.card}>
          <h1 className={styles.title}>Connexion</h1>
          <p className={styles.subtitle}>Continuer vers FGMC Admin</p>

          <form action={formAction} className={styles.form}>
            <TextField
              label="Adresse e-mail"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={setEmail}
              placeholder="admin@exemple.com"
            />

            <TextField
              label="Mot de passe"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={setPassword}
              suffix={
                <button
                  type="button"
                  className={styles.passwordIconButton}
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={
                    showPassword
                      ? "Masquer le mot de passe"
                      : "Afficher le mot de passe"
                  }>
                  <Icon source={showPassword ? HideIcon : ViewIcon} />
                </button>
              }
            />

            <a className={styles.forgotLink} href="#">
              Mot de passe oublie ?
            </a>

            {state.error ? (
              <p className={styles.errorText}>{state.error}</p>
            ) : null}

            <SubmitButton />
          </form>
        </div>
      </div>
    </AppProvider>
  );
}
