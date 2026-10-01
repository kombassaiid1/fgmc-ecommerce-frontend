export const ORDER_STATUS_OPTIONS = [
  { label: "Tous les statuts", value: "" },
  { label: "En cours", value: "En cours" },
  { label: "Confirmées", value: "Confirmées" },
  { label: "Expédiées", value: "Expédiées" },
  { label: "Annulées", value: "Annulées" },
  { label: "Retour", value: "Retour" },
  { label: "Annulé", value: "Annulé" },
  { label: "Autorisation acceptée par Braintree", value: "Autorisation acceptée par Braintree" },
  { label: "Autorisation acceptée par PayPal", value: "Autorisation acceptée par PayPal" },
  { label: "Autorisation a capturer par le marchand", value: "Autorisation. A capturer par le marchand" },
  { label: "Commande et préparée en attente de retrait magasin", value: "commande et préparée en attente de retrait magasin" },
  { label: "Contrôlé Dolibarr FGMC", value: "Contrôlé Dolibarr FGMC" },
  { label: "Delivered to your chosen pickup point (PO or relay)", value: "Delivered to your chosen pickup point (PO or relay)" },
  { label: "Demande de financement en cours", value: "Demande de financement en cours" },
  { label: "En attente d'autorisation", value: "En attente d'autorisation" },
  { label: "En attente de capture", value: "En attente de capture" },
  { label: "En attente de confirmation par PayPal", value: "En attente de confirmation par PayPal" },
  { label: "En attente de paiement", value: "En attente de paiement" },
  { label: "En attente de paiement à la livraison", value: "En attente de paiement à la livraison" },
  { label: "En attente de paiement Braintree", value: "En attente de paiement Braintree" },
  { label: "En attente de paiement par Carte de Crédit", value: "En attente de paiement par Carte de Crédit" },
  { label: "En attente de paiement par chèque", value: "En attente de paiement par chèque" },
  { label: "En attente de paiement par moyen local", value: "En attente de paiement par moyen de paiement local" },
  { label: "En attente de paiement par PayPal", value: "En attente de paiement par PayPal" },
  { label: "En attente de paiement PayPal", value: "En attente de paiement PayPal" },
  { label: "En attente de paiement PayPal.", value: "En attente de paiement PayPal." },
  { label: "En attente de réapprovisionnement (non payé)", value: "En attente de réapprovisionnement (non payé)" },
  { label: "En attente de réapprovisionnement (payé)", value: "En attente de réapprovisionnement (payé)" },
  { label: "En cours de préparation", value: "En cours de préparation" },
  { label: "En cours d'expédition", value: "En cours d'expédition" },
  { label: "Erreur de paiement", value: "Erreur de paiement" },
  { label: "Expédié", value: "Expédié" },
  { label: "Livré", value: "Livré" },
  { label: "Paiement à distance accepté", value: "Paiement à distance accepté" },
  { label: "Paiement en plusieurs fois (3x) (4 x)", value: "Paiement en plusieurs fois (3x) (4 x)" },
  { label: "Paiement VAD accepté", value: "Paiement VAD accepté" },
  { label: "Probleme avec colis", value: "Probleme avec colis" },
  { label: "Produit en Reliquat", value: "Produit en Reliquat" },
  { label: "Remboursé", value: "Remboursé" },
  { label: "Remboursement partiel", value: "Remboursement partiel" },
  { label: "Remis au transporteur", value: "Remis au transporteur" },
  { label: "Tout Livre au expédié", value: "Tout Livre au expédié" },
] as const;

export type OrderStatusColors = Record<string, { backgroundColor: string; textColor: string }>;

export const DEFAULT_ORDER_STATUS_COLORS: OrderStatusColors = Object.fromEntries(
  ORDER_STATUS_OPTIONS.filter(({ value }) => value).map(({ value }) => {
    const normalized = value.toLocaleLowerCase("fr");
    if (normalized.includes("confirm") || normalized.includes("exp") || normalized.includes("livr") || normalized.includes("accept")) {
      return [value, { backgroundColor: "#dcfce7", textColor: "#166534" }];
    }
    if (normalized.includes("annul") || normalized.includes("erreur") || normalized.includes("probleme") || normalized.includes("rembours")) {
      return [value, { backgroundColor: "#fee2e2", textColor: "#991b1b" }];
    }
    if (normalized.includes("attente") || normalized.includes("cours")) {
      return [value, { backgroundColor: "#fef3c7", textColor: "#854d0e" }];
    }
    return [value, { backgroundColor: "#e0f2fe", textColor: "#075985" }];
  }),
);

export function mergeOrderStatusColors(saved?: OrderStatusColors | null): OrderStatusColors {
  return Object.fromEntries(Object.entries(DEFAULT_ORDER_STATUS_COLORS).map(([status, defaults]) => [
    status,
    { ...defaults, ...(saved?.[status] ?? {}) },
  ]));
}
