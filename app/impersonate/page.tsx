import type { Metadata } from "next";
import { Suspense } from "react";

import { ImpersonateClient } from "./impersonate-client";

export const metadata: Metadata = {
  title: "Connexion",
  robots: { index: false, follow: false },
};

export default function ImpersonatePage() {
  return (
    <Suspense fallback={null}>
      <ImpersonateClient />
    </Suspense>
  );
}
