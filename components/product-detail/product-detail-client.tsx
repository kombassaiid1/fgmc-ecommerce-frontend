"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Minus,
  Package,
  Plus,
  ShoppingCart,
  Star,
  X,
} from "lucide-react";

import type { ProductDetailsResponse } from "@/lib/product-details-api";
import { getImageUrl } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useCartStore } from "@/lib/stores/cart-store";
import { RichTextDisplay } from "@/components/ui/rich-text-display";
import { toast } from "sonner";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

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
  const addItem = useCartStore((s) => s.addItem);
  const [tab, setTab] = useState<"description" | "details" | "comments">(
    "description",
  );

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

  const displayedHt = hasCombinaisons
    ? parsePrice(selectedCombinaison?.price ?? product.price)
    : parsePrice(product.price);
  const vat = rateToFraction(product.taxRelation?.rate);
  const displayedTtc = displayedHt * (1 + vat);

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

  const reviewCount = product?.["reviewCount" as never] as unknown as
    | number
    | undefined;
  const ratingScore = product?.["reviewRating" as never] as unknown as
    | number
    | undefined;

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
            {/* Left: Image gallery */}
            <div className="">
              <div className="relative rounded-xl">
                <div className="flex flex-col items-center gap-5 lg:flex-row lg:items-stretch lg:justify-center lg:gap-4">
                  {images.length > 1 ? (
                    <div className="order-2 flex items-center justify-center lg:order-1">
                      {/* Mobile: horizontal carousel */}
                      <div className="w-full max-w-[340px] lg:hidden">
                        <Carousel opts={{ align: "center", dragFree: true }}>
                          <CarouselContent>
                            {images.map((img, idx) => {
                              const url = getImageUrl(img);
                              const active = idx === selectedImageIndex;
                              return (
                                <CarouselItem
                                  key={`${img}-${idx}`}
                                  className="basis-auto">
                                  <button
                                    type="button"
                                    onClick={() => setSelectedImageIndex(idx)}
                                    className={cn(
                                      "h-16 w-16 shrink-0 overflow-hidden rounded-lg border bg-white",
                                      active
                                        ? "border-slate-800 ring-2 ring-slate-900/10"
                                        : "border-slate-200 hover:border-slate-400",
                                    )}
                                    aria-pressed={active}>
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={url}
                                      alt=""
                                      className="h-full w-full object-contain"
                                      loading="lazy"
                                    />
                                  </button>
                                </CarouselItem>
                              );
                            })}
                          </CarouselContent>
                          <CarouselPrevious className="-left-10" />
                          <CarouselNext className="-right-10" />
                        </Carousel>
                      </div>

                      {/* Desktop: vertical carousel */}
                      <div className="hidden lg:block">
                        <Carousel
                          orientation="vertical"
                          opts={{ align: "start", dragFree: true }}
                          className="w-[76px]">
                          <CarouselContent className="max-h-[292px]">
                            {images.map((img, idx) => {
                              const url = getImageUrl(img);
                              const active = idx === selectedImageIndex;
                              return (
                                <CarouselItem
                                  key={`${img}-${idx}`}
                                  className="basis-auto">
                                  <button
                                    type="button"
                                    onClick={() => setSelectedImageIndex(idx)}
                                    className={cn(
                                      "h-16 w-16 shrink-0 overflow-hidden rounded-lg border bg-white",
                                      active
                                        ? "border-slate-800 ring-2 ring-slate-900/10"
                                        : "border-slate-200 hover:border-slate-400",
                                    )}
                                    aria-pressed={active}>
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={url}
                                      alt=""
                                      className="h-full w-full object-contain"
                                      loading="lazy"
                                    />
                                  </button>
                                </CarouselItem>
                              );
                            })}
                          </CarouselContent>
                          <CarouselPrevious className="-top-10" />
                          <CarouselNext className="-bottom-10" />
                        </Carousel>
                      </div>
                    </div>
                  ) : null}

                  <div className="order-1 relative mx-auto aspect-4/3 w-full overflow-hidden lg:order-2">
                    {selectedImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={selectedImageUrl}
                        alt={product.title}
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-slate-400">
                        <Package className="size-20" />
                      </div>
                    )}

                    {images.length > 1 ? (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedImageIndex((prev) =>
                              prev === 0 ? images.length - 1 : prev - 1,
                            )
                          }
                          className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 shadow ring-1 ring-slate-200 hover:bg-white"
                          aria-label="Previous image">
                          <ChevronLeft className="size-6 text-slate-600" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedImageIndex((prev) =>
                              prev === images.length - 1 ? 0 : prev + 1,
                            )
                          }
                          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 shadow ring-1 ring-slate-200 hover:bg-white"
                          aria-label="Next image">
                          <ChevronRight className="size-6 text-slate-600" />
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Info & actions */}
            <div className="p-6 lg:p-10 rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="mx-auto max-w-xl text-center">
                {typeof ratingScore === "number" &&
                typeof reviewCount === "number" &&
                reviewCount > 0 ? (
                  <div className="mx-auto mb-5 inline-flex items-center gap-1 rounded-full bg-slate-50 px-4 py-2 shadow-sm ring-1 ring-slate-200">
                    <div className="flex items-center gap-0.5 text-amber-400">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          className={cn(
                            "size-5",
                            ratingScore >= s ? "fill-current" : "",
                          )}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}

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
                    className="mx-auto mt-3 max-w-prose text-sm text-slate-600"
                    dangerouslySetInnerHTML={{
                      __html: product.shortDescription.trim(),
                    }}
                  />
                ) : null}

                {hasCombinaisons && optionGroups.length > 0 ? (
                  <div className="mt-6 grid gap-3 sm:grid-cols-3">
                    {optionGroups.slice(0, 3).map((group) => {
                      const value =
                        selectedOptionByAttributeId[group.attributeId] ??
                        group.terms[0]?.termId ??
                        "";
                      return (
                        <div key={group.attributeId} className="text-left">
                          <label className="mb-1 block text-xs font-semibold text-slate-700">
                            {group.attributeName}
                          </label>
                          <select
                            className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
                            value={value}
                            onChange={(e) =>
                              (setSelectedOptionByAttributeId((prev) => ({
                                ...prev,
                                [group.attributeId]: e.target.value,
                              })),
                              setQuantity(1))
                            }>
                            {group.terms.map((t) => (
                              <option key={t.termId} value={t.termId}>
                                {t.termName}
                              </option>
                            ))}
                          </select>
                        </div>
                      );
                    })}
                  </div>
                ) : null}

                <div className="mt-8">
                  <div className="text-3xl font-semibold text-rose-600">
                    {displayedTtc.toLocaleString("fr-FR", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{" "}
                    €
                    <span className="text-base font-medium text-slate-500">
                      {" "}
                      TTC
                    </span>
                  </div>
                  <div className="mt-1 text-lg text-slate-500">
                    {displayedHt.toLocaleString("fr-FR", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{" "}
                    € HT
                  </div>
                </div>

                <div className="mt-4 inline-flex items-center gap-2 rounded-md bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200">
                  {stockBadgeLabel === "En stock" ? (
                    <Check className="size-5 text-emerald-600" />
                  ) : stockBadgeLabel === "Rupture de stock" ? (
                    <X className="size-5 text-rose-600" />
                  ) : (
                    <Package className="size-5 text-slate-500" />
                  )}
                  {stockBadgeLabel}
                </div>

                <div className="mt-7 flex items-center justify-center gap-4">
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
                          price: String(
                            hasCombinaisons
                              ? selectedCombinaison?.price ?? product.price
                              : product.price,
                          ),
                        },
                        effectiveQuantity,
                      );
                      toast.success("Ajouté au panier", {
                        description: `${effectiveQuantity} × ${product.title}`,
                      });
                    }}
                    className={cn(
                      "inline-flex h-11 items-center gap-2 rounded-md bg-slate-900 px-5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60",
                    )}>
                    <ShoppingCart className="size-5" />
                    Ajouter au panier
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <hr className="my-12 border-slate-200" />

        {/* Tabs (same style as requested) */}
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
            <button
              type="button"
              onClick={() => setTab("comments")}
              className={cn(
                "rounded-t-xl border border-transparent px-4 py-2 text-sm font-semibold transition",
                tab === "comments"
                  ? "border-slate-200 bg-white text-slate-900"
                  : "text-slate-500 hover:text-slate-900",
              )}>
              Commentaires
            </button>
          </div>

          <div className="px-5 py-6">
            {tab === "description" ? (
              product.description?.trim() ? (
                <RichTextDisplay
                  content={product.description}
                  className="text-slate-600"
                />
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
                <p className="mt-1 text-sm text-slate-600">
                  Cette section sera bientôt disponible.
                </p>
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
