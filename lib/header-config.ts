export type HeaderLayoutId = "ecommerce";

export type HeaderLink = {
  label: string;
  url: string;
  openInNewTab?: boolean;
};

export type SocialLink = {
  platform: "Facebook" | "Instagram" | "X" | string;
  url: string;
  isVisible?: boolean;
};

export const RECOMMENDATIONS_SECTION_TITLE = "À découvrir";

export type HeaderConfig = {
  layout: HeaderLayoutId;
  logoUrl: string;
  logoAlt: string;
  logoWidth: number;
  headerHeight: number;
  backgroundColor: string;
  utilityColor: string;
  textColor: string;
  utilityTextColor: string;
  accentColor: string;
  promoText: string;
  contactEmail: string;
  phoneNumber: string;
  openingDays: string;
  openingTime: string;
  closingTime: string;
  showUtilityBar: boolean;
  showSearch: boolean;
  showCart: boolean;
  showAccount: boolean;
  sticky: boolean;
  links: HeaderLink[];
  mobileLinks: HeaderLink[];
  socialLinks: SocialLink[];
};

export const DEFAULT_HEADER_CONFIG: HeaderConfig = {
  layout: "ecommerce",
  logoUrl: "/logo.png",
  logoAlt: "FGMC",
  logoWidth: 240,
  headerHeight: 88,
  backgroundColor: "#ffffff",
  utilityColor: "#10295f",
  textColor: "#153675",
  utilityTextColor: "#ffffff",
  accentColor: "#df1e32",
  promoText: "Livraison gratuite a partir de 200 TND",
  contactEmail: "contact@fgmc.com",
  phoneNumber: "99 94 94 19",
  openingDays: "Lun-Sam",
  openingTime: "8h",
  closingTime: "18h",
  showUtilityBar: true,
  showSearch: true,
  showCart: true,
  showAccount: true,
  sticky: true,
  links: [
    { label: "Accueil", url: "/" },
    { label: "Categories", url: "/categorie-produit" },
    { label: "Contact", url: "/contact" },
  ],
  mobileLinks: [
    { label: "Accueil", url: "/" },
    { label: "Categories", url: "/categorie-produit" },
    { label: "Contact", url: "/contact" },
    { label: "Mon compte", url: "/mon-compte" },
  ],
  socialLinks: [
    { platform: "Facebook", url: "https://facebook.com", isVisible: true },
    { platform: "Instagram", url: "https://instagram.com", isVisible: true },
  ],
};

export function normalizeHeaderConfig(
  value: Partial<HeaderConfig> | null | undefined,
): HeaderConfig {
  return {
    ...DEFAULT_HEADER_CONFIG,
    ...value,
    layout: "ecommerce",
    links: Array.isArray(value?.links)
      ? value.links
      : DEFAULT_HEADER_CONFIG.links,
    mobileLinks: Array.isArray(value?.mobileLinks)
      ? value.mobileLinks
      : DEFAULT_HEADER_CONFIG.mobileLinks,
    socialLinks: Array.isArray(value?.socialLinks)
      ? value.socialLinks
      : DEFAULT_HEADER_CONFIG.socialLinks,
  };
}
