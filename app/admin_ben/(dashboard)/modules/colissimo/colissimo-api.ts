const BASE = "/frontend-api/admin/colissimo-integration";

/** One call to the Colissimo admin endpoints; throws the server's message on an error. */
export async function colissimoCall<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE}${path}`, { cache: "no-store", ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(Array.isArray(data.message) ? data.message.join(" ") : data.message || "Action impossible.");
  return data as T;
}

export const patch = <T,>(path: string, body: unknown) => colissimoCall<T>(path, { method: "PATCH", body: JSON.stringify(body) });

/** A postal address as the original module keeps it (sender and return). */
export type Address = { company: string; lastname: string; firstname: string; address1: string; address2: string; address3: string; address4: string; city: string; zipcode: string; country: string; phone: string; email: string };

export type DeliveryDateOptions = {
  cutoff_hours: Record<string, string>;
  preparation_days: Record<string, number>;
  exceptions: Array<{ date: string; cutoff: string; preparation: number }>;
  regate_code: string;
  text: string;
  text_color: string;
  text_police: string;
};

export type ColissimoAccount = {
  authMode: "LOGIN" | "KEY";
  contractNumber: string;
  parentAccount: string;
  passwordSet: boolean;
  apiKeySet: boolean;
  configured: boolean;
  updatedAt: string | null;
};
/** Kept for the pages that only need the account state. */
export type ColissimoConfig = ColissimoAccount;

export type ModuleConfig = {
  moduleVersion: string;
  /** Every COLISSIMO_* value of the original module. */
  values: Record<string, unknown>;
  structured: {
    accountType: Record<string, 1>;
    sender: Address;
    returnAddress: Address;
    deliveryDate: DeliveryDateOptions;
    generateLabelStatuses: string[];
    postalPartnerSelected: string[];
  };
  account: ColissimoAccount;
  orderStates: string[];
  documents: { count: number; bytes: number };
  lists: { widgetFonts: string[]; labelFormats: string[]; cn23Formats: string[]; usbProtocols: string[]; postalPartnerCountries: string[] };
  qzCertificate: boolean;
};

export type ColissimoSettings = {
  labelFormat: string;
  displayReference: boolean;
  filterRelay: boolean;
  returnLabel: boolean;
  trackingStates: { inTransit: string; atPickup: string; delivered: string };
  trackingKey: string;
};

export type ColissimoLogLine = { id: string; createdAt: string; level: "info" | "error"; action: string; message: string; orderId: string | null };

export type ColissimoShipment = {
  id: string;
  orderId: string;
  productCode: string;
  colissimoType: string | null;
  pickupPointId: string | null;
  trackIds: string[];
  hasCustomsDocument: boolean;
  weightKg: number;
  parcelCount: number;
  lastStatus: string | null;
  lastEventAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  orderReference?: string | null;
};

export const COLISSIMO_TRACKING_URL = "https://www.laposte.fr/outils/suivre-vos-envois?code=@";

export const COUNTRY_NAMES: Record<string, string> = {
  FR: "France", BE: "Belgique", DE: "Allemagne", ES: "Espagne", IT: "Italie", NL: "Pays-Bas", LU: "Luxembourg", AT: "Autriche", FI: "Finlande",
  EE: "Estonie", DK: "Danemark", PL: "Pologne", PT: "Portugal", CH: "Suisse", GB: "Royaume-Uni", IE: "Irlande", MC: "Monaco", AD: "Andorre",
  GP: "Guadeloupe", MQ: "Martinique", GF: "Guyane", RE: "La Réunion", YT: "Mayotte", PM: "Saint-Pierre-et-Miquelon", NC: "Nouvelle-Calédonie", PF: "Polynésie française",
};

export type OrderRow = {
  id: string;
  reference: string | null;
  customer: string;
  etat: string;
  etatLabel: string;
  createdAt: string;
  type: "HOME" | "HOME_SIGN" | "RELAY";
  service: string;
  country: string;
  hasLabel: boolean;
  shipmentId: string | null;
  trackId: string | null;
};

export type OrdersPage = { total: number; page: number; limit: number; services: string[]; countries: string[]; rows: OrderRow[] };

export type OrderFilters = { scope: "colissimo" | "all"; reference: string; id: string; customer: string; state: string; from: string; to: string; service: string; country: string };
export const EMPTY_FILTERS: OrderFilters = { scope: "colissimo", reference: "", id: "", customer: "", state: "", from: "", to: "", service: "", country: "" };

export type PostageRow = {
  id: string;
  reference: string | null;
  consignee: { name: string; firstName?: string; company?: string; street: string; zip: string; city: string; countryCode: string };
  service: string;
  type: "HOME" | "HOME_SIGN" | "RELAY";
  country: string;
  secureCodeAvailable: boolean;
  returnLabelAvailable: boolean;
  returnLabelDefault: boolean;
  insured: boolean;
  ddpAvailable: boolean;
  nonMachinableAvailable: boolean;
  postalPartnerAvailable: boolean;
  postalPartner: number;
  weightKg: number;
  tareKg: number | null;
  cn23Needed: boolean;
  cn23Copies: number;
  products: Array<{ title: string; quantity: number; unitPrice: number }>;
};

export type PostageOptions = {
  weightKg?: number;
  returnLabel?: boolean;
  insured?: boolean;
  ddp?: boolean;
  nonMachinable?: boolean;
  secureCode?: boolean;
  postalPartner?: number;
  cn23Copies?: number;
  articlesDescription?: string;
};

export type LabelResult = { orderId: string; reference: string | null; ok: boolean; shipmentId?: string; trackId?: string; returnShipmentId?: string; error?: string };

export const LABEL_URL = (shipmentId: string) => `/frontend-api/admin/colissimo-integration/shipments/${shipmentId}/label`;

export function filtersQuery(filters: OrderFilters, page: number, sort: string, dir: string) {
  const query = new URLSearchParams({ page: String(page), sort, dir });
  for (const [key, value] of Object.entries(filters)) if (value) query.set(key, value);
  return query.toString();
}
