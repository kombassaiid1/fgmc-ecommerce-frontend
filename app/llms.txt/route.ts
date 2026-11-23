import { getBackendBaseUrl } from "@/lib/backend-url";
import { stripHtml, truncateText } from "@/lib/seo";
import { getSiteOrigin } from "@/lib/site-origin";
import { getSiteSeo } from "@/lib/site-seo";
import { storefrontPath } from "@/lib/storefront-path";

// Rebuilt at most once an hour, like the sitemap.
export const revalidate = 3600;

async function getJson<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${getBackendBaseUrl()}${path}`, { next: { revalidate: 3600 } });
    return response.ok ? ((await response.json()) as T) : null;
  } catch {
    return null;
  }
}

type Named = { slug: string; title?: string; name?: string; description?: string | null };

/**
 * /llms.txt: a plain-markdown summary of the shop for language models (who we are, what we sell, where the important pages are).
 * Everything comes from the shop's settings and catalogue, so it never goes stale.
 */
export async function GET() {
  const [origin, seo] = await Promise.all([getSiteOrigin(), getSiteSeo()]);
  if (!origin || !seo.indexable) return new Response("Not found", { status: 404 });

  const [categories, brands] = await Promise.all([
    getJson<Named[]>("/categories"),
    getJson<{ data: Named[] }>("/brands?limit=100"),
  ]);

  const url = (path: string) => `${origin}${storefrontPath(path)}`;
  const lines: string[] = [`# ${seo.siteName}`, ""];
  if (seo.description) lines.push(`> ${seo.description}`, "");

  const place = [seo.address.street, seo.address.postalCode, seo.address.city, seo.address.country].filter(Boolean).join(", ");
  const facts = [
    place && `Adresse : ${place}`,
    seo.contactEmail && `E-mail : ${seo.contactEmail}`,
    seo.phone && `Téléphone : ${seo.phone}`,
    `Site : ${url("/")}`,
  ].filter(Boolean);
  lines.push("## À propos", "", ...facts.map((fact) => `- ${fact}`), "");

  const cats = (categories ?? []).filter((c) => c.slug && c.slug !== "categorie-produit");
  if (cats.length) {
    lines.push("## Catégories", "");
    for (const c of cats) {
      const note = c.description ? `: ${truncateText(stripHtml(c.description), 140)}` : "";
      lines.push(`- [${c.title ?? c.name ?? c.slug}](${url(`/${c.slug}`)})${note}`);
    }
    lines.push("");
  }

  const marques = (brands?.data ?? []).filter((b) => b.slug);
  if (marques.length) {
    lines.push("## Marques", "");
    for (const b of marques) lines.push(`- [${b.title ?? b.name ?? b.slug}](${url(`/b/${b.slug}`)})`);
    lines.push("");
  }

  lines.push("## Optionnel", "", `- [Plan du site](${origin}/sitemap.xml)`, `- [Toutes les catégories](${url("/categorie-produit")})`, "");

  return new Response(lines.join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
