"use client";

import { usePathname } from "next/navigation";

import type { FooterConfig, FooterSite } from "@/lib/footer";

import { FooterView } from "./footer-view";

/** The back office has its own layout: the storefront footer never shows there. */
export function FooterGate({ config, site }: { config: FooterConfig; site: FooterSite }) {
  const pathname = usePathname();
  if (pathname.startsWith("/admin_ben")) return null;
  return <FooterView config={config} site={site} />;
}
