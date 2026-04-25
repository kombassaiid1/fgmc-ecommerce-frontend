"use server";

import { redirect } from "next/navigation";

import { loginAdmin } from "@/lib/admin-auth";

export type AdminLoginFormState = {
  error?: string;
};

export async function adminLoginAction(
  _prevState: AdminLoginFormState,
  formData: FormData
): Promise<AdminLoginFormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return {
      error: "L'adresse e-mail et le mot de passe sont obligatoires.",
    };
  }

  const result = await loginAdmin(email, password);
  if (!result.ok) {
    return { error: result.error };
  }

  redirect("/admin_ben");
}
