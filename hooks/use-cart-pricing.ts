"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { quoteCart, type CartQuote, type CartQuoteIssue } from "@/lib/api/orders";
import { useCartStore, type CartItem } from "@/lib/stores/cart-store";

export type CartPricingStatus = "idle" | "loading" | "ready" | "error";

type Result = { signature: string; status: "ready" | "error"; quote: CartQuote | null; error: string | null };

/**
 * Has the server price the cart.
 *
 * Prices in the browser are only what the shop showed when a product was added: they can be old (a promotion
 * ended, a price changed) and nothing stops a visitor from editing them. Whenever the cart's content changes
 * (a product, a variant or a quantity), this asks the server for the real prices and stock, and puts the
 * answer in the cart, so every page shows the amounts the order will really be charged.
 *
 * `blocking` is true while the prices are being checked, when they could not be checked, and while a line
 * cannot be bought (gone, hidden, out of stock, or less in stock than asked).
 */
export function useCartPricing() {
  const itemsByKey = useCartStore((state) => state.items);
  const applyServerPrices = useCartStore((state) => state.applyServerPrices);
  const [result, setResult] = useState<Result | null>(null);
  const [attempt, setAttempt] = useState(0);

  // What the server needs to know: product, variant, quantity. A price change must not trigger a new check.
  const signature = useMemo(
    () =>
      Object.values(itemsByKey)
        .map((item) => `${item.productId}:${item.variantId ?? ""}:${item.qty}`)
        .sort()
        .join("|"),
    [itemsByKey],
  );

  useEffect(() => {
    if (!signature) return;
    const lines = signature.split("|").map((part) => {
      const [id, variantId, quantity] = part.split(":");
      return { id, variantId: variantId || null, quantity: Number(quantity) };
    });
    const controller = new AbortController();
    // A short pause: someone tapping + several times asks once.
    const timer = window.setTimeout(() => {
      quoteCart(lines, { signal: controller.signal })
        .then((quote) => {
          applyServerPrices(quote.lines);
          setResult({ signature, status: "ready", quote, error: null });
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          setResult({ signature, status: "error", quote: null, error: error instanceof Error ? error.message : "Impossible de vérifier les prix." });
        });
    }, 300);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [signature, attempt, applyServerPrices]);

  const current = result && result.signature === signature ? result : null;
  const status: CartPricingStatus = !signature ? "idle" : (current?.status ?? "loading");
  const issues: CartQuoteIssue[] = useMemo(() => (status === "ready" ? (current?.quote?.issues ?? []) : []), [status, current]);

  const issueFor = useCallback(
    (item: Pick<CartItem, "productId" | "variantId">) =>
      issues.find((issue) => issue.id === item.productId && (issue.variantId ?? null) === (item.variantId ?? null)),
    [issues],
  );

  return {
    status,
    /** The server's quote for the cart as it is now (null while it is being checked). */
    quote: status === "ready" ? (current?.quote ?? null) : null,
    error: status === "error" ? (current?.error ?? null) : null,
    issues,
    issueFor,
    /** True while the order must not be placed. */
    blocking: status === "loading" || status === "error" || issues.length > 0,
    /** Checks again (after a failure, or when the server said the prices moved). */
    refresh: () => setAttempt((value) => value + 1),
  };
}
