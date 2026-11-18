const BASE = "/frontend-api/admin/gls-integration";

/** One call to the GLS admin endpoints; throws the server's message on an error. */
export async function glsCall<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE}${path}`, { cache: "no-store", ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(Array.isArray(data.message) ? data.message.join(" ") : data.message || "Action impossible.");
  return data as T;
}

/** Extra price for hard-to-reach areas, in euros. */
export type GlsSupplements = {
  /** Charge the supplement even when the delivery itself is free. */
  applyIfFree: boolean;
  mountain: number;
  corsica: number;
  frIsland: number;
  gbIsland: number;
  spPtIsland: number;
  islands: number;
};

export type GlsSettings = {
  relayTypes: Array<"SHOP" | "LOCKER" | "KEEPER">;
  relayXlOnly: boolean;
  supplements: GlsSupplements;
  /** Order state set for each GLS tracking state; empty leaves the order alone. */
  trackingStates: { inTransit: string; inWarehouse: string; inDelivery: string; delivered: string };
  /** Secret in the address a cron job calls. */
  trackingKey: string;
  /** WinExpé export and import options. */
  exchange: { prefixEnabled: boolean; prefix: string; useReference: boolean; stateAfterExport: string; stateAfterImport: string };
  /** Where returned parcels go; when enabled an order can get a return label. */
  returnService: { enabled: boolean; name: string; name2: string; street: string; zip: string; city: string; country: string };
  /** Offer a printable delivery note on each order. */
  deliveryNote: boolean;
  alternativeShipper: { enabled: boolean; name: string; name2: string; street: string; zip: string; city: string; country: string; email: string; contact: string; phone: string; mobile: string };
};

export type GlsLogLine = { id: string; createdAt: string; level: "info" | "error"; action: string; message: string; orderId: string | null };

export const GLS_TYPE_LABELS: Record<string, string> = {
  "": "Pas un transporteur GLS",
  HOME: "GLS Chez vous (à domicile ou en entreprise)",
  RELAY: "GLS Relais (point relais au choix du client)",
  FLEX: "GLS Chez vous + (avec SMS et choix du jour)",
  EXPRESS: "GLS Avant 13h (express)",
};
