"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  CreditCard,
  LoaderCircle,
  Minus,
  Package,
  Plus,
  ShieldCheck,
  ShoppingCart,
  Star,
  Truck,
} from "lucide-react";

import { canClientReviewProduct, fetchProductReviews, submitProductReview, type ProductDetailsResponse, type ProductReviewsResponse } from "@/lib/product-details-api";
import { getImageUrl } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useCartStore } from "@/lib/stores/cart-store";
import { resolveSpecificPrice } from "@/lib/specific-pricing";
import { RichTextDisplay } from "@/components/ui/rich-text-display";
import { ProductCard, type ProductCardProduct } from "@/components/product-card";
import { getProductById, getProducts } from "@/lib/api/products";
import { toast } from "sonner";
import { getClientSession, subscribeToClientSession, type ClientSession } from "@/lib/client-auth";

function parsePrice(value: string | null | undefined): number {
  const n = parseFloat(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
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

export function ProductDetailClient({ categorySlug, product }: Props) {
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const router = useRouter();
  const [productReviews, setProductReviews] = useState<ProductReviewsResponse | null>(null);
  const [clientSession, setClientSession] = useState<ClientSession | null>(null);
  const [reviewAccess, setReviewAccess] = useState<"loading" | "login" | "not-purchased" | "eligible" | "submitted" | "error">("loading");
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewMessage, setReviewMessage] = useState<string | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [recommendationTab, setRecommendationTab] = useState<"similar" | "spareParts">("similar");
  const [similarProducts, setSimilarProducts] = useState<ProductCardProduct[]>([]);
  const [spareParts, setSpareParts] = useState<ProductCardProduct[]>([]);
  const addItem = useCartStore((s) => s.addItem);
  const [tab, setTab] = useState<"description" | "details" | "comments">(
    "description",
  );
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);

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
    return () => { active = false; };
  }, [categorySlug, product.categories, product.id, product.sparePartIds]);

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

  const selectedCombinaison = useMemo(() => {
    if (!hasCombinaisons) return null;
    const key = optionKey(
      optionGroups
        .map((g) => ({
          attributeId: g.attributeId,
          termId: selectedOptionByAttributeId[g.attributeId],
        }))
        .filter((x) => x.termId),
    );
    return comboByKey.get(key) ?? defaultCombinaison;
  }, [
    comboByKey,
    defaultCombinaison,
    hasCombinaisons,
    optionGroups,
    selectedOptionByAttributeId,
  ]);

  const originalHt = hasCombinaisons
    ? parsePrice(selectedCombinaison?.price ?? product.price)
    : parsePrice(product.price);
  const vat = rateToFraction(product.taxRelation?.rate);
  const originalTtc = originalHt * (1 + vat);
  const displayedTtc = resolveSpecificPrice(product.specificPrices, originalHt, vat, quantity).saleTtc;
  const hasDiscount = displayedTtc < originalTtc;
  const displayedHt = displayedTtc / (1 + vat);
  const discountPercent = originalTtc > 0
    ? Math.min(100, Math.max(1, Math.round(((originalTtc - displayedTtc) / originalTtc) * 100)))
    : 0;

  const displayedStockStatus = hasCombinaisons
    ? (selectedCombinaison?.stockStatus ?? product.stockStatus)
    : product.stockStatus;

  const displayedSku = hasCombinaisons
    ? (selectedCombinaison?.sku ?? product.sku)
    : product.sku;

  const maxPurchasableQty = useMemo(() => {
    const raw = hasCombinaisons ? selectedCombinaison?.qty : product.qty;
    const n = parseQty(raw);
    if (n == null) return null;
    return Math.max(0, n);
  }, [hasCombinaisons, product.qty, selectedCombinaison?.qty]);

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

  return (
    <main className="min-h-screen! bg-muted/30">
      <div className="container mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
        <nav aria-label="Breadcrumb" className="mb-5">
          <ol className="flex flex-wrap items-center gap-1.5 text-sm text-slate-500">
            <li>
              <Link href="/" className="hover:text-slate-900">
                Accueil
              </Link>
            </li>
            <li aria-hidden className="px-1">
              /
            </li>
            <li>
              <Link href={`/${categorySlug}`} className="hover:text-slate-900">
                {categorySlug}
              </Link>
            </li>
            <li aria-hidden className="px-1">
              /
            </li>
            <li className="font-medium text-slate-900">{product.title}</li>
          </ol>
        </nav>

        <section>
          <div className="grid gap-5 lg:grid-cols-2">
            {/* Product image gallery */}
            <div className="lg:sticky lg:top-24 lg:self-start">
              <div className="relative mx-auto w-full overflow-hidden rounded-2xl border border-slate-200 bg-[#f8fafc] shadow-sm lg:max-w-[680px]">
                <div className="relative aspect-square w-full">
                  {selectedImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={selectedImageUrl} alt={product.title} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-slate-400"><Package className="size-20" /></div>
                  )}

                  {images.length > 1 ? (
                    <>
                      <div className="absolute inset-x-4 top-4 z-10 flex gap-1.5" aria-hidden="true">
                        {images.slice(0, 6).map((image, index) => (
                          <span key={`${image}-indicator-${index}`} className={cn("h-1 flex-1 rounded-full", index === selectedImageIndex ? "bg-[#153675]" : "bg-slate-300/80")} />
                        ))}
                      </div>
                      <button type="button" onClick={() => setSelectedImageIndex((prev) => prev === 0 ? images.length - 1 : prev - 1)} className="absolute left-3 top-1/2 z-10 grid size-10 -translate-y-1/2 place-items-center rounded-full border border-white/70 bg-white/90 text-slate-700 shadow-md transition hover:bg-white" aria-label="Image précédente">
                        <ChevronLeft className="size-5" />
                      </button>
                      <button type="button" onClick={() => setSelectedImageIndex((prev) => prev === images.length - 1 ? 0 : prev + 1)} className="absolute right-3 top-1/2 z-10 grid size-10 -translate-y-1/2 place-items-center rounded-full border border-white/70 bg-white/90 text-slate-700 shadow-md transition hover:bg-white" aria-label="Image suivante">
                        <ChevronRight className="size-5" />
                      </button>
                      <span className="absolute right-4 top-4 rounded-full bg-slate-900/65 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">
                        {String(selectedImageIndex + 1).padStart(2, "0")} / {String(images.length).padStart(2, "0")}
                      </span>
                      <div className="absolute inset-x-3 bottom-3 z-10 flex justify-center">
                        <div className="max-w-full overflow-x-auto rounded-2xl border border-white/70 bg-white/90 p-2 shadow-lg backdrop-blur-md">
                          <div className="flex gap-2">
                            {images.map((img, idx) => {
                              const active = idx === selectedImageIndex;
                              return (
                                <button key={`${img}-${idx}`} type="button" onClick={() => setSelectedImageIndex(idx)} className={cn("size-16 shrink-0 overflow-hidden rounded-xl border-2 bg-white transition sm:size-[76px]", active ? "border-[#2456b1] ring-2 ring-[#2456b1]/20" : "border-transparent opacity-75 hover:border-slate-300 hover:opacity-100")} aria-label={`Afficher l’image ${idx + 1}`} aria-pressed={active}>
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={getImageUrl(img)} alt="" className="h-full w-full object-cover" loading="lazy" />
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </>
                  ) : null}
                </div>
              </div>
            </div>
            {/* Right: Info & actions */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:p-10">
              <div className="mx-auto max-w-xl text-left">
                {product.brand?.title ? <p className="mb-1 text-xs font-bold uppercase tracking-[0.16em] text-[#2456b1]">{product.brand.title}</p> : null}
                <h1 className="text-2xl! font-semibold! tracking-tight! text-slate-900! sm:text-3xl!">
                  {product.title}
                </h1>
                {product.reference || displayedSku ? (
                  <div className="mt-2 text-xs font-medium text-slate-500">
                    {product.reference
                      ? `Réf. ${product.reference}`
                      : `SKU: ${displayedSku}`}
                  </div>
                ) : null}
                {product.shortDescription?.trim() ? (
                  <div
                    className="mt-3 max-w-prose text-sm text-slate-600"
                    dangerouslySetInnerHTML={{
                      __html: product.shortDescription.trim(),
                    }}
                  />
                ) : null}

                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                  {typeof ratingScore === "number" && reviewCount != null && reviewCount > 0 ? (
                    <span className="inline-flex items-center gap-1.5 text-slate-700">
                      <Star className="size-4 fill-amber-400 text-amber-400" />
                      <span className="font-semibold">{ratingScore.toFixed(1)}</span>
                      <span className="text-slate-500">({reviewCount} avis)</span>
                    </span>
                  ) : null}
                  <span className={cn("inline-flex items-center gap-2", stockBadgeLabel === "Rupture de stock" ? "text-rose-700" : "text-emerald-700")}>
                    <span className={cn("size-2 rounded-full", stockBadgeLabel === "Rupture de stock" ? "bg-rose-500" : "bg-emerald-500")} />
                    <span className="font-medium">{stockBadgeLabel}</span>
                    {stockBadgeLabel === "En stock" ? <span className="text-slate-500">— expédié sous 48–72 h</span> : null}
                  </span>
                </div>

                <div className="mt-5 rounded-xl border border-[#dce5f2] bg-[#f7f9fd] p-4 text-left sm:p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e1e8f2] pb-3">
                    {hasDiscount ? (
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-[#d6202e] px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-white">
                        Promo <span>-{discountPercent}%</span>
                      </span>
                    ) : (
                      <span className="text-xs font-bold uppercase tracking-wide text-[#536784]">Prix du produit</span>
                    )}
                    {hasDiscount ? (
                      <span className="text-sm text-slate-500 line-through">
                        {originalTtc.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {"\u20ac"} TTC
                      </span>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-end justify-between gap-3 pt-3">
                    <div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold tracking-tight text-[#d6202e] sm:text-4xl">
                          {displayedTtc.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {"\u20ac"}
                        </span>
                        <span className="text-sm font-semibold text-[#536784]">TTC</span>
                      </div>
                      <p className="mt-1 text-sm text-[#536784]">
                        soit <strong className="font-semibold text-[#142c5b]">{displayedHt.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {"\u20ac"} HT</strong>
                      </p>
                    </div>
                    {hasDiscount ? (
                      <p className="rounded-lg bg-white px-3 py-2 text-xs font-medium text-[#153675] ring-1 ring-[#e1e8f2]">
                        Vous &eacute;conomisez <strong>{(originalTtc - displayedTtc).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {"\u20ac"} TTC</strong>
                      </p>
                    ) : null}
                  </div>
                </div>
                {hasCombinaisons && optionGroups.length > 0 ? (
                  <div className="mt-5 space-y-4">
                    {optionGroups.map((group) => {
                      const value = selectedOptionByAttributeId[group.attributeId] ?? group.terms[0]?.termId ?? "";
                      return (
                        <fieldset key={group.attributeId}>
                          <legend className="mb-2 text-sm font-medium text-slate-800">{group.attributeName}</legend>
                          <div className="flex flex-wrap gap-2">
                            {group.terms.map((term) => {
                              const active = value === term.termId;
                              return (
                                <button key={term.termId} type="button" aria-pressed={active}
                                  className={cn("min-h-10 rounded-full border px-4 text-sm transition", active ? "border-[#153675] bg-[#153675] text-white" : "border-slate-200 bg-white text-slate-700 hover:border-[#2456b1]")}
                                  onClick={() => {
                                    setSelectedOptionByAttributeId((prev) => ({ ...prev, [group.attributeId]: term.termId }));
                                    setQuantity(1);
                                  }}>
                                  {term.termName}
                                </button>
                              );
                            })}
                          </div>
                        </fieldset>
                      );
                    })}
                  </div>
                ) : null}

                <div className="mt-5">
                  <p className="mb-2 text-sm font-medium text-slate-800">Quantité</p>
                  <div className="flex items-center justify-start gap-3">
                  <div className="flex items-center rounded-md border border-slate-200 bg-white shadow-sm">
                    <button
                      type="button"
                      className="grid h-11 w-11 place-items-center text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      disabled={effectiveQuantity <= 1}
                      aria-label="Decrease quantity">
                      <Minus className="size-5" />
                    </button>
                    <div className="grid h-11 w-12 place-items-center text-sm font-semibold text-slate-900">
                      {effectiveQuantity}
                    </div>
                    <button
                      type="button"
                      className="grid h-11 w-11 place-items-center text-slate-600 hover:bg-slate-50"
                      onClick={() => {
                        setQuantity((q) => {
                          const next = Math.max(1, q) + 1;
                          if (maxPurchasableQty == null) return next;
                          return Math.min(next, Math.max(1, maxPurchasableQty));
                        });
                      }}
                      disabled={
                        maxPurchasableQty != null &&
                        (maxPurchasableQty <= 0 ||
                          effectiveQuantity >= maxPurchasableQty)
                      }
                      aria-label="Increase quantity">
                      <Plus className="size-5" />
                    </button>
                  </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    disabled={maxPurchasableQty != null && maxPurchasableQty <= 0}
                    onClick={() => {
                      addItem(
                        {
                          productId: product.id,
                          productSlug: product.slug,
                          title: product.title,
                          image: product.images?.[0] ?? null,
                          categorySlug: categorySlug ?? null,
                          variantId: selectedCombinaison?.id ?? null,
                          price: String(displayedHt),
                          taxRate: product.taxRelation?.rate ?? null,
                        },
                        effectiveQuantity,
                      );
                      toast.success("Ajouté au panier", {
                        description: `${effectiveQuantity} × ${product.title}`,
                      });
                    }}
                    className="inline-flex h-12 min-w-[180px] flex-1 items-center justify-center gap-2 rounded-full bg-[#153675] px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#2456b1] disabled:cursor-not-allowed disabled:opacity-60 sm:flex-none">
                    <ShoppingCart className="size-5" />
                    Ajouter au panier
                  </button>
                  <button
                    type="button"
                    disabled={maxPurchasableQty != null && maxPurchasableQty <= 0}
                    onClick={() => {
                      addItem(
                        {
                          productId: product.id,
                          productSlug: product.slug,
                          title: product.title,
                          image: product.images?.[0] ?? null,
                          categorySlug: categorySlug ?? null,
                          variantId: selectedCombinaison?.id ?? null,
                          price: String(displayedHt),
                          taxRate: product.taxRelation?.rate ?? null,
                        },
                        effectiveQuantity,
                      );
                      router.push("/checkout");
                    }}
                    className="inline-flex h-11 min-w-[160px] flex-1 items-center justify-center rounded-full border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-800 transition hover:border-[#153675] hover:text-[#153675] disabled:cursor-not-allowed disabled:opacity-60 sm:flex-none">
                    Acheter maintenant
                  </button>
                  </div>
                </div>
                <div className="mt-6 grid gap-3 border-t border-slate-200 pt-5 text-xs text-slate-600 sm:grid-cols-3">
                  <div className="flex items-start gap-2"><Truck className="mt-0.5 size-4 shrink-0 text-[#2456b1]" /><span>Livraison France &amp; Europe<br /><strong className="font-semibold text-slate-800">48-72 h</strong></span></div>
                  <div className="flex items-start gap-2"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-[#2456b1]" /><span>Garantie &amp; SAV<br /><strong className="font-semibold text-slate-800">Atelier agr&eacute;&eacute;</strong></span></div>
                  <div className="flex items-start gap-2"><CreditCard className="mt-0.5 size-4 shrink-0 text-[#2456b1]" /><span>Paiement s&eacute;curis&eacute;<br /><strong className="font-semibold text-slate-800">Options au panier</strong></span></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <hr className="my-12 border-slate-200" />

        <section className="grid items-start gap-6 lg:grid-cols-[1.15fr_0.85fr]" id="product-reviews">
        <div>
        {/* Product information */}
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-2 pt-2">
            <button
              type="button"
              onClick={() => setTab("description")}
              className={cn(
                "rounded-t-xl border border-transparent px-4 py-2 text-sm font-semibold transition",
                tab === "description"
                  ? "border-slate-200 bg-white text-slate-900"
                  : "text-slate-500 hover:text-slate-900",
              )}>
              Description
            </button>
            <button
              type="button"
              onClick={() => setTab("details")}
              className={cn(
                "rounded-t-xl border border-transparent px-4 py-2 text-sm font-semibold transition",
                tab === "details"
                  ? "border-slate-200 bg-white text-slate-900"
                  : "text-slate-500 hover:text-slate-900",
              )}>
              Détail de produit
            </button>
          </div>

          <div className="px-5 py-6">
            {tab === "description" ? (
              product.description?.trim() ? (
                <>
                  <div className={cn("overflow-hidden transition-[max-height] duration-300", !descriptionExpanded && "max-h-40")}>
                    <RichTextDisplay
                      content={product.description}
                      className="text-slate-600"
                    />
                  </div>
                  {product.description.replace(/<[^>]*>/g, " ").trim().length > 500 ? (
                    <button
                      type="button"
                      onClick={() => setDescriptionExpanded((expanded) => !expanded)}
                      aria-expanded={descriptionExpanded}
                      className="mt-3 text-sm font-semibold text-[#153675] underline-offset-4 hover:underline">
                      {descriptionExpanded ? "Voir moins" : "Voir plus"}
                    </button>
                  ) : null}
                </>
              ) : (
                <p className="text-sm text-slate-500">Aucune description.</p>
              )
            ) : null}

            {tab === "details" ? (
              displayAttributes.length > 0 ? (
                <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                  <table className="w-full text-sm text-left">
                    <tbody className="divide-y divide-slate-100">
                      {displayAttributes.map((a, i) => (
                        <tr
                          key={i}
                          className={cn(i % 2 === 0 && "bg-slate-50")}>
                          <th className="py-3 px-4 font-medium text-slate-900 w-1/3">
                            {a.attribute?.name ?? "—"}
                          </th>
                          <td className="py-3 px-4 text-slate-600">
                            {a.term?.name ?? "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-slate-500">
                  Aucun détail technique.
                </p>
              )
            ) : null}

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

        <aside className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <h2 className="border-b border-slate-200 px-5 py-4 text-base font-semibold text-slate-900">Avis clients</h2>
          <div className="grid grid-cols-[auto_1fr] gap-5 p-5">
            <div className="min-w-24 text-center">
              <div className="text-5xl font-semibold tracking-tight text-slate-900">{productReviews?.total ? productReviews.avgRating.toLocaleString("fr-FR", { maximumFractionDigits: 1 }) : "—"}<span className="text-lg font-normal text-slate-400">/5</span></div>
              <p className="mt-1 text-xs text-slate-500">({productReviews?.total ?? 0} avis)</p>
            </div>
            <div className="space-y-2 pt-1">
              {[5, 4, 3, 2, 1].map((star) => {
                const count = productReviews?.distribution[star as 1 | 2 | 3 | 4 | 5] ?? 0;
                const percentage = productReviews?.total ? (count / productReviews.total) * 100 : 0;
                return <div key={star} className="flex items-center gap-2 text-xs"><span className="flex w-7 items-center gap-1 text-slate-600">{star}<Star className="size-3 fill-amber-400 text-amber-400" /></span><span className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100"><span className="block h-full rounded-full bg-amber-400" style={{ width: `${percentage}%` }} /></span><span className="w-5 text-right text-slate-500">{count}</span></div>;
              })}
            </div>
          </div>
          <div className="max-h-[460px] divide-y divide-slate-200 overflow-y-auto px-5">
            {productReviews?.reviews.length ? productReviews.reviews.map((review) => (
              <article key={review.id} className="py-4">
                <div className="flex items-center gap-1 text-amber-400" aria-label={`${review.rating} sur 5`}>{[1, 2, 3, 4, 5].map((star) => <Star key={star} className={cn("size-4", review.rating >= star ? "fill-current" : "text-slate-200")} />)}</div>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{review.review}</p>
                <div className="mt-3 flex items-center justify-between text-xs text-slate-500"><span className="font-medium text-slate-700">{review.name}</span><time dateTime={review.createdAt}>{new Date(review.createdAt).toLocaleDateString("fr-FR")}</time></div>
              </article>
            )) : <p className="py-5 text-sm text-slate-500">Aucun avis client pour le moment.</p>}
          </div>
          <div className="border-t border-slate-200 p-5">
            {reviewAccess === "loading" ? (
              <p className="flex items-center gap-2 text-sm text-slate-500"><LoaderCircle className="size-4 animate-spin" />Vérification de votre éligibilité…</p>
            ) : reviewAccess === "login" ? (
              <div className="rounded-lg bg-slate-50 p-4">
                <p className="text-sm font-medium text-slate-800">Connectez-vous pour laisser un avis après votre achat.</p>
                <Link
                  href={`/login?returnTo=${encodeURIComponent(`/${categorySlug}/${product.slug}.html#product-reviews`)}`}
                  className="mt-3 inline-flex min-h-10 items-center justify-center rounded-md bg-[#153675] px-4 text-sm font-semibold text-white hover:bg-[#0a224f]">
                  Se connecter
                </Link>
              </div>
            ) : reviewAccess === "not-purchased" ? (
              <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">L’avis est réservé aux clients ayant acheté ce produit.</p>
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

        <section className="mt-10 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
            <h2 className="text-lg font-semibold text-slate-900">À découvrir aussi</h2>
            <div className="flex rounded-full bg-slate-100 p-1" role="tablist" aria-label="Produits associés">
              <button type="button" role="tab" aria-selected={recommendationTab === "similar"}
                onClick={() => setRecommendationTab("similar")}
                className={cn("rounded-full px-4 py-2 text-sm font-medium transition", recommendationTab === "similar" ? "bg-white text-[#153675] shadow-sm" : "text-slate-600 hover:text-slate-900")}>
                Produits similaires
              </button>
              <button type="button" role="tab" aria-selected={recommendationTab === "spareParts"}
                onClick={() => setRecommendationTab("spareParts")}
                className={cn("rounded-full px-4 py-2 text-sm font-medium transition", recommendationTab === "spareParts" ? "bg-white text-[#153675] shadow-sm" : "text-slate-600 hover:text-slate-900")}>
                Pièces de rechange
              </button>
            </div>
          </div>
          <div className="p-4 sm:p-6">
            {(recommendationTab === "similar" ? similarProducts : spareParts).length ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
                {(recommendationTab === "similar" ? similarProducts : spareParts).slice(0, 6).map((relatedProduct) => (
                  <ProductCard key={relatedProduct.id} product={relatedProduct} categorySlug={categorySlug} />
                ))}
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-slate-500">
                {recommendationTab === "similar" ? "Aucun autre produit disponible dans cette catégorie." : "Aucune pièce de rechange associée à ce produit."}
              </p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
