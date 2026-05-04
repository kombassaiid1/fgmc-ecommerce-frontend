import { useEffect, useMemo, useState } from "react";
import { BriefcaseBusiness, FolderTree, HandCoins } from "lucide-react";
import Link from "next/link";
import { getCategories, type Category } from "@/lib/api/categories";
import { cn } from "@/lib/utils";

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

  const fallbackItems = [
    {
      label: "Espace Pro",
      icon: BriefcaseBusiness,
      active: true,
      href: "#",
      id: undefined as string | undefined,
    },
    {
      label: "Financement",
      icon: HandCoins,
      active: false,
      href: "#",
      id: undefined as string | undefined,
    },
  ];

  type NavItem =
    | typeof fallbackItems[number]
    | {
        id: string;
        label: string;
        icon: typeof FolderTree;
        active: boolean;
        href: string;
      };

  const categoryItems: NavItem[] =
    selectedCategories.length > 0
      ? selectedCategories.map((category, index) => ({
          id: category.id,
          label: category.title,
          icon: FolderTree,
          active: index === 0,
          href: `/${category.slug}`,
        }))
      : fallbackItems;

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
    "min-w-[220px] rounded-md border border-slate-200 bg-white py-1 shadow-xl ring-1 ring-black/5 dark:border-slate-700 dark:bg-slate-900 dark:ring-white/10";

  return (
    <aside className="sticky top-[72px] isolate z-100 hidden h-full w-full flex-col gap-2 rounded-r-lg border-r border-slate-200 bg-slate-50/50 p-4 text-sm text-blue-700 shadow-sm md:flex dark:border-slate-800 dark:bg-slate-950/50 dark:text-blue-400">
      <div className="mb-6 px-4">
        <h2 className="text-2xl font-bold text-blue-700 dark:text-blue-300">
          {title}
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {subtitle}
        </p>
      </div>

      <nav className="flex flex-1 flex-col gap-1" onMouseLeave={scheduleClose}>
        {categoryItems.map((item) => {
          const Icon = item.icon;
          const itemId = "id" in item ? item.id : undefined;
          const children = itemId
            ? childrenByParent.get(itemId) ?? []
            : [];
          const hasChildren = children.length > 0;

          const baseClass = cn(
            "flex cursor-pointer items-center gap-3 rounded px-4 py-3 text-sm transition-transform",
            item.active
              ? "rounded-r border-l-4 border-blue-700 bg-blue-50 py-3 font-semibold text-blue-700 hover:translate-x-1 dark:bg-blue-900/20 dark:text-blue-300"
              : "font-medium text-slate-600 hover:translate-x-1 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800",
          );

          const openPanel = () => {
            clearCloseTimer();
            if (itemId && hasChildren) {
              setHoveredCategoryId(itemId);
            } else {
              setHoveredCategoryId(null);
              setHoveredChildId(null);
            }
          };

          const innerLink =
            item.href === "#" ? (
              <div className={baseClass}>
                <Icon size={18} />
                <span>{item.label}</span>
              </div>
            ) : (
              <Link href={item.href} className={baseClass}>
                <Icon size={18} />
                <span>{item.label}</span>
              </Link>
            );

          return (
            <div
              key={"id" in item && item.id ? item.id : item.label}
              className={cn(
                "relative isolate",
                itemId && hoveredCategoryId === itemId && hasChildren
                  ? "z-110"
                  : "z-100",
              )}
              onMouseEnter={openPanel}
            >
              {innerLink}

              {itemId &&
              hoveredCategoryId === itemId &&
              hasChildren ? (
                <div
                  role="menu"
                  aria-label="Sous-catégories"
                  className={cn(
                    "absolute left-full top-0 z-120 ml-2",
                    submenuClass,
                  )}
                  onMouseEnter={() => {
                    clearCloseTimer();
                    setHoveredCategoryId(itemId);
                  }}
                  onMouseLeave={() => setHoveredChildId(null)}
                >
                  <ul>
                    {children.map((child) => {
                      const grand =
                        childrenByParent.get(child.id) ?? [];
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
                              "block px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-blue-50 hover:text-blue-700 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-blue-300",
                              hoveredChildId === child.id &&
                                grand.length > 0 &&
                                "bg-blue-50/80 dark:bg-slate-800/80",
                            )}
                          >
                            {child.title}
                          </Link>
                          {grand.length > 0 &&
                          hoveredChildId === child.id ? (
                            <div
                              role="menu"
                              className={cn(
                                "absolute left-full top-0 z-130 ml-1",
                                submenuClass,
                              )}
                              onMouseEnter={clearCloseTimer}
                            >
                              <ul className="max-h-[min(320px,calc(100vh-140px))] overflow-y-auto">
                                {grand.map((leaf) => (
                                  <li key={leaf.id}>
                                    <Link
                                      href={`/${leaf.slug}`}
                                      className="block whitespace-nowrap px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-blue-50 hover:text-blue-700 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-blue-300"
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
