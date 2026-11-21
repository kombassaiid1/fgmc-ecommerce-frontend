import { FieldLabel, useGetPuck, type ComponentConfig, type CustomField, type Fields } from "@puckeditor/core";
import { useQuery } from "@tanstack/react-query";

import { getCategories, type Category } from "@/lib/api/categories";

import { colorField, yesNoOptions } from "../fields";
import {
  FEATURED_PRODUCTS_DEFAULTS,
  FEATURED_PRODUCTS_FALLBACK_TITLE,
  FeaturedProducts,
  type FeaturedProductsProps,
} from "./featured-products";

/** Indented category list (parents first); the empty value means "all categories". */
function categoryOptions(categories: Category[]) {
  const byParent = new Map<string, Category[]>();
  for (const category of categories) {
    const key = category.parentCategoryId ?? "__root__";
    byParent.set(key, [...(byParent.get(key) ?? []), category]);
  }
  const options: Array<{ label: string; value: string }> = [{ label: "Toutes les catégories", value: "" }];
  const walk = (parentKey: string, depth: number, seen: Set<string>) => {
    const children = [...(byParent.get(parentKey) ?? [])].sort((a, b) => a.title.localeCompare(b.title, "fr"));
    for (const child of children) {
      if (seen.has(child.id)) continue;
      options.push({ label: `${"— ".repeat(depth)}${child.title}`, value: child.id });
      walk(child.id, depth + 1, new Set(seen).add(child.id));
    }
  };
  walk("__root__", 0, new Set());
  return options;
}

function CategorySelect({ value, onChange, label }: { value: string; onChange: (value: string) => void; label: string }) {
  const { data = [], isLoading } = useQuery({
    queryKey: ["navbar-categories"],
    queryFn: () => getCategories(),
    staleTime: 60_000,
  });
  const getPuck = useGetPuck();

  // Choosing a category also renames the section after it, unless the title was customised.
  const select = (nextId: string) => {
    const { selectedItem, getSelectorForId, dispatch } = getPuck();
    const props = selectedItem?.props as Partial<FeaturedProductsProps> & { id?: string } | undefined;
    const selector = props?.id ? getSelectorForId(props.id) : undefined;
    if (!selectedItem || !props || !selector) {
      onChange(nextId);
      return;
    }
    const title = typeof props.title === "string" ? props.title.trim() : "";
    const previousName = data.find((item) => item.id === props.categoryId)?.title;
    const isAutoTitle = title === "" || title === FEATURED_PRODUCTS_FALLBACK_TITLE || title === previousName;
    const nextName = data.find((item) => item.id === nextId)?.title;
    dispatch({
      type: "replace",
      destinationIndex: selector.index,
      destinationZone: selector.zone,
      data: {
        ...selectedItem,
        props: {
          ...selectedItem.props,
          categoryId: nextId,
          ...(isAutoTitle ? { title: nextName ?? FEATURED_PRODUCTS_FALLBACK_TITLE } : {}),
        },
      },
    });
  };

  return (
    <FieldLabel label={label}>
      <select
        aria-label={label}
        value={value ?? ""}
        disabled={isLoading}
        onChange={(event) => select(event.target.value)}
        style={{ width: "100%", height: 36, padding: "0 8px", border: "1px solid #d5dadf", borderRadius: 3, background: "#fff", font: "inherit", fontSize: 13 }}>
        {categoryOptions(data).map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </FieldLabel>
  );
}

const categorySelectField: CustomField<string> = {
  type: "custom",
  label: "Catégorie des produits",
  render: ({ value, onChange, field }) => (
    <CategorySelect value={value} onChange={onChange} label={field.label ?? "Catégorie des produits"} />
  ),
};

const FIELDS = {
  // ---- Content
  title: { type: "text", label: "Titre de la section (vide = nom de la catégorie)" },
  source: {
    type: "radio",
    label: "Produits affichés",
    options: [
      { label: "D'une catégorie", value: "category" },
      { label: "À découvrir (recommandations)", value: "recommendations" },
    ],
  },
  categoryId: categorySelectField,
  maxProducts: { type: "number", label: "Nombre maximum de produits", min: 1, max: 100 },
  columns: {
    type: "select",
    label: "Produits visibles (ordinateur)",
    options: [
      { label: "2", value: 2 },
      { label: "3", value: 3 },
      { label: "4", value: 4 },
      { label: "5", value: 5 },
      { label: "6", value: 6 },
    ],
  },
  mobileColumns: {
    type: "radio",
    label: "Produits visibles (mobile)",
    options: [
      { label: "1", value: 1 },
      { label: "2", value: 2 },
    ],
  },
  autoplaySeconds: { type: "number", label: "Défilement auto (secondes, 0 = arrêt)", min: 0, max: 30 },
  showDots: { type: "radio", label: "Pastilles", options: yesNoOptions },
  showViewAll: { type: "radio", label: "Lien « Voir tout »", options: yesNoOptions },
  viewAllLabel: { type: "text", label: "Texte du lien" },

  imageFit: {
    type: "radio",
    label: "Photo du produit",
    options: [
      { label: "Remplir", value: "cover" },
      { label: "Entière", value: "contain" },
    ],
  },
  imageRatio: {
    type: "radio",
    label: "Forme de la photo",
    options: [
      { label: "Carrée", value: "1/1" },
      { label: "5:4", value: "5/4" },
      { label: "4:3", value: "4/3" },
    ],
  },

  // ---- Style
  accentColor: colorField("Couleur des prix en promotion", "#d6202e"),
  buttonColor: colorField("Couleur des boutons et flèches", "#153675"),
  cardRadius: { type: "number", label: "Arrondi des cartes (px)", min: 0, max: 24 },
  background: colorField("Arrière-plan", "#f2f5fa"),
  maxWidth: { type: "number", label: "Largeur maximale (px)", min: 600, max: 2400 },
} satisfies ComponentConfig<FeaturedProductsProps>["fields"];

/**
 * Puck definition of a featured-products carousel (moved here from
 * Apparence): products of a category, or the personalised « À découvrir » block.
 * Add the block several times for several carousels.
 */
export const featuredProductsBlock: ComponentConfig<FeaturedProductsProps> = {
  label: "Produits en vedette",
  defaultProps: FEATURED_PRODUCTS_DEFAULTS,
  fields: FIELDS,

  // The recommendations block has no category / count / link: hide those fields.
  // « Produits visibles (mobile) » stays: the carousel uses it for both sources.
  resolveFields: (data) => {
    if (data.props.source === "recommendations") {
      return {
        title: FIELDS.title,
        source: FIELDS.source,
        mobileColumns: FIELDS.mobileColumns,
        background: FIELDS.background,
        maxWidth: FIELDS.maxWidth,
      } as Fields<FeaturedProductsProps>;
    }
    return FIELDS;
  },

  render: ({ puck, ...props }) => <FeaturedProducts {...props} isEditing={puck.isEditing} />,
};
