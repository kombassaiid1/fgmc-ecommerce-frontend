import { HomeHero } from "@/components/home/home-hero";
import { PopularCategories } from "@/components/home/popular-categories";
import { DailyOffer } from "@/components/home/daily-offer";
import { FeaturedProducts } from "@/components/home/featured-products";
import { DiscoverProducts } from "@/components/home/discover-products";
import { SearchResultsPage } from "@/components/search/search-results-page";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ search?: string | string[] }>;
}) {
  const params = await searchParams;
  const search = Array.isArray(params.search) ? params.search[0] : params.search;
  if (search?.trim()) return <SearchResultsPage term={search.trim()} />;

  return <main className="min-h-screen"><HomeHero /><PopularCategories /><DailyOffer /><FeaturedProducts /><DiscoverProducts /></main>;
}
