import type { Metadata } from "next";

import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Connexion client | FGMC",
};

export default function ClientLoginPage() {
  return <LoginForm />;
}
