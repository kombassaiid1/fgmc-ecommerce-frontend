import type { Metadata } from "next";

import { SignupForm } from "./signup-form";

export const metadata: Metadata = {
  title: "Inscription client",
};

export default function ClientSignupPage() {
  return <SignupForm />;
}
