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

export type HomeHeroSlide = {
  id: string;
  imageUrl: string;
  altText: string;
  href: string;
};

export type HomeFeaturedProductsConfig = {
  id: string;
  title: string;
  categoryId: string | null;
};

export type HomePopularCategoriesConfig = {
  title: string;
  categoryIds: string[] | null;
};

export type HomeImageTile = {
  imageUrl: string;
  altText: string;
};

export type HomeHeroConfig = {
  slides: HomeHeroSlide[];
  professionalsCategoryIds: string[] | null;
  individualsCategoryIds: string[] | null;
  featuredProductSections: HomeFeaturedProductsConfig[];
  homeSectionOrder: string[];
  /** Legacy single section retained so older saved configs still normalize. */
  featuredProducts: HomeFeaturedProductsConfig;
  popularCategories: HomePopularCategoriesConfig;
  imageTiles: Array<HomeImageTile | null>;
};

export const DEFAULT_HOME_HERO_CONFIG: HomeHeroConfig = {
  slides: [],
  professionalsCategoryIds: null,
  individualsCategoryIds: null,
  featuredProductSections: [{ id: "featured-products-1", title: "Meilleures ventes", categoryId: null }],
  homeSectionOrder: ["featured:featured-products-1", "image-layout"],
  featuredProducts: { id: "featured-products-1", title: "Meilleures ventes", categoryId: null },
  popularCategories: { title: "Explore Popular Categories", categoryIds: null },
  imageTiles: [null, null, null, null],
};

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
  heroConfig: HomeHeroConfig;
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
  heroConfig: DEFAULT_HOME_HERO_CONFIG,
};

export function normalizeHomeHeroConfig(
  value: unknown,
): HomeHeroConfig {
  if (typeof value !== "object" || value === null) {
    return DEFAULT_HOME_HERO_CONFIG;
  }
  const config = value as Partial<HomeHeroConfig>;
  const categories = (ids: unknown) =>
    Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string") : null;
  const rawSections = Array.isArray(config.featuredProductSections)
    ? config.featuredProductSections
    : config.featuredProducts
      ? [config.featuredProducts]
      : DEFAULT_HOME_HERO_CONFIG.featuredProductSections;
  const featuredProductSections = rawSections
    .filter((section) => typeof section?.title === "string")
    .map((section, index) => ({
      id: typeof section.id === "string" && section.id ? section.id : `featured-products-${index + 1}`,
      title: section.title.trim() || `Featured products ${index + 1}`,
      categoryId: typeof section.categoryId === "string" && section.categoryId.trim() ? section.categoryId : null,
    }));
  const validSectionIds = new Set([
    "image-layout",
    ...featuredProductSections.map((section) => `featured:${section.id}`),
  ]);
  const savedOrder = Array.isArray(config.homeSectionOrder)
    ? config.homeSectionOrder.filter((id): id is string => typeof id === "string" && validSectionIds.has(id))
    : [];
  const homeSectionOrder = [
    ...new Set([...savedOrder, ...featuredProductSections.map((section) => `featured:${section.id}`), "image-layout"]),
  ];

  return {
    slides: Array.isArray(config.slides)
      ? config.slides.filter(
          (slide): slide is HomeHeroSlide =>
            typeof slide?.id === "string" &&
            typeof slide?.imageUrl === "string" &&
            typeof slide?.altText === "string" &&
            typeof slide?.href === "string",
        )
      : [],
    professionalsCategoryIds: categories(config.professionalsCategoryIds),
    individualsCategoryIds: categories(config.individualsCategoryIds),
    featuredProductSections,
    homeSectionOrder,
    featuredProducts: featuredProductSections[0] ?? DEFAULT_HOME_HERO_CONFIG.featuredProducts,
    popularCategories: {
      title:
        typeof config.popularCategories?.title === "string" &&
        config.popularCategories.title.trim()
          ? config.popularCategories.title.trim()
          : DEFAULT_HOME_HERO_CONFIG.popularCategories.title,
      categoryIds: categories(config.popularCategories?.categoryIds),
    },
    imageTiles: Array.from({ length: 4 }, (_, index) => {
      const tile = Array.isArray(config.imageTiles)
        ? config.imageTiles[index]
        : null;
      return typeof tile?.imageUrl === "string" && tile.imageUrl.trim()
        ? {
            imageUrl: tile.imageUrl,
            altText: typeof tile.altText === "string" ? tile.altText : "",
          }
        : null;
    }),
  };
}

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
    heroConfig: normalizeHomeHeroConfig(value?.heroConfig),
  };
}
