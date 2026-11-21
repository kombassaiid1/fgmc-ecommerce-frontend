import type { Metadata } from "next";

import { CommandesClient } from "./commandes-client";

export const metadata: Metadata = {
  title: "Commandes",
  robots: { index: false, follow: false },
};

export default function MonCompteCommandesPage() {
  return <CommandesClient />;
}
