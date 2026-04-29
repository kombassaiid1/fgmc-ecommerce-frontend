import { useEffect, useMemo, useState } from "react";
import { BriefcaseBusiness, FolderTree, HandCoins } from "lucide-react";
import Link from "next/link";
import { getCategories, type Category } from "@/lib/api/categories";

type ProfessionalsSideNavBlockProps = {
  title?: string;
  subtitle?: string;
  categoryIds?: string;
};

export function ProfessionalsSideNavBlock({
  title = "Professionnels",
  subtitle = "Solutions Industrielles",
  categoryIds = "",
}: ProfessionalsSideNavBlockProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [hoveredCategoryId, setHoveredCategoryId] = useState<string | null>(null);
  const [closeTimer, setCloseTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await getCategories();
        setCategories(data);
      } catch {
        setCategories([]);
      }
    };
    void load();
  }, []);

  const selectedCategoryIds = useMemo(
    () =>
      categoryIds
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean),
    [categoryIds],
  );

  const selectedCategories = useMemo(() => {
    const byId = new Map(categories.map((c) => [c.id, c]));
    return selectedCategoryIds
      .map((id) => byId.get(id))
      .filter((c): c is Category => Boolean(c));
  }, [categories, selectedCategoryIds]);

  const childrenByParent = useMemo(() => {
    const map = new Map<string, Category[]>();
    for (const category of categories) {
      const key = category.parentCategoryId ?? "__root__";
      const bucket = map.get(key) ?? [];
      bucket.push(category);
      map.set(key, bucket);
    }
    for (const [key, bucket] of map.entries()) {
      map.set(
        key,
        [...bucket].sort((a, b) => a.title.localeCompare(b.title, "fr")),
      );
    }
    return map;
  }, [categories]);

  const fallbackItems = [
    { label: "Espace Pro", icon: BriefcaseBusiness, active: true, href: "#" },
    { label: "Financement", icon: HandCoins, active: false, href: "#" },
  ];

  const categoryItems =
    selectedCategories.length > 0
      ? selectedCategories.map((category, index) => ({
          id: category.id,
          label: category.title,
          icon: FolderTree,
          active: index === 0,
          href: `/${category.slug}`,
        }))
      : fallbackItems;

  const hoveredCategory = useMemo(
    () => selectedCategories.find((item) => item.id === hoveredCategoryId) ?? null,
    [hoveredCategoryId, selectedCategories],
  );

  const hoveredChildren = useMemo(() => {
    if (!hoveredCategory) return [];
    return childrenByParent.get(hoveredCategory.id) ?? [];
  }, [childrenByParent, hoveredCategory]);

  const hoveredGrandChildren = useMemo(
    () =>
      hoveredChildren.flatMap(
        (child) => childrenByParent.get(child.id) ?? [],
      ),
    [childrenByParent, hoveredChildren],
  );

  const clearCloseTimer = () => {
    if (closeTimer) {
      clearTimeout(closeTimer);
      setCloseTimer(null);
    }
  };

  const scheduleClose = () => {
    clearCloseTimer();
    const timer = setTimeout(() => {
      setHoveredCategoryId(null);
      setCloseTimer(null);
    }, 120);
    setCloseTimer(timer);
  };

  return (
    <aside className="sticky top-[72px] z-10 hidden h-full w-full flex-col gap-2 rounded-r-lg border-r border-slate-200 bg-slate-50/50 p-4 text-sm text-blue-700 shadow-sm md:flex dark:border-slate-800 dark:bg-slate-950/50 dark:text-blue-400">
      <div className="mb-6 px-4">
        <h2 className="text-2xl font-bold text-blue-700 dark:text-blue-300">
          {title}
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {subtitle}
        </p>
      </div>

      <nav
        className="relative flex flex-1 flex-col gap-2"
        onMouseLeave={scheduleClose}
      >
        {categoryItems.map((item) => {
          const Icon = item.icon;
          const itemId = "id" in item ? item.id : undefined;
          const hasChildren = itemId
            ? (childrenByParent.get(itemId)?.length ?? 0) > 0
            : false;
          const baseClass =
            item.active
              ? "flex cursor-pointer items-center gap-3 rounded-r border-l-4 border-blue-700 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700 transition-transform hover:translate-x-1 dark:bg-blue-900/20 dark:text-blue-300"
              : "flex cursor-pointer items-center gap-3 rounded px-4 py-3 text-sm font-medium text-slate-600 transition-transform hover:translate-x-1 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800";
          const onHover = () => {
            clearCloseTimer();
            if (itemId && hasChildren) setHoveredCategoryId(itemId);
            else setHoveredCategoryId(null);
          };

          if (item.href === "#") {
            return (
              <div
                key={item.label}
                onMouseEnter={onHover}
                className={baseClass}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </div>
            );
          }

          return (
            <Link
              key={item.label}
              href={item.href}
              onMouseEnter={onHover}
              className={baseClass}>
              <Icon size={18} />
              <span>{item.label}</span>
            </Link>
          );
        })}

        {hoveredCategory && hoveredChildren.length > 0 ? (
          <div
            className="absolute top-0 left-[calc(100%+6px)] z-30 min-w-[230px] rounded-md border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900"
            onMouseEnter={() => {
              clearCloseTimer();
              setHoveredCategoryId(hoveredCategory.id);
            }}
            onMouseLeave={scheduleClose}
          >
            <ul className="py-1">
              {hoveredChildren.map((child) => (
                <li key={child.id}>
                  <Link
                    href={`/${child.slug}`}
                    className="block px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-blue-50 hover:text-blue-700 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-blue-300"
                  >
                    {child.title}
                  </Link>
                </li>
              ))}
              {hoveredGrandChildren.map((leaf) => (
                <li key={leaf.id}>
                  <Link
                    href={`/${leaf.slug}`}
                    className="block px-3 py-2 pl-5 text-sm text-slate-600 transition-colors hover:bg-blue-50 hover:text-blue-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-blue-300"
                  >
                    {leaf.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </nav>

    </aside>
  );
}
