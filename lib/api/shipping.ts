import { apiRequest } from "./http-client";

export type ShippingOption = {
  carrierId: string;
  name: string;
  transitTime: string | null;
  speedGrade: number;
  logoUrl: string | null;
  isPickup: boolean;
  /** The GLS delivery this carrier stands for (HOME, RELAY, FLEX, EXPRESS), or null. */
  glsType: string | null;
  /** Delivery price, handling excluded. */
  price: number;
  handlingFee: number;
  /** What the customer pays for delivery. */
  total: number;
  free: boolean;
};

export type ShippingQuote = {
  /** False until at least one carrier exists: checkout then keeps its flat rate. */
  configured: boolean;
  /** False when the destination country belongs to no active zone. */
  countryServed: boolean;
  countryCode: string;
  zoneName: string | null;
  weightKg: number;
  options: ShippingOption[];
  defaultCarrierId: string | null;
  freeShippingRemaining: number | null;
};

export type ShippingQuoteInput = {
  countryCode: string;
  /** Delivery postcode, used for GLS island and mountain supplements. */
  postcode?: string;
  subtotal: number;
  items: Array<{ productId: string; quantity: number }>;
};

export function getShippingQuote(input: ShippingQuoteInput) {
  return apiRequest<ShippingQuote>({
    path: "/shipping/quote",
    method: "POST",
    body: JSON.stringify(input),
  });
}

export type GlsRelay = {
  id: string;
  name: string;
  street: string;
  zip: string;
  city: string;
  country: string;
  lat: number | null;
  lng: number | null;
  /** Straight-line distance in kilometres. */
  distance: number | null;
  phone: string;
  /** Day 0 is Monday, times as HH:mm. */
  hours: Array<{ day: number; from: string; to: string }>;
};

/** GLS pick-up points near an address, for a relay-delivery carrier. */
export async function searchGlsRelays(input: { zip: string; city?: string; street?: string; country: string }) {
  const query = new URLSearchParams({ zip: input.zip, country: input.country });
  if (input.city) query.set("city", input.city);
  if (input.street) query.set("street", input.street);
  const result = await apiRequest<{ relays: GlsRelay[] }>({ path: `/gls/relays?${query.toString()}`, method: "GET" });
  return result.relays;
}
