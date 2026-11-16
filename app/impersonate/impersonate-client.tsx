"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { apiRequest } from "@/lib/api/http-client";
import type { ClientAuthResponse } from "@/lib/api/clients";
import { saveClientSession } from "@/lib/client-auth";

/** Landing page of the admin "log in as customer" button. */
export function ImpersonateClient() {
  const router = useRouter();
  const params = useSearchParams();
  const code = params.get("code");
  const started = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (!code) {
      setError("Lien de connexion invalide.");
      return;
    }
    // Keep the one-time code out of history/referrers.
    window.history.replaceState(null, "", "/impersonate");
    apiRequest<ClientAuthResponse>({
      path: "/auth/impersonate/exchange",
      method: "POST",
      body: JSON.stringify({ code }),
    })
      .then((response) => {
        saveClientSession(response);
        router.replace("/mon-compte");
      })
      .catch((exchangeError) =>
        setError(
          exchangeError instanceof Error
            ? exchangeError.message
            : "Connexion impossible. Relancez-la depuis l'administration.",
        ),
      );
  }, [code, router]);

  return (
    <main className="mx-auto flex min-h-[50vh] max-w-md items-center justify-center px-4 text-center">
      {error ? (
        <p role="alert" className="text-sm text-red-600">{error}</p>
      ) : (
        <p className="text-sm text-slate-600">Ouverture de la session client…</p>
      )}
    </main>
  );
}
