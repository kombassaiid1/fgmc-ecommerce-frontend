import type { Metadata } from "next";

import { AdressesClient } from "./adresses-client";

export const metadata: Metadata = {
  title: "Adresses",
  robots: { index: false, follow: false },
};

export default function MonCompteAdressesPage() {
  return <AdressesClient />;
}
