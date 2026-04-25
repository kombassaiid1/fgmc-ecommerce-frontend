import { redirect } from "next/navigation";

import { getAdminUserFromSession } from "@/lib/admin-auth";

import { AdminShell } from "./admin-shell";

export default async function AdminDashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const adminUser = await getAdminUserFromSession();

  if (!adminUser) {
    redirect("/admin_ben/login");
  }

  return <AdminShell user={adminUser}>{children}</AdminShell>;
}
