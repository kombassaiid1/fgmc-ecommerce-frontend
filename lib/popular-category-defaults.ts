import type { Category } from "@/lib/api/categories";

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

export function getDefaultPopularCategoryIds(categories: Category[]) {
  const audienceRoots = new Set(
    categories
      .filter((category) => !category.parentCategoryId)
      .filter((category) => {
        const title = normalize(category.title);
        const slug = normalize(category.slug);
        return ["professionnel", "professionnels", "particulier", "particuliers"].includes(title) ||
          ["professionnel", "professionnels", "particulier", "particuliers"].includes(slug);
      })
      .map((category) => category.id),
  );
  const eligible = categories.filter((category) => !audienceRoots.has(category.id));
  const withImages = eligible.filter((category) => Boolean(category.image?.trim()));
  return (withImages.length ? withImages : eligible).slice(0, 12).map((category) => category.id);
}
