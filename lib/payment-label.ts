/** How an order was paid, as shown in the admin: the label stored on the order, or a fallback from its payment method. */
export const PAYMENT_LABELS = {
  card: "Paiement par carte bancaire",
  cash: "Paiement à la livraison",
  bank: "Virement bancaire",
} as const;

export function paymentLabel(order: { paymentType?: string | null; paymentMethod?: string | null }): string {
  const type = order.paymentType?.trim();
  // Orders paid before the label existed carry the name of the processor.
  if (type && type.toLowerCase() !== "stripe") return type;
  if (type || order.paymentMethod === "En_ligne") return PAYMENT_LABELS.card;
  if (order.paymentMethod === "COD") return PAYMENT_LABELS.cash;
  return "—";
}
