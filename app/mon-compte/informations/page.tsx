import type { Metadata } from "next";

import { InformationsClient } from "./informations-client";

export const metadata: Metadata = {
  title: "Informations",
  robots: { index: false, follow: false },
};

export default function MonCompteInformationsPage() {
  return <InformationsClient />;
}
