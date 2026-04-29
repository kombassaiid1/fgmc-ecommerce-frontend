import { PuckRenderer } from "@/components/puck/puck-renderer";
import { getPublishedPageDataBySlug } from "@/lib/server/pages";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Home() {
  const { data } = await getPublishedPageDataBySlug("home");

  return (
    <main style={{ padding: "24px 0" }}>
      <PuckRenderer data={data} />
    </main>
  );
}
