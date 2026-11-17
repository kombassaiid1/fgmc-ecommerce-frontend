import { apiRequest } from "./http-client";

export type ShippingOption = {
  carrierId: string;
  name: string;
  transitTime: string | null;
  speedGrade: number;
  logoUrl: string | null;
  isPickup: boolean;
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
