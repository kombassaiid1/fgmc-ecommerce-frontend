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

/**
 * What a featured section shows: products of a category (default), or the
 * "À découvrir" recommendation block. At most one section uses recommendations.
 */
export type HomeFeaturedProductsSource = "category" | "recommendations";

export type HomeFeaturedProductsConfig = {
  id: string;
  title: string;
  /** Always a real category id or null (null for a recommendations section). */
  categoryId: string | null;
  source: HomeFeaturedProductsSource;
};

export const RECOMMENDATIONS_SECTION_TITLE = "À découvrir";

/** True for an empty title or one of the automatic titles ("Meilleures ventes", "Featured products N"). */
export function isDefaultFeaturedSectionTitle(title: string): boolean {
  const value = title.trim();
  return value === "" || value === "Meilleures ventes" || /^Featured products \d+$/.test(value);
}

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
  featuredProductSections: [{ id: "featured-products-1", title: "Meilleures ventes", categoryId: null, source: "category" }],
  homeSectionOrder: ["featured:featured-products-1", "image-layout"],
  featuredProducts: { id: "featured-products-1", title: "Meilleures ventes", categoryId: null, source: "category" },
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
  // Sections saved before `source` existed have no such field: they stay
  // category sections. Only the first recommendations section is kept, so the
  // block (and its POST /reco/home call) can never appear twice.
  let hasRecommendationsSection = false;
  const featuredProductSections = rawSections
    .filter((section) => typeof section?.title === "string")
    .map((section, index): HomeFeaturedProductsConfig => {
      const isRecommendations = section.source === "recommendations" && !hasRecommendationsSection;
      if (isRecommendations) hasRecommendationsSection = true;
      return {
        id: typeof section.id === "string" && section.id ? section.id : `featured-products-${index + 1}`,
        title:
          section.title.trim() ||
          (isRecommendations ? RECOMMENDATIONS_SECTION_TITLE : `Featured products ${index + 1}`),
        categoryId:
          !isRecommendations && typeof section.categoryId === "string" && section.categoryId.trim()
            ? section.categoryId
            : null,
        source: isRecommendations ? "recommendations" : "category",
      };
    });
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
