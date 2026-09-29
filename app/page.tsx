import { HomeHero } from "@/components/home/home-hero";
import { DailyOffer } from "@/components/home/daily-offer";
import { FeaturedProducts } from "@/components/home/featured-products";

export default function Home() {
  return <main className="min-h-screen"><HomeHero /><DailyOffer /><FeaturedProducts /></main>;
}
