import { getCatalogPanelsConfig } from "@/lib/api/builder-page";

import { CatalogPanelsLayout } from "./catalog-panels-layout";

/**
 * Wraps a category or product page. When the home page's Hero block has "Afficher les panneaux sur les pages
 * produit et catégorie" switched on, the page is framed by the Hero's two category panels; otherwise it is unchanged.
 */
export async function CatalogSidePanels({ children }: { children: React.ReactNode }) {
  const config = await getCatalogPanelsConfig();
  if (!config) return <>{children}</>;
  return <CatalogPanelsLayout config={config}>{children}</CatalogPanelsLayout>;
}
