import type { Metadata } from "next";

import { CheckoutClient } from "./checkout-client";
import { StripeReturn } from "./stripe-return";

export const metadata: Metadata = {
  title: "Commande",
  robots: { index: false, follow: false },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const paidOrderId = first(params.stripe_order);
  const sessionId = first(params.session_id);
  const cancelledOrderId = first(params.stripe_cancelled);

  if (paidOrderId && sessionId) {
    return <StripeReturn kind="paid" orderId={paidOrderId} sessionId={sessionId} />;
  }
  if (cancelledOrderId) {
    return <StripeReturn kind="cancelled" orderId={cancelledOrderId} />;
  }
  return <CheckoutClient />;
}
