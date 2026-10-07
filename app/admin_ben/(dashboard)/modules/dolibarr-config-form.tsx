"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Badge, BlockStack, Button, Card, Checkbox, InlineGrid, Select, Text, TextField, useFrame } from '@shopify/polaris';

type Config = {
  configured: boolean; apiUrl: string; apiKeySet: boolean; integrationToken: string;
  callbackUrl: string;
  warehouseId: string; entity: string; syncProducts: boolean; syncStoreProducts: boolean;
  syncStock: boolean; syncInvoices: boolean; syncCustomers: boolean; syncOrders: boolean;
};
type Invoice = { id: string; reference: string; customerName: string | null; date: string | null; totalTtc: number | null; status: string | null; orderId: string | null };
const defaults: Config = { configured: false, apiUrl: '', apiKeySet: false, integrationToken: '', callbackUrl: '', warehouseId: '', entity: '1', syncProducts: true, syncStoreProducts: true, syncStock: true, syncInvoices: true, syncCustomers: true, syncOrders: true };

export default function DolibarrConfigForm() {
  const { showToast, hideToast } = useFrame();
  const toastCount = useRef(0);
  const [config, setConfig] = useState(defaults);
  const [apiKey, setApiKey] = useState('');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [warehouses, setWarehouses] = useState<Array<{ id: string; label: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState('');
  const [connectedVersion, setConnectedVersion] = useState('');

  const toast = useCallback((content: string, error = false) => {
    const id = `dolibarr-${Date.now()}-${++toastCount.current}`;
    showToast({ id, content, error, duration: 6000, onDismiss: () => hideToast({ id }) });
  }, [hideToast, showToast]);

  const loadInvoices = useCallback(async () => {
    const response = await fetch('/api/admin/dolibarr-integration/invoices', { cache: 'no-store' });
    const data = await response.json();
    if (response.ok) setInvoices(data);
  }, []);

  const reload = useCallback(async () => {
    const response = await fetch('/api/admin/dolibarr-integration', { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Impossible de charger la configuration.');
    setConfig({ ...defaults, ...data });
    setApiKey('');
    if (data.configured) await loadInvoices();
  }, [loadInvoices]);

  useEffect(() => { reload().catch((error: unknown) => toast(error instanceof Error ? error.message : 'Chargement impossible.', true)).finally(() => setLoading(false)); }, [reload, toast]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true);
    try {
      const response = await fetch('/api/admin/dolibarr-integration', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...config, apiKey }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Enregistrement impossible.');
      setConfig({ ...defaults, ...data }); setApiKey('');
      toast('Configuration Dolibarr enregistrée. La clé API est chiffrée sur le serveur.');
    } catch (error) { toast(error instanceof Error ? error.message : 'Enregistrement impossible.', true); }
    finally { setSaving(false); }
  }

  async function testConnection() {
    setTesting(true);
    try {
      const response = await fetch('/api/admin/dolibarr-integration/test', { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Connexion impossible.');
      setConnectedVersion(data.version ?? 'Dolibarr');
      setWarehouses(Array.isArray(data.warehouses) ? data.warehouses : []);
      const notice = data.warehouseLookupError
        ? `Connecté · ${data.version ?? 'Dolibarr'}, mais la liste des entrepôts est inaccessible: ${data.warehouseLookupError}`
        : data.warehouses?.length && !config.warehouseId
          ? `Connecté · ${data.version ?? 'Dolibarr'}. Choisissez un entrepôt pour activer le stock.`
          : `Connexion réussie · ${data.version ?? 'Dolibarr'}`;
      toast(notice, Boolean(data.warehouseLookupError));
    } catch (error) { toast(error instanceof Error ? error.message : 'Connexion impossible.', true); }
    finally { setTesting(false); }
  }

  async function sync(path: string, label: string) {
    setSyncing(path);
    try {
      const response = await fetch(`/api/admin/dolibarr-integration/${path}`, { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Synchronisation impossible.');
      const summary = path.includes('products')
        ? `${data.synced} ligne(s) produit synchronisée(s), ${data.failed} erreur(s).`
        : `${data.customersSynced} client(s), ${data.ordersSynced} commande(s), ${data.failed} erreur(s).`;
      const firstFailure = Array.isArray(data.failures) ? data.failures[0] : null;
      const failureDetails = firstFailure?.error ? ` ${firstFailure.error}` : '';
      toast(`${label} · ${summary}${failureDetails}`, Number(data.failed) > 0);
      await loadInvoices();
    } catch (error) { toast(error instanceof Error ? error.message : 'Synchronisation impossible.', true); }
    finally { setSyncing(''); }
  }

  async function copyToken() {
    try { await navigator.clipboard.writeText(config.integrationToken); toast('Jeton copié. Collez-le dans le module Dolibarr.'); }
    catch { toast('Copie impossible. Sélectionnez et copiez le jeton manuellement.', true); }
  }

  if (loading) return <Card><Text as="p" variant="bodyMd">Chargement de la configuration…</Text></Card>;

  return <BlockStack gap="400">
    <Card>
      <form onSubmit={save}>
        <BlockStack gap="400">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><Text as="h2" variant="headingMd">Connexion à Dolibarr</Text><Text as="p" variant="bodySm" tone="subdued">Connexion REST authentifiée par la clé API d’un utilisateur Dolibarr.</Text></div>
            {config.configured ? <Badge tone="success">Configuré</Badge> : <Badge tone="attention">À configurer</Badge>}
          </div>
          <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
            <TextField label="URL REST Dolibarr" value={config.apiUrl} onChange={(apiUrl) => setConfig((old) => ({ ...old, apiUrl }))} placeholder="https://dolibarr.example.com/api/index.php" autoComplete="url" helpText="Localhost accepte HTTP. En production, utilisez HTTPS." />
            <TextField label="Clé API Dolibarr" type="password" value={apiKey} onChange={setApiKey} placeholder={config.apiKeySet ? 'Laisser vide pour garder la clé actuelle' : 'Clé API de l’utilisateur Dolibarr'} autoComplete="new-password" helpText={config.apiKeySet ? 'Clé enregistrée chiffrée. Elle ne sera pas réaffichée.' : 'Envoyée dans l’en-tête DOLAPIKEY.'} />
            {warehouses.length ? <Select label="Entrepôt Dolibarr" options={[{ label: 'Choisir un entrepôt', value: '' }, ...warehouses.map((warehouse) => ({ label: `${warehouse.label} · #${warehouse.id}`, value: warehouse.id }))]} value={config.warehouseId} onChange={(warehouseId) => setConfig((old) => ({ ...old, warehouseId }))} helpText="Sélectionné parmi les entrepôts visibles par la clé API." /> : <TextField label="Entrepôt Dolibarr" type="number" value={config.warehouseId} onChange={(warehouseId) => setConfig((old) => ({ ...old, warehouseId }))} placeholder="Tester la connexion pour charger la liste" autoComplete="off" helpText="ID d’un entrepôt actif, requis pour la synchronisation du stock." />}
            <TextField label="Entité" type="number" value={config.entity} onChange={(entity) => setConfig((old) => ({ ...old, entity }))} autoComplete="off" helpText="Valeur transmise avec DOLAPIENTITY pour le multicompany." />
          </InlineGrid>
          {config.integrationToken && <div className="rounded-lg border border-[#dfe4e8] bg-[#f8fafc] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3"><div><Text as="h3" variant="headingSm">Jeton de retour Dolibarr → boutique</Text><Text as="p" variant="bodySm" tone="subdued">À copier dans la configuration du module FGMC installé dans Dolibarr.</Text></div><Button onClick={copyToken}>Copier</Button></div>
            <input aria-label="Jeton de synchronisation" readOnly value={config.integrationToken} className="mt-3 w-full rounded-md border border-[#cbd5df] bg-white px-3 py-2 font-mono text-xs text-[#344054]" />
            <div className="mt-3 flex flex-wrap items-end gap-2"><div className="min-w-64 flex-1"><TextField label="URL callback à saisir dans le module Dolibarr" value={config.callbackUrl} onChange={() => {}} readOnly autoComplete="off" /></div><Button onClick={() => navigator.clipboard.writeText(config.callbackUrl).then(() => toast('URL callback copiée.')).catch(() => toast('Copie impossible.', true))}>Copier l’URL</Button></div>
          </div>}
          <div>
            <Text as="h3" variant="headingSm">Données synchronisées</Text>
            <div className="mt-3 grid gap-x-5 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
              <Checkbox label="Produits boutique → Dolibarr" checked={config.syncProducts} onChange={(syncProducts) => setConfig((old) => ({ ...old, syncProducts }))} />
              <Checkbox label="Produits Dolibarr → boutique" checked={config.syncStoreProducts} onChange={(syncStoreProducts) => setConfig((old) => ({ ...old, syncStoreProducts }))} />
              <Checkbox label="Stock Dolibarr → boutique" checked={config.syncStock} onChange={(syncStock) => setConfig((old) => ({ ...old, syncStock }))} />
              <Checkbox label="Clients boutique → Dolibarr" checked={config.syncCustomers} onChange={(syncCustomers) => setConfig((old) => ({ ...old, syncCustomers }))} />
              <Checkbox label="Commandes boutique → Dolibarr" checked={config.syncOrders} onChange={(syncOrders) => setConfig((old) => ({ ...old, syncOrders }))} />
              <Checkbox label="Factures validées Dolibarr → boutique" checked={config.syncInvoices} onChange={(syncInvoices) => setConfig((old) => ({ ...old, syncInvoices }))} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" submit loading={saving}>Enregistrer</Button>
            <Button onClick={testConnection} loading={testing} disabled={!config.configured}>Tester la connexion</Button>
            {connectedVersion && <Badge tone="success">Connecté · {connectedVersion}</Badge>}
          </div>
        </BlockStack>
      </form>
    </Card>

    <Card>
      <BlockStack gap="300">
        <div><Text as="h2" variant="headingMd">Synchronisation initiale</Text><Text as="p" variant="bodySm" tone="subdued">Synchronisez le catalogue de produits dans le sens souhaite.</Text></div>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={() => void sync('sync/products', 'Produits')} loading={syncing === 'sync/products'} disabled={!config.configured || !config.syncProducts || Boolean(syncing)}>Synchroniser les produits et variantes</Button>
          <Button onClick={() => void sync('sync/products/from-dolibarr', 'Catalogue Dolibarr')} loading={syncing === 'sync/products/from-dolibarr'} disabled={!config.configured || !config.syncStoreProducts || Boolean(syncing)}>Importer le catalogue Dolibarr</Button>
        </div>
        <Text as="p" variant="bodySm" tone="subdued">Les synchronisations manuelles sont relançables; les produits déjà liés sont mis à jour. Les événements de facture validée sont reçus par le module Dolibarr.</Text>
      </BlockStack>
    </Card>

    <Card>
      <BlockStack gap="300">
        <div>
          <Text as="h2" variant="headingMd">Clients et commandes de la boutique</Text>
          <Text as="p" variant="bodySm" tone="subdued">Envoie les clients non lies vers Dolibarr, puis cree les commandes avec leurs lignes. Activez ces options et enregistrez la configuration avant de lancer la synchronisation.</Text>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary" onClick={() => void sync('sync/customers-orders', 'Clients et commandes')} loading={syncing === 'sync/customers-orders'} disabled={!config.configured || (!config.syncCustomers && !config.syncOrders) || Boolean(syncing)}>Synchroniser les clients et commandes vers Dolibarr</Button>
          <Text as="span" variant="bodySm" tone="subdued">Clients : {config.syncCustomers ? 'actif' : 'inactif'} | Commandes : {config.syncOrders ? 'actif' : 'inactif'}</Text>
        </div>
        <Text as="p" variant="bodySm" tone="subdued">Les clients sont synchronises avant les commandes pour associer chaque commande a son tiers Dolibarr. Le resultat et les eventuelles erreurs apparaitront dans une notification.</Text>
      </BlockStack>
    </Card>

    <Card>
      <BlockStack gap="300">
        <div className="flex items-center justify-between gap-3"><div><Text as="h2" variant="headingMd">Factures reçues</Text><Text as="p" variant="bodySm" tone="subdued">Factures Dolibarr validées et liées aux commandes de la boutique.</Text></div><Button onClick={() => void loadInvoices()}>Actualiser</Button></div>
        {invoices.length ? <div className="overflow-x-auto"><table className="w-full min-w-[620px] border-collapse text-left text-sm"><thead><tr className="border-b border-[#dfe4e8] text-xs text-[#667085]"><th className="py-2">Référence</th><th className="py-2">Client</th><th className="py-2">Commande boutique</th><th className="py-2">Date</th><th className="py-2 text-right">TTC</th></tr></thead><tbody>{invoices.map((invoice) => <tr key={invoice.id} className="border-b border-[#edf0f3]"><td className="py-3 font-medium">{invoice.reference}</td><td className="py-3">{invoice.customerName || '—'}</td><td className="py-3">{invoice.orderId || 'Non liée'}</td><td className="py-3">{invoice.date ? new Date(invoice.date).toLocaleDateString('fr-FR') : '—'}</td><td className="py-3 text-right">{invoice.totalTtc == null ? '—' : new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(invoice.totalTtc)}</td></tr>)}</tbody></table></div> : <div className="rounded-lg border border-dashed border-[#cbd5df] p-6 text-center"><Text as="p" variant="bodySm" tone="subdued">Aucune facture reçue pour le moment.</Text></div>}
      </BlockStack>
    </Card>
  </BlockStack>;
}
