"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Badge, Button, Icon, Text } from "@shopify/polaris";
import { AppsIcon, SearchIcon } from "@shopify/polaris-icons";
import "./modules-page.css";

type ModuleId = "prestashop" | "dolibarr";
type ModuleFilter = "all" | "configured" | "needs-setup";
type ModuleCategory = "all" | "erp" | "catalog";

type ModuleEntry = {
  id: ModuleId;
  name: string;
  category: Exclude<ModuleCategory, "all">;
  categoryLabel: string;
  description: string;
  image: string;
  configHref: string;
  configLabel: string;
  accent: "blue" | "orange";
  download?: { href: string; label: string };
};

const modules: ModuleEntry[] = [
  {
    id: "prestashop",
    name: "PrestaShop",
    category: "catalog",
    categoryLabel: "Import de catalogue",
    image: "/modules/prestashop-catalog.png",
    description:
      "Connectez votre Webservice PrestaShop et importez les informations utiles du catalogue vers FGMC.",
    configHref: "/admin_ben/modules/prestashop",
    configLabel: "Ouvrir la configuration",
    accent: "orange",
  },
  {
    id: "dolibarr",
    name: "Dolibarr",
    category: "erp",
    categoryLabel: "ERP · Synchronisation",
    image: "/modules/dolibarr-sync.svg",
    description:
      "Synchronisez produits, variantes, clients, commandes, stock et factures avec votre ERP Dolibarr.",
    configHref: "/admin_ben/modules/dolibarr",
    configLabel: "Configurer la synchronisation",
    accent: "blue",
  },
];

const filterTabs: Array<{ id: ModuleFilter; label: string }> = [
  { id: "all", label: "Tous les modules" },
  { id: "configured", label: "Configurés" },
  { id: "needs-setup", label: "À configurer" },
];

export default function AdminModulesPage() {
  const [configured, setConfigured] = useState<Record<ModuleId, boolean | null>>({
    prestashop: null,
    dolibarr: null,
  });
  const [filter, setFilter] = useState<ModuleFilter>("all");
  const [category, setCategory] = useState<ModuleCategory>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const endpoints: Array<[ModuleId, string]> = [
      ["prestashop", "/api/admin/prestashop-integration"],
      ["dolibarr", "/api/admin/dolibarr-integration"],
    ];
    endpoints.forEach(async ([id, endpoint]) => {
      try {
        const response = await fetch(endpoint, { cache: "no-store" });
        if (!response.ok) throw new Error("Status indisponible");
        const data = (await response.json()) as { configured?: boolean };
        setConfigured((current) => ({ ...current, [id]: Boolean(data.configured) }));
      } catch {
        setConfigured((current) => ({ ...current, [id]: null }));
      }
    });
  }, []);

  const visibleModules = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("fr");
    return modules.filter((module) => {
      const isConfigured = configured[module.id];
      const matchesFilter =
        filter === "all" ||
        (filter === "configured" && isConfigured === true) ||
        (filter === "needs-setup" && isConfigured !== true);
      const matchesCategory = category === "all" || module.category === category;
      const matchesSearch =
        !query ||
        `${module.name} ${module.categoryLabel} ${module.description}`
          .toLocaleLowerCase("fr")
          .includes(query);
      return matchesFilter && matchesCategory && matchesSearch;
    });
  }, [category, configured, filter, search]);

  const configuredCount = Object.values(configured).filter((value) => value === true).length;

  return (
    <div className="modules-directory">
      <header className="modules-directory-header">
        <div>
          <div className="modules-directory-breadcrumb">
            <Link href="/admin_ben">Administration</Link><span>/</span><span>Modules</span>
          </div>
          <Text as="h1" variant="heading2xl">Modules</Text>
          <p>Découvrez et gérez les intégrations de votre boutique FGMC.</p>
        </div>
        <label className="modules-directory-search">
          <Icon source={SearchIcon} />
          <span className="visually-hidden">Rechercher un module</span>
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher des modules" />
        </label>
      </header>

      <div className="modules-directory-filters">
        <div className="modules-directory-tabs" role="tablist" aria-label="Filtrer les modules">
          {filterTabs.map((tab) => (
            <button key={tab.id} type="button" role="tab" aria-selected={filter === tab.id} className={filter === tab.id ? "is-active" : ""} onClick={() => setFilter(tab.id)}>
              {tab.label}{tab.id === "all" ? <span>{modules.length}</span> : null}
            </button>
          ))}
        </div>
        <label className="modules-directory-category">
          <span className="visually-hidden">Catégorie</span>
          <select value={category} onChange={(event) => setCategory(event.target.value as ModuleCategory)}>
            <option value="all">Toutes les catégories</option>
            <option value="erp">ERP & synchronisation</option>
            <option value="catalog">Import de catalogue</option>
          </select>
        </label>
      </div>

      {visibleModules.length ? (
        <section className="modules-directory-grid" aria-label="Catalogue des modules">
          {visibleModules.map((module) => {
            const isConfigured = configured[module.id];
            return (
              <article className="modules-directory-item" key={module.id}>
                <div className={`modules-directory-icon modules-icon-${module.accent}`} aria-hidden="true">
                  <Image src={module.image} alt="" width={52} height={52} />
                </div>
                <div className="modules-directory-content">
                  <div className="modules-directory-name-row">
                    <Link href={module.configHref} className="modules-directory-name">{module.name}</Link>
                    <Badge tone={isConfigured ? "success" : "attention"}>
                      {isConfigured ? "Configuré" : isConfigured === null ? "Disponible" : "À configurer"}
                    </Badge>
                  </div>
                  <div className="modules-directory-meta">
                    <span>{module.categoryLabel}</span><span aria-hidden="true">·</span><span>Intégration FGMC</span>
                  </div>
                  <p className="modules-directory-description">{module.description}</p>
                  <div className="modules-directory-actions">
                    <Link href={module.configHref}>{module.configLabel}<span aria-hidden="true">→</span></Link>
                    {module.download ? <a href={module.download.href} download>{module.download.label}</a> : null}
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      ) : (
        <div className="modules-directory-empty">
          <div className="modules-directory-icon modules-icon-empty"><Icon source={AppsIcon} /></div>
          <h2>Aucun module trouvé</h2>
          <p>Essayez une autre recherche ou modifiez les filtres.</p>
          <Button onClick={() => { setSearch(""); setFilter("all"); setCategory("all"); }}>Afficher tous les modules</Button>
        </div>
      )}

      <footer className="modules-directory-footer">
        <span className="modules-footer-icon"><Icon source={AppsIcon} /></span>
        <div><strong>D’autres modules arrivent bientôt</strong><p>Les prochaines intégrations seront ajoutées à ce catalogue.</p></div>
        <span className="modules-footer-count">{configuredCount} configuré{configuredCount > 1 ? "s" : ""}</span>
      </footer>
    </div>
  );
}
