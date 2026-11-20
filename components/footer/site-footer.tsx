import { getFooter } from "@/lib/footer";

import { FooterGate } from "./footer-gate";

/** The storefront footer, drawn from what was saved in /admin_ben/apparence/footer. */
export async function SiteFooter() {
  const { config, site } = await getFooter();
  if (!config.enabled) return null;
  return <FooterGate config={config} site={site} />;
}
