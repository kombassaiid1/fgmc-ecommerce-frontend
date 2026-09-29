import type { Metadata } from "next";

import { CommandesClient } from "./commandes-client";

export const metadata: Metadata = {
  title: "Commandes | FGMC",
};

export default function MonCompteCommandesPage() {
  return <CommandesClient />;
}
