"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { getCategories } from "@/lib/api/categories";
import { cn } from "@/lib/utils";
import { normalizeSelection } from "@/components/puck-blocks/category-selection";
import { CategoryPanel, HERO_DEFAULTS, MobileDropdown, buildCategoryTree, getAudienceCategories, type HeroProps } from "@/components/puck-blocks/hero/hero";

const noop = () => {};

/**
 * Frames a category or product page with the home page's two category panels (left and right).
 * They come from the Hero block's settings in the page builder. Below 1360 px there is no room for them
 * beside the content, so there they become the two buttons of the home page, each opening its category list.
 */
export function CatalogPanelsLayout({ config, children }: { config: Partial<HeroProps>; children: React.ReactNode }) {
  const settings = { ...HERO_DEFAULTS, ...config };
  // Same "Suivre le défilement" setting as on the home page. Here there is no hero section to stop at:
  // a panel that follows the visitor stops above the footer.
  const follow = settings.followScroll === "none" ? "none" : "page";
  const bar = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState<"left" | "right" | null>(null);
  const query = useQuery({ queryKey: ["navbar-categories"], queryFn: () => getCategories(), staleTime: 60_000 });
  const tree = useMemo(() => buildCategoryTree(query.data ?? []), [query.data]);
  const left = getAudienceCategories(tree, "professionnels", normalizeSelection(settings.leftCategoryIds));
  const right = getAudienceCategories(tree, "particuliers", normalizeSelection(settings.rightCategoryIds));

  // The two buttons follow the visitor, just under the site header when that header is sticky.
  useEffect(() => {
    const element = bar.current;
    const win = element?.ownerDocument.defaultView;
    if (!element || !win) return;
    const place = () => {
      const header = win.document.querySelector("header");
      const sticky = header && ["sticky", "fixed"].includes(win.getComputedStyle(header).position);
      element.style.top = `${sticky && header ? header.getBoundingClientRect().height : 0}px`;
    };
    place();
    win.addEventListener("resize", place);
    win.addEventListener("scroll", place, { passive: true });
    return () => {
      win.removeEventListener("resize", place);
      win.removeEventListener("scroll", place);
    };
  }, []);

  const sides = [
    { key: "left" as const, title: settings.leftTitle || left.audienceRoot?.title || "Professionnels", color: settings.leftColor, data: left, footer: settings.leftFooter },
    { key: "right" as const, title: settings.rightTitle || right.audienceRoot?.title || "Particuliers", color: settings.rightColor, data: right, footer: undefined },
  ];
  const current = sides.find((side) => side.key === open);

  return (
    <>
      {/* Phones, tablets and small laptops: the two panels as buttons above the page. */}
      <div ref={bar} className="sticky z-30 grid grid-cols-2 gap-2 bg-[#f2f5fa] px-4 py-2 min-[1360px]:hidden">
        {sides.map((side) => (
          <button
            key={side.key}
            type="button"
            data-panel-toggle=""
            aria-expanded={open === side.key}
            onClick={() => setOpen((value) => (value === side.key ? null : side.key))}
            style={{ background: side.color }}
            className="flex min-h-11 items-center justify-between gap-1 rounded-xl px-3 text-left text-sm font-bold uppercase tracking-wide text-white shadow-sm transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0858b1] sm:min-h-[52px] sm:px-4 sm:text-base"
          >
            {side.title}
            <ChevronDown className={cn("size-4 shrink-0 transition-transform duration-200 motion-reduce:transition-none", open === side.key && "rotate-180")} aria-hidden="true" />
          </button>
        ))}
        {current ? (
          <MobileDropdown
            key={current.key}
            pinned={false}
            className="col-span-2"
            title={current.title}
            href={current.data.audienceRoot ? `/${current.data.audienceRoot.slug}` : "/categorie-produit"}
            color={current.color}
            categories={current.data.categories}
            footer={current.footer}
            onLinkClick={noop}
            onClose={() => setOpen(null)}
          />
        ) : null}
      </div>

    <div className="mx-auto w-full min-[1360px]:grid min-[1360px]:grid-cols-[240px_minmax(0,1fr)_240px] min-[1360px]:items-start min-[1360px]:gap-4 min-[1360px]:px-4 min-[1360px]:pt-4">
      <div className="hidden min-[1360px]:block">
        <CategoryPanel
          title={settings.leftTitle || left.audienceRoot?.title || "Professionnels"}
          href={left.audienceRoot ? `/${left.audienceRoot.slug}` : "/categorie-produit"}
          color={settings.leftColor}
          categories={left.categories}
          submenuSide="right"
          footer={settings.leftFooter}
          onOpenSheet={noop}
          sheetOpen={false}
          onPinned={noop}
          onLinkClick={noop}
          follow={follow}
          followOffset={settings.followOffset}
        />
      </div>
      <div className="min-w-0">{children}</div>
      <div className="hidden min-[1360px]:block">
        <CategoryPanel
          title={settings.rightTitle || right.audienceRoot?.title || "Particuliers"}
          href={right.audienceRoot ? `/${right.audienceRoot.slug}` : "/categorie-produit"}
          color={settings.rightColor}
          categories={right.categories}
          submenuSide="left"
          onOpenSheet={noop}
          sheetOpen={false}
          onPinned={noop}
          onLinkClick={noop}
          follow={follow}
          followOffset={settings.followOffset}
        />
      </div>
    </div>
    </>
  );
}
