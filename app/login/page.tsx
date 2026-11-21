import type { Metadata } from "next";

import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Connexion client",
};

export default function ClientLoginPage() {
  return <LoginForm />;
}
