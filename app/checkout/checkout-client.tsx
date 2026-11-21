"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { KeyboardEvent } from "react";
import countries from "world-countries";
import { ChevronRight,
  AlertCircle,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  CreditCard,
  DoorOpen,
  Fingerprint,
  Hash,
  Home,
  Landmark,
  LockKeyhole,
  Loader2,
  Mail,
  MapPin,
  PackageCheck,
  Pencil,
  Phone,
  Plus,
  Save,
  Search,
  ShoppingCart,
  Store,
  Trash2,
  Truck,
  User,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getImageUrl } from "@/lib/api";
import { PAYMENT_LABELS } from "@/lib/payment-label";
import { getShippingQuote, type ColissimoRelay, type GlsRelay, type ShippingQuote } from "@/lib/api/shipping";
import { ColissimoDelivery } from "./colissimo-delivery";
import { ColissimoDeliveryDate } from "./colissimo-delivery-date";
import { GlsDelivery } from "./gls-delivery";
import {
  createAuthenticatedOrder,
  createClientAddress,
  deleteClientAddress,
  createGuestOrder,
  getClientAddresses,
  updateClientAddress,
  type OrderItemPayload,
  type OrderTotalsPayload,
} from "@/lib/api/orders";
import { loginClient, signupClient } from "@/lib/api/clients";
import {
  createStripeCheckoutSession,
  getStripePublicConfig,
  type StripePublicConfig,
} from "@/lib/api/stripe";
import {
  getClientSession,
  saveClientSession,
  subscribeToClientSession,
  type ClientSession,
} from "@/lib/client-auth";
import { useCartStore, type CartItem } from "@/lib/stores/cart-store";
import { trackRecoPurchase } from "@/lib/reco/events";
import { cn } from "@/lib/utils";

type CheckoutForm = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  numberIdFiscale: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
  deliveryMethod: "standard" | "pickup";
  paymentMethod: "cash" | "bank" | "card";
  notes: string;
};

type AddressKind = "livraison" | "facturation" | "mixte";

type CustomerAddress = {
  id: string;
  label: string;
  kind: AddressKind;
  firstName: string;
  lastName: string;
  company: string;
  phone: string;
  street: string;
  apartment: string;
  city: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

type CheckoutAddressForm = Omit<
  CustomerAddress,
  "id" | "createdAt" | "updatedAt"
>;

const DEFAULT_FORM: CheckoutForm = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  company: "",
  numberIdFiscale: "",
  address: "",
  city: "",
  postalCode: "",
  country: "Tunisie",
  deliveryMethod: "standard",
  paymentMethod: "card",
  notes: "",
};

const EMPTY_ADDRESS_FORM: CheckoutAddressForm = {
  label: "Mon adresse",
  kind: "mixte",
  firstName: "",
  lastName: "",
  company: "",
  phone: "",
  street: "",
  apartment: "",
  city: "",
  postalCode: "",
  country: "Tunisie",
  isDefault: false,
};

const countryOptions = countries
  .map((country) => ({
    code: country.cca2,
    name: country.translations.fra?.common ?? country.name.common,
  }))
  .filter((country) => country.code && country.name)
  .sort((a, b) => a.name.localeCompare(b.name, "fr"));

/** Matches a country name (or code) from the form to the ISO code shipping zones use. */
function countryCodeFromName(value: string | undefined | null) {
  const text = (value ?? "").trim().toLowerCase();
  if (!text) return "";
  if (/^[a-z]{2}$/.test(text)) return text.toUpperCase();
  return countryOptions.find((country) => country.name.toLowerCase() === text)?.code ?? "";
}

const ADDRESS_STORAGE_EVENT = "fgmc-account-addresses-change";

let cachedSession: ClientSession | null = null;
let cachedSessionKey = "";

function parsePrice(value: string): number {
  const parsed = Number.parseFloat(
    String(value).replace(/[^0-9.,-]/g, "").replace(",", "."),
  );
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatEuro(value: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function rateToFraction(rate: number | null | undefined): number {
  if (rate == null || !Number.isFinite(rate)) return 0;
  return rate > 1 ? rate / 100 : rate;
}

function itemTotals(item: CartItem) {
  const unitHt = parsePrice(item.price);
  const unitTtc = unitHt * (1 + rateToFraction(item.taxRate));
  const qty = Math.max(0, item.qty ?? 0);

  return {
    unitHt,
    unitTtc,
    lineHt: unitHt * qty,
    lineTtc: unitTtc * qty,
  };
}

function getServerSessionSnapshot() {
  return null;
}

function getClientSessionSnapshot() {
  const nextSession = getClientSession();
  const nextKey = nextSession
    ? `${nextSession.token}:${JSON.stringify(nextSession.user)}`
    : "";

  if (nextKey === cachedSessionKey) {
    return cachedSession;
  }

  cachedSession = nextSession;
  cachedSessionKey = nextKey;
  return cachedSession;
}

function useClientSessionState() {
  return useSyncExternalStore(
    subscribeToClientSession,
    getClientSessionSnapshot,
    getServerSessionSnapshot,
  );
}

function buildInitialForm(session: ClientSession | null): CheckoutForm {
  return {
    ...DEFAULT_FORM,
    firstName: session?.user?.firstName ?? "",
    lastName: session?.user?.lastName ?? "",
    email: session?.user?.email ?? "",
    phone: session?.user?.phoneNumber ?? "",
    company: session?.user?.company ?? "",
    numberIdFiscale: session?.user?.numberIdFiscale ?? "",
  };
}

function getAddressStorageKey(session: ClientSession | null) {
  const identity =
    session?.user?.id ?? session?.user?.email ?? session?.token ?? "guest";
  return `fgmc-account-addresses:${identity}`;
}

function getAddressStorageSnapshot(key: string) {
  if (typeof window === "undefined") return "[]";
  return window.localStorage.getItem(key) ?? "[]";
}

function getServerAddressStorageSnapshot() {
  return "[]";
}

function subscribeAddressStorage(key: string, onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};

  const onStorage = (event: StorageEvent) => {
    if (event.key === key) onStoreChange();
  };
  const onCustomStorage = () => onStoreChange();

  window.addEventListener("storage", onStorage);
  window.addEventListener(ADDRESS_STORAGE_EVENT, onCustomStorage);

  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(ADDRESS_STORAGE_EVENT, onCustomStorage);
  };
}

function parseAddresses(raw: string): CustomerAddress[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isCustomerAddress);
  } catch {
    return [];
  }
}

function writeAddresses(key: string, addresses: CustomerAddress[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(addresses));
  window.dispatchEvent(new Event(ADDRESS_STORAGE_EVENT));
}

function normalizeAddresses(addresses: CustomerAddress[]) {
  const defaultIndex = addresses.findIndex((address) => address.isDefault);
  if (defaultIndex >= 0) {
    return addresses.map((address, index) => ({
      ...address,
      isDefault: index === defaultIndex,
    }));
  }
  return addresses.map((address, index) => ({
    ...address,
    isDefault: index === 0,
  }));
}

function isCustomerAddress(value: unknown): value is CustomerAddress {
  if (!value || typeof value !== "object") return false;
  const address = value as Partial<CustomerAddress>;
  return (
    typeof address.id === "string" &&
    typeof address.label === "string" &&
    typeof address.kind === "string" &&
    typeof address.street === "string" &&
    typeof address.city === "string" &&
    typeof address.country === "string"
  );
}

function checkoutFormWithAddress(
  form: CheckoutForm,
  address: CustomerAddress,
): CheckoutForm {
  return {
    ...form,
    firstName: form.firstName.trim() || address.firstName,
    lastName: form.lastName.trim() || address.lastName,
    phone: form.phone.trim() || address.phone,
    company: form.company.trim() || address.company,
    address: [address.street, address.apartment].filter(Boolean).join(", "),
    city: address.city,
    postalCode: address.postalCode,
    country: address.country,
  };
}

function addressFormFromCheckout(
  form: CheckoutForm,
  isDefault: boolean,
): CheckoutAddressForm {
  return {
    ...EMPTY_ADDRESS_FORM,
    label: "Mon adresse",
    firstName: form.firstName,
    lastName: form.lastName,
    company: form.company,
    phone: form.phone,
    street: form.address,
    city: form.city,
    postalCode: form.postalCode,
    country: form.country || EMPTY_ADDRESS_FORM.country,
    isDefault,
  };
}

function addressFormFromAddress(address: CustomerAddress): CheckoutAddressForm {
  return {
    label: address.label,
    kind: address.kind,
    firstName: address.firstName,
    lastName: address.lastName,
    company: address.company,
    phone: address.phone,
    street: address.street,
    apartment: address.apartment,
    city: address.city,
    postalCode: address.postalCode,
    country: address.country,
    isDefault: address.isDefault,
  };
}

function cleanAddressForm(form: CheckoutAddressForm): CheckoutAddressForm {
  return {
    ...form,
    label: form.label.trim() || "Mon adresse",
    firstName: form.firstName.trim(),
    lastName: form.lastName.trim(),
    company: form.company.trim(),
    phone: form.phone.trim(),
    street: form.street.trim(),
    apartment: form.apartment.trim(),
    city: form.city.trim(),
    postalCode: form.postalCode.trim(),
    country: form.country.trim() || EMPTY_ADDRESS_FORM.country,
  };
}

function createAddressId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function CheckoutClient() {
  const itemsByKey = useCartStore((state) => state.items);
  const items = useMemo(() => Object.values(itemsByKey), [itemsByKey]);
  const clearCart = useCartStore((state) => state.clear);
  const session = useClientSessionState();
  const [form, setForm] = useState<CheckoutForm>(() => buildInitialForm(null));
  const [hasTouchedForm, setHasTouchedForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [completedOrderId, setCompletedOrderId] = useState<string | null>(null);
  const [completedReference, setCompletedReference] = useState<string | null>(null);
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [addressEditorMode, setAddressEditorMode] = useState<
    "create" | "edit" | null
  >(null);
  const [editingAddressId, setEditingAddressId] = useState("");
  const [addressForm, setAddressForm] = useState<CheckoutAddressForm>(
    EMPTY_ADDRESS_FORM,
  );
  const [addressError, setAddressError] = useState<string | null>(null);
  const [isSavingAddress, setIsSavingAddress] = useState(false);
  const [showLoginForm, setShowLoginForm] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [accountPassword, setAccountPassword] = useState("");
  const [accountCreationNotice, setAccountCreationNotice] = useState<string | null>(null);
  const [paymentNotice, setPaymentNotice] = useState<string | null>(null);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [stripeConfig, setStripeConfig] = useState<StripePublicConfig | null>(null);

  useEffect(() => {
    let cancelled = false;
    getStripePublicConfig()
      .then((config) => {
        if (!cancelled) setStripeConfig(config);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const visibleForm = hasTouchedForm ? form : buildInitialForm(session);
  const addressStorageKey = getAddressStorageKey(session);
  const rawAddresses = useSyncExternalStore(
    (onStoreChange) => subscribeAddressStorage(addressStorageKey, onStoreChange),
    () => getAddressStorageSnapshot(addressStorageKey),
    getServerAddressStorageSnapshot,
  );
  const savedAddresses = useMemo(
    () => parseAddresses(rawAddresses),
    [rawAddresses],
  );

  useEffect(() => {
    if (!session?.token) return;
    let cancelled = false;
    void getClientAddresses(session.token)
      .then(({ data }) => {
        if (cancelled) return;
        const existingAddresses = parseAddresses(getAddressStorageSnapshot(addressStorageKey));
        const localById = new Map(existingAddresses.map((address) => [address.id, address]));
        const addresses: CustomerAddress[] = data.map((address, index) => {
          const local = localById.get(address.id);
          return {
            ...(local ?? EMPTY_ADDRESS_FORM),
            id: address.id,
            label: local?.label ?? "Mon adresse",
            kind: local?.kind ?? "mixte",
            firstName: local?.firstName ?? session.user?.firstName ?? "",
            lastName: local?.lastName ?? session.user?.lastName ?? "",
            company: local?.company ?? session.user?.company ?? "",
            phone: local?.phone ?? "",
            street: local?.street ?? address.street,
            apartment: local?.apartment ?? "",
            city: address.City,
            postalCode: address.zipCode,
            country: address.country,
            isDefault: local?.isDefault ?? index === 0,
            createdAt: local?.createdAt ?? address.createdAt ?? new Date().toISOString(),
            updatedAt: local?.updatedAt ?? address.createdAt ?? new Date().toISOString(),
          };
        });
        const normalized = normalizeAddresses(addresses);
        if (JSON.stringify(existingAddresses) !== JSON.stringify(normalized)) {
          writeAddresses(addressStorageKey, normalized);
        }
      })
      .catch((error) => {
        console.error("Unable to load saved customer addresses", error);
      });
    return () => {
      cancelled = true;
    };
  }, [addressStorageKey, session?.token, session?.user?.firstName, session?.user?.lastName, session?.user?.company]);
  const deliveryAddresses = useMemo(
    () =>
      session?.token
        ? savedAddresses.filter((address) => address.kind !== "facturation")
        : [],
    [savedAddresses, session?.token],
  );
  const selectedAddress =
    deliveryAddresses.find((address) => address.id === selectedAddressId) ??
    deliveryAddresses.find((address) => address.isDefault) ??
    deliveryAddresses[0] ??
    null;

  // Delivery options and prices come from the server, for this country and this cart.
  const shippingCountryCode = useMemo(
    () => countryCodeFromName(selectedAddress?.country ?? visibleForm.country),
    [selectedAddress?.country, visibleForm.country],
  );
  const quoteSubtotal = useMemo(
    () => roundMoney(items.reduce((sum, item) => sum + roundMoney(itemTotals(item).lineTtc), 0)),
    [items],
  );
  /** GLS adds a supplement for islands and mountain areas, which depends on the postcode. */
  const shippingPostcode = (selectedAddress?.postalCode ?? visibleForm.postalCode ?? "").replace(/\s+/g, "").slice(0, 12);
  const quoteKey = useMemo(
    () => `${shippingCountryCode}|${shippingPostcode}|${quoteSubtotal}|${items.map((item) => `${item.productId}:${item.qty}`).join(",")}`,
    [items, quoteSubtotal, shippingCountryCode, shippingPostcode],
  );
  const [quoteState, setQuoteState] = useState<{ key: string; quote: ShippingQuote | null } | null>(null);
  const [chosenCarrierId, setChosenCarrierId] = useState("");
  const [glsRelay, setGlsRelay] = useState<GlsRelay | null>(null);
  const [glsMobile, setGlsMobile] = useState("");
  const [colissimoRelay, setColissimoRelay] = useState<ColissimoRelay | null>(null);
  const [colissimoDoorCodes, setColissimoDoorCodes] = useState({ code1: "", code2: "" });
  const [colissimoPhoneRequired, setColissimoPhoneRequired] = useState(false);
  /** How many steps the customer has confirmed, in order: a confirmed step folds into a summary, the next one opens. */
  const [doneUpTo, setDoneUpTo] = useState(0);
  const [stepError, setStepError] = useState<{ step: number; message: string } | null>(null);

  useEffect(() => {
    if (!shippingCountryCode || items.length === 0) return;
    let cancelled = false;
    getShippingQuote({
      countryCode: shippingCountryCode,
      postcode: shippingPostcode,
      subtotal: quoteSubtotal,
      items: items.map((item) => ({ productId: item.productId, quantity: item.qty })),
    })
      .then((quote) => {
        if (!cancelled) setQuoteState({ key: quoteKey, quote });
      })
      .catch(() => {
        // Quote unavailable: checkout does not block the order; shipping stays « à confirmer ».
        if (!cancelled) setQuoteState({ key: quoteKey, quote: null });
      });
    return () => {
      cancelled = true;
    };
  }, [items, quoteKey, quoteSubtotal, shippingCountryCode, shippingPostcode]);

  const quote = quoteState?.quote ?? null;
  const quoteLoading = Boolean(shippingCountryCode) && items.length > 0 && quoteState?.key !== quoteKey;
  /** Once a carrier exists, prices come from the server rather than the flat rate. */
  const carrierMode = Boolean(quote?.configured);
  const chosenOption = carrierMode
    ? (quote?.options.find((option) => option.carrierId === chosenCarrierId) ??
      quote?.options.find((option) => option.carrierId === quote.defaultCarrierId) ??
      quote?.options[0] ??
      null)
    : null;

  const totals = useMemo(() => {
    const productsTtc = items.reduce(
      (sum, item) => sum + itemTotals(item).lineTtc,
      0,
    );
    const productsHt = items.reduce(
      (sum, item) => sum + itemTotals(item).lineHt,
      0,
    );
    // Only a real carrier quote is ever charged: no flat rate.
    const shipping = items.length > 0 && carrierMode ? (chosenOption?.total ?? 0) : 0;

    return {
      productsHt,
      productsTtc,
      shipping,
      subtotalTtc: items.length > 0 ? productsTtc + shipping : 0,
    };
  }, [items, carrierMode, chosenOption?.total]);
  /** Standard delivery without a carrier quote: the price is not known yet. */
  const shippingPending = items.length > 0 && !carrierMode && visibleForm.deliveryMethod === "standard";

  function updateField<K extends keyof CheckoutForm>(
    key: K,
    value: CheckoutForm[K],
  ) {
    setHasTouchedForm(true);
    setSubmitError(null);
    setForm((current) => ({
      ...(hasTouchedForm ? current : buildInitialForm(session)),
      [key]: value,
    }));
  }

  async function handleClientLogin() {
    const email = loginEmail.trim() || visibleForm.email.trim();
    if (!email || !loginPassword) {
      setLoginError("Saisissez votre adresse e-mail et votre mot de passe.");
      return;
    }
    setIsLoggingIn(true);
    setLoginError(null);
    try {
      const response = await loginClient({ email, password: loginPassword });
      saveClientSession(response);
      setHasTouchedForm(false);
      setLoginPassword("");
      setShowLoginForm(false);
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : "Connexion impossible.");
    } finally {
      setIsLoggingIn(false);
    }
  }

  function handleSelectAddress(addressId: string) {
    setSelectedAddressId(addressId);
    setSubmitError(null);
  }

  function persistAddresses(nextAddresses: CustomerAddress[]) {
    writeAddresses(addressStorageKey, normalizeAddresses(nextAddresses));
  }

  function startCreateAddress() {
    setAddressForm(
      addressFormFromCheckout(visibleForm, savedAddresses.length === 0),
    );
    setAddressEditorMode("create");
    setEditingAddressId("");
    setAddressError(null);
    setSubmitError(null);
  }

  function startEditAddress(address: CustomerAddress) {
    setAddressForm(addressFormFromAddress(address));
    setAddressEditorMode("edit");
    setEditingAddressId(address.id);
    setAddressError(null);
    setSubmitError(null);
  }

  function cancelAddressEditor() {
    setAddressEditorMode(null);
    setEditingAddressId("");
    setAddressError(null);
  }

  function updateAddressField<K extends keyof CheckoutAddressForm>(
    key: K,
    value: CheckoutAddressForm[K],
  ) {
    setAddressForm((current) => ({ ...current, [key]: value }));
    setAddressError(null);
  }

  async function handleAddressSubmit() {
    const cleanForm = cleanAddressForm(addressForm);

    if (!cleanForm.firstName || !cleanForm.lastName) {
      setAddressError("Le prenom et le nom sont obligatoires.");
      return;
    }

    if (!cleanForm.street || !cleanForm.city || !cleanForm.country) {
      setAddressError("L'adresse, la ville et le pays sont obligatoires.");
      return;
    }

    const now = new Date().toISOString();
    setIsSavingAddress(true);
    setAddressError(null);
    try {
      const apiFields = {
        country: cleanForm.country,
        street: [cleanForm.street, cleanForm.apartment].filter(Boolean).join(", "),
        City: cleanForm.city,
        state: cleanForm.city || cleanForm.country,
        zipCode: cleanForm.postalCode || "-",
      };

      const saved = session?.token
        ? addressEditorMode === "edit" && editingAddressId
          ? await updateClientAddress(session.token, editingAddressId, apiFields)
          : await createClientAddress(session.token, apiFields)
        : null;

      if (addressEditorMode === "edit" && editingAddressId) {
        persistAddresses(
          savedAddresses.map((address) =>
            address.id === editingAddressId
              ? { ...address, ...cleanForm, id: saved?.id ?? editingAddressId, updatedAt: now }
              : cleanForm.isDefault
                ? { ...address, isDefault: false }
                : address,
          ),
        );
        setSelectedAddressId(editingAddressId);
      } else {
        const nextAddress: CustomerAddress = {
          id: saved?.id ?? createAddressId(),
          ...cleanForm,
          street: saved ? cleanForm.street : cleanForm.street,
          isDefault: cleanForm.isDefault || savedAddresses.length === 0,
          createdAt: now,
          updatedAt: now,
        };

        persistAddresses(
          nextAddress.isDefault
            ? savedAddresses
                .map((address) => ({ ...address, isDefault: false }))
                .concat(nextAddress)
            : savedAddresses.concat(nextAddress),
        );
        setSelectedAddressId(nextAddress.id);
      }

      setAddressEditorMode(null);
      setEditingAddressId("");
      setAddressError(null);
    } catch (error) {
      setAddressError(error instanceof Error ? error.message : "Impossible d'enregistrer l'adresse.");
    } finally {
      setIsSavingAddress(false);
    }
  }

  function handleDeleteAddress(addressId: string) {
    if (
      typeof window !== "undefined" &&
      !window.confirm("Supprimer cette adresse ?")
    ) {
      return;
    }

    if (session?.token) {
      void deleteClientAddress(session.token, addressId).catch((error) => {
        setAddressError(error instanceof Error ? error.message : "Impossible de supprimer l'adresse.");
      });
    }
    persistAddresses(savedAddresses.filter((address) => address.id !== addressId));

    if (selectedAddressId === addressId) {
      setSelectedAddressId("");
    }

    if (editingAddressId === addressId) {
      cancelAddressEditor();
    }

    setSubmitError(null);
  }

  /** Payment on delivery is no longer offered. Card is the default when online payment is on, bank transfer otherwise. */
  const paymentChoice: CheckoutForm["paymentMethod"] =
    visibleForm.paymentMethod === "bank" ? "bank" : stripeConfig?.enabled ? "card" : "bank";

  const stepStatus = (step: number): "done" | "open" | "locked" => (step <= doneUpTo ? "done" : step === doneUpTo + 1 ? "open" : "locked");

  /** What must be right before a step can be confirmed; the same rules as the order, asked one step at a time. */
  function validateStep(step: number): string | null {
    if (step === 1) {
      if (!visibleForm.firstName.trim() || !visibleForm.lastName.trim()) return "Indiquez votre prénom et votre nom.";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(visibleForm.email.trim())) return "Indiquez une adresse e-mail valide.";
      if (!visibleForm.phone.trim()) return "Indiquez votre numéro de téléphone.";
      if (!session?.token && accountPassword.length < 6) return "Choisissez un mot de passe d’au moins 6 caractères pour créer votre compte.";
      return null;
    }
    if (step === 2) {
      if (addressEditorMode) return "Enregistrez ou annulez l’adresse en cours de modification.";
      if (deliveryAddresses.length > 0) return selectedAddress ? null : "Choisissez une adresse de livraison.";
      if (!visibleForm.address.trim() || !visibleForm.postalCode.trim() || !visibleForm.city.trim()) return "Complétez votre adresse : rue, code postal et ville.";
      return null;
    }
    if (step === 3) {
      if (carrierMode) {
        if (quoteLoading) return "Le calcul des frais de livraison est en cours. Réessayez dans un instant.";
        if (!chosenOption) return "Aucun mode de livraison n’est disponible pour cette commande. Vérifiez votre adresse.";
        if (chosenOption.glsType === "RELAY" && !glsRelay) return "Choisissez un point relais GLS pour cette livraison.";
        if ((chosenOption.glsType === "RELAY" || chosenOption.glsType === "FLEX") && !/^\+?[0-9 ().-]{6,20}$/.test(glsMobile.trim())) return "Indiquez un numéro de mobile valide : GLS vous envoie un SMS pour cette livraison.";
        if (chosenOption.colissimoType === "RELAY" && !colissimoRelay) return "Choisissez un point de retrait Colissimo pour cette livraison.";
        if (chosenOption.colissimoType === "RELAY" && (glsMobile.trim() || colissimoPhoneRequired) && !/^\+?[0-9 ().-]{6,20}$/.test(glsMobile.trim())) {
          return colissimoPhoneRequired ? "Indiquez un numéro de mobile valide : Colissimo l’utilise pour vous prévenir de l’arrivée du colis." : "Le numéro de mobile n’est pas valide : corrigez-le ou laissez le champ vide.";
        }
      }
      return null;
    }
    return null;
  }

  function continueFrom(step: number) {
    const problem = validateStep(step);
    if (problem) {
      setStepError({ step, message: problem });
      return;
    }
    setStepError(null);
    setDoneUpTo(step);
  }

  /** Reopens a confirmed step. The ones after it are asked again, since they can depend on it (the address decides the carriers). */
  function editStep(step: number) {
    setStepError(null);
    setDoneUpTo(step - 1);
  }

  const summaryOf = (step: number) => {
    if (step === 1) return [`${visibleForm.firstName} ${visibleForm.lastName}`.trim(), visibleForm.email].filter(Boolean).join(" · ");
    if (step === 2) {
      return selectedAddress
        ? [selectedAddress.street, `${selectedAddress.postalCode} ${selectedAddress.city}`.trim()].filter(Boolean).join(", ")
        : [visibleForm.address, `${visibleForm.postalCode} ${visibleForm.city}`.trim()].filter(Boolean).join(", ");
    }
    if (step === 3) {
      if (carrierMode && chosenOption) {
        const place = chosenOption.colissimoType === "RELAY" ? colissimoRelay?.name : chosenOption.glsType === "RELAY" ? glsRelay?.name : "";
        return [chosenOption.name, place, chosenOption.free ? "Gratuit" : formatEuro(chosenOption.total)].filter(Boolean).join(" · ");
      }
      return visibleForm.deliveryMethod === "pickup" ? "Retrait magasin · Gratuit" : "Livraison standard · tarif à confirmer";
    }
    return "";
  };

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (items.length === 0) return;
    if (doneUpTo < 3) {
      const first = [1, 2, 3].find((step) => step > doneUpTo) ?? 1;
      setStepError({ step: first, message: "Validez cette étape avant de passer au paiement." });
      return;
    }

    const currentForm = selectedAddress
      ? checkoutFormWithAddress(visibleForm, selectedAddress)
      : visibleForm;
    if (carrierMode && (quoteLoading || !chosenOption)) {
      setSubmitError(
        quoteLoading
          ? "Le calcul des frais de livraison est en cours. Réessayez dans un instant."
          : "Aucun mode de livraison n'est disponible pour cette commande. Vérifiez votre adresse.",
      );
      return;
    }
    // A GLS carrier needs what only the customer can give: a relay point, and a mobile number for the text message.
    if (carrierMode && chosenOption?.glsType === "RELAY" && !glsRelay) {
      setSubmitError("Choisissez un point relais GLS pour cette livraison.");
      return;
    }
    if (carrierMode && (chosenOption?.glsType === "RELAY" || chosenOption?.glsType === "FLEX") && !/^\+?[0-9 ().-]{6,20}$/.test(glsMobile.trim())) {
      setSubmitError("Indiquez un numéro de mobile valide : GLS vous envoie un SMS pour cette livraison.");
      return;
    }
    if (carrierMode && chosenOption?.colissimoType === "RELAY" && !colissimoRelay) {
      setSubmitError("Choisissez un point de retrait Colissimo pour cette livraison.");
      return;
    }
    if (carrierMode && chosenOption?.colissimoType === "RELAY" && (glsMobile.trim() || colissimoPhoneRequired) && !/^\+?[0-9 ().-]{6,20}$/.test(glsMobile.trim())) {
      setSubmitError(colissimoPhoneRequired ? "Indiquez un numéro de mobile valide : Colissimo l’utilise pour vous prévenir de l’arrivée du colis." : "Le numéro de mobile n’est pas valide : corrigez-le ou laissez le champ vide.");
      return;
    }
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const payOnline = paymentChoice === "card" && Boolean(stripeConfig?.enabled);
      const payload = {
        ...buildOrderTotalsPayload(items, totals),
        paymentMethod: payOnline ? ("En_ligne" as const) : ("COD" as const),
        paymentType: payOnline ? PAYMENT_LABELS.card : paymentChoice === "bank" ? PAYMENT_LABELS.bank : PAYMENT_LABELS.cash,
        ...(carrierMode && chosenOption
          ? {
              shipping: {
                carrierId: chosenOption.carrierId,
                countryCode: shippingCountryCode,
                postcode: shippingPostcode,
                ...(chosenOption.glsType === "RELAY" && glsRelay ? { relayId: glsRelay.id } : {}),
                ...(chosenOption.glsType === "RELAY" || chosenOption.glsType === "FLEX" ? { mobile: glsMobile.trim() } : {}),
                ...(chosenOption.colissimoType === "RELAY" && colissimoRelay ? { relayId: colissimoRelay.id, relayName: colissimoRelay.name, relayStreet: colissimoRelay.street, relayZip: colissimoRelay.zip, relayCity: colissimoRelay.city, relayCountry: colissimoRelay.country, relayType: colissimoRelay.pointType } : {}),
                ...(chosenOption.colissimoType === "RELAY" && glsMobile.trim() ? { mobile: glsMobile.trim() } : {}),
                ...(chosenOption.colissimoType && chosenOption.colissimoType !== "RELAY" && colissimoDoorCodes.code1.trim() ? { doorCode1: colissimoDoorCodes.code1.trim() } : {}),
                ...(chosenOption.colissimoType && chosenOption.colissimoType !== "RELAY" && colissimoDoorCodes.code2.trim() ? { doorCode2: colissimoDoorCodes.code2.trim() } : {}),
              },
            }
          : {}),
      };
      const order = session?.token
        ? await createAuthenticatedCheckoutOrder(
            session.token,
            currentForm,
            payload,
            selectedAddress?.id,
          )
        : await createGuestOrder({
            ...payload,
            guestName: `${currentForm.firstName} ${currentForm.lastName}`.trim(),
            guestEmail: currentForm.email.trim() || undefined,
            guestPhone: currentForm.phone.trim(),
            guestAddress: formatAddress(currentForm),
          });

      // Order confirmed: fire-and-forget PURCHASE for attributed products.
      trackRecoPurchase(items.map((item) => item.productId));

      if (!session?.token && accountPassword) {
        try {
          const clientSession = await signupClient({
            email: currentForm.email.trim(),
            password: accountPassword,
            firstName: currentForm.firstName.trim(),
            lastName: currentForm.lastName.trim(),
            phoneNumber: currentForm.phone.trim() || null,
            company: currentForm.company.trim() || null,
            numberIdFiscale: currentForm.numberIdFiscale.trim() || null,
          });
          const authenticatedSession = saveClientSession(clientSession);
          try {
            await createClientAddress(authenticatedSession.token, {
              country: currentForm.country.trim(),
              street: currentForm.address.trim(),
              City: currentForm.city.trim(),
              state: currentForm.city.trim() || currentForm.country.trim(),
              zipCode: currentForm.postalCode.trim() || "-",
            });
            setAccountCreationNotice(
              "Votre compte a ete cree, votre adresse enregistree et vous etes connecte.",
            );
          } catch {
            setAccountCreationNotice(
              "Votre compte client a ete cree et vous etes connecte, mais l'adresse n'a pas pu etre enregistree au compte.",
            );
          }
        } catch {
          setAccountCreationNotice(
            "Commande confirmee. Le compte n'a pas pu etre cree automatiquement; verifiez l'adresse e-mail et reessayez plus tard.",
          );
        }
      }

      if (payOnline) {
        try {
          const { url } = await createStripeCheckoutSession(order.id);
          setIsRedirecting(true);
          clearCart();
          window.location.assign(url);
          return;
        } catch (error) {
          setPaymentNotice(
            `Votre commande est enregistrée, mais le paiement en ligne n'a pas pu démarrer (${
              error instanceof Error ? error.message : "erreur inconnue"
            }). Nous vous contacterons pour finaliser le règlement.`,
          );
        }
      }

      setCompletedOrderId(order.id);
      setCompletedReference(order.reference ?? null);
      clearCart();
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "Impossible de confirmer la commande. Reessayez dans un instant.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (completedOrderId) {
    return (
      <main className="min-h-[calc(100dvh-5rem)] bg-[#f2f5fa] px-4 py-16 text-[#0f1f45]">
        <div className="mx-auto max-w-xl text-center">
          <CheckCircle2 className="mx-auto size-10 text-[#153675]" aria-hidden="true" />
          <h1 className="mt-5! text-3xl! font-semibold!">Commande confirmée</h1>
          <p className="mt-3! text-base! leading-6 text-[#5b6b8a]">
            Votre commande a bien été enregistrée.
          </p>
          <p className="mx-auto mt-6! w-fit rounded-[4px] border border-dashed border-[#b4c2dc] bg-white px-5 py-3 text-base font-medium tabular-nums">
            Référence : {completedReference ?? completedOrderId}
          </p>
          {paymentNotice ? (
            <p role="alert" className="mx-auto mt-4! max-w-md text-sm leading-6 text-destructive">
              {paymentNotice}
            </p>
          ) : null}
          {accountCreationNotice ? (
            <p className="mx-auto mt-4! max-w-md text-sm leading-6 text-[#5b6b8a]">
              {accountCreationNotice}
            </p>
          ) : null}
          <Link
            href="/categorie-produit"
            className="mt-8 inline-flex min-h-12 items-center rounded-[4px] bg-[#153675] px-8 text-base font-medium text-white transition-colors duration-200 hover:bg-[#0f1f45] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
            Continuer mes achats
          </Link>
        </div>
      </main>
    );
  }

  const progress = Math.round((Math.min(doneUpTo, 3) / 3) * 100);
  const progressLabel =
    doneUpTo >= 3
      ? "Dernière étape : le paiement"
      : `Étape ${doneUpTo + 1} sur 4 : ${["vos coordonnées", "l’adresse", "la livraison"][doneUpTo]}`;

  if (items.length === 0) {
    return (
      <main className="min-h-[calc(100dvh-5rem)] bg-muted px-4 py-12">
        <div className="mx-auto flex max-w-xl flex-col items-center rounded-lg border border-border bg-background px-6 py-12 text-center shadow-sm">
          <div className="grid size-14 place-items-center rounded-full bg-primary/10 text-primary">
            <ShoppingCart className="size-6" />
          </div>
          <h1 className="mt-5 text-2xl font-bold text-foreground">
            Votre panier est vide
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Ajoutez des produits avant de passer a la caisse.
          </p>
          <Button asChild className="mt-6 bg-destructive hover:bg-destructive/90">
            <Link href="/">Continuer mes achats</Link>
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main
      className="min-h-[calc(100dvh-5rem)] bg-[var(--co-linen)] text-[var(--co-ink)]"
      style={
        {
          "--co-ink": "#0f1f45",
          "--co-royal": "#153675",
          "--co-thread": "#d6202e",
          "--co-linen": "#f2f5fa",
          "--co-seam": "#b4c2dc",
          "--co-line": "#d5deee",
          "--co-muted": "#5b6b8a",
        } as React.CSSProperties
      }>
      {/* Same tailor's tape as the cart: the red pin slides along it as the steps are confirmed. */}
      <header className="relative bg-[var(--co-ink)] text-white">
        <div className="mx-auto w-full max-w-7xl px-4 pb-20 pt-6 sm:px-6 lg:px-8">
          <nav aria-label="Breadcrumb">
            <ol className="flex items-center gap-1.5 text-sm text-white/70">
              <li>
                <Link href="/" className="-mx-1 rounded px-1 transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
                  Accueil
                </Link>
              </li>
              <li aria-hidden className="flex items-center"><ChevronRight className="size-3.5" /></li>
              <li>
                <Link href="/cart" className="-mx-1 rounded px-1 transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
                  Panier
                </Link>
              </li>
              <li aria-hidden className="flex items-center"><ChevronRight className="size-3.5" /></li>
              <li aria-current="page" className="font-medium text-white">Commande</li>
            </ol>
          </nav>
          <h1 className="mt-6 text-5xl! font-semibold! leading-[0.95]! tracking-tight sm:text-6xl!">
            Finaliser la commande
          </h1>
        </div>
        <div className="cat-tape absolute inset-x-0 bottom-0" aria-hidden="true" />
        <div className="absolute inset-x-4 bottom-2.5 h-7 sm:inset-x-6 lg:inset-x-8">
          <p
            className="absolute bottom-0 whitespace-nowrap rounded-[3px] bg-[var(--co-thread)] px-3 py-1 text-sm font-medium text-white shadow-[0_2px_0_rgba(15,31,69,0.35)] transition-[left,transform] duration-500 ease-out motion-reduce:transition-none"
            style={{ left: `${progress}%`, transform: `translateX(-${progress}%)` }}
            aria-live="polite">
            {progressLabel}
          </p>
        </div>
      </header>
      <form
        onSubmit={handleSubmit}
        className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_390px] lg:px-8">
        <section className="min-w-0 space-y-6">
          <div className="flex justify-end">
            <Link
              href="/cart"
              className="inline-flex min-h-11 items-center rounded-md px-1 text-base font-medium text-[var(--co-royal)] underline decoration-2 underline-offset-[6px] hover:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--co-royal)]">
              Modifier le panier
            </Link>
          </div>

          {!session ? (
            <>
            <div className="flex flex-col gap-3 rounded-lg border border-primary/20 bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <LockKeyhole className="mt-0.5 size-5 text-primary" />
                <div>
                  <p className="font-semibold">Connectez-vous plus vite</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Votre compte client peut remplir vos informations
                    automatiquement.
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                className="shrink-0"
                onClick={() => {
                  setShowLoginForm((open) => !open);
                  setLoginEmail(visibleForm.email);
                  setLoginError(null);
                }}>
                {showLoginForm ? "Fermer" : "Connexion client"}
              </Button>
            </div>
            {showLoginForm ? (
              <div
                className="mt-4 grid gap-4 rounded-lg border border-border bg-background p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
                onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void handleClientLogin();
                  }
                }}>
                <TextField
                  id="checkout-login-email"
                  label="Adresse e-mail"
                  type="email"
                  value={loginEmail}
                  onChange={setLoginEmail}
                  autoComplete="email"
                  icon={Mail}
                  required
                />
                <TextField
                  id="checkout-login-password"
                  label="Mot de passe"
                  type="password"
                  value={loginPassword}
                  onChange={setLoginPassword}
                  autoComplete="current-password"
                  icon={LockKeyhole}
                  required
                />
                <Button type="button" onClick={() => void handleClientLogin()} disabled={isLoggingIn}>
                  {isLoggingIn ? "Connexion..." : "Se connecter"}
                </Button>
                {loginError ? (
                  <p role="alert" className="text-sm text-destructive sm:col-span-3">
                    {loginError}
                  </p>
                ) : null}
              </div>
            ) : null}
            </>
          ) : (
            <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-background p-4">
              <div className="grid size-10 place-items-center rounded-full bg-primary text-primary-foreground">
                <User className="size-5" />
              </div>
              <div className="min-w-0">
                <p className="truncate font-semibold">
                  {session.user?.firstName || session.user?.lastName
                    ? `${session.user?.firstName ?? ""} ${
                        session.user?.lastName ?? ""
                      }`.trim()
                    : "Compte client"}
                </p>
                <p className="truncate text-sm text-muted-foreground">
                  {session.user?.email}
                </p>
              </div>
            </div>
          )}

          <div className="divide-y divide-dashed divide-[var(--co-seam)] overflow-hidden rounded-[4px] border border-[var(--co-line)] bg-white">
          <CheckoutPanel
            step={1}
            icon={User}
            title="Vos coordonnées"
            description="Nous les utilisons pour vous joindre au sujet de la commande."
            status={stepStatus(1)}
            summary={summaryOf(1)}
            error={stepError?.step === 1 ? stepError.message : null}
            onEdit={() => editStep(1)}
            onContinue={() => continueFrom(1)}>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                id="checkout-first-name"
                label="Prénom"
                value={visibleForm.firstName}
                onChange={(value) => updateField("firstName", value)}
                autoComplete="given-name"
                required
              />
              <TextField
                id="checkout-last-name"
                label="Nom"
                value={visibleForm.lastName}
                onChange={(value) => updateField("lastName", value)}
                autoComplete="family-name"
                required
              />
              <TextField
                id="checkout-email"
                label="Adresse e-mail"
                type="email"
                value={visibleForm.email}
                onChange={(value) => updateField("email", value)}
                autoComplete="email"
                icon={Mail}
                required
              />
              <TextField
                id="checkout-phone"
                label="Téléphone"
                type="tel"
                value={visibleForm.phone}
                onChange={(value) => updateField("phone", value)}
                autoComplete="tel"
                icon={Phone}
                required
              />
              <TextField
                id="checkout-client-company"
                label="Société"
                value={visibleForm.company}
                onChange={(value) => updateField("company", value)}
                autoComplete="organization"
                icon={Building2}
              />
              <TextField
                id="checkout-client-tax-id"
                label="Matricule fiscal"
                value={visibleForm.numberIdFiscale}
                onChange={(value) => updateField("numberIdFiscale", value)}
                icon={Fingerprint}
              />
              {!session?.token ? (
                <TextField
                  id="checkout-account-password"
                  label="Mot de passe pour créer votre compte"
                  type="password"
                  value={accountPassword}
                  onChange={setAccountPassword}
                  autoComplete="new-password"
                  icon={LockKeyhole}
                  minLength={6}
                  required
                />
              ) : null}
            </div>
          </CheckoutPanel>

          <CheckoutPanel
            step={2}
            icon={MapPin}
            title="Adresse de livraison"
            description="Où devons-nous livrer votre commande ?"
            status={stepStatus(2)}
            summary={summaryOf(2)}
            error={stepError?.step === 2 ? stepError.message : null}
            onEdit={() => editStep(2)}
            onContinue={() => continueFrom(2)}>
            {addressEditorMode ? null : deliveryAddresses.length > 0 ? (
              <SavedAddressPicker
                addresses={deliveryAddresses}
                selectedAddressId={selectedAddress?.id ?? ""}
                onSelect={handleSelectAddress}
                onCreate={startCreateAddress}
                onEdit={startEditAddress}
                onDelete={handleDeleteAddress}
              />
            ) : (
              <ManualAddressFields
                form={visibleForm}
                onFieldChange={updateField}
                onCreateAddress={startCreateAddress}
                showAddressBookActions={Boolean(session?.token)}
              />
            )}
            {addressEditorMode ? (
              <CheckoutAddressEditor
                mode={addressEditorMode}
                form={addressForm}
                error={addressError}
                saving={isSavingAddress}
                onFieldChange={updateAddressField}
                onSave={handleAddressSubmit}
                onCancel={cancelAddressEditor}
              />
            ) : null}
          </CheckoutPanel>

          <CheckoutPanel
            step={3}
            icon={Truck}
            title="Livraison"
            description="Comment souhaitez-vous recevoir vos articles ?"
            status={stepStatus(3)}
            summary={summaryOf(3)}
            error={stepError?.step === 3 ? stepError.message : null}
            onEdit={() => editStep(3)}
            onContinue={() => continueFrom(3)}>
            {carrierMode && quote ? (
              !quote.countryServed ? (
                <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm leading-6 text-destructive">
                  Nous ne livrons pas encore dans ce pays. Choisissez une autre adresse de livraison, ou contactez-nous.
                </p>
              ) : quote.options.length === 0 ? (
                <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm leading-6 text-destructive">
                  Aucun mode de livraison n&apos;est disponible pour cette commande. Contactez-nous pour organiser l&apos;envoi.
                </p>
              ) : (
                <>
                  <TicketChoices
                    legend="Mode de livraison"
                    name="checkout-carrier"
                    value={chosenOption?.carrierId ?? ""}
                    onChange={(value) => {
                      setChosenCarrierId(value);
                      setGlsRelay(null); // a relay point belongs to the carrier it was chosen for
                      setColissimoRelay(null);
                    }}
                    options={quote.options.map((option) => ({
                      value: option.carrierId,
                      label: option.name,
                      hint: [option.transitTime, option.isPickup ? "Retrait sur place" : null, option.handlingFee > 0 ? "frais de manutention inclus" : null]
                        .filter(Boolean)
                        .join(" · ") || "À l'adresse indiquée",
                      icon: option.isPickup ? Store : Truck,
                      image: option.logoUrl ? getImageUrl(option.logoUrl) : undefined,
                      aside: option.free ? "Gratuit" : formatEuro(option.total),
                    }))}
                  />
                  {chosenOption?.glsType === "RELAY" || chosenOption?.glsType === "FLEX" ? (
                    <GlsDelivery
                      key={chosenOption.carrierId}
                      glsType={chosenOption.glsType}
                      country={shippingCountryCode}
                      defaultZip={(selectedAddress?.postalCode ?? visibleForm.postalCode) || ""}
                      defaultCity={(selectedAddress?.city ?? visibleForm.city) || ""}
                      defaultStreet={(selectedAddress?.street ?? visibleForm.address) || ""}
                      relay={glsRelay}
                      onRelay={setGlsRelay}
                      mobile={glsMobile}
                      onMobile={setGlsMobile}
                    />
                  ) : null}
                  {chosenOption?.colissimoType ? (
                    <ColissimoDelivery
                      key={chosenOption.carrierId}
                      type={chosenOption.colissimoType as "HOME" | "HOME_SIGN" | "RELAY"}
                      country={shippingCountryCode}
                      defaultZip={(selectedAddress?.postalCode ?? visibleForm.postalCode) || ""}
                      defaultCity={(selectedAddress?.city ?? visibleForm.city) || ""}
                      defaultStreet={(selectedAddress?.street ?? visibleForm.address) || ""}
                      relay={colissimoRelay}
                      onRelay={setColissimoRelay}
                      mobile={glsMobile}
                      onMobile={setGlsMobile}
                      defaultMobile={(selectedAddress?.phone?.trim() || visibleForm.phone) ?? ""}
                      doorCodes={colissimoDoorCodes}
                      onDoorCodes={setColissimoDoorCodes}
                      onPhoneRequired={setColissimoPhoneRequired}
                    />
                  ) : null}
                  {chosenOption?.colissimoType ? <ColissimoDeliveryDate zip={(selectedAddress?.postalCode ?? visibleForm.postalCode) || ""} country={shippingCountryCode} /> : null}
                  {quote.freeShippingRemaining ? (
                    <p className="mb-2! text-sm! text-muted-foreground">
                      Plus que <strong className="text-foreground">{formatEuro(quote.freeShippingRemaining)}</strong> d&apos;achats pour la livraison gratuite.
                    </p>
                  ) : null}
                </>
              )
            ) : quoteLoading && quoteState === null ? (
              <p className="text-sm text-muted-foreground" aria-live="polite">Calcul des frais de livraison…</p>
            ) : (
              <TicketChoices
                legend="Mode de livraison"
                name="checkout-delivery"
                value={visibleForm.deliveryMethod}
                onChange={(value) =>
                  updateField("deliveryMethod", value as CheckoutForm["deliveryMethod"])
                }
                options={[
                  { value: "standard", label: "Livraison standard", hint: "À l'adresse indiquée", icon: Truck, aside: "À confirmer" },
                  { value: "pickup", label: "Retrait magasin", hint: "Vous venez récupérer la commande", icon: Store, aside: "Gratuit" },
                ]}
              />
            )}

            <div className="space-y-2">
              <Label htmlFor="checkout-notes">Instructions pour la livraison</Label>
              <textarea
                id="checkout-notes"
                value={visibleForm.notes}
                onChange={(event) => updateField("notes", event.target.value)}
                rows={3}
                className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-3 text-sm outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              />
            </div>
          </CheckoutPanel>

          <CheckoutPanel
            step={4}
            icon={CreditCard}
            title="Paiement"
            description="Réglez en ligne maintenant ou à la réception."
            status={stepStatus(4)}
            summary=""
            error={stepError?.step === 4 ? stepError.message : null}>
            <TicketChoices
              legend="Mode de paiement"
              name="checkout-payment"
              value={paymentChoice}
              onChange={(value) =>
                updateField("paymentMethod", value as CheckoutForm["paymentMethod"])
              }
              options={[
                ...(stripeConfig?.enabled
                  ? [{
                      value: "card",
                      label: "Carte bancaire",
                      hint: "Paiement sécurisé par Stripe",
                      icon: CreditCard,
                      badge: stripeConfig.mode === "sandbox" ? "Mode test" : undefined,
                    }]
                  : []),
                { value: "bank", label: "Virement bancaire", hint: "Par virement à la commande", icon: Landmark },
              ]}
            />
            {paymentChoice === "card" && stripeConfig?.enabled ? (
              <p className="rounded-lg border border-dashed border-border bg-muted/50 px-4 py-3 text-sm! leading-6 text-muted-foreground">
                {stripeConfig.mode === "sandbox" ? (
                  <>
                    <strong className="font-semibold text-foreground">Mode test : aucun débit réel.</strong>{" "}
                    Utilisez la carte 4242 4242 4242 4242, une date d&apos;expiration future et un CVC au choix.
                  </>
                ) : (
                  "Vous serez redirigé vers la page de paiement sécurisée Stripe pour saisir votre carte."
                )}
              </p>
            ) : null}
          </CheckoutPanel>
          </div>
        </section>

        <aside className="lg:sticky lg:top-28 lg:self-start">
          <div className="rounded-t-[4px] border border-b-0 border-[var(--co-line)] bg-white">
            <div className="border-b border-dashed border-border p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-2xl! font-semibold!">Votre commande</h2>
                <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                  <PackageCheck className="size-4" aria-hidden="true" />
                  {items.reduce((sum, item) => sum + item.qty, 0)} article
                  {items.reduce((sum, item) => sum + item.qty, 0) > 1 ? "s" : ""}
                </span>
              </div>
            </div>

            <div className="max-h-[360px] space-y-4 overflow-y-auto p-5">
              {items.map((item) => {
                const image = item.image?.trim()
                  ? getImageUrl(item.image)
                  : null;
                const totalsForItem = itemTotals(item);

                return (
                  <div key={item.key} className="flex gap-3">
                    <div className="relative size-16 shrink-0 overflow-hidden rounded-md bg-muted">
                      {image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={image}
                          alt={item.title}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="grid h-full w-full place-items-center text-muted-foreground">
                          <ShoppingCart className="size-4" />
                        </div>
                      )}
                      <span className="absolute top-1 right-1 grid min-w-5 place-items-center rounded-full bg-foreground px-1.5 text-xs font-semibold text-background">
                        {item.qty}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm! font-semibold!">
                        {item.title}
                      </p>
                      {item.variantId ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Variante: {item.variantId}
                        </p>
                      ) : null}
                      <div className="mt-2 flex items-end justify-between gap-3">
                        <span className="text-xs text-muted-foreground">
                          {formatEuro(totalsForItem.unitHt)} HT
                        </span>
                        <span className="text-sm font-bold tabular-nums">
                          {formatEuro(totalsForItem.lineTtc)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="space-y-3 border-t border-dashed border-border p-5 text-sm">
              <SummaryRow label="Produits HT" value={formatEuro(totals.productsHt)} />
              <SummaryRow
                label="Produits TTC"
                value={formatEuro(totals.productsTtc)}
              />
              <SummaryRow
                label={
                  carrierMode
                    ? (chosenOption?.name ?? "Livraison")
                    : visibleForm.deliveryMethod === "pickup"
                      ? "Retrait magasin"
                      : "Livraison"
                }
                value={shippingPending ? "À confirmer" : formatEuro(totals.shipping)}
              />
              <div className="border-t border-border pt-4">
                <div className="flex items-baseline justify-between gap-4">
                  <span className="text-lg font-semibold">Total TTC</span>
                  <span className="text-4xl font-semibold leading-none tabular-nums text-[var(--co-ink)]">
                    {formatEuro(totals.subtotalTtc)}
                  </span>
                </div>
              </div>

              {submitError ? (
                <div
                  role="alert"
                  className="flex items-start gap-3 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  <span>{submitError}</span>
                </div>
              ) : (
                <p className="text-xs leading-5 text-muted-foreground">
                  Le total est affiché TTC, avec le détail HT pour contrôle.
                </p>
              )}

              <Button
                type="submit"
                disabled={isSubmitting || isRedirecting || (carrierMode && (quoteLoading || !chosenOption))}
                className="h-14 w-full rounded-[4px] bg-[#153675] text-lg font-medium text-white hover:bg-[#0f1f45] focus-visible:ring-[#153675]/40">
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    {isRedirecting ? "Redirection vers Stripe..." : "Confirmation..."}
                  </>
                ) : (
                  paymentChoice === "card" && stripeConfig?.enabled ? (
                    <>
                      <LockKeyhole className="size-4" aria-hidden="true" />
                      Payer {formatEuro(totals.subtotalTtc)}
                    </>
                  ) : (
                    "Confirmer la commande"
                  )
                )}
              </Button>

              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <CreditCard className="size-4" aria-hidden="true" />
                <span>Commande et données client protégées</span>
              </div>
            </div>
          </div>
          <div
            aria-hidden="true"
            className="h-2 w-full"
            style={{
              background:
                "radial-gradient(circle at 8px 0, #f2f5fa 5px, #fff 5.5px) 0 0 / 16px 8px repeat-x",
            }}
          />
        </aside>
      </form>
    </main>
  );
}

function buildOrderTotalsPayload(
  items: CartItem[],
  totals: {
    productsHt: number;
    productsTtc: number;
    shipping: number;
    subtotalTtc: number;
  },
): OrderTotalsPayload {
  const orderItems: OrderItemPayload[] = items.map((item) => {
    const totalsForItem = itemTotals(item);

    return {
      id: item.productId,
      title: item.title,
      slug: item.productSlug,
      image: item.image ?? undefined,
      variantId: item.variantId ?? undefined,
      quantity: Math.max(0, item.qty ?? 0),
      unitPrice: roundMoney(totalsForItem.unitTtc),
      totalPrice: roundMoney(totalsForItem.lineTtc),
      unitPriceHt: roundMoney(totalsForItem.unitHt),
      totalPriceHt: roundMoney(totalsForItem.lineHt),
      taxRate: rateToFraction(item.taxRate) * 100,
    };
  });

  return {
    items: orderItems,
    total: roundMoney(totals.subtotalTtc),
    unitPrice: roundMoney(totals.productsTtc),
    discount: 0,
    priceHT: roundMoney(totals.productsHt),
    tva: roundMoney(totals.productsTtc - totals.productsHt),
    priceTTC: roundMoney(totals.subtotalTtc),
    deliveryFee: roundMoney(totals.shipping),
  };
}

async function createAuthenticatedCheckoutOrder(
  token: string,
  form: CheckoutForm,
  payload: OrderTotalsPayload,
  savedAddressId?: string,
) {
  const addressId = savedAddressId ?? (await createClientAddress(token, {
      country: form.country.trim(),
      street: form.address.trim(),
      City: form.city.trim(),
      state: form.city.trim() || form.country.trim(),
      zipCode: form.postalCode.trim() || "-",
    })).id;

  return createAuthenticatedOrder(token, {
    ...payload,
    addressId,
  });
}

function formatAddress(form: CheckoutForm) {
  return [form.address, form.city, form.postalCode, form.country]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(", ");
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

/**
 * One step of the checkout. The open step shows its fields and a "Continuer" button; a confirmed step folds into a
 * summary row with a green check and a "Modifier" button; the steps still to come are greyed out.
 */
function CheckoutPanel({
  step,
  title,
  description,
  status,
  summary,
  error,
  onEdit,
  onContinue,
  children,
}: {
  step: number;
  icon?: typeof User;
  title: string;
  description: string;
  status: "done" | "open" | "locked";
  summary: string;
  error: string | null;
  onEdit?: () => void;
  onContinue?: () => void;
  children: React.ReactNode;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const previous = useRef(status);
  useEffect(() => {
    // Moving on or going back by the customer's own action: bring the step they are now working on into view.
    if (previous.current !== "open" && status === "open") {
      heading.current?.focus({ preventScroll: true });
      heading.current?.scrollIntoView({ block: "nearest", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    }
    previous.current = status;
  }, [status]);

  if (status === "done") {
    return (
      <section aria-labelledby={`checkout-step-${step}`} className="flex items-center gap-4 p-5 sm:px-7">
        <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full bg-[#153675] text-white">
          <Check className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id={`checkout-step-${step}`} ref={heading} tabIndex={-1} className="text-lg! font-bold! leading-tight outline-none">
            {title}
            <span className="sr-only"> : étape confirmée</span>
          </h2>
          {summary ? <p className="mt-0.5! truncate text-sm! text-muted-foreground">{summary}</p> : null}
        </div>
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium text-primary hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-ring"
          aria-label={`Modifier : ${title}`}>
          <Pencil className="size-4" aria-hidden="true" />
          Modifier
        </button>
      </section>
    );
  }

  if (status === "locked") {
    return (
      <section aria-labelledby={`checkout-step-${step}`} className="flex items-center gap-4 p-5 opacity-60 sm:px-7">
        <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center text-2xl font-bold tabular-nums text-muted-foreground">{step}</span>
        <h2 id={`checkout-step-${step}`} className="text-lg! font-bold! leading-tight text-muted-foreground">{title}</h2>
      </section>
    );
  }

  return (
    <section
      aria-labelledby={`checkout-step-${step}`}
      className="grid gap-5 p-5 sm:p-7 md:grid-cols-[3rem_minmax(0,1fr)]">
      <span
        aria-hidden="true"
        className="text-5xl font-semibold leading-none text-[#b4c2dc] tabular-nums">
        {step}
      </span>
      <div className="min-w-0">
        <h2 id={`checkout-step-${step}`} ref={heading} tabIndex={-1} className="text-2xl! font-bold! leading-tight outline-none">
          {title}
        </h2>
        <p className="mt-1! text-sm! leading-6 text-muted-foreground">{description}</p>
        <div className="mt-5 space-y-4">{children}</div>
        {error ? <p role="alert" className="mt-4! rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm! leading-6 text-destructive">{error}</p> : null}
        {onContinue ? (
          <div className="mt-5">
            <Button type="button" onClick={onContinue} className="h-12 rounded-[4px] bg-[#153675] px-8 text-base text-white hover:bg-[#0f1f45]">Continuer</Button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

type TicketOption = {
  value: string;
  label: string;
  hint: string;
  icon: typeof Truck;
  /** Logo shown in place of the icon. */
  image?: string;
  aside?: string;
  badge?: string;
};

/**
 * Selectable "tickets": a stub with an icon, a perforation, then the details.
 * The chosen ticket fills its stub and wears a "Choisi" tag. A native radio
 * stays in the DOM (visually hidden) for keyboard and screen-reader users.
 */
function TicketChoices({
  legend,
  name,
  value,
  onChange,
  options,
}: {
  legend: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  options: TicketOption[];
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-3 text-sm font-medium">{legend}</legend>
      <div className="grid gap-4 sm:grid-cols-2">
        {options.map((option) => {
          const selected = option.value === value;
          const id = `${name}-${option.value}`;
          const Icon = option.icon;
          return (
            <label
              key={option.value}
              htmlFor={id}
              className={cn(
                "relative grid min-h-[5.5rem] cursor-pointer grid-cols-[4.5rem_minmax(0,1fr)] rounded-xl border bg-background transition-[border-color,box-shadow] duration-200 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary motion-reduce:transition-none",
                selected
                  ? "border-primary shadow-md ring-1 ring-primary"
                  : "border-border hover:border-primary/50",
              )}>
              <input
                id={id}
                type="radio"
                name={name}
                value={option.value}
                checked={selected}
                onChange={() => onChange(option.value)}
                className="sr-only"
              />
              {selected ? (
                <span className="absolute -top-2.5 right-3 rounded-sm bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
                  Choisi
                </span>
              ) : null}
              <span
                aria-hidden="true"
                className={cn(
                  "grid place-items-center rounded-l-[11px] border-r border-dashed transition-colors duration-200 motion-reduce:transition-none",
                  selected
                    ? "border-primary-foreground/40 bg-primary text-primary-foreground"
                    : "border-border bg-muted text-muted-foreground",
                )}>
                {option.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={option.image} alt="" className="max-h-10 max-w-12 object-contain" />
                ) : (
                  <Icon className="size-7" strokeWidth={1.75} />
                )}
              </span>
              <span className="flex min-w-0 flex-col justify-center gap-1 px-4 py-3">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-base font-semibold leading-tight">{option.label}</span>
                  {option.badge ? (
                    <span className="rounded-sm bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-900">
                      {option.badge}
                    </span>
                  ) : null}
                </span>
                <span className="text-xs leading-5 text-muted-foreground">{option.hint}</span>
                {option.aside ? (
                  <span className="text-lg font-bold leading-none tabular-nums">{option.aside}</span>
                ) : null}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function SavedAddressPicker({
  addresses,
  selectedAddressId,
  onSelect,
  onCreate,
  onEdit,
  onDelete,
}: {
  addresses: CustomerAddress[];
  selectedAddressId: string;
  onSelect: (addressId: string) => void;
  onCreate: () => void;
  onEdit: (address: CustomerAddress) => void;
  onDelete: (addressId: string) => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-base! leading-6 text-[#5b6b8a]">
        L&apos;adresse choisie sert à la facturation et à la livraison.
      </p>

      <div role="radiogroup" aria-label="Adresses enregistrées" className="grid gap-4 md:grid-cols-2">
        {addresses.map((address) => (
          <SavedAddressCard
            key={address.id}
            address={address}
            isSelected={address.id === selectedAddressId}
            onSelect={() => onSelect(address.id)}
            onEdit={() => onEdit(address)}
            onDelete={() => onDelete(address.id)}
          />
        ))}

        <button
          type="button"
          onClick={onCreate}
          className="flex min-h-[170px] cursor-pointer flex-col items-center justify-center gap-2 rounded-[4px] border-2 border-dashed border-[#b4c2dc] bg-transparent px-4 py-6 text-base font-medium text-[#153675] transition-colors duration-200 hover:border-[#153675] hover:bg-[#f2f5fa] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#153675]">
          <Plus className="size-6" aria-hidden="true" />
          Ajouter une adresse
        </button>
      </div>
    </div>
  );
}

const ADDRESS_KIND_LABEL: Record<AddressKind, string> = {
  livraison: "Livraison",
  facturation: "Facturation",
  mixte: "Livraison et facturation",
};

/** A saved address, laid out like the label on a parcel. */
function SavedAddressCard({
  address,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
}: {
  address: CustomerAddress;
  isSelected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const inputId = `checkout-address-${address.id}`;
  const fullName = [address.firstName, address.lastName].filter(Boolean).join(" ");
  const cityLine = [address.postalCode, address.city].filter(Boolean).join(" ");
  const streetLines = [address.street, address.apartment].filter(Boolean);
  const title = address.label.trim() || "Mon adresse";

  return (
    <article
      className={cn(
        "relative flex flex-col rounded-[4px] bg-white transition-[border-color,box-shadow] duration-200 motion-reduce:transition-none has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[#153675]",
        isSelected
          ? "border-2 border-[#153675] shadow-[0_2px_0_rgba(15,31,69,0.12)]"
          : "border border-[#d5deee] hover:border-[#153675]/60",
      )}>
      {isSelected ? (
        <span className="absolute -top-2.5 right-3 rounded-[3px] bg-[#153675] px-2 py-0.5 text-xs font-medium text-white">
          Livraison ici
        </span>
      ) : null}

      <label htmlFor={inputId} className="flex flex-1 cursor-pointer items-start gap-3 px-4 pb-4 pt-4">
        <input
          id={inputId}
          type="radio"
          name="checkout-saved-address"
          checked={isSelected}
          onChange={onSelect}
          className="mt-1 size-5 shrink-0 accent-[#153675]"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="text-lg! font-semibold! leading-tight! text-[#0f1f45]">{title}</h3>
            {address.isDefault ? (
              <span className="rounded-[3px] bg-[#eef2f9] px-2 py-0.5 text-xs font-medium text-[#153675]">
                Par défaut
              </span>
            ) : null}
          </div>
          <p className="mt-0.5! text-sm! text-[#5b6b8a]">{ADDRESS_KIND_LABEL[address.kind] ?? ADDRESS_KIND_LABEL.mixte}</p>

          <address className="mt-3 space-y-0.5 text-[15px] not-italic leading-snug text-[#0f1f45]">
            {fullName ? <p className="font-medium">{fullName}</p> : null}
            {address.company ? <p>{address.company}</p> : null}
            {streetLines.map((line) => (
              <p key={line}>{line}</p>
            ))}
            {cityLine ? <p>{cityLine}</p> : null}
            {address.country ? <p>{address.country}</p> : null}
          </address>

          {address.phone ? (
            <p className="mt-3 flex items-center gap-2 text-sm text-[#5b6b8a]">
              <Phone className="size-4 shrink-0" aria-hidden="true" />
              <span className="tabular-nums">{address.phone}</span>
            </p>
          ) : null}
        </div>
      </label>

      <div className="flex items-center gap-2 border-t border-dashed border-[#b4c2dc] px-2 py-1">
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Modifier l’adresse ${title}`}
          className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded px-3 text-sm font-medium text-[#153675] transition-colors duration-200 hover:bg-[#f2f5fa] focus-visible:outline focus-visible:outline-2">
          <Pencil className="size-4" aria-hidden="true" />
          Modifier
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Supprimer l’adresse ${title}`}
          className="ml-auto inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded px-3 text-sm font-medium text-[#5b6b8a] transition-colors duration-200 hover:bg-[#fdecee] hover:text-[#d6202e] focus-visible:outline focus-visible:outline-2">
          <Trash2 className="size-4" aria-hidden="true" />
          Supprimer
        </button>
      </div>
    </article>
  );
}

function CheckoutAddressEditor({
  mode,
  form,
  error,
  saving,
  onFieldChange,
  onSave,
  onCancel,
}: {
  mode: "create" | "edit";
  form: CheckoutAddressForm;
  error: string | null;
  saving: boolean;
  onFieldChange: <K extends keyof CheckoutAddressForm>(
    key: K,
    value: CheckoutAddressForm[K],
  ) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="rounded-[4px] border-2 border-dashed border-[#b4c2dc] bg-white p-4 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-xl! font-semibold! leading-tight! text-[#0f1f45]">
            {mode === "edit" ? "Modifier l’adresse" : "Nouvelle adresse"}
          </h3>
          <p className="mt-1! text-sm! text-[#5b6b8a]">
            {mode === "edit"
              ? "Corrigez les champs puis enregistrez."
              : "Elle sera enregistrée dans votre compte."}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onCancel}
          aria-label="Fermer l’éditeur d’adresse">
          <X className="size-4" />
        </Button>
      </div>

      {error ? (
        <div
          role="alert"
          className="mt-4 flex items-start gap-3 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="mt-5 grid gap-4">
        <div className="grid gap-4 sm:grid-cols-[1fr_210px]">
          <TextField
            id="checkout-address-label"
            label="Nom de l'adresse"
            value={form.label}
            onChange={(value) => onFieldChange("label", value)}
            icon={Home}
            required
          />
          <div className="space-y-2">
            <Label htmlFor="checkout-address-kind">Usage</Label>
            <Select
              value={form.kind}
              onValueChange={(value) =>
                onFieldChange("kind", value as AddressKind)
              }>
              <SelectTrigger id="checkout-address-kind" className="h-12 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="livraison">Livraison</SelectItem>
                <SelectItem value="facturation">Facturation</SelectItem>
                <SelectItem value="mixte">Livraison et facturation</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            id="checkout-address-first-name"
            label="Prénom"
            value={form.firstName}
            onChange={(value) => onFieldChange("firstName", value)}
            autoComplete="given-name"
            required
          />
          <TextField
            id="checkout-address-last-name"
            label="Nom"
            value={form.lastName}
            onChange={(value) => onFieldChange("lastName", value)}
            autoComplete="family-name"
            required
          />
        </div>

        <TextField
          id="checkout-address-street"
          label="Adresse"
          value={form.street}
          onChange={(value) => onFieldChange("street", value)}
          autoComplete="street-address"
          icon={MapPin}
          required
        />
        <TextField
          id="checkout-address-apartment"
          label="Appartement, bâtiment, détails (facultatif)"
          value={form.apartment}
          onChange={(value) => onFieldChange("apartment", value)}
          autoComplete="address-line2"
          icon={DoorOpen}
        />

        <div className="grid gap-4 sm:grid-cols-[1fr_150px_170px]">
          <TextField
            id="checkout-address-city"
            label="Ville"
            value={form.city}
            onChange={(value) => onFieldChange("city", value)}
            autoComplete="address-level2"
            icon={Building2}
            required
          />
          <TextField
            id="checkout-address-postal"
            label="Code postal"
            value={form.postalCode}
            onChange={(value) => onFieldChange("postalCode", value)}
            autoComplete="postal-code"
            icon={Hash}
          />
          <CountrySelect
            id="checkout-address-country"
            value={form.country}
            onChange={(value) => onFieldChange("country", value)}
          />
        </div>

        <label
          htmlFor="checkout-address-default"
          className="flex min-h-12 cursor-pointer items-center gap-3 rounded-[4px] border border-[#d5deee] bg-[#f2f5fa] px-3 py-2 text-[15px] font-medium text-[#0f1f45]">
          <input
            id="checkout-address-default"
            type="checkbox"
            checked={form.isDefault}
            onChange={(event) =>
              onFieldChange("isDefault", event.target.checked)
            }
            className="size-5 accent-[#153675]"
          />
          Utiliser comme adresse par défaut
        </label>
      </div>

      <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel} className="h-12 rounded-[4px] px-6 text-base">
          Annuler
        </Button>
        <Button type="button" onClick={onSave} disabled={saving} className="h-12 rounded-[4px] bg-[#153675] px-6 text-base text-white hover:bg-[#0f1f45]">
          <Save className="size-4" aria-hidden="true" />
          {saving ? "Enregistrement…" : "Enregistrer l’adresse"}
        </Button>
      </div>
    </div>
  );
}

function ManualAddressFields({
  form,
  onFieldChange,
  onCreateAddress,
  showAddressBookActions,
}: {
  form: CheckoutForm;
  onFieldChange: <K extends keyof CheckoutForm>(
    key: K,
    value: CheckoutForm[K],
  ) => void;
  onCreateAddress: () => void;
  showAddressBookActions: boolean;
}) {
  return (
    <div className="grid gap-4">
      {showAddressBookActions ? (
        <div className="flex flex-col gap-3 rounded-md border border-dashed border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>Aucune adresse enregistrée pour ce compte.</span>
          <button
            type="button"
            onClick={onCreateAddress}
            className="inline-flex min-h-10 items-center gap-2 text-left font-semibold text-primary hover:underline">
            <Plus className="size-4" />
            Ajouter une adresse
          </button>
        </div>
      ) : null}
      <TextField
        id="checkout-address"
        label="Adresse"
        value={form.address}
        onChange={(value) => onFieldChange("address", value)}
        autoComplete="street-address"
        icon={MapPin}
        required
      />
      <div className="grid gap-4 sm:grid-cols-[1fr_150px_160px]">
        <TextField
          id="checkout-city"
          label="Ville"
          value={form.city}
          onChange={(value) => onFieldChange("city", value)}
          autoComplete="address-level2"
          icon={Building2}
          required
        />
        <TextField
          id="checkout-postal"
          label="Code postal"
          value={form.postalCode}
          onChange={(value) => onFieldChange("postalCode", value)}
          autoComplete="postal-code"
          icon={Hash}
        />
        <CountrySelect
          id="checkout-country"
          value={form.country}
          onChange={(value) => onFieldChange("country", value)}
        />
      </div>
    </div>
  );
}

function TextField({
  id,
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
  icon: Icon = User,
  required = false,
  minLength,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  autoComplete?: string;
  icon?: typeof User;
  required?: boolean;
  minLength?: number;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label}
        {required ? <span className="text-destructive">*</span> : null}
      </Label>
      <div className="relative">
        <Icon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={id}
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          minLength={minLength}
          required={required}
          className={cn("h-12 pl-10", type === "date" && "pr-3")}
        />
      </div>
    </div>
  );
}

function CountrySelect({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const listboxId = `${id}-listbox`;
  const options =
    value && !countryOptions.some((country) => country.name === value)
      ? [{ code: "custom", name: value }, ...countryOptions]
      : countryOptions;
  const normalizedQuery = query.trim().toLocaleLowerCase("fr");
  const filteredOptions = normalizedQuery
    ? options.filter((country) =>
        country.name.toLocaleLowerCase("fr").includes(normalizedQuery),
      )
    : options;

  function selectCountry(countryName: string) {
    onChange(countryName);
    setQuery("");
    setActiveIndex(0);
    setIsOpen(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((current) =>
        filteredOptions.length === 0
          ? 0
          : Math.min(current + 1, filteredOptions.length - 1),
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
      return;
    }

    if (event.key === "Enter" && isOpen && filteredOptions[activeIndex]) {
      event.preventDefault();
      selectCountry(filteredOptions[activeIndex].name);
      return;
    }

    if (event.key === "Escape") {
      setIsOpen(false);
      setQuery("");
      setActiveIndex(0);
    }
  }

  return (
    <div
      className="relative space-y-2"
      onBlur={(event) => {
        const nextFocus =
          event.relatedTarget instanceof Node ? event.relatedTarget : null;

        if (!nextFocus || !event.currentTarget.contains(nextFocus)) {
          setIsOpen(false);
          setQuery("");
          setActiveIndex(0);
        }
      }}>
      <Label htmlFor={id}>
        Pays
        <span className="text-destructive">*</span>
      </Label>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={id}
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-expanded={isOpen}
          aria-required
          autoComplete="country-name"
          value={isOpen ? query : value}
          onFocus={() => {
            setIsOpen(true);
            setQuery("");
            setActiveIndex(0);
          }}
          onChange={(event) => {
            setQuery(event.target.value);
            setIsOpen(true);
            setActiveIndex(0);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Rechercher un pays"
          required
          className="h-12 pr-10 pl-10"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            setIsOpen((open) => !open);
            setQuery("");
            setActiveIndex(0);
          }}
          aria-label={
            isOpen ? "Fermer la liste des pays" : "Ouvrir la liste des pays"
          }>
          <ChevronDown
            className={
              isOpen
                ? "size-4 rotate-180 transition-transform"
                : "size-4 transition-transform"
            }
          />
        </Button>
      </div>

      {isOpen ? (
        <div
          id={listboxId}
          role="listbox"
          className="absolute z-50 mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-border bg-background p-1 shadow-lg">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((country, index) => {
              const isSelected = country.name === value;
              const isActive = index === activeIndex;

              return (
                <button
                  key={country.code}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={cn(
                    "flex min-h-10 w-full items-center justify-between gap-3 rounded-sm px-3 py-2 text-left text-sm text-foreground",
                    isActive
                      ? "bg-primary/10"
                      : "hover:bg-primary/5",
                  )}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => selectCountry(country.name)}>
                  <span>{country.name}</span>
                  {isSelected ? <Check className="size-4 text-primary" /> : null}
                </button>
              );
            })
          ) : (
            <div className="px-3 py-4 text-sm text-muted-foreground">
              Aucun pays trouve.
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );
}
