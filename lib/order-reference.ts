/** The formats an order reference can have (Paramètres de la boutique, Commandes). The server builds the real ones; this shows the preview. */
export type ReferenceType = "RANDOM" | "PREFIX_YEAR_MONTH_SEQ" | "PREFIX_YEAR_SEQ" | "PREFIX_SEQ";
export type ReferenceReset = "NEVER" | "YEARLY" | "MONTHLY";

export type OrderSettings = {
  type: ReferenceType;
  prefix: string;
  digits: number;
  reset: ReferenceReset;
  /** The running number the next order will get; null for the random format. */
  nextNumber: number | null;
  example: string;
};

const two = (value: number) => String(value).padStart(2, "0");

/** The reference a running number gives, as the server builds it: C + 26 + 11 + 1249 is C26111249. */
export function previewReference(type: ReferenceType, prefix: string, digits: number, sequence: number, date = new Date()): string {
  const number = String(Math.max(0, sequence)).padStart(digits, "0");
  const year = two(date.getFullYear() % 100);
  switch (type) {
    case "PREFIX_YEAR_MONTH_SEQ": return `${prefix}${year}${two(date.getMonth() + 1)}${number}`;
    case "PREFIX_YEAR_SEQ": return `${prefix}${year}${number}`;
    case "PREFIX_SEQ": return `${prefix}${number}`;
    default: return "XKBKNABJK";
  }
}
