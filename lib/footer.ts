import { getBackendBaseUrl } from "@/lib/backend-url";

/** The storefront footer, as the backend stores it (see footer-config.ts in the backend's footer module). */
export type FooterLink = { label: string; url: string; newTab: boolean };
export type FooterGroup = { title: string; links: FooterLink[] };

export type FooterConfig = {
  enabled: boolean;
  backgroundColor: string;
  textColor: string;
  accentColor: string;
  showGrid: boolean;
  showEdge: boolean;
  showRuler: boolean;
  showWordmark: boolean;
  showBackToTop: boolean;
  logo: string;
  tagline: string;
  wordmark: string;
  showContact: boolean;
  showSocial: boolean;
  showMap: boolean;
  groups: FooterGroup[];
  cta: { enabled: boolean; title: string; text: string; buttonLabel: string; buttonUrl: string };
  copyright: string;
  legalLinks: FooterLink[];
};

/** The shop's own details that the footer shows next to its content. They come from the shop information settings. */
export type FooterSite = {
  siteName: string;
  logo: string;
  contactEmail: string;
  phoneNumber: string;
  secondPhoneNumber: string;
  address: string;
  postalCode: string;
  city: string;
  country: string;
  socialLinks: Record<string, string>;
};

export const SOCIAL_ORDER = ["facebook", "instagram", "x", "youtube", "tiktok", "linkedin", "pinterest", "whatsapp", "snapchat"] as const;

export const DEFAULT_FOOTER: FooterConfig = {
  enabled: true,
  backgroundColor: "#0b1f4d",
  textColor: "#ffffff",
  accentColor: "#e2232d",
  showGrid: true,
  showEdge: true,
  showRuler: true,
  showWordmark: true,
  showBackToTop: true,
  logo: "",
  tagline: "Réparation, vente, achat et location de machines à coudre.",
  wordmark: "FGMC",
  showContact: true,
  showSocial: true,
  showMap: true,
  groups: [],
  cta: { enabled: true, title: "Une réparation, une machine, un devis ?", text: "Notre équipe vous répond avec une proposition claire.", buttonLabel: "Nous contacter", buttonUrl: "/informations" },
  copyright: "© {year} {siteName}. Tous droits réservés.",
  legalLinks: [],
};

export const EMPTY_SITE: FooterSite = { siteName: "", logo: "", contactEmail: "", phoneNumber: "", secondPhoneNumber: "", address: "", postalCode: "", city: "", country: "", socialLinks: {} };

/** Reads the shop settings the footer needs, from the public or the admin settings response. */
export function toFooterSite(settings: Record<string, unknown> | null | undefined): FooterSite {
  const text = (key: string) => (typeof settings?.[key] === "string" ? (settings[key] as string) : "");
  const links = settings?.socialLinks && typeof settings.socialLinks === "object" ? (settings.socialLinks as Record<string, string>) : {};
  return {
    siteName: text("siteName"),
    logo: text("logo"),
    contactEmail: text("contactEmail"),
    phoneNumber: text("phoneNumber"),
    secondPhoneNumber: text("secondPhoneNumber"),
    address: text("address"),
    postalCode: text("postalCode"),
    city: text("city"),
    country: text("country"),
    socialLinks: links,
  };
}

/** "© {year} {siteName}" with its two placeholders filled in. */
export function fillCopyright(template: string, siteName: string, year = new Date().getFullYear()) {
  return template.replaceAll("{year}", String(year)).replaceAll("{siteName}", siteName || "");
}

async function getJson<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${getBackendBaseUrl()}${path}`, { cache: "no-store" });
    return response.ok ? ((await response.json()) as T) : null;
  } catch {
    return null;
  }
}

/** For the storefront: the saved footer and the shop details, each falling back when the backend does not answer. */
export async function getFooter(): Promise<{ config: FooterConfig; site: FooterSite }> {
  const [config, settings] = await Promise.all([getJson<FooterConfig>("/footer"), getJson<Record<string, unknown>>("/settings")]);
  return { config: config ?? DEFAULT_FOOTER, site: toFooterSite(settings) };
}
