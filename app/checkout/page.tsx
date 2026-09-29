import type { Metadata } from "next";

import { CheckoutClient } from "./checkout-client";

export const metadata: Metadata = {
  title: "Checkout | FGMC",
};

export default function CheckoutPage() {
  return <CheckoutClient />;
}
