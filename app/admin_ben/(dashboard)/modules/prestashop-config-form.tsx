"use client";

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Badge, Card } from '@shopify/polaris';

type Config = { configured: boolean; shopUrl: string; apiKeySet: boolean };
type RemoteProduct = { id: string; title: string; reference: string; priceHT: string; quantity: string; manufacturerId: string; categoryId: string; taxRulesGroupId: string };
type Preview = { id: string; title: string; shortDescription: string; description: string; reference: string; priceHT: string; slug: string; brand: string; categories: string[]; taxRulesGroupId: string; images: number; features: number; combinations: number; quantity: string; active: boolean };
type RemoteTax = { id: string; name: string; rate: number; active: boolean; imported: boolean };
type RemoteBrand = { id: string; name: string; active: boolean; imported: boolean };
type ImportCandidate = { id: string; title: string; reference: string; priceHT: string; quantity: string; active: boolean; duplicate: boolean; duplicateTitle: string | null };
const emptyConfig: Config = { configured: false, shopUrl: '', apiKeySet: false };

export default function PrestashopConfigForm() {
  const [config, setConfig] = useState(emptyConfig);
  const [apiKey, setApiKey] = useState('');
  const [products, setProducts] = useState<RemoteProduct[]>([]);
  const [taxes, setTaxes] = useState<RemoteTax[]>([]);
  const [selectedTaxIds, setSelectedTaxIds] = useState<string[]>([]);
  const [brands, setBrands] = useState<RemoteBrand[]>([]);
  const [selectedBrandIds, setSelectedBrandIds] = useState<string[]>([]);
  const [catalogCandidates, setCatalogCandidates] = useState<ImportCandidate[]>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [catalogImportResults, setCatalogImportResults] = useState<Record<string, string>>({});
  const [catalogScanned, setCatalogScanned] = useState(0);
  const [catalogImportProgress, setCatalogImportProgress] = useState({ done: 0, total: 0 });
  const [catalogFilter, setCatalogFilter] = useState<'all' | 'new' | 'duplicate' | 'offline'>('all');
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogPage, setCatalogPage] = useState(0);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewing, setPreviewing] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [searching, setSearching] = useState(false);
  const [loadingTaxes, setLoadingTaxes] = useState(false);
  const [importingTaxes, setImportingTaxes] = useState(false);
  const [loadingBrands, setLoadingBrands] = useState(false);
  const [importingBrands, setImportingBrands] = useState(false);
  const [scanningCatalog, setScanningCatalog] = useState(false);
  const [importingCatalog, setImportingCatalog] = useState(false);
  const [pendingImportIds, setPendingImportIds] = useState<string[]>([]);
  const [showImportStatusDialog, setShowImportStatusDialog] = useState(false);
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

  async function loadTaxes() {
    setLoadingTaxes(true); setError(''); setMessage('');
    try {
      const response = await fetch('/api/admin/prestashop-integration/taxes', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Chargement des taxes impossible.');
      const rows: RemoteTax[] = data;
      setTaxes(rows);
      setSelectedTaxIds(rows.filter((tax) => !tax.imported).map((tax) => tax.id));
      if (!rows.length) setMessage('Aucune taxe trouvée dans PrestaShop.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Chargement des taxes impossible.'); }
    finally { setLoadingTaxes(false); }
  }

  async function importSelectedTaxes() {
    setImportingTaxes(true); setError(''); setMessage('');
    try {
      const response = await fetch('/api/admin/prestashop-integration/taxes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taxIds: selectedTaxIds }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Import des taxes impossible.');
      await loadTaxes();
      setMessage(`Import terminé : ${data.imported} taxe(s) ajoutée(s), ${data.skipped} déjà présente(s).`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Import des taxes impossible.'); }
    finally { setImportingTaxes(false); }
  }

  async function loadBrands() {
    setLoadingBrands(true); setError(''); setMessage('');
    try {
      const response = await fetch('/api/admin/prestashop-integration/brands', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Chargement des marques impossible.');
      const rows: RemoteBrand[] = data;
      setBrands(rows);
      setSelectedBrandIds(rows.filter((brand) => !brand.imported).map((brand) => brand.id));
      if (!rows.length) setMessage('Aucune marque trouvée dans PrestaShop.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Chargement des marques impossible.'); }
    finally { setLoadingBrands(false); }
  }

  async function importSelectedBrands() {
    setImportingBrands(true); setError(''); setMessage('');
    try {
      const response = await fetch('/api/admin/prestashop-integration/brands', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandIds: selectedBrandIds }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Import des marques impossible.');
      await loadBrands();
      setMessage(`Import terminé : ${data.imported} marque(s) ajoutée(s), ${data.skipped} déjà présente(s), ${data.imagesImported} image(s) importée(s).`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Import des marques impossible.'); }
    finally { setImportingBrands(false); }
  }

  async function scanProductCatalog() {
    setScanningCatalog(true); setError(''); setMessage(''); setCatalogScanned(0);
    setCatalogCandidates([]); setSelectedProductIds([]); setCatalogImportResults({});
    const collected: ImportCandidate[] = [];
    const pageSize = 100;
    const parallelPages = 4;
    let offset = 0;
    try {
      let hasMore = true;
      while (hasMore) {
        const offsets = Array.from({ length: parallelPages }, (_, index) => offset + index * pageSize);
        const pages = await Promise.all(offsets.map(async (pageOffset) => {
          const response = await fetch(`/api/admin/prestashop-integration/products/import-candidates?offset=${pageOffset}&limit=${pageSize}`, { cache: 'no-store' });
          const data = await response.json();
          if (!response.ok) throw new Error(data.message || `Chargement impossible à partir du produit ${pageOffset + 1}.`);
          return data as { items: ImportCandidate[]; hasMore: boolean };
        }));
        for (const page of pages) collected.push(...page.items);
        setCatalogCandidates([...collected]);
        setCatalogScanned(collected.length);
        hasMore = pages.every((page) => page.hasMore);
        offset += parallelPages * pageSize;
      }
      setSelectedProductIds(collected.filter((product) => !product.duplicate).map((product) => product.id));
      const duplicates = collected.filter((product) => product.duplicate).length;
      const offline = collected.filter((product) => !product.active).length;
      setMessage(`Analyse terminée : ${collected.length} produits, ${duplicates} déjà présents dans la boutique, ${offline} inactifs / non publiés sur PrestaShop.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Analyse du catalogue impossible.');
    } finally { setScanningCatalog(false); }
  }

  function requestProductImport(ids: string[]) {
    if (!ids.length) return;
    setPendingImportIds([...ids]);
    setShowImportStatusDialog(true);
  }

  async function importSelectedProducts(status: 'PUBLIC' | 'DRAFT', productIds = selectedProductIds) {
    const ids = [...productIds];
    if (!ids.length) return;
    setShowImportStatusDialog(false);
    setImportingCatalog(true); setError(''); setMessage(''); setCatalogImportProgress({ done: 0, total: ids.length });
    const results = { ...catalogImportResults };
    let imported = 0;
    let failed = 0;
    try {
      for (let index = 0; index < ids.length; index++) {
        const id = ids[index];
        try {
          const response = await fetch(`/api/admin/prestashop-integration/products/${encodeURIComponent(id)}/import`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.message || 'Import impossible.');
          results[id] = 'Importé';
          imported++;
        } catch (cause) {
          results[id] = cause instanceof Error ? `Échec : ${cause.message}` : 'Échec de l’import';
          failed++;
        }
        if (index % 5 === 4 || index === ids.length - 1) {
          setCatalogImportResults({ ...results });
          setCatalogImportProgress({ done: index + 1, total: ids.length });
        }
      }
      setMessage(`Import terminé : ${imported} produit(s) ${status === 'PUBLIC' ? 'publié(s)' : 'en brouillon'}, ${failed} échec(s).`);
    } finally { setImportingCatalog(false); }
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

  const filteredCatalogCandidates = catalogCandidates.filter((product) => {
    const matchesFilter = catalogFilter === 'all'
      || (catalogFilter === 'new' && !product.duplicate)
      || (catalogFilter === 'duplicate' && product.duplicate)
      || (catalogFilter === 'offline' && !product.active);
    const query = catalogSearch.trim().toLocaleLowerCase();
    return matchesFilter && (!query || `${product.title} ${product.reference} ${product.id}`.toLocaleLowerCase().includes(query));
  });
  const catalogPageSize = 50;
  const catalogPageCount = Math.max(1, Math.ceil(filteredCatalogCandidates.length / catalogPageSize));
  const visibleCatalogCandidates = filteredCatalogCandidates.slice(catalogPage * catalogPageSize, (catalogPage + 1) * catalogPageSize);
  const selectedProductIdSet = new Set(selectedProductIds);
  const hasSelectedInactiveProducts = catalogCandidates.some((product) => !product.active && selectedProductIdSet.has(product.id));

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
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-[#24364b]">Taxes PrestaShop</h2>
            <p className="mt-1 text-sm text-[#667085]">Chargez les taux de taxe de votre boutique, puis importez tout ou seulement ceux que vous choisissez.</p>
          </div>
          <button type="button" onClick={loadTaxes} disabled={!config.configured || loadingTaxes || importingTaxes} className="rounded-lg border border-[#cbd5df] px-4 py-2.5 text-sm font-semibold text-[#344054] disabled:opacity-50">
            {loadingTaxes ? 'Chargement…' : taxes.length ? 'Actualiser les taxes' : 'Charger les taxes'}
          </button>
        </div>
        {taxes.length > 0 && <>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-y border-[#edf0f3] py-3">
            <p className="text-sm text-[#667085]">{taxes.length} taxe(s) trouvée(s) · {taxes.filter((tax) => tax.imported).length} déjà dans la boutique</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setSelectedTaxIds(taxes.filter((tax) => !tax.imported).map((tax) => tax.id))} className="rounded-md border border-[#cbd5df] px-3 py-2 text-xs font-semibold text-[#344054]">Sélectionner les nouvelles</button>
              <button type="button" onClick={() => setSelectedTaxIds([])} className="rounded-md border border-[#cbd5df] px-3 py-2 text-xs font-semibold text-[#344054]">Tout désélectionner</button>
              <button type="button" onClick={importSelectedTaxes} disabled={!selectedTaxIds.length || importingTaxes || loadingTaxes} className="rounded-md bg-[#1457a6] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">
                {importingTaxes ? 'Import…' : `Importer ${selectedTaxIds.length} sélectionnée(s)`}
              </button>
            </div>
          </div>
          <div className="mt-2 max-h-80 overflow-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="sticky top-0 bg-white text-xs uppercase text-[#667085]"><tr className="border-b border-[#dce4ea]"><th className="w-12 py-3 pl-2">Choix</th><th className="py-3">Taxe</th><th className="py-3">Taux</th><th className="py-3 text-right">État</th></tr></thead>
              <tbody>{taxes.map((tax) => <tr key={tax.id} className="border-b border-[#edf0f3]">
                <td className="py-3 pl-2"><input type="checkbox" aria-label={`Sélectionner ${tax.name}`} checked={selectedTaxIds.includes(tax.id)} disabled={tax.imported || importingTaxes} onChange={(event) => setSelectedTaxIds((current) => event.target.checked ? [...current, tax.id] : current.filter((id) => id !== tax.id))} /></td>
                <td className="py-3 font-medium text-[#24364b]">{tax.name}<span className="ml-2 text-xs text-[#98a2b3]">ID {tax.id}</span></td>
                <td className="py-3">{tax.rate}%</td>
                <td className="py-3 text-right">{tax.imported ? <Badge tone="success">Déjà importée</Badge> : tax.active ? <Badge tone="info">Disponible</Badge> : <Badge tone="warning">Inactive</Badge>}</td>
              </tr>)}</tbody>
            </table>
          </div>
        </>}
      </Card>

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-[#24364b]">Marques PrestaShop</h2>
            <p className="mt-1 text-sm text-[#667085]">Chargez les marques, sélectionnez celles à importer et récupérez leur image depuis PrestaShop si elle existe.</p>
          </div>
          <button type="button" onClick={loadBrands} disabled={!config.configured || loadingBrands || importingBrands} className="rounded-lg border border-[#cbd5df] px-4 py-2.5 text-sm font-semibold text-[#344054] disabled:opacity-50">
            {loadingBrands ? 'Chargement…' : brands.length ? 'Actualiser les marques' : 'Charger les marques'}
          </button>
        </div>
        {brands.length > 0 && <>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-y border-[#edf0f3] py-3">
            <p className="text-sm text-[#667085]">{brands.length} marque(s) trouvée(s) · {brands.filter((brand) => brand.imported).length} déjà dans la boutique</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setSelectedBrandIds(brands.filter((brand) => !brand.imported).map((brand) => brand.id))} className="rounded-md border border-[#cbd5df] px-3 py-2 text-xs font-semibold text-[#344054]">Sélectionner les nouvelles</button>
              <button type="button" onClick={() => setSelectedBrandIds([])} className="rounded-md border border-[#cbd5df] px-3 py-2 text-xs font-semibold text-[#344054]">Tout désélectionner</button>
              <button type="button" onClick={importSelectedBrands} disabled={!selectedBrandIds.length || importingBrands || loadingBrands} className="rounded-md bg-[#1457a6] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">
                {importingBrands ? 'Import…' : `Importer ${selectedBrandIds.length} sélectionnée(s)`}
              </button>
            </div>
          </div>
          <div className="mt-2 max-h-80 overflow-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="sticky top-0 bg-white text-xs uppercase text-[#667085]"><tr className="border-b border-[#dce4ea]"><th className="w-12 py-3 pl-2">Choix</th><th className="py-3">Marque</th><th className="py-3 text-right">État</th></tr></thead>
              <tbody>{brands.map((brand) => <tr key={brand.id} className="border-b border-[#edf0f3]">
                <td className="py-3 pl-2"><input type="checkbox" aria-label={`Sélectionner ${brand.name}`} checked={selectedBrandIds.includes(brand.id)} disabled={brand.imported || importingBrands} onChange={(event) => setSelectedBrandIds((current) => event.target.checked ? [...current, brand.id] : current.filter((id) => id !== brand.id))} /></td>
                <td className="py-3 font-medium text-[#24364b]">{brand.name}<span className="ml-2 text-xs text-[#98a2b3]">ID {brand.id}</span></td>
                <td className="py-3 text-right">{brand.imported ? <Badge tone="success">Déjà importée</Badge> : brand.active ? <Badge tone="info">Disponible</Badge> : <Badge tone="warning">Inactive</Badge>}</td>
              </tr>)}</tbody>
            </table>
          </div>
        </>}
      </Card>

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-[#24364b]">Import du catalogue produits</h2>
            <p className="mt-1 max-w-3xl text-sm text-[#667085]">Analyse les produits PrestaShop par pages de 100 pour détecter les produits déjà liés ou ayant la même référence. Le scan complet peut prendre un moment pour un catalogue de 21&nbsp;548 produits.</p>
          </div>
          <button type="button" onClick={scanProductCatalog} disabled={!config.configured || scanningCatalog || importingCatalog} className="rounded-lg bg-[#1457a6] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
            {scanningCatalog ? `Analyse… ${catalogScanned} produits` : catalogCandidates.length ? 'Réanalyser tout le catalogue' : 'Analyser tout le catalogue'}
          </button>
        </div>
        {catalogCandidates.length > 0 && <>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-[#dce4ea] bg-[#f8fafc] p-3"><p className="text-xs text-[#667085]">Produits analysés</p><p className="mt-1 text-lg font-semibold text-[#24364b]">{catalogCandidates.length}</p></div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3"><p className="text-xs text-amber-800">Doublons / produits déjà liés</p><p className="mt-1 text-lg font-semibold text-amber-900">{catalogCandidates.filter((product) => product.duplicate).length}</p></div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3"><p className="text-xs text-slate-600">Inactifs / non publiés dans PrestaShop</p><p className="mt-1 text-lg font-semibold text-slate-800">{catalogCandidates.filter((product) => !product.active).length}</p></div>
          </div>
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <label className="min-w-56 flex-1 text-xs font-semibold text-[#667085]">Rechercher dans le catalogue
              <input value={catalogSearch} onChange={(event) => { setCatalogSearch(event.target.value); setCatalogPage(0); }} placeholder="Nom, référence ou ID PrestaShop" className="mt-1 block w-full rounded-lg border border-[#cbd5df] px-3 py-2 text-sm font-normal text-[#344054] outline-none focus:border-[#1457a6]" />
            </label>
            <label className="text-xs font-semibold text-[#667085]">Afficher
              <select value={catalogFilter} onChange={(event) => { setCatalogFilter(event.target.value as typeof catalogFilter); setCatalogPage(0); }} className="mt-1 block rounded-lg border border-[#cbd5df] bg-white px-3 py-2 text-sm font-normal text-[#344054]">
                <option value="all">Tous les produits</option><option value="new">Nouveaux</option><option value="duplicate">Doublons</option><option value="offline">Inactifs / non publiés</option>
              </select>
            </label>
            <button type="button" onClick={() => setSelectedProductIds(catalogCandidates.filter((product) => !product.duplicate).map((product) => product.id))} disabled={importingCatalog} className="rounded-md border border-[#cbd5df] px-3 py-2 text-xs font-semibold text-[#344054] disabled:opacity-50">Sélectionner les nouveaux</button>
            <button type="button" onClick={() => { const activeIds = new Set(catalogCandidates.filter((product) => product.active).map((product) => product.id)); setSelectedProductIds((current) => current.filter((id) => activeIds.has(id))); }} disabled={importingCatalog || !hasSelectedInactiveProducts} className="rounded-md border border-[#cbd5df] px-3 py-2 text-xs font-semibold text-[#344054] disabled:opacity-50">Désélectionner les inactifs</button>
            <button type="button" onClick={() => setSelectedProductIds([])} disabled={importingCatalog} className="rounded-md border border-[#cbd5df] px-3 py-2 text-xs font-semibold text-[#344054] disabled:opacity-50">Tout désélectionner</button>
            <button type="button" onClick={() => requestProductImport(selectedProductIds)} disabled={!selectedProductIds.length || importingCatalog || scanningCatalog} className="rounded-md bg-[#1457a6] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">
              {importingCatalog ? `Import… ${catalogImportProgress.done}/${catalogImportProgress.total}` : `Importer ${selectedProductIds.length} sélectionné(s)`}
            </button>
          </div>
          {scanningCatalog && <p role="status" className="mt-3 text-sm text-[#1457a6]">Pages de 100 produits analysées · {catalogScanned} produits vérifiés…</p>}
          {importingCatalog && <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#e8edf3]"><div className="h-full rounded-full bg-[#1457a6] transition-all" style={{ width: `${catalogImportProgress.total ? Math.round(catalogImportProgress.done / catalogImportProgress.total * 100) : 0}%` }} /></div>}
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[780px] border-collapse text-left text-sm">
              <thead className="text-xs uppercase text-[#667085]"><tr className="border-b border-[#dce4ea]"><th className="w-12 py-3 pl-2">Choix</th><th className="py-3 pr-3">Produit</th><th className="py-3 pr-3">Référence</th><th className="py-3 pr-3">Prix HT</th><th className="py-3 pr-3">Stock</th><th className="py-3">État PrestaShop / boutique</th></tr></thead>
              <tbody>{visibleCatalogCandidates.map((product) => <tr key={product.id} className="border-b border-[#edf0f3]">
                <td className="py-3 pl-2"><input type="checkbox" aria-label={`Sélectionner ${product.title}`} checked={selectedProductIds.includes(product.id)} disabled={importingCatalog || catalogImportResults[product.id] === 'Importé'} onChange={(event) => setSelectedProductIds((current) => event.target.checked ? [...current, product.id] : current.filter((id) => id !== product.id))} /></td>
                <td className="py-3 pr-3 font-medium text-[#24364b]">{product.title || `Produit ${product.id}`}<span className="ml-2 text-xs text-[#98a2b3]">ID {product.id}</span>{product.duplicate && <span className="mt-1 block text-xs text-amber-700">Correspond au produit boutique : {product.duplicateTitle}</span>}</td>
                <td className="py-3 pr-3">{product.reference || '—'}</td><td className="py-3 pr-3">{product.priceHT}</td><td className="py-3 pr-3">{product.quantity}</td>
                <td className="py-3"><div className="flex flex-wrap gap-1.5">{product.active ? <Badge tone="success">Publié</Badge> : <Badge tone="warning">Inactif / non publié</Badge>}{product.duplicate && <Badge tone="attention">Doublon · mise à jour</Badge>}{catalogImportResults[product.id] && <Badge tone={catalogImportResults[product.id] === 'Importé' ? 'success' : 'critical'}>{catalogImportResults[product.id]}</Badge>}</div></td>
              </tr>)}</tbody>
            </table>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-[#667085]">
            <span>{filteredCatalogCandidates.length ? `${catalogPage * catalogPageSize + 1}–${Math.min((catalogPage + 1) * catalogPageSize, filteredCatalogCandidates.length)} sur ${filteredCatalogCandidates.length}` : 'Aucun produit à afficher'} · {selectedProductIds.length} sélectionné(s)</span>
            <div className="flex gap-2"><button type="button" onClick={() => setCatalogPage((page) => Math.max(0, page - 1))} disabled={catalogPage === 0} className="rounded-md border border-[#cbd5df] px-3 py-1.5 disabled:opacity-40">Précédent</button><span className="px-2 py-1.5">Page {catalogPage + 1} / {catalogPageCount}</span><button type="button" onClick={() => setCatalogPage((page) => Math.min(catalogPageCount - 1, page + 1))} disabled={catalogPage + 1 >= catalogPageCount} className="rounded-md border border-[#cbd5df] px-3 py-1.5 disabled:opacity-40">Suivant</button></div>
          </div>
        </>}
      </Card>

      <Card>
        <form onSubmit={searchProducts} className="flex flex-wrap items-end gap-3">
          <label className="min-w-64 flex-1 text-sm font-semibold text-[#344054]">Choisir un produit à importer<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nom ou référence PrestaShop" className="mt-1 block w-full rounded-lg border border-[#cbd5df] px-3 py-2.5 font-normal outline-none focus:border-[#1457a6]" /></label>
          <button disabled={!config.configured || searching} className="rounded-lg bg-[#1457a6] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{searching ? 'Recherche…' : 'Rechercher'}</button>
        </form>
        <p className="mt-3 text-xs text-[#667085]">L’import met à jour le produit déjà associé à son identifiant PrestaShop, ou à sa référence.</p>
        {products.length > 0 && <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[760px] border-collapse text-left text-sm"><thead><tr className="border-b border-[#dce4ea] text-xs uppercase text-[#667085]"><th className="py-3 pr-3">Produit</th><th className="py-3 pr-3">Référence</th><th className="py-3 pr-3">Prix HT</th><th className="py-3 pr-3">Stock</th><th className="py-3 text-right">Action</th></tr></thead><tbody>{products.map((product) => <tr key={product.id} className="border-b border-[#edf0f3]"><td className="py-3 pr-3 font-medium text-[#24364b]">{product.title || `Produit ${product.id}`}<span className="ml-2 text-xs text-[#98a2b3]">ID {product.id}</span></td><td className="py-3 pr-3">{product.reference || '—'}</td><td className="py-3 pr-3">{product.priceHT}</td><td className="py-3 pr-3">{product.quantity || '0'}</td><td className="py-3 text-right"><button type="button" onClick={() => loadPreview(product)} disabled={Boolean(previewing) || importingCatalog} className="rounded-md border border-[#cbd5df] px-3 py-2 text-xs font-semibold text-[#344054] disabled:opacity-50">{previewing === product.id ? 'Chargement…' : 'Aperçu'}</button></td></tr>)}</tbody></table></div>}
        {preview && <div className="mt-5 rounded-lg border border-[#dce4ea] bg-[#f8fafc] p-4">
          <div className="flex flex-wrap items-start justify-between gap-4"><div><h3 className="font-semibold text-[#24364b]">{preview.title}</h3><p className="mt-1 text-xs text-[#667085]">Produit PrestaShop #{preview.id} · {preview.active ? 'actif dans PrestaShop' : 'inactif dans PrestaShop'} · choisis le statut pendant l'import</p></div><button type="button" onClick={() => requestProductImport([preview.id])} disabled={importingCatalog} className="rounded-md bg-[#1457a6] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">Importer ce produit</button></div>
          <dl className="mt-4 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3"><div><dt className="text-xs text-[#667085]">Référence</dt><dd>{preview.reference || '—'}</dd></div><div><dt className="text-xs text-[#667085]">Prix HT (valeur boutique)</dt><dd>{preview.priceHT}</dd></div><div><dt className="text-xs text-[#667085]">Slug</dt><dd>{preview.slug || '—'}</dd></div><div><dt className="text-xs text-[#667085]">Marque</dt><dd>{preview.brand || 'Sans marque'}</dd></div><div><dt className="text-xs text-[#667085]">Catégories</dt><dd>{preview.categories.join(', ') || '—'}</dd></div><div><dt className="text-xs text-[#667085]">Groupe de taxe / stock</dt><dd>{preview.taxRulesGroupId || '—'} / {preview.quantity || '0'}</dd></div><div><dt className="text-xs text-[#667085]">Images · caractéristiques · déclinaisons</dt><dd>{preview.images} · {preview.features} · {preview.combinations}</dd></div></dl>
          {preview.shortDescription && <div className="mt-4"><p className="text-xs text-[#667085]">Description courte</p><p className="mt-1 line-clamp-3 text-sm">{preview.shortDescription.replace(/<[^>]*>/g, ' ')}</p></div>}
        </div>}
      </Card>
      {showImportStatusDialog && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
        <section role="dialog" aria-modal="true" aria-labelledby="prestashop-import-status-title" className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl">
          <h2 id="prestashop-import-status-title" className="text-lg font-semibold text-[#24364b]">Choisir le statut des produits</h2>
          <p className="mt-2 text-sm leading-6 text-[#667085]">{pendingImportIds.length} produit(s) sélectionné(s). Le statut choisi sera appliqué à tous les produits importés ou mis à jour pendant cette opération.</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <button type="button" onClick={() => void importSelectedProducts('PUBLIC', pendingImportIds)} className="rounded-lg bg-[#1457a6] px-4 py-3 text-left text-sm font-semibold text-white hover:bg-[#104987]">
              Public <span className="mt-1 block text-xs font-normal text-blue-100">Visible sur la boutique en ligne</span>
            </button>
            <button type="button" onClick={() => void importSelectedProducts('DRAFT', pendingImportIds)} className="rounded-lg border border-[#cbd5df] px-4 py-3 text-left text-sm font-semibold text-[#344054] hover:bg-slate-50">
              Brouillon <span className="mt-1 block text-xs font-normal text-[#667085]">Non publié sur la boutique</span>
            </button>
          </div>
          <div className="mt-5 flex justify-end"><button type="button" onClick={() => setShowImportStatusDialog(false)} className="rounded-lg px-4 py-2 text-sm font-semibold text-[#667085] hover:bg-slate-100">Annuler</button></div>
        </section>
      </div>}
      {message && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</p>}
      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
    </div>
  );
}
