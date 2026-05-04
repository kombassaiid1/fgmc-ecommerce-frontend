import { useEffect, useMemo, useState } from "react";
import { FolderTree } from "lucide-react";
import Link from "next/link";
import { getCategories, type Category } from "@/lib/api/categories";
import { cn } from "@/lib/utils";

type IndividualsSideNavBlockProps = {
  title?: string;
  subtitle?: string;
  categoryIds?: string;
};

export function IndividualsSideNavBlock({
  title = "Particuliers",
  subtitle = "Espace Créatif",
  categoryIds = "",
}: IndividualsSideNavBlockProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [hoveredCategoryId, setHoveredCategoryId] = useState<string | null>(
    null,
  );
  const [hoveredChildId, setHoveredChildId] = useState<string | null>(null);
  const [closeTimer, setCloseTimer] = useState<ReturnType<
    typeof setTimeout
  > | null>(null);

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

  const categoryItems = selectedCategories.map((category, index) => ({
    id: category.id,
    label: category.title,
    icon: FolderTree,
    active: index === 0,
    href: `/${category.slug}`,
  }));

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
      setHoveredChildId(null);
      setCloseTimer(null);
    }, 150);
    setCloseTimer(timer);
  };

  const submenuClass =
    "min-w-[220px] rounded-md border border-slate-200 bg-white py-1 text-left shadow-xl ring-1 ring-black/5 dark:border-slate-700 dark:bg-slate-900 dark:ring-white/10";

  return (
    <aside className="sticky top-[72px] isolate z-100 hidden h-full w-full flex-col gap-2 rounded-l-lg border-l border-slate-200 bg-slate-50/50 p-4 text-right text-sm text-red-600 shadow-sm lg:flex dark:border-slate-800 dark:bg-slate-950/50 dark:text-red-400">
      <div className="mb-6 px-4">
        <h2 className="text-2xl font-bold text-red-600 dark:text-red-300">
          {title}
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {subtitle}
        </p>
      </div>

      <nav className="flex flex-1 flex-col gap-1" onMouseLeave={scheduleClose}>
        {categoryItems.map((item) => {
          const Icon = item.icon;
          const children = childrenByParent.get(item.id) ?? [];
          const hasChildren = children.length > 0;

          const baseClass = cn(
            "flex cursor-pointer items-center justify-end gap-3 rounded px-4 py-3 text-sm transition-transform",
            item.active
              ? "rounded-l border-r-4 border-red-600 bg-red-50 py-3 font-semibold text-red-600 hover:-translate-x-1 dark:bg-red-900/20 dark:text-red-300"
              : "font-medium text-slate-600 hover:-translate-x-1 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800",
          );

          return (
            <div
              key={item.id}
              className={cn(
                "relative isolate",
                hoveredCategoryId === item.id && hasChildren
                  ? "z-110"
                  : "z-100",
              )}
              onMouseEnter={() => {
                clearCloseTimer();
                if (hasChildren) setHoveredCategoryId(item.id);
                else {
                  setHoveredCategoryId(null);
                  setHoveredChildId(null);
                }
              }}
            >
              <Link href={item.href} className={baseClass}>
                <span>{item.label}</span>
                <Icon size={16} />
              </Link>

              {hoveredCategoryId === item.id && hasChildren ? (
                <div
                  role="menu"
                  aria-label="Sous-catégories"
                  className={cn(
                    "absolute right-full top-0 z-120 mr-2",
                    submenuClass,
                  )}
                  onMouseEnter={() => {
                    clearCloseTimer();
                    setHoveredCategoryId(item.id);
                  }}
                  onMouseLeave={() => setHoveredChildId(null)}
                >
                  <ul>
                    {children.map((child) => {
                      const grand = childrenByParent.get(child.id) ?? [];
                      return (
                        <li
                          key={child.id}
                          className="relative"
                          onMouseEnter={() => {
                            clearCloseTimer();
                            setHoveredChildId(child.id);
                          }}
                          onMouseLeave={() =>
                            setHoveredChildId((cur) =>
                              cur === child.id ? null : cur,
                            )
                          }
                        >
                          <Link
                            href={`/${child.slug}`}
                            className={cn(
                              "block px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-red-50 hover:text-red-700 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-red-300",
                              hoveredChildId === child.id &&
                                grand.length > 0 &&
                                "bg-red-50/80 dark:bg-slate-800/80",
                            )}
                          >
                            {child.title}
                          </Link>
                          {grand.length > 0 &&
                          hoveredChildId === child.id ? (
                            <div
                              role="menu"
                              className={cn(
                                "absolute right-full top-0 z-130 mr-1",
                                submenuClass,
                              )}
                              onMouseEnter={clearCloseTimer}
                            >
                              <ul className="max-h-[min(320px,calc(100vh-140px))] overflow-y-auto">
                                {grand.map((leaf) => (
                                  <li key={leaf.id}>
                                    <Link
                                      href={`/${leaf.slug}`}
                                      className="block whitespace-nowrap px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-red-50 hover:text-red-700 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-red-300"
                                    >
                                      {leaf.title}
                                    </Link>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
