import type { Metadata } from "next";

import { PageNotFound } from "@/components/shared/page-not-found";

export const metadata: Metadata = {
  title: "Page introuvable",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return <PageNotFound />;
}
