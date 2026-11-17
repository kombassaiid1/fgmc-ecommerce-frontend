import { apiRequest } from "./http-client";

export type StripePublicConfig = {
  enabled: boolean;
  mode: "sandbox" | "live";
  publishableKey: string | null;
};

export function getStripePublicConfig() {
  return apiRequest<StripePublicConfig>({
    path: "/integrations/stripe/public-config",
    method: "GET",
  });
}

/** Starts a Stripe Checkout session for an order saved with paymentMethod "En_ligne". */
export function createStripeCheckoutSession(orderId: string) {
  return apiRequest<{ url: string; mode: "sandbox" | "live" }>({
    path: "/integrations/stripe/checkout-session",
    method: "POST",
    body: JSON.stringify({ orderId, returnOrigin: window.location.origin }),
  });
}

export function confirmStripePayment(orderId: string, sessionId: string) {
  return apiRequest<{ orderId: string; paid: boolean; mode: "sandbox" | "live" }>({
    path: "/integrations/stripe/confirm",
    method: "POST",
    body: JSON.stringify({ orderId, sessionId }),
  });
}
