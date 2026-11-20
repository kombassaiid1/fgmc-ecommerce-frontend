import { HomeHero } from "@/components/home/home-hero";
import { PopularCategories } from "@/components/home/popular-categories";
import { DailyOffer } from "@/components/home/daily-offer";
import { FeaturedProducts } from "@/components/home/featured-products";
import { BuilderHome } from "@/components/home/builder-home";
import { getBuilderPage } from "@/lib/api/builder-page";
import { SearchResultsPage } from "@/components/search/search-results-page";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ search?: string | string[] }>;
}) {
  const params = await searchParams;
  const search = Array.isArray(params.search) ? params.search[0] : params.search;
  if (search?.trim()) return <SearchResultsPage term={search.trim()} />;

  // The page saved in the page builder, when there is one; otherwise the original home page.
  const builderPage = await getBuilderPage("home");
  if (builderPage) return <main className="min-h-screen"><BuilderHome data={builderPage} /></main>;

  return <main className="min-h-screen"><HomeHero /><PopularCategories /><DailyOffer /><FeaturedProducts /></main>;
}
