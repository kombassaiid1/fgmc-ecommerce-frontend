"use client";

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Badge, Card } from '@shopify/polaris';

type Config = { configured: boolean; shopUrl: string; apiKeySet: boolean };
type RemoteProduct = { id: string; title: string; reference: string; priceHT: string; quantity: string; manufacturerId: string; categoryId: string; taxRulesGroupId: string };
type Preview = { id: string; title: string; shortDescription: string; description: string; reference: string; priceHT: string; slug: string; brand: string; categories: string[]; taxRulesGroupId: string; images: number; features: number; combinations: number; quantity: string; active: boolean };
const emptyConfig: Config = { configured: false, shopUrl: '', apiKeySet: false };

export default function PrestashopConfigForm() {
  const [config, setConfig] = useState(emptyConfig);
  const [apiKey, setApiKey] = useState('');
  const [products, setProducts] = useState<RemoteProduct[]>([]);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewing, setPreviewing] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [searching, setSearching] = useState(false);
  const [importing, setImporting] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    const response = await fetch('/api/admin/prestashop-integration', { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Chargement impossible.');
    setConfig({ ...emptyConfig, ...data });
    setApiKey('');
  }, []);

  useEffect(() => { reload().catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Chargement impossible.')).finally(() => setLoading(false)); }, [reload]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(''); setMessage('');
    try {
      const response = await fetch('/api/admin/prestashop-integration', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ shopUrl: config.shopUrl, apiKey }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Enregistrement impossible.');
      await reload(); setMessage('Configuration enregistrée. La clé Webservice est chiffrée sur le serveur.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Enregistrement impossible.'); }
    finally { setSaving(false); }
  }

  async function testConnection() {
    setTesting(true); setError(''); setMessage('');
    try {
      const response = await fetch('/api/admin/prestashop-integration/test', { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Connexion impossible.');
      setMessage(`Connexion réussie à ${data.shopUrl}.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Connexion impossible.'); }
    finally { setTesting(false); }
  }

  async function searchProducts(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSearching(true); setError(''); setMessage('');
    try {
      const response = await fetch(`/api/admin/prestashop-integration/products?search=${encodeURIComponent(search)}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Recherche impossible.');
      setProducts(data);
      if (!data.length) setMessage('Aucun produit trouvé. Essayez sa référence ou une partie de son nom.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Recherche impossible.'); }
    finally { setSearching(false); }
  }

  async function importProduct(product: Pick<RemoteProduct, 'id'>) {
    setImporting(product.id); setError(''); setMessage('');
    try {
      const response = await fetch(`/api/admin/prestashop-integration/products/${encodeURIComponent(product.id)}/import`, { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Import impossible.');
      const combinationPriceNote = data.combinationSpecificPrices
        ? ` ${data.combinationSpecificPrices} prix spécifiques liés à une déclinaison n'ont pas été importés (cette règle n'est pas encore gérée par le catalogue).`
        : '';
      setMessage(`${data.updated ? 'Produit mis à jour' : 'Produit importé comme brouillon'} : ${data.title}. Images : ${data.images}, catégories : ${data.categories}, attributs : ${data.attributes}, déclinaisons : ${data.combinations}, prix spécifiques : ${data.specificPrices ?? 0}.${combinationPriceNote} ${data.taxMapped ? 'Taxe associée.' : 'Taxe non associée automatiquement : vérifiez le taux dans la fiche produit.'}`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Import impossible.'); }
    finally { setImporting(null); }
  }

  async function loadPreview(product: RemoteProduct) {
    setPreviewing(product.id); setError(''); setMessage('');
    try {
      const response = await fetch(`/api/admin/prestashop-integration/products/${encodeURIComponent(product.id)}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Aperçu impossible.');
      setPreview(data);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Aperçu impossible.'); }
    finally { setPreviewing(null); }
  }

  return (
    <div className="space-y-5">
      <Card>
        <form onSubmit={save} className="space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div><h2 className="text-base font-semibold text-[#24364b]">Connexion à la boutique</h2><p className="mt-1 text-sm text-[#667085]">Le Webservice PrestaShop doit être activé avec les droits de lecture sur les produits, catégories, fabricants, caractéristiques, déclinaisons, taxes et images.</p></div>
            {config.configured && <Badge tone="success">Configuré</Badge>}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm font-semibold text-[#344054]">URL de la boutique PrestaShop<input required type="url" value={config.shopUrl} onChange={(event) => setConfig({ ...config, shopUrl: event.target.value })} placeholder="https://boutique.example.com" className="mt-1 block w-full rounded-lg border border-[#cbd5df] px-3 py-2.5 font-normal outline-none focus:border-[#1457a6]" /><span className="mt-1 block text-xs font-normal text-[#667085]">Entre l’URL du magasin, sans identifiant ni clé API.</span></label>
            <label className="text-sm font-semibold text-[#344054]">Clé Webservice {config.apiKeySet && <span className="font-normal text-emerald-700">· enregistrée</span>}<input type="password" autoComplete="new-password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={config.apiKeySet ? 'Laisser vide pour garder la clé actuelle' : 'Clé créée dans Paramètres avancés > Webservice'} className="mt-1 block w-full rounded-lg border border-[#cbd5df] px-3 py-2.5 font-normal outline-none focus:border-[#1457a6]" /><span className="mt-1 block text-xs font-normal text-[#667085]">La clé est chiffrée côté serveur et n’est jamais renvoyée à cette page.</span></label>
          </div>
          <div className="flex flex-wrap gap-3">
            <button disabled={saving || loading} className="rounded-lg bg-[#1457a6] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
            <button type="button" onClick={testConnection} disabled={!config.configured || saving || testing} className="rounded-lg border border-[#cbd5df] px-4 py-2.5 text-sm font-semibold text-[#344054] disabled:opacity-50">{testing ? 'Test en cours…' : 'Tester la connexion'}</button>
          </div>
        </form>
      </Card>

      <Card>
        <form onSubmit={searchProducts} className="flex flex-wrap items-end gap-3">
          <label className="min-w-64 flex-1 text-sm font-semibold text-[#344054]">Choisir un produit à importer<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nom ou référence PrestaShop" className="mt-1 block w-full rounded-lg border border-[#cbd5df] px-3 py-2.5 font-normal outline-none focus:border-[#1457a6]" /></label>
          <button disabled={!config.configured || searching} className="rounded-lg bg-[#1457a6] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{searching ? 'Recherche…' : 'Rechercher'}</button>
        </form>
        <p className="mt-3 text-xs text-[#667085]">L’import met à jour le produit déjà associé à son identifiant PrestaShop, ou à sa référence.</p>
        {products.length > 0 && <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[760px] border-collapse text-left text-sm"><thead><tr className="border-b border-[#dce4ea] text-xs uppercase text-[#667085]"><th className="py-3 pr-3">Produit</th><th className="py-3 pr-3">Référence</th><th className="py-3 pr-3">Prix HT</th><th className="py-3 pr-3">Stock</th><th className="py-3 text-right">Action</th></tr></thead><tbody>{products.map((product) => <tr key={product.id} className="border-b border-[#edf0f3]"><td className="py-3 pr-3 font-medium text-[#24364b]">{product.title || `Produit ${product.id}`}<span className="ml-2 text-xs text-[#98a2b3]">ID {product.id}</span></td><td className="py-3 pr-3">{product.reference || '—'}</td><td className="py-3 pr-3">{product.priceHT}</td><td className="py-3 pr-3">{product.quantity || '0'}</td><td className="py-3 text-right"><button type="button" onClick={() => loadPreview(product)} disabled={Boolean(previewing) || Boolean(importing)} className="rounded-md border border-[#cbd5df] px-3 py-2 text-xs font-semibold text-[#344054] disabled:opacity-50">{previewing === product.id ? 'Chargement…' : 'Aperçu'}</button></td></tr>)}</tbody></table></div>}
        {preview && <div className="mt-5 rounded-lg border border-[#dce4ea] bg-[#f8fafc] p-4">
          <div className="flex flex-wrap items-start justify-between gap-4"><div><h3 className="font-semibold text-[#24364b]">{preview.title}</h3><p className="mt-1 text-xs text-[#667085]">Produit PrestaShop #{preview.id} · {preview.active ? 'actif dans PrestaShop' : 'inactif dans PrestaShop'} · import en brouillon pour validation</p></div><button type="button" onClick={() => importProduct({ id: preview.id })} disabled={Boolean(importing)} className="rounded-md bg-[#1457a6] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">{importing === preview.id ? 'Import…' : 'Importer ce produit'}</button></div>
          <dl className="mt-4 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3"><div><dt className="text-xs text-[#667085]">Référence</dt><dd>{preview.reference || '—'}</dd></div><div><dt className="text-xs text-[#667085]">Prix HT (valeur boutique)</dt><dd>{preview.priceHT}</dd></div><div><dt className="text-xs text-[#667085]">Slug</dt><dd>{preview.slug || '—'}</dd></div><div><dt className="text-xs text-[#667085]">Marque</dt><dd>{preview.brand || 'Sans marque'}</dd></div><div><dt className="text-xs text-[#667085]">Catégories</dt><dd>{preview.categories.join(', ') || '—'}</dd></div><div><dt className="text-xs text-[#667085]">Groupe de taxe / stock</dt><dd>{preview.taxRulesGroupId || '—'} / {preview.quantity || '0'}</dd></div><div><dt className="text-xs text-[#667085]">Images · caractéristiques · déclinaisons</dt><dd>{preview.images} · {preview.features} · {preview.combinations}</dd></div></dl>
          {preview.shortDescription && <div className="mt-4"><p className="text-xs text-[#667085]">Description courte</p><p className="mt-1 line-clamp-3 text-sm">{preview.shortDescription.replace(/<[^>]*>/g, ' ')}</p></div>}
        </div>}
      </Card>
      {message && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</p>}
      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
    </div>
  );
}
