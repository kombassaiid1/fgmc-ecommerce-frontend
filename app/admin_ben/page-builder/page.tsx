import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getAdminUserFromSession } from "@/lib/admin-auth";

import { PageBuilderClient } from "./page-builder-client";

export const metadata: Metadata = {
  title: "Page builder",
};

// Lives outside the (dashboard) route group on purpose: no sidebar, no top bar.
export default async function PageBuilderPage({ searchParams }: { searchParams: Promise<{ page?: string | string[] }> }) {
  const adminUser = await getAdminUserFromSession();

  if (!adminUser) {
    redirect("/admin_ben/login");
  }

  const { page } = await searchParams;
  const slug = (Array.isArray(page) ? page[0] : page)?.trim() || "home";

  // One editor per page: switching page starts a fresh one.
  return <PageBuilderClient key={slug} slug={slug} />;
}
