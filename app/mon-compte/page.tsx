import type { Metadata } from "next";

import { MonCompteClient } from "./mon-compte-client";

export const metadata: Metadata = {
  title: "Mon compte | FGMC",
};

export default function MonComptePage() {
  return <MonCompteClient />;
}
