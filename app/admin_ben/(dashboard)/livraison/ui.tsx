"use client";

export function formatMoney(value: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value);
}

/** "1,5" and "1.5" both mean one and a half. Returns NaN for anything else. */
export function parseNumber(value: string) {
  const text = value.trim().replace(",", ".");
  return text === "" ? NaN : Number(text);
}
