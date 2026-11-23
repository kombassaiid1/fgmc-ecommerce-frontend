"use client";

import { Carousel, CarouselContent, CarouselItem, useCarousel } from "@/components/ui/carousel";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  PiCaretLeftBold as ChevronLeft,
  PiCaretRightBold as ChevronRight,
  PiChatCircleDotsDuotone as ChatDots,
  PiLockKeyDuotone as LockKey,
  PiSealCheckDuotone as SealCheck,
  PiCheckBold as Check,
  PiMagnifyingGlassPlusBold as ZoomIn,
  PiCreditCardDuotone as CreditCard,
  PiMinusBold as Minus,
  PiXBold as Close,
  PiPackageDuotone as Package,
  PiPlusBold as Plus,
  PiShieldCheckDuotone as ShieldCheck,
  PiShoppingCartSimpleDuotone as ShoppingCart,
  PiSpinnerGapBold as LoaderCircle,
  PiStarFill as Star,
  PiTruckDuotone as Truck,
} from "react-icons/pi";

import { canClientReviewProduct, fetchProductReviews, getAttachmentAccess, submitProductReview, type ProductDetailsResponse, type ProductReviewsResponse } from "@/lib/product-details-api";
import { getImageUrl } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useCartStore } from "@/lib/stores/cart-store";
import { useRecentlyViewedStore } from "@/lib/stores/recently-viewed-store";
import { sendProductView } from "@/lib/api/reco";
import { resolveSpecificPrice } from "@/lib/specific-pricing";
import { RichTextDisplay } from "@/components/ui/rich-text-display";
import { ProductCard, type ProductCardProduct } from "@/components/product-card";
import { getProductById, getProducts } from "@/lib/api/products";
import { toast } from "sonner";
import { getClientSession, subscribeToClientSession, type ClientSession } from "@/lib/client-auth";

import "./product.css";

function parsePrice(value: string | null | undefined): number {
  const n = parseFloat(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function formatEuroNumber(value: number): string {
  const [integer, fraction] = value.toFixed(2).split(".");
  return `${integer.replace(/\B(?=(\d{3})+(?!\d))/g, "\u202f")},${fraction}`;
}

function rateToFraction(rate: number | null | undefined): number {
  if (rate == null || !Number.isFinite(rate)) return 0;
  return rate > 1 ? rate / 100 : rate;
}

function parseQty(value: string | number | null | undefined): number | null {
  if (value == null) return null;
  const n =
    typeof value === "number"
      ? value
      : parseInt(String(value).replace(/[^0-9-]/g, ""), 10);
  if (!Number.isFinite(n)) return null;
  if (n < 0) return 0;
  return n;
}

/** "574--fil-a-broder-poly-soft-1000m" -> "Fil a broder poly soft 1000m" */
function prettySlug(slug: string): string {
  const words = slug.replace(/^\d+-+/, "").replace(/-+/g, " ").trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : slug;
}

type Props = {
  categorySlug: string;
  product: ProductDetailsResponse;
};

type CombinaisonOption = {
  attributeId?: string;
  attributeName?: string;
  termId?: string;
  termName?: string;
};

type Combinaison = {
  id: string;
  isActive?: boolean;
  isDefault?: boolean;
  price?: string | null;
  qty?: string | null;
  stockStatus?: string | null;
  sku?: string | null;
  image?: string | null;
  options?: unknown;
};

function isOptionArray(value: unknown): value is CombinaisonOption[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        item != null &&
        typeof item === "object" &&
        ("attributeName" in item || "termName" in item),
    )
  );
}

function optionKey(options: Array<{ attributeId: string; termId: string }>) {
  return options
    .slice()
    .sort((a, b) => a.attributeId.localeCompare(b.attributeId))
    .map((o) => `${o.attributeId}:${o.termId}`)
    .join("|");
}

/** Previous / next buttons of a recommendations carousel. Hidden when everything already fits on screen. */
function RecommendationArrows({ title }: { title: string }) {
  const { scrollPrev, scrollNext, canScrollPrev, canScrollNext } = useCarousel();
  if (!canScrollPrev && !canScrollNext) return null;
  const base = "static inline-flex size-10 translate-x-0 translate-y-0 items-center justify-center rounded-full border-[#c5d0e6] text-[#153675]";
  return (
    <div className="flex gap-2">
      <button type="button" onClick={scrollPrev} disabled={!canScrollPrev} aria-label={`${title} : précédents`} className={cn(base, "cursor-pointer border bg-white transition-colors hover:bg-[#eef2f9] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#153675] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white")}>
        <ChevronLeft className="size-5" aria-hidden="true" />
      </button>
      <button type="button" onClick={scrollNext} disabled={!canScrollNext} aria-label={`${title} : suivants`} className={cn(base, "cursor-pointer border bg-white transition-colors hover:bg-[#eef2f9] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#153675] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white")}>
        <ChevronRight className="size-5" aria-hidden="true" />
      </button>
    </div>
  );
}

export function ProductDetailClient({ categorySlug, product }: Props) {
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [justAdded, setJustAdded] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const lensRef = useRef<HTMLDivElement>(null);
  const paneRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [lightbox, setLightbox] = useState(false);
  const [lightboxZoom, setLightboxZoom] = useState(false);
  const router = useRouter();
  const [productReviews, setProductReviews] = useState<ProductReviewsResponse | null>(null);
  const [clientSession, setClientSession] = useState<ClientSession | null>(null);
  const [reviewAccess, setReviewAccess] = useState<"loading" | "login" | "not-purchased" | "eligible" | "submitted" | "error">("loading");
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewMessage, setReviewMessage] = useState<string | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [similarProducts, setSimilarProducts] = useState<ProductCardProduct[]>([]);
  const [spareParts, setSpareParts] = useState<ProductCardProduct[]>([]);
  const [associatedProducts, setAssociatedProducts] = useState<ProductCardProduct[]>([]);
  const addItem = useCartStore((s) => s.addItem);
  const addRecentlyViewed = useRecentlyViewedStore((s) => s.addView);
  const [tab, setTab] = useState<string>(
    "description",
  );

  const recordedViewRef = useRef<string | null>(null);
  useEffect(() => {
    // Once per product page display, not on every re-render.
    if (recordedViewRef.current === product.id) return;
    recordedViewRef.current = product.id;
    addRecentlyViewed(product.id);
    sendProductView(product.id);
  }, [addRecentlyViewed, product.id]);

  useEffect(() => {
    const syncSession = () => setClientSession(getClientSession());
    syncSession();
    return subscribeToClientSession(syncSession);
  }, []);

  useEffect(() => {
    if (!clientSession?.token) {
      setReviewAccess("login");
      return;
    }
    let active = true;
    setReviewAccess("loading");
    canClientReviewProduct(product.id, clientSession.token)
      .then(({ purchased }) => {
        if (active) setReviewAccess(purchased ? "eligible" : "not-purchased");
      })
      .catch((error: unknown) => {
        if (!active) return;
        setReviewAccess(error instanceof Error && error.message.includes("(401)") ? "login" : "error");
      });
    return () => { active = false; };
  }, [clientSession?.token, product.id]);

  useEffect(() => {
    let active = true;
    fetchProductReviews(product.id)
      .then((data) => { if (active) setProductReviews(data); })
      .catch(() => { if (active) setProductReviews(null); });
    return () => { active = false; };
  }, [product.id]);

  useEffect(() => {
    let active = true;
    const categoryId = product.categories?.find((entry) => entry.category?.slug === categorySlug)?.categoryId
      ?? product.categories?.[0]?.categoryId;
    if (categoryId) {
      getProducts({ page: 1, limit: 12, categoryId, includeDescendants: true, status: "PUBLIC" })
        .then((result) => {
          if (active) setSimilarProducts(result.data.filter((item) => item.id !== product.id));
        })
        .catch(() => { if (active) setSimilarProducts([]); });
    } else {
      setSimilarProducts([]);
    }

    const ids = (product.sparePartIds ?? []).filter((id) => id !== product.id);
    Promise.allSettled(ids.map((id) => getProductById(id)))
      .then((results) => {
        if (!active) return;
        setSpareParts(results.flatMap((result) => result.status === "fulfilled" && result.value.status === "PUBLIC" ? [result.value] : []));
      });
    const associatedIds = (product.associatedIds ?? []).filter((id) => id !== product.id);
    Promise.allSettled(associatedIds.map((id) => getProductById(id)))
      .then((results) => {
        if (!active) return;
        setAssociatedProducts(results.flatMap((result) => result.status === "fulfilled" && result.value.status === "PUBLIC" ? [result.value] : []));
      });
    return () => { active = false; };
  }, [categorySlug, product.categories, product.id, product.sparePartIds, product.associatedIds]);

  // « À découvrir aussi »: one section under the other, each only when it has something to show.
  const recommendationSections = [
    { id: "similar", title: "Produits similaires", items: similarProducts },
    { id: "spare-parts", title: "Pièces de rechange", items: spareParts },
    { id: "associated", title: "Produits associés", items: associatedProducts },
  ].filter((section) => section.items.length > 0);

  const images = product.images ?? [];
  const selectedImageUrl = images[selectedImageIndex]
    ? getImageUrl(images[selectedImageIndex]!)
    : null;

  const normalizedCombinaisons = useMemo(() => {
    const list = (product.combinaisons ??
      // backward compat
      (product.variants as Combinaison[] | undefined) ??
      []) as Combinaison[];
    return list
      .filter((c) => c && typeof c.id === "string")
      .map((c) => ({
        ...c,
        options: isOptionArray(c.options) ? c.options : [],
      }));
  }, [product.combinaisons, product.variants]);

  const hasCombinaisons = normalizedCombinaisons.length > 0;

  const defaultCombinaison = useMemo(() => {
    if (!hasCombinaisons) return null;
    return (
      normalizedCombinaisons.find((c) => c.isDefault) ??
      normalizedCombinaisons.find((c) => c.isActive !== false) ??
      normalizedCombinaisons[0] ??
      null
    );
  }, [hasCombinaisons, normalizedCombinaisons]);

  const [selectedOptionByAttributeId, setSelectedOptionByAttributeId] =
    useState<Record<string, string>>(() => {
      const initial: Record<string, string> = {};
      const opts = (defaultCombinaison?.options as CombinaisonOption[]) ?? [];
      for (const o of opts) {
        if (o.attributeId && o.termId) {
          initial[o.attributeId] = o.termId;
        }
      }
      return initial;
    });

  const optionGroups = useMemo(() => {
    const groups = new Map<
      string,
      {
        attributeId: string;
        attributeName: string;
        terms: Array<{ termId: string; termName: string }>;
      }
    >();
    for (const combo of normalizedCombinaisons) {
      const opts = combo.options as CombinaisonOption[];
      for (const o of opts) {
        if (!o.attributeId || !o.termId) continue;
        const attributeName = o.attributeName ?? "Option";
        const termName = o.termName ?? o.termId;
        const existing = groups.get(o.attributeId) ?? {
          attributeId: o.attributeId,
          attributeName,
          terms: [],
        };
        if (!existing.terms.some((t) => t.termId === o.termId)) {
          existing.terms.push({ termId: o.termId, termName });
        }
        groups.set(o.attributeId, existing);
      }
    }
    const list = Array.from(groups.values()).map((g) => ({
      ...g,
      terms: g.terms.sort((a, b) => a.termName.localeCompare(b.termName, "fr")),
    }));
    // keep stable "Option / Option 2 / Option 3" order
    const parseOption = (name: string) => {
      const m = /^option(?:\s+(\d+))?$/i.exec(name.trim());
      if (!m) return null;
      return m[1] ? Number(m[1]) : 1;
    };
    list.sort((a, b) => {
      const an = parseOption(a.attributeName);
      const bn = parseOption(b.attributeName);
      if (an != null || bn != null) {
        if (an == null) return 1;
        if (bn == null) return -1;
        return an - bn;
      }
      return a.attributeName.localeCompare(b.attributeName, "fr", {
        numeric: true,
        sensitivity: "base",
      });
    });
    return list;
  }, [normalizedCombinaisons]);

  const comboByKey = useMemo(() => {
    const map = new Map<string, Combinaison>();
    for (const combo of normalizedCombinaisons) {
      const opts = (combo.options as CombinaisonOption[])
        .filter((o) => o.attributeId && o.termId)
        .map((o) => ({ attributeId: o.attributeId!, termId: o.termId! }));
      map.set(optionKey(opts), combo);
    }
    return map;
  }, [normalizedCombinaisons]);

  // Options that stand alone (a model, and a separate extra) are combinations of one choice each. Picking one choice per
  // group adds their price differences to the product's price; a combination that holds several choices is used as it is.
  const singleByChoice = useMemo(() => {
    const map = new Map<string, Combinaison>();
    for (const combo of normalizedCombinaisons) {
      if (combo.isActive === false) continue;
      const opts = (combo.options as CombinaisonOption[]).filter((o) => o.attributeId && o.termId);
      if (opts.length === 1) map.set(`${opts[0].attributeId}:${opts[0].termId}`, combo);
    }
    return map;
  }, [normalizedCombinaisons]);

  const baseHt = parsePrice(product.price);

  // What a group shows before anything is picked: the choice that costs least (no extra), else the first.
  const defaultTermId = (group: { attributeId: string; terms: Array<{ termId: string }> }) => {
    let best: { termId: string; price: number } | null = null;
    for (const term of group.terms) {
      const combo = singleByChoice.get(`${group.attributeId}:${term.termId}`);
      const price = combo ? parsePrice(combo.price ?? product.price) : Number.POSITIVE_INFINITY;
      if (best == null || price < best.price) best = { termId: term.termId, price };
    }
    return best?.termId ?? group.terms[0]?.termId ?? "";
  };
  const chosenTermId = (group: { attributeId: string; terms: Array<{ termId: string }> }) =>
    selectedOptionByAttributeId[group.attributeId] ?? defaultTermId(group);

  type Resolved = {
    /** Several combinations are joined with "+", in a fixed order: the server reads it the same way. */
    variantId: string;
    priceHt: number;
    qty: string | null | undefined;
    stockStatus: string | null | undefined;
    sku: string | null | undefined;
    label: string | null;
  };
  const describe = (combos: Combinaison[]) =>
    combos
      .flatMap((c) => (c.options as CombinaisonOption[]).map((o) => (o.termName ? (o.attributeName ? `${o.attributeName} : ${o.termName}` : o.termName) : "")))
      .filter(Boolean)
      .join(" · ") || null;
  const fromOne = (combo: Combinaison): Resolved => ({ variantId: combo.id, priceHt: parsePrice(combo.price ?? product.price), qty: combo.qty, stockStatus: combo.stockStatus, sku: combo.sku, label: describe([combo]) });

  const resolved = useMemo<Resolved | null>(() => {
    if (!hasCombinaisons) return null;
    if (optionGroups.length === 0) return defaultCombinaison ? fromOne(defaultCombinaison) : null;
    const choices = optionGroups
      .map((g) => ({ attributeId: g.attributeId, termId: selectedOptionByAttributeId[g.attributeId] ?? defaultTermId(g) }))
      .filter((x) => x.termId);
    // A combination that holds exactly these choices.
    const exact = comboByKey.get(optionKey(choices));
    if (exact) return fromOne(exact);
    // Otherwise one stand-alone combination per group, added up.
    if (choices.length < 2) return null;
    const parts = choices.map((c) => singleByChoice.get(`${c.attributeId}:${c.termId}`));
    if (parts.some((part) => !part)) return null;
    const combos = parts as Combinaison[];
    const quantities = combos.map((c) => parseQty(c.qty)).filter((n): n is number => n != null);
    return {
      variantId: combos.map((c) => c.id).sort().join("+"),
      priceHt: combos.reduce((sum, c) => sum + (parsePrice(c.price ?? product.price) - baseHt), baseHt),
      qty: quantities.length ? String(Math.min(...quantities)) : null,
      stockStatus: combos.some((c) => String(c.stockStatus ?? "").toLowerCase() === "outofstock") ? "outofstock" : combos[0]?.stockStatus,
      sku: product.sku,
      label: describe(combos),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the helpers above only read these same inputs
  }, [baseHt, comboByKey, defaultCombinaison, hasCombinaisons, optionGroups, selectedOptionByAttributeId, singleByChoice]);

  // No combination holds these choices: nothing is sold at another combination's price.
  const combinationMissing = hasCombinaisons && optionGroups.length > 0 && !resolved;

  const originalHt = hasCombinaisons
    ? (resolved?.priceHt ?? baseHt)
    : baseHt;
  const vat = rateToFraction(product.taxRelation?.rate);
  const originalTtc = originalHt * (1 + vat);
  const displayedTtc = resolveSpecificPrice(product.specificPrices, originalHt, vat, quantity).saleTtc;
  const hasDiscount = displayedTtc < originalTtc;
  const displayedHt = displayedTtc / (1 + vat);
  const discountPercent = originalTtc > 0
    ? Math.min(100, Math.max(1, Math.round(((originalTtc - displayedTtc) / originalTtc) * 100)))
    : 0;

  const displayedStockStatus = hasCombinaisons
    ? (resolved?.stockStatus ?? product.stockStatus)
    : product.stockStatus;

  const displayedSku = hasCombinaisons
    ? (resolved?.sku ?? product.sku)
    : product.sku;

  const maxPurchasableQty = useMemo(() => {
    const raw = hasCombinaisons ? resolved?.qty : product.qty;
    const n = parseQty(raw);
    if (n == null) return null;
    return Math.max(0, n);
  }, [hasCombinaisons, product.qty, resolved?.qty]);

  const stockBadgeLabel = useMemo(() => {
    const status = String(displayedStockStatus ?? "").toLowerCase();
    const qty = maxPurchasableQty;
    if (qty != null) {
      if (qty <= 0) return "Rupture de stock";
      return "En stock";
    }
    if (status === "instock") return "En stock";
    if (status === "outofstock") return "Rupture de stock";
    return "Disponible";
  }, [displayedStockStatus, maxPurchasableQty]);

  const effectiveQuantity = useMemo(() => {
    if (maxPurchasableQty == null) return Math.max(1, quantity);
    if (maxPurchasableQty <= 0) return 1;
    return Math.min(Math.max(1, quantity), maxPurchasableQty);
  }, [maxPurchasableQty, quantity]);

  const displayAttributes = useMemo(() => {
    return (
      product.attributes
        ?.map((a) => ({
          attribute: a.attribute ?? undefined,
          term: a.term ?? undefined,
        }))
        .filter((a) => a.attribute?.name || a.term?.name) ?? []
    );
  }, [product.attributes]);

  const reviewCount = productReviews?.total ?? product.reviewCount;
  const ratingScore = productReviews?.avgRating || product.reviewRating;

  async function handleReviewSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!clientSession?.token || !clientSession.user) return;
    setReviewSubmitting(true);
    setReviewError(null);
    setReviewMessage(null);
    try {
      const user = clientSession.user;
      const name = [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || user.email.split("@")[0];
      await submitProductReview(product.id, clientSession.token, {
        review: reviewText.trim(),
        rating: reviewRating,
        name,
        email: user.email,
      });
      setReviewAccess("submitted");
      setReviewMessage("Merci pour votre avis. Il sera visible après validation.");
      setReviewText("");
    } catch (submitError) {
      setReviewError(submitError instanceof Error ? submitError.message : "Impossible d’envoyer votre avis.");
    } finally {
      setReviewSubmitting(false);
    }
  }

  const detailHref = categorySlug
    ? `/${categorySlug}/${product.slug}.html`
    : `/${product.slug}.html`;

  const unavailable = combinationMissing || (maxPurchasableQty != null && maxPurchasableQty <= 0);

  // Hover zoom, as on the big marketplaces: a square on the photo, and the enlarged area shown beside it.
  const ZOOM = 2.5;
  const moveLens = (clientX: number, clientY: number) => {
    const stage = stageRef.current;
    const img = imgRef.current;
    const lens = lensRef.current;
    const pane = paneRef.current;
    if (!stage || !img || !lens || !pane || !img.naturalWidth) return;
    const box = stage.getBoundingClientRect();
    const size = box.width / ZOOM;
    const lx = Math.min(Math.max(clientX - box.left - size / 2, 0), box.width - size);
    const ly = Math.min(Math.max(clientY - box.top - size / 2, 0), box.height - size);
    const fit = Math.min(box.width / img.naturalWidth, box.height / img.naturalHeight);
    const drawnW = img.naturalWidth * fit;
    const drawnH = img.naturalHeight * fit;
    const offsetX = (box.width - drawnW) / 2;
    const offsetY = (box.height - drawnH) / 2;
    lens.style.width = `${size}px`;
    lens.style.height = `${size}px`;
    lens.style.transform = `translate(${lx}px, ${ly}px)`;
    lens.dataset.on = "1";
    pane.style.backgroundSize = `${drawnW * ZOOM}px ${drawnH * ZOOM}px`;
    pane.style.backgroundPosition = `${-(lx - offsetX) * ZOOM}px ${-(ly - offsetY) * ZOOM}px`;
    pane.dataset.on = "1";
  };
  const hideLens = () => {
    if (lensRef.current) lensRef.current.dataset.on = "0";
    if (paneRef.current) paneRef.current.dataset.on = "0";
  };

  // Full view: Escape closes, arrows change photo, the page behind does not scroll.
  useEffect(() => {
    if (!lightbox) return;
    const count = (product.images ?? []).length;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLightbox(false);
      if (count > 1 && event.key === "ArrowLeft") setSelectedImageIndex((i) => (i === 0 ? count - 1 : i - 1));
      if (count > 1 && event.key === "ArrowRight") setSelectedImageIndex((i) => (i === count - 1 ? 0 : i + 1));
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [lightbox, product.images]);
  const addToCart = () =>
    addItem(
      {
        productId: product.id,
        productSlug: product.slug,
        title: product.title,
        image: product.images?.[0] ?? null,
        categorySlug: categorySlug ?? null,
        variantId: resolved?.variantId ?? null,
        variantLabel: resolved?.label ?? null,
        price: String(displayedHt),
        taxRate: product.taxRelation?.rate ?? null,
      },
      effectiveQuantity,
    );
  const handleAdd = () => {
    addToCart();
    toast.success("Ajouté au panier", { description: `${effectiveQuantity} × ${product.title}` });
    setJustAdded(true);
    window.setTimeout(() => setJustAdded(false), 1800);
  };
  const inStock = stockBadgeLabel !== "Rupture de stock";

  return (
    <main className="pd">
      <div className="pd-band">
      <div className="pd-wrap">
        <nav aria-label="Fil d’Ariane" className="pd-crumbs">
          <Link href="/">Accueil</Link>
          {categorySlug ? (
            <>
              <ChevronRight className="size-3.5" aria-hidden="true" />
              <Link href={`/${categorySlug}`}>{prettySlug(categorySlug)}</Link>
            </>
          ) : null}
          <ChevronRight className="size-3.5" aria-hidden="true" />
          <span aria-current="page">{product.title}</span>
        </nav>

        <section className="pd-hero">
          <div className="pd-gallery">
            <div className="pd-mat">
              <div className="pd-stage" ref={stageRef}>
                <span className="pd-frame" aria-hidden="true" />
                {selectedImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img ref={imgRef} src={selectedImageUrl} alt={product.title} />
                ) : (
                  <div className="pd-empty"><Package className="size-20" aria-hidden="true" /></div>
                )}
                {selectedImageUrl ? (
                  <>
                    <div ref={lensRef} className="pd-lens" aria-hidden="true" />
                    <button
                      type="button"
                      className="pd-zone"
                      aria-label="Agrandir la photo"
                      onPointerMove={(event) => { if (event.pointerType === "mouse") moveLens(event.clientX, event.clientY); }}
                      onPointerLeave={hideLens}
                      onClick={() => { hideLens(); setLightboxZoom(false); setLightbox(true); }}
                    />
                    <span className="pd-hint" aria-hidden="true">
                      <ZoomIn className="size-4" />
                      <span className="pd-hint-mouse">Survolez pour zoomer, cliquez pour agrandir</span>
                      <span className="pd-hint-touch">Touchez pour agrandir</span>
                    </span>
                  </>
                ) : null}
                {images.length > 1 ? (
                  <>
                    <span className="pd-count" aria-hidden="true">
                      {String(selectedImageIndex + 1).padStart(2, "0")} / {String(images.length).padStart(2, "0")}
                    </span>
                    <button type="button" className="pd-arrow is-prev" onClick={() => setSelectedImageIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1))} aria-label="Image précédente">
                      <ChevronLeft className="size-5" aria-hidden="true" />
                    </button>
                    <button type="button" className="pd-arrow is-next" onClick={() => setSelectedImageIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1))} aria-label="Image suivante">
                      <ChevronRight className="size-5" aria-hidden="true" />
                    </button>
                  </>
                ) : null}
              </div>
              {selectedImageUrl ? <div ref={paneRef} className="pd-pane" aria-hidden="true" style={{ backgroundImage: `url("${selectedImageUrl}")` }} /> : null}
            </div>
            {images.length > 1 ? (
              <ul className="pd-thumbs" aria-label="Photos du produit">
                {images.map((img, idx) => (
                  <li key={`${img}-${idx}`}>
                    <button type="button" className="pd-thumb" onClick={() => setSelectedImageIndex(idx)} aria-label={`Afficher l’image ${idx + 1}`} aria-pressed={idx === selectedImageIndex}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={getImageUrl(img)} alt="" loading="lazy" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="pd-info">
            {product.brand?.title ? <span className="pd-brand">{product.brand.title}</span> : null}
            <h1 className="pd-title">{product.title}</h1>

            <div className="pd-meta">
              {product.reference || displayedSku ? (
                <span className="pd-ref">{product.reference ? `Réf. ${product.reference}` : `SKU ${displayedSku}`}</span>
              ) : null}
              <span className={cn("pd-stock", inStock ? "is-in" : "is-out")}>
                <i aria-hidden="true" />
                {stockBadgeLabel}
                {stockBadgeLabel === "En stock" ? <small>expédié sous 48–72 h</small> : null}
              </span>
              {typeof ratingScore === "number" && reviewCount != null && reviewCount > 0 ? (
                <span className="pd-rating">
                  <Star className="size-4" aria-hidden="true" />
                  {ratingScore.toFixed(1)}
                  <small>({reviewCount} avis)</small>
                </span>
              ) : null}
            </div>

            {product.shortDescription?.trim() ? (
              <div className="pd-short" dangerouslySetInnerHTML={{ __html: product.shortDescription.trim() }} />
            ) : null}

            <div className="pd-price">
              {hasDiscount ? (
                <span className="pd-ribbon">Promo -{discountPercent}%</span>
              ) : (
                <span className="pd-ribbon is-plain">Prix</span>
              )}
              <div className="pd-price-row">
                <div>
                  <p className="pd-price-now">
                    <strong>{formatEuroNumber(displayedTtc)} {"\u20ac"}</strong>
                    <span>TTC</span>
                  </p>
                  <p className="pd-price-ht">
                    soit <strong>{formatEuroNumber(displayedHt)} {"\u20ac"} HT</strong>
                    {hasDiscount ? <span className="pd-price-old"> &nbsp; {formatEuroNumber(originalTtc)} {"\u20ac"} TTC</span> : null}
                  </p>
                </div>
                {hasDiscount ? (
                  <p className="pd-save">Vous économisez <strong>{formatEuroNumber(originalTtc - displayedTtc)} {"\u20ac"}</strong></p>
                ) : null}
              </div>
            </div>

            {hasCombinaisons && optionGroups.length > 0 ? (
              <div className="pd-opts">
                {optionGroups.map((group) => {
                  const value = chosenTermId(group);
                  return (
                    <fieldset key={group.attributeId} className="pd-opt">
                      <legend>{group.attributeName}</legend>
                      <div className="pd-chips">
                        {group.terms.map((term) => (
                          <button
                            key={term.termId}
                            type="button"
                            className="pd-chip"
                            aria-pressed={value === term.termId}
                            onClick={() => {
                              setSelectedOptionByAttributeId((prev) => ({ ...prev, [group.attributeId]: term.termId }));
                              setQuantity(1);
                            }}>
                            {term.termName}
                          </button>
                        ))}
                      </div>
                    </fieldset>
                  );
                })}
                {combinationMissing ? (
                  <p role="alert" className="pd-opt-missing">Cette combinaison n’est pas proposée. Choisissez d’autres options.</p>
                ) : null}
              </div>
            ) : null}

            <div className="pd-buy">
              <div>
                <p className="pd-label" id="pd-qty-label">Quantité</p>
                <div className="pd-qty" role="group" aria-labelledby="pd-qty-label">
                  <button type="button" onClick={() => setQuantity((q) => Math.max(1, q - 1))} disabled={effectiveQuantity <= 1} aria-label="Diminuer la quantité">
                    <Minus className="size-5" aria-hidden="true" />
                  </button>
                  <output aria-live="polite">{effectiveQuantity}</output>
                  <button
                    type="button"
                    onClick={() => {
                      setQuantity((q) => {
                        const next = Math.max(1, q) + 1;
                        if (maxPurchasableQty == null) return next;
                        return Math.min(next, Math.max(1, maxPurchasableQty));
                      });
                    }}
                    disabled={maxPurchasableQty != null && (maxPurchasableQty <= 0 || effectiveQuantity >= maxPurchasableQty)}
                    aria-label="Augmenter la quantité">
                    <Plus className="size-5" aria-hidden="true" />
                  </button>
                </div>
              </div>

              <div className="pd-actions">
                <button type="button" className={cn("pd-add", justAdded && "is-done")} disabled={unavailable} onClick={handleAdd}>
                  {justAdded ? <Check className="size-6" aria-hidden="true" /> : <ShoppingCart className="size-6" aria-hidden="true" />}
                  {justAdded ? "Ajouté au panier" : "Ajouter au panier"}
                </button>
                <button
                  type="button"
                  className="pd-now"
                  disabled={unavailable}
                  onClick={() => {
                    addToCart();
                    router.push("/checkout");
                  }}>
                  Acheter maintenant
                </button>
              </div>
            </div>

            <ul className="pd-trust">
              <li><span className="ico"><Truck className="size-6" aria-hidden="true" /></span><span>Livraison France &amp; Europe<b>48-72 h</b></span></li>
              <li><span className="ico"><ShieldCheck className="size-6" aria-hidden="true" /></span><span>Garantie &amp; SAV<b>Atelier agréé</b></span></li>
              <li><span className="ico"><CreditCard className="size-6" aria-hidden="true" /></span><span>Paiement sécurisé<b>Options au panier</b></span></li>
            </ul>
          </div>
        </section>

      </div>
      </div>

      <div className="pd-wrap">
        <section className="pd-below" id="product-reviews">
        <div>
        {/* Product information */}
        <section className="pd-card">
          <div className="pd-tabs" role="tablist" aria-label="Informations produit">
            {[
              { id: "description", label: "Description" },
              { id: "details", label: "Détail de produit" },
              ...(product.attachments ?? []).map((file, index) => ({ id: `attachment-${index}`, label: file.name })),
            ].map((item) => (
              <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} onClick={() => setTab(item.id)} className="pd-tab">
                {item.label}
              </button>
            ))}
          </div>

          <div className="px-5 py-6">
            {tab === "description" ? (
              product.description?.trim() ? (
                <div>
                    <RichTextDisplay
                      content={product.description}
                      className="pd-rich"
                    />
                </div>
              ) : (
                <p className="text-sm text-slate-500">Aucune description.</p>
              )
            ) : null}

            {tab === "details" ? (
              displayAttributes.length > 0 ? (
                <table className="pd-spec">
                  <tbody>
                    {displayAttributes.map((a, i) => (
                      <tr key={i}>
                        <th scope="row">{a.attribute?.name ?? "—"}</th>
                        <td>{a.term?.name ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-sm text-slate-500">
                  Aucun détail technique.
                </p>
              )
            ) : null}

            {tab.startsWith("attachment-") ? (() => {
              const index = Number(tab.slice("attachment-".length));
              const file = (product.attachments ?? [])[index];
              return file ? (
                <ProductAttachmentPanel
                  key={tab}
                  productId={product.id}
                  index={index}
                  file={file}
                  token={clientSession?.token}
                />
              ) : null;
            })() : null}

            {tab === "comments" ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-6 text-center">
                <h3 className="text-base font-semibold text-slate-900">
                  Avis clients
                </h3>
                <p className="mt-1 text-sm text-slate-600">Les avis des clients ayant acheté ce produit sont affichés dans la section Avis clients.</p>
                <button type="button" onClick={() => document.getElementById("product-reviews")?.scrollIntoView({ behavior: "smooth", block: "start" })} className="mt-3 text-sm font-semibold text-[#153675] underline-offset-4 hover:underline">Voir les avis et donner une note</button>
              </div>
            ) : null}
          </div>
        </section>
        </div>

        <aside className="pd-card">
          <div className="pd-head">
            <h2 className="pd-h2">Avis clients</h2>
            {productReviews?.total ? <span className="pd-rv-count">{productReviews.total} avis</span> : null}
          </div>
          {productReviews?.total ? (
            <div className="pd-rv-sum">
              <div className="pd-rv-score">
                <p><strong>{productReviews.avgRating.toLocaleString("fr-FR", { maximumFractionDigits: 1 })}</strong><span>/5</span></p>
                <div className="pd-rv-stars" aria-hidden="true">
                  {[1, 2, 3, 4, 5].map((star) => <Star key={star} className={cn("size-5", Math.round(productReviews.avgRating) >= star ? "is-on" : "is-off")} />)}
                </div>
              </div>
              <div className="pd-rv-bars">
                {[5, 4, 3, 2, 1].map((star) => {
                  const count = productReviews.distribution[star as 1 | 2 | 3 | 4 | 5] ?? 0;
                  const percentage = (count / productReviews.total) * 100;
                  return (
                    <div key={star} className="pd-rv-bar">
                      <span>{star}<Star className="size-3.5" aria-hidden="true" /></span>
                      <i><b style={{ width: `${percentage}%` }} /></i>
                      <em>{count}</em>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="pd-rv-empty">
              <span className="pd-rv-icon"><ChatDots className="size-9" aria-hidden="true" /></span>
              <h3>Pas encore d’avis</h3>
              <p>Les avis sont publiés par les clients qui ont acheté ce produit. Soyez le premier à partager votre expérience.</p>
              <div className="pd-rv-ghost" aria-hidden="true">
                {[1, 2, 3, 4, 5].map((star) => <Star key={star} className="size-6" />)}
              </div>
            </div>
          )}
          <div className={cn("pd-rv-list", !productReviews?.reviews.length && "hidden")}>
            {productReviews?.reviews.length ? productReviews.reviews.map((review) => (
              <article key={review.id} className="py-4">
                <div className="flex items-center gap-1 text-amber-400" aria-label={`${review.rating} sur 5`}>{[1, 2, 3, 4, 5].map((star) => <Star key={star} className={cn("size-4", review.rating >= star ? "fill-current" : "text-slate-200")} />)}</div>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{review.review}</p>
                <div className="mt-3 flex items-center justify-between text-xs text-slate-500"><span className="font-medium text-slate-700">{review.name}</span><time dateTime={review.createdAt}>{new Date(review.createdAt).toLocaleDateString("fr-FR")}</time></div>
              </article>
            )) : null}
          </div>
          <div className="pd-rv-foot">
            {reviewAccess === "loading" ? (
              <p className="flex items-center gap-2 text-sm text-slate-500"><LoaderCircle className="size-4 animate-spin" />Vérification de votre éligibilité…</p>
            ) : reviewAccess === "login" ? (
              <div className="pd-rv-note">
                <span className="pd-rv-note-icon"><LockKey className="size-6" aria-hidden="true" /></span>
                <div>
                  <p><b>Un avis ? Connectez-vous d’abord.</b> Vous pourrez le publier après votre achat.</p>
                  <Link href={`/login?returnTo=${encodeURIComponent(`${detailHref}#product-reviews`)}`} className="pd-rv-link">
                    Se connecter
                  </Link>
                </div>
              </div>
            ) : reviewAccess === "not-purchased" ? (
              <div className="pd-rv-note">
                <span className="pd-rv-note-icon"><SealCheck className="size-6" aria-hidden="true" /></span>
                <p><b>Avis réservés aux acheteurs.</b> Commandez ce produit pour pouvoir donner votre avis.</p>
              </div>
            ) : reviewAccess === "error" ? (
              <p role="alert" className="rounded-lg bg-amber-50 p-4 text-sm text-amber-800">Impossible de vérifier votre accès aux avis pour le moment. Veuillez réessayer plus tard.</p>
            ) : reviewAccess === "submitted" ? (
              <p role="status" className="rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800">{reviewMessage}</p>
            ) : (
              <form onSubmit={(event) => void handleReviewSubmit(event)} className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-900">Votre avis</h3>
                {reviewError ? <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">{reviewError}</p> : null}
                <div>
                  <span className="mb-1 block text-xs font-medium text-slate-600">Votre note</span>
                  <div className="flex items-center gap-1" role="radiogroup" aria-label="Votre note">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        role="radio"
                        aria-checked={reviewRating === star}
                        aria-label={`${star} sur 5`}
                        onClick={() => setReviewRating(star)}
                        className="rounded-sm p-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#153675]">
                        <Star className={cn("size-5", reviewRating >= star ? "fill-amber-400 text-amber-400" : "text-slate-300")} />
                      </button>
                    ))}
                  </div>
                </div>
                <label className="block text-xs font-medium text-slate-600" htmlFor="product-review-text">Votre commentaire</label>
                <textarea
                  id="product-review-text"
                  value={reviewText}
                  onChange={(event) => setReviewText(event.target.value)}
                  required
                  minLength={1}
                  maxLength={3000}
                  rows={4}
                  placeholder="Partagez votre expérience avec ce produit…"
                  className="w-full resize-y rounded-md border border-slate-300 bg-white p-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#2456b1] focus:ring-2 focus:ring-[#2456b1]/20"
                />
                <button
                  type="submit"
                  disabled={reviewSubmitting || !reviewText.trim()}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-[#153675] px-4 text-sm font-semibold text-white transition hover:bg-[#0a224f] disabled:cursor-not-allowed disabled:opacity-60">
                  {reviewSubmitting ? <><LoaderCircle className="size-4 animate-spin" />Envoi…</> : "Envoyer mon avis"}
                </button>
              </form>
            )}
          </div>
        </aside>
        </section>

        {recommendationSections.map((section) => (
          <Carousel key={section.id} opts={{ align: "start", slidesToScroll: "auto" }} className="mt-10" aria-label={section.title}>
            <section className="pd-card" aria-labelledby={`pd-reco-${section.id}`}>
              <div className="pd-head">
                <h2 id={`pd-reco-${section.id}`} className="pd-h2">{section.title}</h2>
                <RecommendationArrows title={section.title} />
              </div>
              <div className="p-4 sm:p-6">
                <CarouselContent>
                  {section.items.slice(0, 12).map((relatedProduct) => (
                    <CarouselItem key={relatedProduct.id} className="basis-1/2 sm:basis-1/3 lg:basis-1/5 xl:basis-1/6">
                      <div className="h-full">
                        <ProductCard product={relatedProduct} categorySlug={categorySlug} />
                      </div>
                    </CarouselItem>
                  ))}
                </CarouselContent>
              </div>
            </section>
          </Carousel>
        ))}
      </div>

      {lightbox && selectedImageUrl ? (
        <div className="pd-lb" role="dialog" aria-modal="true" aria-label={`Photos de ${product.title}`}>
          <div className="pd-lb-top">
            <p>{product.title}{images.length > 1 ? <span> · {selectedImageIndex + 1} / {images.length}</span> : null}</p>
            <button ref={closeRef} type="button" onClick={() => setLightbox(false)} aria-label="Fermer">
              <Close className="size-6" aria-hidden="true" />
            </button>
          </div>
          <div className={cn("pd-lb-view", lightboxZoom && "is-zoomed")} onClick={(event) => { if (event.target === event.currentTarget) setLightbox(false); }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={selectedImageUrl} alt={product.title} onClick={() => setLightboxZoom((value) => !value)} />
          </div>
          {images.length > 1 ? (
            <>
              <button type="button" className="pd-lb-arrow is-prev" onClick={() => setSelectedImageIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1))} aria-label="Image précédente">
                <ChevronLeft className="size-6" aria-hidden="true" />
              </button>
              <button type="button" className="pd-lb-arrow is-next" onClick={() => setSelectedImageIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1))} aria-label="Image suivante">
                <ChevronRight className="size-6" aria-hidden="true" />
              </button>
              <ul className="pd-lb-thumbs">
                {images.map((img, idx) => (
                  <li key={`${img}-lb-${idx}`}>
                    <button type="button" aria-pressed={idx === selectedImageIndex} aria-label={`Afficher l’image ${idx + 1}`} onClick={() => setSelectedImageIndex(idx)}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={getImageUrl(img)} alt="" />
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          <p className="pd-lb-hint">{lightboxZoom ? "Cliquez sur la photo pour réduire" : "Cliquez sur la photo pour zoomer"}</p>
        </div>
      ) : null}

      <div className="pd-bar">
        <div className="pd-bar-price">
          <strong>{formatEuroNumber(displayedTtc)} {"\u20ac"}</strong>
          <small>TTC</small>
        </div>
        <button type="button" className="pd-add" disabled={unavailable} onClick={handleAdd}>
          <ShoppingCart className="size-5" aria-hidden="true" />
          Ajouter au panier
        </button>
      </div>
    </main>
  );
}


function ProductAttachmentPanel({
  productId,
  index,
  file,
  token,
}: {
  productId: string;
  index: number;
  file: { name: string; url?: string; isPublic?: boolean };
  token?: string | null;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const restricted = file.isPublic === false;

  if (!restricted && file.url) {
    return (
      <div className="space-y-3">
        <iframe
          src={file.url}
          title={file.name}
          className="h-[600px] w-full rounded-lg border border-slate-200"
        />
        <a
          href={file.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-sm font-semibold text-[#153675] underline-offset-4 hover:underline">
          Télécharger le PDF
        </a>
      </div>
    );
  }

  const download = async () => {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      const { url } = await getAttachmentAccess(productId, index, token);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (accessError) {
      setError(accessError instanceof Error ? accessError.message : "Téléchargement impossible.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-6 text-center">
      <h3 className="text-base font-semibold text-slate-900">{file.name}</h3>
      <p className="mt-1 text-sm text-slate-600">
        Ce document est réservé aux clients ayant acheté ce produit, une fois la commande livrée.
      </p>
      {token ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void download()}
          className="mt-3 cursor-pointer rounded-md bg-[#153675] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
          {busy ? "Vérification…" : "Télécharger le PDF"}
        </button>
      ) : (
        <p className="mt-3 text-sm font-medium text-slate-700">
          Connectez-vous à votre compte pour accéder à ce document.
        </p>
      )}
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
