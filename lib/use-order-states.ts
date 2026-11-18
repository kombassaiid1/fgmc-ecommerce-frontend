"use client";

import { useEffect, useMemo, useState } from "react";
import { orderStatesApi, type OrderStateRow } from "@/lib/api/order-states";

let cached: Promise<OrderStateRow[]> | null = null;
let cachedAt = 0;

/** The statuses, shared between screens and refreshed every minute. */
function loadStates(): Promise<OrderStateRow[]> {
  if (!cached || Date.now() - cachedAt > 60_000) {
    cachedAt = Date.now();
    cached = orderStatesApi.list().catch((error: unknown) => {
      cached = null;
      throw error;
    });
  }
  return cached;
}

export type StatusOption = { label: string; value: string; backgroundColor: string; textColor: string };
export type StatusColors = Record<string, { backgroundColor: string; textColor: string }>;

/**
 * The order statuses for selectors and colored labels. Values are the status names, which is what the orders API takes
 * and returns. Empty until loaded (or when the list cannot be read).
 */
export function useOrderStates() {
  const [states, setStates] = useState<OrderStateRow[]>([]);
  useEffect(() => {
    let cancelled = false;
    loadStates()
      .then((rows) => {
        if (!cancelled) setStates(rows);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  return useMemo(() => {
    const options: StatusOption[] = states.map((state) => ({ label: state.name, value: state.name, backgroundColor: state.color, textColor: state.textColor }));
    const colors: StatusColors = Object.fromEntries(states.map((state) => [state.name, { backgroundColor: state.color, textColor: state.textColor }]));
    return { states, options, colors };
  }, [states]);
}
