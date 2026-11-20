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

  // The home page is the one composed in the page builder.
  const builderPage = await getBuilderPage("home");
  if (builderPage) return <main className="min-h-screen"><BuilderHome data={builderPage} /></main>;

  // Nothing saved in the builder yet: an empty page, to be filled from /admin_ben/page-builder.
  return <main className="min-h-screen" />;
}
