"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Badge, Card } from "@shopify/polaris";

type DolibarrConfig = {
  configured: boolean;
  storeApiUrl: string;
  apiUrl: string;
  apiKeySet: boolean;
  usernameSet: boolean;
  passwordSet: boolean;
  integrationTokenSet: boolean;
  syncProducts: boolean;
  syncStoreProducts: boolean;
  syncStock: boolean;
  syncInvoices: boolean;
  syncCustomers: boolean;
  syncOrders: boolean;
};

const initialConfig: DolibarrConfig = {
  configured: false, storeApiUrl: "", apiUrl: "", apiKeySet: false, usernameSet: false, passwordSet: false,
  integrationTokenSet: false, syncProducts: true, syncStoreProducts: false, syncStock: true,
  syncInvoices: true, syncCustomers: true, syncOrders: true,
};

type SyncField = "syncProducts" | "syncStoreProducts" | "syncStock" | "syncInvoices" | "syncCustomers" | "syncOrders";
type SyncDirection = "store-to-dolibarr" | "dolibarr-to-store";

function createIntegrationToken() {
  const bytes = new Uint8Array(32);
  window.crypto.getRandomValues(bytes);
  return `fgmc_${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

export default function DolibarrConfigForm() {
  const [config, setConfig] = useState(initialConfig);
  const [apiKey, setApiKey] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [integrationToken, setIntegrationToken] = useState("");
  const [generatedToken, setGeneratedToken] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState<SyncDirection | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const reloadConfig = useCallback(async () => {
    const response = await fetch("/api/admin/dolibarr-integration", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Chargement impossible.");
    setConfig({ ...initialConfig, ...data });
    if (!data.integrationTokenSet) {
      setIntegrationToken(createIntegrationToken());
      setGeneratedToken(true);
    } else {
      setIntegrationToken("");
      setGeneratedToken(false);
    }
  }, []);

  useEffect(() => {
    reloadConfig()
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Chargement impossible."))
      .finally(() => setLoading(false));
  }, [reloadConfig]);

  async function saveConfig(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/admin/dolibarr-integration", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiUrl: config.apiUrl, apiKey, username, password, integrationToken,
          syncProducts: config.syncProducts, syncStock: config.syncStock,
          syncStoreProducts: config.syncStoreProducts,
          syncInvoices: config.syncInvoices, syncCustomers: config.syncCustomers,
          syncOrders: config.syncOrders,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Enregistrement impossible.");
      setApiKey(""); setUsername(""); setPassword(""); setIntegrationToken(""); setGeneratedToken(false);
      await reloadConfig();
      setMessage("Configuration enregistree. Les secrets sont chiffres sur le serveur.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Enregistrement impossible.");
    } finally { setSaving(false); }
  }

  async function testConnection() {
    setTesting(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/admin/dolibarr-integration/test", { method: "POST" });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.message || "La connexion a echoue.");
      setMessage(data.message);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "La connexion a echoue.");
    } finally { setTesting(false); }
  }

  async function runManualSync(direction: SyncDirection) {
    setSyncing(direction); setError(""); setMessage("");
    try {
      const response = await fetch("/api/admin/dolibarr-integration/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ direction }),
      });
      const data = await response.json();
      if (!response.ok || data.ok === false) throw new Error(data.message || "La synchronisation a echoue.");
      const summary = Object.entries(data.result ?? {})
        .map(([name, count]) => `${name}: ${count}`)
        .join(" · ");
      setMessage(`Synchronisation terminee${summary ? ` — ${summary}` : "."}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "La synchronisation a echoue.");
    } finally { setSyncing(null); }
  }

  function toggle(field: SyncField) {
    setConfig((current) => ({ ...current, [field]: !current[field] }));
  }

  function regenerateToken() {
    setIntegrationToken(createIntegrationToken());
    setGeneratedToken(true);
  }

  return (
    <Card>
      <form className="space-y-5" onSubmit={saveConfig}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[#24364b]">Configuration de la connexion</h2>
            <p className="mt-1 text-sm text-[#667085]">La cle Web Services et les identifiants Dolibarr sont chiffres dans la base et ne sont jamais renvoyes a cette page.</p>
          </div>
          <Badge tone={config.configured ? "success" : "attention"}>{config.configured ? "Configure" : "A configurer"}</Badge>
        </div>

        {loading ? <p className="text-sm text-[#667085]">Chargement de la configuration...</p> : (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block text-sm font-medium text-[#344054]">
                URL de Dolibarr
                <input required type="url" value={config.apiUrl} onChange={(event) => setConfig({ ...config, apiUrl: event.target.value })} placeholder="https://dolibarr.example.com" className="mt-1 block w-full rounded-lg border border-[#cbd5df] px-3 py-2.5 font-normal outline-none focus:border-[#1457a6] focus:ring-2 focus:ring-[#1457a6]/15" />
                <span className="mt-1 block text-xs font-normal text-[#667085]">L'URL REST /api/index.php sera ajoutee automatiquement.</span>
              </label>
              <label className="block text-sm font-medium text-[#344054]">
                URL API de la boutique · a copier dans Dolibarr
                <input readOnly value={config.storeApiUrl} className="mt-1 block w-full rounded-lg border border-[#cbd5df] bg-[#f8fafc] px-3 py-2.5 font-mono text-sm font-normal text-[#475467]" />
              </label>
              <label className="block text-sm font-medium text-[#344054]">
                Cle Web Services Dolibarr {config.apiKeySet && <span className="font-normal text-emerald-700">· deja enregistree</span>}
                <input type="password" autoComplete="new-password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={config.apiKeySet ? "Laisser vide pour conserver la cle actuelle" : "Cle generee dans Dolibarr / Web Services"} className="mt-1 block w-full rounded-lg border border-[#cbd5df] px-3 py-2.5 font-normal outline-none focus:border-[#1457a6] focus:ring-2 focus:ring-[#1457a6]/15" />
              </label>
              <label className="block text-sm font-medium text-[#344054]">
                Login Dolibarr {config.usernameSet && <span className="font-normal text-emerald-700">· deja enregistre</span>}
                <input required={!config.usernameSet} autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} placeholder={config.usernameSet ? "Laisser vide pour conserver le login actuel" : "Login Dolibarr (pas l'adresse e-mail)"} className="mt-1 block w-full rounded-lg border border-[#cbd5df] px-3 py-2.5 font-normal outline-none focus:border-[#1457a6] focus:ring-2 focus:ring-[#1457a6]/15" />
              </label>
              <label className="block text-sm font-medium text-[#344054]">
                Mot de passe Dolibarr {config.passwordSet && <span className="font-normal text-emerald-700">· deja enregistre</span>}
                <input required={!config.passwordSet} type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder={config.passwordSet ? "Laisser vide pour conserver le mot de passe actuel" : "Mot de passe de l'utilisateur Dolibarr"} className="mt-1 block w-full rounded-lg border border-[#cbd5df] px-3 py-2.5 font-normal outline-none focus:border-[#1457a6] focus:ring-2 focus:ring-[#1457a6]/15" />
              </label>
              <label className="block text-sm font-medium text-[#344054] md:col-span-2">
                Token secret de synchronisation {config.integrationTokenSet && !generatedToken && <span className="font-normal text-emerald-700">· deja enregistre</span>}
                <div className="mt-1 flex gap-2">
                  <input type={generatedToken ? "text" : "password"} autoComplete="new-password" value={integrationToken} onChange={(event) => { setIntegrationToken(event.target.value); setGeneratedToken(false); }} placeholder={config.integrationTokenSet ? "Laisser vide pour conserver le token actuel" : "Generation securisee..."} className="block w-full rounded-lg border border-[#cbd5df] px-3 py-2.5 font-mono text-sm font-normal outline-none focus:border-[#1457a6] focus:ring-2 focus:ring-[#1457a6]/15" />
                  <button type="button" disabled={!integrationToken} onClick={() => navigator.clipboard.writeText(integrationToken).then(() => setMessage("Token copie. Collez-le dans la configuration du module Dolibarr."))} className="shrink-0 rounded-lg border border-[#cbd5df] px-3 text-sm font-semibold text-[#344054] disabled:opacity-50">Copier</button>
                  <button type="button" onClick={regenerateToken} className="shrink-0 rounded-lg border border-[#cbd5df] px-3 text-sm font-semibold text-[#344054]">Regenerer</button>
                </div>
                <span className="mt-1 block text-xs font-normal text-[#667085]">Un secret securise est genere automatiquement s'il n'en existe pas. Copiez-le avant l'enregistrement, puis collez-le dans Dolibarr. Le token enregistre ne sera plus affiche ensuite.</span>
              </label>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-[#344054]">Donnees a synchroniser</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {([
                  ["syncProducts", "Produits · Dolibarr vers boutique"],
                  ["syncStoreProducts", "Produits · boutique vers Dolibarr"],
                  ["syncStock", "Stocks · Dolibarr vers boutique"],
                  ["syncInvoices", "Factures · Dolibarr vers boutique"],
                  ["syncCustomers", "Clients · boutique vers Dolibarr"],
                  ["syncOrders", "Commandes · boutique vers Dolibarr"],
                ] as const).map(([field, label]) => (
                  <label key={field} className="flex cursor-pointer items-center gap-2 rounded-lg border border-[#e4e7ec] px-3 py-2.5 text-sm text-[#344054]">
                    <input type="checkbox" checked={config[field]} onChange={() => toggle(field)} className="size-4 accent-[#1457a6]" />{label}
                  </label>
                ))}
              </div>
            </div>
            <section aria-labelledby="manual-sync-title" className="rounded-xl border border-[#dce4ea] bg-[#f8fafc] p-4">
              <div>
                <h3 id="manual-sync-title" className="text-sm font-semibold text-[#24364b]">Synchronisation manuelle</h3>
                <p className="mt-1 text-sm text-[#667085]">Lancez une synchronisation maintenant. Les choix ci-dessus determinent les donnees envoyees.</p>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-lg border border-[#e4e7ec] bg-white p-3">
                  <p className="text-sm font-semibold text-[#344054]">Boutique vers Dolibarr</p>
                  <p className="mt-1 min-h-10 text-xs leading-5 text-[#667085]">Envoie les produits, les clients et les commandes de la boutique vers Dolibarr.</p>
                  <button type="button" disabled={!config.configured || saving || testing || syncing !== null} onClick={() => runManualSync("store-to-dolibarr")} className="mt-3 min-h-11 w-full rounded-lg bg-[#1457a6] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#104987] disabled:cursor-not-allowed disabled:opacity-50">
                    {syncing === "store-to-dolibarr" ? "Synchronisation en cours..." : "Synchroniser boutique → Dolibarr"}
                  </button>
                </div>
                <div className="rounded-lg border border-[#e4e7ec] bg-white p-3">
                  <p className="text-sm font-semibold text-[#344054]">Dolibarr vers boutique</p>
                  <p className="mt-1 min-h-10 text-xs leading-5 text-[#667085]">Importe les produits, les stocks et les factures de Dolibarr dans le magasin.</p>
                  <button type="button" disabled={!config.configured || saving || testing || syncing !== null} onClick={() => runManualSync("dolibarr-to-store")} className="mt-3 min-h-11 w-full rounded-lg border border-[#1457a6] bg-white px-4 py-2.5 text-sm font-semibold text-[#1457a6] hover:bg-[#eff6ff] disabled:cursor-not-allowed disabled:opacity-50">
                    {syncing === "dolibarr-to-store" ? "Synchronisation en cours..." : "Synchroniser Dolibarr → boutique"}
                  </button>
                </div>
              </div>
              <p className="mt-3 text-xs text-[#667085]">Le module FGMC Sync version 1.1.3 ou plus recente doit etre installe dans Dolibarr. Pour synchroniser le stock des combinaisons, renseignez aussi l'ID de l'entrepot dans les reglages du module Dolibarr.</p>
            </section>
            {message && <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p>}
            {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}
            <div className="flex flex-wrap gap-3 border-t border-[#edf0f3] pt-4">
              <button type="submit" disabled={saving} className="rounded-lg bg-[#1457a6] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{saving ? "Enregistrement..." : "Enregistrer la configuration"}</button>
              <button type="button" disabled={!config.configured || testing || syncing !== null} onClick={testConnection} className="rounded-lg border border-[#cbd5df] bg-white px-4 py-2.5 text-sm font-semibold text-[#344054] disabled:opacity-50">{testing ? "Test en cours..." : "Tester la connexion"}</button>
            </div>
          </>
        )}
      </form>
    </Card>
  );
}
