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
  /** The Colissimo delivery this carrier stands for (HOME, HOME_SIGN, RELAY), or null. */
  colissimoType: string | null;
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

export type ColissimoRelay = GlsRelay & {
  /** BPR, A2P, BDP, CMT, PCS… as sent by Colissimo. */
  pointType: string;
};

/** Colissimo pickup points near an address, for a "Point de retrait" carrier. */
export async function searchColissimoRelays(input: { zip: string; city?: string; street?: string; country: string; device?: "desktop" | "mobile" }) {
  const query = new URLSearchParams({ zip: input.zip, country: input.country, device: input.device ?? "desktop" });
  if (input.city) query.set("city", input.city);
  if (input.street) query.set("street", input.street);
  const result = await apiRequest<{ relays: ColissimoRelay[] }>({ path: `/colissimo/relays?${query.toString()}`, method: "GET" });
  return result.relays;
}

/** GLS pick-up points near an address, for a relay-delivery carrier. */
export async function searchGlsRelays(input: { zip: string; city?: string; street?: string; country: string }) {
  const query = new URLSearchParams({ zip: input.zip, country: input.country });
  if (input.city) query.set("city", input.city);
  if (input.street) query.set("street", input.street);
  const result = await apiRequest<{ relays: GlsRelay[] }>({ path: `/gls/relays?${query.toString()}`, method: "GET" });
  return result.relays;
}

export type ColissimoWidgetConfig = {
  available: boolean;
  native: boolean;
  remote: boolean;
  token: string | null;
  preparationTime: number;
  relayFilter: string;
  osmRelayFilter: string;
  color1: string;
  color2: string;
  font: string;
  modal: boolean;
  points: number;
  phoneOptional: boolean;
  mobile: { displayMap: boolean; superposed: boolean; first: string } | null;
  doorCodes: boolean;
};

/** What the checkout needs to show the Colissimo pickup point widget (settings and token). */
export async function getColissimoWidgetConfig(device: "desktop" | "mobile") {
  return apiRequest<ColissimoWidgetConfig>({ path: `/colissimo/widget-config?device=${device}`, method: "GET" });
}

export type ColissimoDeliveryEstimate = { message: string; deliveryDate: string; color: string; font: string } | null;

/** The estimated delivery date for a postcode, or null when the option is off. */
export async function getColissimoDeliveryDate(zip: string, country: string) {
  const query = new URLSearchParams({ zip, country });
  const result = await apiRequest<{ estimate: ColissimoDeliveryEstimate }>({ path: `/colissimo/delivery-date?${query.toString()}`, method: "GET" });
  return result.estimate;
}
