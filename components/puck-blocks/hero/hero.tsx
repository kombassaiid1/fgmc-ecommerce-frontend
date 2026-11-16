/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronLeft, ChevronRight, X } from "lucide-react";

import { getImageUrl } from "@/lib/api";
import { getCategories, type Category } from "@/lib/api/categories";
import { cn } from "@/lib/utils";

import { normalizeSelection, type CategorySelection } from "../category-selection";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export type HeroCustomSlide = {
  imageUrl: string;
  altText: string;
  href: string;
};

export type HeroProps = {
  slides: HeroCustomSlide[];
  autoplaySeconds: number;
  showArrows: boolean;
  showDots: boolean;

  showPanels: boolean;
  leftTitle: string;
  leftFooter: string;
  rightTitle: string;
  /** Ordered category ids shown in each panel. Empty = automatic. */
  leftCategoryIds: CategorySelection[];
  rightCategoryIds: CategorySelection[];

  leftColor: string;
  rightColor: string;
  background: string;
  maxWidth: number;
  panelGap: number;
  sliderRadius: number;

  /** Whether the category panels follow the visitor while scrolling. */
  followScroll: FollowMode;
  /** Gap (px) between the top of the screen, or the sticky header, and a pinned panel. */
  followOffset: number;
};

type CategoryNode = Category & { children: CategoryNode[]; menuImage?: string };
type Slide = { key: string; imageUrl: string; altText: string; href: string };

export const HERO_DEFAULTS: HeroProps = {
  // Starting slides, copied from the site settings (Apparence > Accueil & hero).
  slides: [
    {
      imageUrl: "https://supabase.elbootic.tn/storage/v1/object/public/fgmc/image/1790679411314-MERIOMA 2026-AA.webp",
      altText: "MERIOMA 2026-AA",
      href: "/categorie-produit",
    },
    {
      imageUrl: "https://supabase.elbootic.tn/storage/v1/object/public/fgmc/image/1790679411223-machine-slider-fgmc.webp",
      altText: "Machine slider FGMC",
      href: "/categorie-produit",
    },
    {
      imageUrl: "https://supabase.elbootic.tn/storage/v1/object/public/fgmc/image/1790679411207-zaaraeurope-slider.webp",
      altText: "Zaara Europe slider",
      href: "/categorie-produit",
    },
  ],
  autoplaySeconds: 6,
  showArrows: true,
  showDots: true,
  showPanels: true,
  leftTitle: "",
  leftFooter: "Devis, financement & SAV dédiés aux professionnels.",
  rightTitle: "",
  leftCategoryIds: [],
  rightCategoryIds: [],
  leftColor: "#153675",
  rightColor: "#d6202e",
  background: "#f2f5fa",
  maxWidth: 1550,
  panelGap: 18,
  sliderRadius: 12,
  followScroll: "page",
  followOffset: 16,
};

/* -------------------------------------------------------------------------- */
/* Category helpers (same rules as the storefront's HomeHero)                 */
/* -------------------------------------------------------------------------- */

function normalize(value: string) {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function buildCategoryTree(categories: Category[]): CategoryNode[] {
  const nodes = new Map<string, CategoryNode>();
  categories.forEach((category) => nodes.set(category.id, { ...category, children: [] }));
  const roots: CategoryNode[] = [];
  categories.forEach((category) => {
    const node = nodes.get(category.id);
    if (!node) return;
    const parent = category.parentCategoryId ? nodes.get(category.parentCategoryId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  });
  return roots;
}

function flattenCategoryTree(categories: CategoryNode[]): CategoryNode[] {
  return categories.flatMap((category) => [category, ...flattenCategoryTree(category.children)]);
}

function getAudienceCategories(
  categories: CategoryNode[],
  audience: "professionnels" | "particuliers",
  selection: CategorySelection[],
) {
  const names =
    audience === "professionnels"
      ? ["professionnel", "professionnels", "pro"]
      : ["particulier", "particuliers"];
  const audienceRoot = categories.find(
    (category) =>
      names.includes(normalize(category.title.trim())) || names.includes(normalize(category.slug.trim())),
  );
  if (selection.length === 0) {
    return { audienceRoot, categories: audienceRoot?.children ?? categories };
  }
  // Explicit selection (made in the builder): keep its order, skip deleted ids.
  const all = flattenCategoryTree(categories);
  const chosen = selection.flatMap(({ id, childIds, imageUrl }): CategoryNode[] => {
    const category = all.find((item) => item.id === id);
    if (!category) return [];
    // childIds = which direct sub-categories appear in the hover menu.
    const allowed = childIds === null ? null : new Set(childIds);
    return [
      {
        ...category,
        children: allowed ? category.children.filter((child) => allowed.has(child.id)) : category.children,
        menuImage: imageUrl || undefined,
      },
    ];
  });
  return { audienceRoot, categories: chosen };
}

/* -------------------------------------------------------------------------- */
/* Block                                                                      */
/* -------------------------------------------------------------------------- */

export function Hero(props: Partial<HeroProps> & { isEditing?: boolean }) {
  const {
    slides: customSlides,
    autoplaySeconds,
    showArrows,
    showDots,
    showPanels,
    leftTitle,
    leftFooter,
    rightTitle,
    leftCategoryIds,
    rightCategoryIds,
    leftColor,
    rightColor,
    background,
    maxWidth,
    panelGap,
    sliderRadius,
    followScroll,
    followOffset,
  } = { ...HERO_DEFAULTS, ...props };
  const isEditing = Boolean(props.isEditing);

  const [activeSlide, setActiveSlide] = useState(0);
  // Mobile: which panel's side sheet is open.
  const [sheet, setSheet] = useState<"left" | "right" | null>(null);
  // The sheet is rendered in <body> of the document the block lives in (the
  // editor canvas is an iframe), so it is never clipped or stacked under
  // anything inside the block.
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const attachSection = useCallback((element: HTMLElement | null) => {
    setPortalTarget(element ? element.ownerDocument.body : null);
  }, []);

  const categoriesQuery = useQuery({
    queryKey: ["navbar-categories"],
    queryFn: () => getCategories(),
    staleTime: 60_000,
  });

  const tree = useMemo(() => buildCategoryTree(categoriesQuery.data ?? []), [categoriesQuery.data]);
  const professionals = getAudienceCategories(tree, "professionnels", normalizeSelection(leftCategoryIds));
  const individuals = getAudienceCategories(tree, "particuliers", normalizeSelection(rightCategoryIds));

  const slides: Slide[] = customSlides
    .filter((slide) => slide.imageUrl)
    .map((slide, index) => ({ key: `slide-${index}`, ...slide }));

  useEffect(() => {
    if (slides.length < 2 || autoplaySeconds <= 0) return;
    const timer = window.setInterval(
      () => setActiveSlide((current) => (current + 1) % slides.length),
      autoplaySeconds * 1000,
    );
    return () => window.clearInterval(timer);
  }, [slides.length, autoplaySeconds]);

  // Clamp instead of resetting in an effect: keeps the index valid when slides change.
  const current = activeSlide < slides.length ? activeSlide : 0;

  const moveSlide = (step: number) => {
    if (slides.length < 2) return;
    setActiveSlide((value) => (value + step + slides.length) % slides.length);
  };

  // In the editor, links must not navigate away from the canvas.
  const guardClick = (event: React.MouseEvent) => {
    if (isEditing) event.preventDefault();
  };

  return (
    <section
      ref={attachSection}
      className="px-4 py-5 sm:px-6 lg:py-6"
      style={{ background: background || undefined }}
      aria-label="Accueil et catégories"
    >
      <div
        className={cn(
          "mx-auto grid",
          // Mobile: the two panels sit side by side above the slider.
          showPanels
            ? "grid-cols-2 lg:grid-cols-[minmax(230px,310px)_minmax(0,1fr)_minmax(230px,310px)]"
            : "grid-cols-1",
        )}
        style={{ maxWidth, gap: panelGap }}
      >
        {showPanels ? (
          <CategoryPanel
            title={leftTitle || professionals.audienceRoot?.title || "Professionnels"}
            href={professionals.audienceRoot ? `/${professionals.audienceRoot.slug}` : "/categorie-produit"}
            color={leftColor}
            categories={professionals.categories}
            className="order-1"
            submenuSide="right"
            footer={leftFooter}
            onOpenSheet={() => setSheet("left")}
            onLinkClick={guardClick}
            follow={isEditing ? "none" : followScroll}
            followOffset={followOffset}
          />
        ) : null}

        <div
          className={cn(
            "relative order-3 aspect-[1046/657] w-full overflow-hidden bg-[#0a224f] shadow-sm lg:order-2",
            showPanels && "col-span-2 lg:col-span-1",
          )}
          style={{ borderRadius: sliderRadius }}
        >
          {slides.length > 0 ? (
            <>
              {slides.map((slide, index) => (
                <Link
                  key={slide.key}
                  href={slide.href || "/categorie-produit"}
                  onClick={guardClick}
                  aria-hidden={index !== current}
                  tabIndex={index === current ? 0 : -1}
                  className={cn(
                    "absolute inset-0 transition-opacity duration-500",
                    index === current ? "opacity-100" : "pointer-events-none opacity-0",
                  )}
                >
                  <img
                    width={1046}
                    height={657}
                    src={getImageUrl(slide.imageUrl)}
                    alt={slide.altText || ""}
                    className="h-full w-full object-cover"
                  />
                </Link>
              ))}
              {slides.length > 1 && showArrows ? (
                <>
                  <button
                    type="button"
                    onClick={() => moveSlide(-1)}
                    aria-label="Image précédente"
                    className="absolute left-3 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/70 bg-[#0a224f]/75 text-white shadow transition hover:bg-[#0a224f]"
                  >
                    <ChevronLeft className="size-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveSlide(1)}
                    aria-label="Image suivante"
                    className="absolute right-3 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/70 bg-[#0a224f]/75 text-white shadow transition hover:bg-[#0a224f]"
                  >
                    <ChevronRight className="size-5" />
                  </button>
                </>
              ) : null}
              {slides.length > 1 && showDots ? (
                <div className="absolute inset-x-0 bottom-4 flex justify-center gap-2" aria-label="Choisir une image">
                  {slides.map((slide, index) => (
                    <button
                      key={slide.key}
                      type="button"
                      aria-label={`Afficher l’image ${index + 1}`}
                      aria-current={index === current}
                      onClick={() => setActiveSlide(index)}
                      className={cn(
                        "h-2.5 w-2.5 rounded-full border border-white transition",
                        index === current ? "w-7 bg-white" : "bg-white/50 hover:bg-white/80",
                      )}
                    />
                  ))}
                </div>
              ) : null}
            </>
          ) : (
            <div className="absolute inset-0 flex flex-col justify-end overflow-hidden bg-[linear-gradient(135deg,#0a224f_0%,#153675_58%,#d6202e_160%)] p-7 text-white sm:p-10">
              <div className="absolute -right-10 -top-16 size-64 rounded-full border-[36px] border-white/10" aria-hidden="true" />
              <p className="relative mb-3 text-xs font-bold uppercase tracking-[0.22em] text-white/75">
                France Général Machines à Coudre
              </p>
              <h1 className="relative max-w-xl text-3xl font-bold leading-tight sm:text-5xl">Votre partenaire industriel</h1>
              <p className="relative mt-4 max-w-lg text-sm text-white/80 sm:text-base">Réparation · Vente · Achat · Location</p>
              <Link
                href="/categorie-produit"
                onClick={guardClick}
                className="relative mt-6 inline-flex min-h-11 w-fit items-center rounded-md bg-white px-5 text-sm font-bold text-[#0a224f] transition hover:bg-[#f0f4fa]"
              >
                Découvrir nos produits
              </Link>
            </div>
          )}
        </div>

        {showPanels ? (
          <CategoryPanel
            title={rightTitle || individuals.audienceRoot?.title || "Particuliers"}
            href={individuals.audienceRoot ? `/${individuals.audienceRoot.slug}` : "/categorie-produit"}
            color={rightColor}
            categories={individuals.categories}
            className="order-2 lg:order-3"
            submenuSide="left"
            onOpenSheet={() => setSheet("right")}
            onLinkClick={guardClick}
            follow={isEditing ? "none" : followScroll}
            followOffset={followOffset}
          />
        ) : null}
      </div>

      {sheet && portalTarget
        ? createPortal(
            <CategorySheet
              side={sheet}
              title={
                sheet === "left"
                  ? leftTitle || professionals.audienceRoot?.title || "Professionnels"
                  : rightTitle || individuals.audienceRoot?.title || "Particuliers"
              }
              href={
                (sheet === "left" ? professionals : individuals).audienceRoot
                  ? `/${(sheet === "left" ? professionals : individuals).audienceRoot?.slug}`
                  : "/categorie-produit"
              }
              color={sheet === "left" ? leftColor : rightColor}
              categories={(sheet === "left" ? professionals : individuals).categories}
              footer={sheet === "left" ? leftFooter : undefined}
              onLinkClick={guardClick}
              onClose={() => setSheet(null)}
            />,
            portalTarget,
          )
        : null}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Category panel                                                             */
/* -------------------------------------------------------------------------- */

function CategoryPanel({
  title,
  href,
  color,
  categories,
  className,
  footer,
  submenuSide,
  onOpenSheet,
  onLinkClick,
  follow,
  followOffset,
}: {
  title: string;
  href: string;
  color: string;
  categories: CategoryNode[];
  className?: string;
  footer?: string;
  submenuSide: "left" | "right";
  /** Mobile: open this panel's categories in a side sheet. */
  onOpenSheet: () => void;
  onLinkClick: (event: React.MouseEvent) => void;
  /** Follow the visitor while scrolling (never in the editor). */
  follow: FollowMode;
  followOffset: number;
}) {
  const cellRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  useFollowScroll(cellRef, panelRef, follow, followOffset);

  return (
    <div ref={cellRef} className={cn("min-w-0", className)}>
    <aside
      ref={panelRef}
      className="relative z-20 h-fit min-w-0 rounded-xl border border-[#dce3ec] bg-white shadow-sm hover:z-50 focus-within:z-50"
      aria-label={title}
    >
      <h2 className="overflow-hidden rounded-xl lg:rounded-b-none lg:rounded-t-xl" style={{ background: color }}>
        {/* Mobile: only the title is shown, and it opens the side sheet. */}
        <button
          type="button"
          onClick={onOpenSheet}
          aria-haspopup="dialog"
          className="flex min-h-11 w-full items-center justify-between gap-1 px-3 text-left text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-black/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white sm:min-h-[52px] sm:px-4 sm:text-base lg:hidden"
        >
          {title}
          <ChevronRight className="size-4 shrink-0" aria-hidden="true" />
        </button>
        <Link
          href={href}
          onClick={onLinkClick}
          className="hidden min-h-[52px] items-center justify-between gap-1 px-4 text-base font-bold uppercase tracking-wide text-white transition-colors hover:bg-black/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white lg:flex"
        >
          {title}
          <ChevronRight className="size-4" aria-hidden="true" />
        </Link>
      </h2>
      <ul className="hidden divide-y divide-[#e8edf3] lg:block" aria-label={`${title} categories`}>
        {categories.map((category) => (
          <li key={category.id} className="group relative">
            <Link
              href={`/${category.slug}`}
              onClick={onLinkClick}
              aria-haspopup={category.children.length > 0 || category.menuImage ? "true" : undefined}
              className="flex min-h-[39px] items-center justify-between gap-2 px-4 py-2 text-[13px] text-[#12264b] transition-colors hover:bg-[#f2f6fc] hover:text-[#2456b1] focus-visible:bg-[#f2f6fc] focus-visible:text-[#2456b1] focus-visible:outline-none"
            >
              <span>{category.title}</span>
              {category.children.length > 0 || category.menuImage ? (
                <ChevronRight className="size-3 shrink-0 text-[#687b98]" aria-hidden="true" />
              ) : null}
            </Link>
            {category.children.length > 0 || category.menuImage ? (
              <div
                className={cn(
                  "invisible absolute top-0 z-50 rounded-lg border border-[#dce3ec] bg-white opacity-0 shadow-xl transition-opacity group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100",
                  category.menuImage ? "w-[min(720px,calc(100vw-2rem))]" : "w-64",
                  submenuSide === "right" ? "left-full" : "right-full",
                )}
              >
                <div className={cn("flex max-h-[420px]", category.menuImage && "gap-5 p-4")}>
                  <ul
                    aria-label={`${category.title} sous-catégories`}
                    className={cn(
                      "min-w-0 overflow-y-auto",
                      // With a picture, sub-categories flow into two columns beside it.
                      category.menuImage ? "flex-1 sm:columns-2 sm:gap-6" : "w-full py-2",
                    )}
                  >
                    <li className={cn("break-inside-avoid text-xs font-bold uppercase text-[#929db0]", category.menuImage ? "pb-2" : "px-4 py-2")}>
                      {category.title}
                    </li>
                    {category.children.map((child) => (
                      <li key={child.id} className="break-inside-avoid">
                        <Link
                          href={`/${child.slug}`}
                          onClick={onLinkClick}
                          className={cn(
                            "block text-[13px] text-[#12264b] transition-colors hover:bg-[#f2f6fc] hover:text-[#2456b1] focus-visible:bg-[#f2f6fc] focus-visible:text-[#2456b1] focus-visible:outline-none",
                            category.menuImage ? "rounded px-2 py-1.5" : "px-4 py-2",
                          )}
                        >
                          {child.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                  {category.menuImage ? (
                    <Link
                      href={`/${category.slug}`}
                      onClick={onLinkClick}
                      tabIndex={-1}
                      aria-hidden="true"
                      className="hidden w-[260px] shrink-0 items-center justify-center sm:flex"
                    >
                      <img
                        src={getImageUrl(category.menuImage)}
                        alt=""
                        className="max-h-[388px] w-full rounded-md object-contain"
                      />
                    </Link>
                  ) : null}
                </div>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      {footer ? (
        <p className="hidden border-t border-[#e8edf3] bg-[#f6f8fc] px-4 py-3 text-xs leading-relaxed text-[#63748f] lg:block">
          {footer}
        </p>
      ) : null}
    </aside>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Follow-on-scroll for the category panels                                   */
/* -------------------------------------------------------------------------- */

type FollowMode = "none" | "section" | "page";

/**
 * Keeps a panel in view while the page scrolls (desktop only).
 *
 * The panel starts in its normal place, level with the slider. Once its row
 * scrolls up to the top of the screen, it is pinned there, below the
 * storefront's sticky header when there is one. It stays pinned until the end
 * of the hero ("section") or of the whole built page ("page"), where it
 * scrolls away with that end instead of covering what follows.
 */
function useFollowScroll(
  cellRef: React.RefObject<HTMLDivElement | null>,
  panelRef: React.RefObject<HTMLElement | null>,
  mode: FollowMode,
  offset: number,
) {
  useEffect(() => {
    const cell = cellRef.current;
    const panel = panelRef.current;
    if (!cell || !panel || mode === "none") return;
    const doc = cell.ownerDocument;
    const win = doc.defaultView;
    if (!win) return;

    const desktop = win.matchMedia("(min-width: 1024px)");

    const release = () => {
      panel.style.position = "";
      panel.style.top = "";
      panel.style.left = "";
      panel.style.width = "";
      panel.style.zIndex = "";
      cell.style.minHeight = "";
    };

    // Runs straight from the scroll event (no animation-frame delay), so a pinned
    // panel never lags a frame behind the page.
    const update = () => {
      if (!desktop.matches) {
        release();
        return;
      }

      // Sit below the storefront's sticky header, when it has one.
      let top = offset;
      const header = doc.querySelector("header");
      if (header) {
        const position = win.getComputedStyle(header).position;
        if (position === "sticky" || position === "fixed") top += header.getBoundingClientRect().height;
      }

      const cellRect = cell.getBoundingClientRect();
      if (cellRect.top >= top) {
        release();
        return;
      }

      const panelHeight = panel.offsetHeight;
      // End of the stretch the panel may follow the visitor through.
      const boundary =
        mode === "section"
          ? cell.closest("section")
          : (cell.closest("[data-pb-page]") ?? doc.querySelector("footer"));
      let y = top;
      if (boundary) {
        const rect = boundary.getBoundingClientRect();
        const limit = boundary.tagName === "FOOTER" ? rect.top : rect.bottom;
        y = Math.min(top, limit - panelHeight);
      }

      // Keep the row's height while the panel is out of the flow.
      cell.style.minHeight = `${panelHeight}px`;
      panel.style.position = "fixed";
      panel.style.top = `${y}px`;
      panel.style.left = `${cellRect.left}px`;
      panel.style.width = `${cellRect.width}px`;
      panel.style.zIndex = "30";
    };

    update();
    win.addEventListener("scroll", update, { passive: true });
    win.addEventListener("resize", update);
    return () => {
      win.removeEventListener("scroll", update);
      win.removeEventListener("resize", update);
      release();
    };
  }, [cellRef, panelRef, mode, offset]);
}

/* -------------------------------------------------------------------------- */
/* Mobile side sheet                                                          */
/* -------------------------------------------------------------------------- */

function CategorySheet({
  side,
  title,
  href,
  color,
  categories,
  footer,
  onLinkClick,
  onClose,
}: {
  side: "left" | "right";
  title: string;
  href: string;
  color: string;
  categories: CategoryNode[];
  footer?: string;
  onLinkClick: (event: React.MouseEvent) => void;
  onClose: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  // Lock page scroll and close on Escape, in the document the sheet lives in.
  useEffect(() => {
    const doc = rootRef.current?.ownerDocument ?? document;
    const previous = doc.body.style.overflow;
    doc.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeRef.current();
    };
    doc.addEventListener("keydown", onKey);
    return () => {
      doc.body.style.overflow = previous;
      doc.removeEventListener("keydown", onKey);
    };
  }, []);

  const navigate = (event: React.MouseEvent) => {
    onLinkClick(event);
    onClose();
  };

  return (
    <div ref={rootRef} className="fixed inset-0 z-[1000] lg:hidden" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/50 animate-in fade-in duration-200" onClick={onClose} aria-hidden="true" />
      <div
        className={cn(
          "absolute inset-y-0 flex w-[88%] max-w-sm flex-col bg-white shadow-2xl animate-in duration-200",
          side === "left" ? "left-0 slide-in-from-left" : "right-0 slide-in-from-right",
        )}
      >
        <div className="flex min-h-14 shrink-0 items-center justify-between gap-2 pl-4 pr-2 text-white" style={{ background: color }}>
          <Link href={href} onClick={navigate} className="py-3 text-base font-bold uppercase tracking-wide">
            {title}
          </Link>
          <button
            type="button"
            onClick={onClose}
            autoFocus
            aria-label="Fermer"
            className="flex size-11 items-center justify-center rounded-full transition-colors hover:bg-black/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        <ul className="min-h-0 flex-1 divide-y divide-[#e8edf3] overflow-y-auto overscroll-contain" aria-label={`${title} categories`}>
          {categories.map((category) => (
            <SheetItem key={category.id} category={category} onNavigate={navigate} />
          ))}
        </ul>

        {footer ? (
          <p className="shrink-0 border-t border-[#e8edf3] bg-[#f6f8fc] px-4 py-3 text-xs leading-relaxed text-[#63748f]">
            {footer}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/** One category in the sheet; its sub-categories open as an accordion (no hover on touch screens). */
function SheetItem({
  category,
  onNavigate,
}: {
  category: CategoryNode;
  onNavigate: (event: React.MouseEvent) => void;
}) {
  const [open, setOpen] = useState(false);
  const hasChildren = category.children.length > 0;

  return (
    <li>
      <div className="flex items-stretch">
        <Link
          href={`/${category.slug}`}
          onClick={onNavigate}
          className="flex min-h-12 flex-1 items-center px-4 py-3 text-[15px] text-[#12264b] transition-colors hover:bg-[#f2f6fc] hover:text-[#2456b1] focus-visible:bg-[#f2f6fc] focus-visible:outline-none"
        >
          {category.title}
        </Link>
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-label={open ? `Replier ${category.title}` : `Déplier ${category.title}`}
            className="flex w-12 shrink-0 items-center justify-center border-l border-[#e8edf3] text-[#687b98] transition-colors hover:bg-[#f2f6fc] focus-visible:bg-[#f2f6fc] focus-visible:outline-none"
          >
            <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} aria-hidden="true" />
          </button>
        ) : null}
      </div>
      {hasChildren && open ? (
        <ul className="border-t border-[#e8edf3] bg-[#f6f8fc]">
          <li>
            <Link
              href={`/${category.slug}`}
              onClick={onNavigate}
              className="block px-6 py-3 text-sm font-semibold text-[#2456b1] focus-visible:outline-none"
            >
              Tout voir
            </Link>
          </li>
          {category.children.map((child) => (
            <li key={child.id}>
              <Link
                href={`/${child.slug}`}
                onClick={onNavigate}
                className="block px-6 py-3 text-sm text-[#12264b] transition-colors hover:bg-white hover:text-[#2456b1] focus-visible:bg-white focus-visible:outline-none"
              >
                {child.title}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}
