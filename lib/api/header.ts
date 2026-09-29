import { apiRequest } from "@/lib/api/http-client";
import {
  normalizeHeaderConfig,
  type HeaderConfig,
} from "@/lib/header-config";

function toHeaderSettingsPayload(config: HeaderConfig) {
  return {
    layout: config.layout,
    logoUrl: config.logoUrl,
    logoAlt: config.logoAlt,
    logoWidth: config.logoWidth,
    headerHeight: config.headerHeight,
    backgroundColor: config.backgroundColor,
    utilityColor: config.utilityColor,
    textColor: config.textColor,
    utilityTextColor: config.utilityTextColor,
    accentColor: config.accentColor,
    promoText: config.promoText,
    contactEmail: config.contactEmail,
    phoneNumber: config.phoneNumber,
    openingDays: config.openingDays,
    openingTime: config.openingTime,
    closingTime: config.closingTime,
    showUtilityBar: config.showUtilityBar,
    showSearch: config.showSearch,
    showCart: config.showCart,
    showAccount: config.showAccount,
    sticky: config.sticky,
    links: config.links,
    mobileLinks: config.mobileLinks,
    socialLinks: config.socialLinks,
    heroConfig: config.heroConfig,
  };
}

export async function getPublicHeaderSettings(): Promise<HeaderConfig> {
  const response = await apiRequest<Partial<HeaderConfig>>({ path: "/header" });
  return normalizeHeaderConfig(response);
}

export async function getAdminHeaderSettings(): Promise<HeaderConfig> {
  const response = await apiRequest<Partial<HeaderConfig>>({
    path: "/header/admin",
  });
  return normalizeHeaderConfig(response);
}

export async function updateHeaderSettings(
  config: HeaderConfig,
): Promise<HeaderConfig> {
  const response = await apiRequest<Partial<HeaderConfig>>({
    path: "/header/settings",
    method: "PATCH",
    body: JSON.stringify(toHeaderSettingsPayload(config)),
  });

  return normalizeHeaderConfig(response);
}

export async function updateHomeHeroConfig(
  heroConfig: HeaderConfig["heroConfig"],
): Promise<HeaderConfig> {
  const response = await apiRequest<Partial<HeaderConfig>>({
    path: "/header/settings",
    method: "PATCH",
    body: JSON.stringify({ heroConfig }),
  });
  return normalizeHeaderConfig(response);
}
