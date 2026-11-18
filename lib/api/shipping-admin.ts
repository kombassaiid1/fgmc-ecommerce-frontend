/** Admin-side shipping setup: zones, carriers, preferences, product weights. */

export type Billing = "WEIGHT" | "PRICE";
export type OutOfRange = "HIGHEST" | "DISABLE";

export type Zone = { id: string; name: string; active: boolean; countryCodes: string[]; stateCount: number; createdAt: string };
/** A zone is a name and an active flag. Countries are attached from the country side (setCountryZone). */
export type ZoneInput = { name: string; active: boolean };

/** A state, region or département, optionally assigned to a zone. */
export type GeoState = {
  id: string;
  name: string;
  isoCode: string;
  countryCode: string;
  zoneId: string;
  zoneName: string | null;
  active: boolean;
};
export type GeoStateInput = Omit<GeoState, "id" | "zoneName">;
export type GeoStatePage = { data: GeoState[]; meta: { total: number; page: number; limit: number; totalPages: number } };

export type CarrierRange = { from: number; to: number; rates: Array<{ zoneId: string; price: number }> };
export type Carrier = {
  id: string;
  name: string;
  transitTime: string;
  speedGrade: number;
  logoUrl: string;
  trackingUrl: string;
  active: boolean;
  position: number;
  isPickup: boolean;
  freeShipping: boolean;
  billing: Billing;
  addHandling: boolean;
  outOfRange: OutOfRange;
  minWeightKg: number;
  maxWeightKg: number;
  /** Id of the tax applied to the shipping price, empty for none. */
  taxId: string;
  /** The GLS delivery this carrier stands for (HOME, RELAY, FLEX, EXPRESS), empty when it is not a GLS carrier. */
  glsType: string;
  /** Id of the PrestaShop carrier it was imported from, empty when it was created here. */
  prestashopId: string;
  ranges: CarrierRange[];
};
export type CarrierInput = Omit<Carrier, "id" | "position" | "prestashopId">;

/** Shipping settings of one product (the Livraison tab of the product page). */
export type ProductShippingInput = {
  widthCm: number;
  heightCm: number;
  depthCm: number;
  weightKg: number;
  deliveryMode: "NONE" | "DEFAULT" | "CUSTOM";
  deliveryInStock: string;
  deliveryOutOfStock: string;
  extraFee: number;
  /** Empty means every carrier is available. */
  carrierIds: string[];
};

export type Preferences = {
  handlingFee: number;
  freeAbovePrice: number;
  freeAboveWeightKg: number;
  defaultCarrier: string;
  sortBy: "PRICE" | "POSITION";
  orderWay: "ASC" | "DESC";
  defaultItemWeightKg: number;
};

export type ProductWeightRow = { productId: string; title: string; slug: string; image: string | null; weightKg: number | null };
export type ProductWeightPage = { data: ProductWeightRow[]; meta: { total: number; page: number; limit: number; totalPages: number } };

const BASE = "/frontend-api/admin/shipping";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    cache: "no-store",
    ...init,
    headers: { ...(init?.body ? { "Content-Type": "application/json" } : {}), ...init?.headers },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = Array.isArray(data.message) ? data.message.join(" ") : data.message;
    throw new Error(message || "Action impossible.");
  }
  return data as T;
}

const json = (value: unknown) => JSON.stringify(value);

export const shippingAdmin = {
  zones: () => request<Zone[]>("/zones"),
  createZone: (input: ZoneInput) => request<Zone>("/zones", { method: "POST", body: json(input) }),
  updateZone: (id: string, input: ZoneInput) => request<Zone>(`/zones/${id}`, { method: "PUT", body: json(input) }),
  deleteZone: (id: string) => request<{ deleted: boolean }>(`/zones/${id}`, { method: "DELETE" }),
  /** Puts one country in a zone, or takes it out of every zone (zoneId null). */
  setCountryZone: (countryCode: string, zoneId: string | null) => request<{ countryCode: string; zoneId: string | null }>(`/country-zones/${countryCode}`, { method: "PUT", body: json({ zoneId }) }),

  states: (filters: { search: string; countryCode: string; zoneId: string; active: string; sort: string; dir: string; page: number }) =>
    request<GeoStatePage>(`/states?search=${encodeURIComponent(filters.search)}&countryCode=${encodeURIComponent(filters.countryCode)}&zoneId=${encodeURIComponent(filters.zoneId)}&active=${encodeURIComponent(filters.active)}&sort=${encodeURIComponent(filters.sort)}&dir=${encodeURIComponent(filters.dir)}&page=${filters.page}`),
  createState: (input: GeoStateInput) => request<GeoState>("/states", { method: "POST", body: json(input) }),
  updateState: (id: string, input: GeoStateInput) => request<GeoState>(`/states/${id}`, { method: "PUT", body: json(input) }),
  setStateActive: (id: string, active: boolean) => request<GeoState>(`/states/${id}/active`, { method: "PATCH", body: json({ active }) }),
  deleteState: (id: string) => request<{ deleted: boolean }>(`/states/${id}`, { method: "DELETE" }),

  carriers: () => request<Carrier[]>("/carriers"),
  carrier: (id: string) => request<Carrier>(`/carriers/${id}`),
  createCarrier: (input: CarrierInput) => request<Carrier>("/carriers", { method: "POST", body: json(input) }),
  updateCarrier: (id: string, input: CarrierInput) => request<Carrier>(`/carriers/${id}`, { method: "PUT", body: json(input) }),
  setCarrierGlsType: (id: string, glsType: string) => request<Carrier>(`/carriers/${id}/gls-type`, { method: "PATCH", body: json({ glsType }) }),
  setCarrierActive: (id: string, active: boolean) => request<Carrier>(`/carriers/${id}/active`, { method: "PATCH", body: json({ active }) }),
  deleteCarrier: (id: string) => request<{ deleted: boolean }>(`/carriers/${id}`, { method: "DELETE" }),
  reorderCarriers: (ids: string[]) => request<Carrier[]>("/carriers/positions", { method: "PATCH", body: json({ ids }) }),

  preferences: () => request<Preferences>("/preferences"),
  savePreferences: (input: Preferences) => request<Preferences>("/preferences", { method: "PUT", body: json(input) }),

  productWeights: (search: string, page: number) => request<ProductWeightPage>(`/product-weights?search=${encodeURIComponent(search)}&page=${page}`),
  setProductWeight: (productId: string, weightKg: number) => request<{ productId: string; weightKg: number }>(`/product-weights/${productId}`, { method: "PUT", body: json({ weightKg }) }),
  productShipping: (productId: string) => request<ProductShippingInput>(`/product-shipping/${productId}`),
  saveProductShipping: (productId: string, input: ProductShippingInput) => request<ProductShippingInput>(`/product-shipping/${productId}`, { method: "PUT", body: json(input) }),
  clearProductWeight: (productId: string) => request<{ productId: string; weightKg: null }>(`/product-weights/${productId}`, { method: "DELETE" }),
};

/** Country list for zone editing: ISO code and French name. */
export const EMPTY_CARRIER: CarrierInput = {
  name: "",
  transitTime: "",
  speedGrade: 5,
  logoUrl: "",
  trackingUrl: "",
  active: true,
  isPickup: false,
  freeShipping: false,
  billing: "WEIGHT",
  addHandling: true,
  outOfRange: "HIGHEST",
  minWeightKg: 0,
  maxWeightKg: 0,
  taxId: "",
  glsType: "",
  ranges: [],
};
