import { redirect } from "next/navigation";

import { getAdminUserFromSession } from "@/lib/admin-auth";
import { PolarisClientProvider } from "./polaris-client-provider";

export default async function AdminBuilderLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const adminUser = await getAdminUserFromSession();

  if (!adminUser) {
    redirect("/admin_ben/login");
  }

  return <PolarisClientProvider>{children}</PolarisClientProvider>;
}
