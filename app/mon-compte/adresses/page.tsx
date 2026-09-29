import type { Metadata } from "next";

import { AdressesClient } from "./adresses-client";

export const metadata: Metadata = {
  title: "Adresses | FGMC",
};

export default function MonCompteAdressesPage() {
  return <AdressesClient />;
}
