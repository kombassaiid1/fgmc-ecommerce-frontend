import { HomeHero } from "@/components/home/home-hero";
import { PopularCategories } from "@/components/home/popular-categories";
import { DailyOffer } from "@/components/home/daily-offer";
import { FeaturedProducts } from "@/components/home/featured-products";

export default function Home() {
  return <main className="min-h-screen"><HomeHero /><PopularCategories /><DailyOffer /><FeaturedProducts /></main>;
}
