import { redirect } from "next/navigation";

import { getAdminUserFromSession } from "@/lib/admin-auth";

import { AdminLoginForm } from "./login-form";

export default async function AdminLoginPage() {
  const adminUser = await getAdminUserFromSession();

  if (adminUser) {
    redirect("/admin_ben");
  }

  return <AdminLoginForm />;
}
