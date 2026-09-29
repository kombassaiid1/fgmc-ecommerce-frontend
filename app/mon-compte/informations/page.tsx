import type { Metadata } from "next";

import { InformationsClient } from "./informations-client";

export const metadata: Metadata = {
  title: "Informations | FGMC",
};

export default function MonCompteInformationsPage() {
  return <InformationsClient />;
}
