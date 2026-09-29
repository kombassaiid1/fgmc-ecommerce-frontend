export type StorefrontSpecificPrice = {
  id?: string;
  currency?: string;
  country?: string;
  group?: string;
  customer?: string;
  fromDate?: string;
  toDate?: string;
  fromQuantity?: number;
  leaveInitialPrice?: boolean;
  fixedPrice?: string;
  discount?: string;
  discountType?: "amount" | "percent" | string;
  taxIncluded?: boolean;
};

export function resolveSpecificPrice(
  rules: StorefrontSpecificPrice[] | null | undefined,
  priceHt: number,
  taxRate: number,
  quantity = 1,
  now = new Date(),
) {
  const fraction = taxRate > 1 ? taxRate / 100 : taxRate;
  const originalTtc = priceHt * (1 + fraction);
  const active = (Array.isArray(rules) ? rules : []).filter((rule) => {
    const from = rule.fromDate ? new Date(`${rule.fromDate}T00:00:00`) : null;
    const to = rule.toDate ? new Date(`${rule.toDate}T23:59:59.999`) : null;
    const currency = (rule.currency ?? "all").toUpperCase();
    return (currency === "ALL" || currency === "EUR") &&
      ((rule.country ?? "all").toUpperCase() === "ALL" || (rule.country ?? "").toUpperCase() === "TN") &&
      (rule.group ?? "all").toLowerCase() === "all" &&
      (rule.customer ?? "all").toLowerCase() === "all" &&
      Math.max(1, Number(rule.fromQuantity) || 1) <= quantity &&
      (!from || now >= from) && (!to || now <= to);
  }).sort((a, b) => (Number(b.fromQuantity) || 1) - (Number(a.fromQuantity) || 1));

  const rule = active[0];
  if (!rule || originalTtc <= 0) return { originalTtc, saleTtc: originalTtc, rule: null as StorefrontSpecificPrice | null };

  let saleTtc = originalTtc;
  if (!rule.leaveInitialPrice && Number(rule.fixedPrice) > 0) {
    saleTtc = Number(rule.fixedPrice) * (1 + fraction);
  }
  const amount = Math.max(0, Number(rule.discount) || 0);
  if (amount > 0) {
    const isPercent = rule.discountType === "percent";
    if (isPercent) saleTtc *= Math.max(0, 1 - amount / 100);
    else saleTtc = Math.max(0, saleTtc - amount * (rule.taxIncluded === false ? (1 + fraction) : 1));
  }
  saleTtc = Math.max(0, Math.min(originalTtc, saleTtc));
  return { originalTtc, saleTtc, rule };
}
