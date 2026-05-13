"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getCategories, type Category } from "@/lib/api/categories";
import { cn } from "@/lib/utils";

type ProfessionalsSideNavBlockProps = {
  title?: string;
  subtitle?: string;
  categoryIds?: string;
};

type NavItem = {
  id?: string;
  label: string;
  href: string;
};

export function ProfessionalsSideNavBlock({
  title = "Professionnels",
  subtitle = "Solutions Industrielles",
  categoryIds = "",
}: ProfessionalsSideNavBlockProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
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
      } finally {
        setLoading(false);
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

  const fallbackItems: NavItem[] = [
    {
      label: "Espace Pro",
      href: "#",
    },
    {
      label: "Financement",
      href: "#",
    },
  ];

  const categoryItems: NavItem[] =
    selectedCategories.length > 0
      ? selectedCategories.map((category) => ({
          id: category.id,
          label: category.title,
          href: `/${category.slug}`,
        }))
      : fallbackItems;

  const skeletonRows = useMemo(() => Array.from({ length: 6 }), []);

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
    "min-w-[232px] rounded-md border border-slate-200 bg-white py-1.5 text-left shadow-xl ring-1 ring-black/5 dark:border-slate-700 dark:bg-slate-900 dark:ring-white/10";

  return (
    <aside className="sticky top-18! isolate z-100 hidden h-full w-full flex-col gap-2 rounded-r-lg border-r border-slate-200 bg-white/85 p-4 text-sm text-blue-700 shadow-sm backdrop-blur md:flex dark:border-slate-800 dark:bg-slate-950/75 dark:text-blue-400">
      <div className="mb-6 border-b border-slate-200/80 px-4 pb-5 dark:border-slate-800">
        <h2 className="text-2xl! font-bold! tracking-normal text-blue-700 dark:text-blue-300">
          {title}
        </h2>
        <p className="mt-1! text-sm! text-slate-500 dark:text-slate-400">
          {subtitle}
        </p>
      </div>

      <nav
        className="flex flex-1 flex-col gap-1"
        aria-busy={loading}
        onMouseLeave={scheduleClose}>
        {loading ? (
          <div className="space-y-2" aria-hidden="true">
            {skeletonRows.map((_, index) => (
              <div
                key={index}
                className="h-11 overflow-hidden rounded-md border border-slate-200/70 bg-slate-100/90 dark:border-slate-800 dark:bg-slate-800/70">
                <div className="h-full animate-pulse rounded-md bg-gradient-to-r from-transparent via-white/65 to-transparent dark:via-white/5" />
              </div>
            ))}
          </div>
        ) : null}

        {!loading
          ? categoryItems.map((item) => {
              const children = item.id
                ? (childrenByParent.get(item.id) ?? [])
                : [];
              const hasChildren = children.length > 0;

              const baseClass = cn(
                "flex min-h-11 cursor-pointer items-center rounded-md border border-transparent px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:border-blue-100 hover:bg-blue-50/80 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 dark:text-slate-300 dark:hover:border-blue-900/40 dark:hover:bg-blue-950/35 dark:hover:text-blue-300",
                item.id &&
                  hoveredCategoryId === item.id &&
                  hasChildren &&
                  "border-blue-100 bg-blue-50/80 text-blue-700 dark:border-blue-900/40 dark:bg-blue-950/35 dark:text-blue-300",
              );

              const openPanel = () => {
                clearCloseTimer();
                if (item.id && hasChildren) {
                  setHoveredCategoryId(item.id);
                } else {
                  setHoveredCategoryId(null);
                  setHoveredChildId(null);
                }
              };

              const innerLink =
                item.href === "#" ? (
                  <div className={baseClass}>
                    <span>{item.label}</span>
                  </div>
                ) : (
                  <Link href={item.href} className={baseClass}>
                    <span>{item.label}</span>
                  </Link>
                );

              return (
                <div
                  key={item.id ?? item.label}
                  className={cn(
                    "relative isolate",
                    item.id && hoveredCategoryId === item.id && hasChildren
                      ? "z-110"
                      : "z-100",
                  )}
                  onMouseEnter={openPanel}>
                  {innerLink}

                  {item.id && hoveredCategoryId === item.id && hasChildren ? (
                    <div
                      role="menu"
                      aria-label="Sous-categories"
                      className={cn(
                        "absolute left-full top-0 z-120 ml-2",
                        submenuClass,
                      )}
                      onMouseEnter={() => {
                        clearCloseTimer();
                        setHoveredCategoryId(item.id ?? null);
                      }}
                      onMouseLeave={() => setHoveredChildId(null)}>
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
                              }>
                              <Link
                                href={`/${child.slug}`}
                                className={cn(
                                  "block px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-blue-300",
                                  hoveredChildId === child.id &&
                                    grand.length > 0 &&
                                    "bg-blue-50/80 dark:bg-slate-800/80",
                                )}>
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
                                  onMouseEnter={clearCloseTimer}>
                                  <ul className="max-h-[min(320px,calc(100vh-140px))] overflow-y-auto">
                                    {grand.map((leaf) => (
                                      <li key={leaf.id}>
                                        <Link
                                          href={`/${leaf.slug}`}
                                          className="block whitespace-nowrap px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-blue-300">
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
            })
          : null}
      </nav>
    </aside>
  );
}
