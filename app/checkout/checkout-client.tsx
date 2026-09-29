"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { KeyboardEvent } from "react";
import countries from "world-countries";
import {
  AlertCircle,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  CreditCard,
  Fingerprint,
  Home,
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
  getClientSession,
  saveClientSession,
  subscribeToClientSession,
  type ClientSession,
} from "@/lib/client-auth";
import { useCartStore, type CartItem } from "@/lib/stores/cart-store";
import { cn } from "@/lib/utils";

const SHIPPING_PRICE = 8;

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
  paymentMethod: "cash" | "bank";
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
  paymentMethod: "cash",
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

  const totals = useMemo(() => {
    const productsTtc = items.reduce(
      (sum, item) => sum + itemTotals(item).lineTtc,
      0,
    );
    const productsHt = items.reduce(
      (sum, item) => sum + itemTotals(item).lineHt,
      0,
    );
    const shipping =
      items.length > 0 && visibleForm.deliveryMethod === "standard"
        ? SHIPPING_PRICE
        : 0;

    return {
      productsHt,
      productsTtc,
      shipping,
      subtotalTtc: items.length > 0 ? productsTtc + shipping : 0,
    };
  }, [items, visibleForm.deliveryMethod]);

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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (items.length === 0) return;

    const currentForm = selectedAddress
      ? checkoutFormWithAddress(visibleForm, selectedAddress)
      : visibleForm;
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const payload = buildOrderTotalsPayload(items, totals);
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

      setCompletedOrderId(order.id);
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
      <main className="min-h-[calc(100dvh-5rem)] bg-muted px-4 py-12">
        <div className="mx-auto flex max-w-xl flex-col items-center rounded-lg border border-border bg-background px-6 py-12 text-center shadow-sm">
          <div className="grid size-14 place-items-center rounded-full bg-primary/10 text-primary">
            <CheckCircle2 className="size-7" />
          </div>
          <h1 className="mt-5 text-2xl font-bold text-foreground">
            Commande confirmee
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Votre commande a ete enregistree avec succes.
          </p>
          <p className="mt-4 rounded-md bg-muted px-4 py-2 text-sm font-semibold text-foreground">
            Reference: {completedOrderId}
          </p>
          {accountCreationNotice ? (
            <p className="mt-4 max-w-md text-sm leading-6 text-muted-foreground">
              {accountCreationNotice}
            </p>
          ) : null}
          <Button asChild className="mt-6 bg-destructive hover:bg-destructive/90">
            <Link href="/">Continuer mes achats</Link>
          </Button>
        </div>
      </main>
    );
  }

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
    <main className="min-h-[calc(100dvh-5rem)] bg-muted text-foreground">
      <form
        onSubmit={handleSubmit}
        className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_390px] lg:px-8">
        <section className="min-w-0 space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-normal text-destructive">
                Paiement securise
              </p>
              <h1 className="mt-2 text-3xl font-bold tracking-normal sm:text-4xl">
                Finaliser la commande
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                Verifiez vos coordonnees, choisissez le mode de livraison et
                confirmez votre demande.
              </p>
            </div>
            <Link
              href="/cart"
              className="inline-flex min-h-11 items-center rounded-md border border-border bg-background px-4 text-sm font-semibold hover:border-primary hover:text-primary">
              Retour au panier
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

          <CheckoutPanel
            icon={User}
            title="Informations client"
            description="Ces details seront utilises pour vous contacter au sujet de la commande.">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                id="checkout-first-name"
                label="Prenom"
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
                label="Telephone"
                type="tel"
                value={visibleForm.phone}
                onChange={(value) => updateField("phone", value)}
                autoComplete="tel"
                icon={Phone}
                required
              />
              <TextField
                id="checkout-client-company"
                label="Societe"
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
                  label="Mot de passe pour creer votre compte"
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
            icon={MapPin}
            title="Adresse de livraison"
            description="Indiquez l'adresse ou vous souhaitez recevoir la commande.">
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
            icon={Truck}
            title="Livraison et paiement"
            description="Choisissez comment recevoir et regler votre commande.">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="checkout-delivery">Mode de livraison</Label>
                <Select
                  value={visibleForm.deliveryMethod}
                  onValueChange={(value) =>
                    updateField(
                      "deliveryMethod",
                      value as CheckoutForm["deliveryMethod"],
                    )
                  }>
                  <SelectTrigger id="checkout-delivery" className="h-12 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">
                      Livraison standard
                    </SelectItem>
                    <SelectItem value="pickup">Retrait magasin</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="checkout-payment">Mode de paiement</Label>
                <Select
                  value={visibleForm.paymentMethod}
                  onValueChange={(value) =>
                    updateField(
                      "paymentMethod",
                      value as CheckoutForm["paymentMethod"],
                    )
                  }>
                  <SelectTrigger id="checkout-payment" className="h-12 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Paiement a la livraison</SelectItem>
                    <SelectItem value="bank">Virement bancaire</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="checkout-notes">Instructions speciales</Label>
              <textarea
                id="checkout-notes"
                value={visibleForm.notes}
                onChange={(event) => updateField("notes", event.target.value)}
                rows={4}
                className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-3 text-sm outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              />
            </div>
          </CheckoutPanel>
        </section>

        <aside className="lg:sticky lg:top-28 lg:self-start">
          <div className="rounded-lg border border-border bg-background shadow-sm">
            <div className="border-b border-border p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-muted-foreground">
                    Resume
                  </p>
                  <h2 className="text-xl font-bold">Votre commande</h2>
                </div>
                <div className="grid size-10 place-items-center rounded-full bg-primary/10 text-primary">
                  <PackageCheck className="size-5" />
                </div>
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
                      <p className="line-clamp-2 text-sm font-semibold">
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
                        <span className="text-sm font-bold text-destructive">
                          {formatEuro(totalsForItem.lineTtc)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="space-y-3 border-t border-border p-5 text-sm">
              <SummaryRow label="Produits HT" value={formatEuro(totals.productsHt)} />
              <SummaryRow
                label="Produits TTC"
                value={formatEuro(totals.productsTtc)}
              />
              <SummaryRow
                label={
                  visibleForm.deliveryMethod === "pickup"
                  ? "Retrait magasin"
                    : "Livraison"
                }
                value={formatEuro(totals.shipping)}
              />
              <div className="border-t border-border pt-4">
                <div className="flex items-baseline justify-between gap-4">
                  <span className="font-bold uppercase tracking-normal text-muted-foreground">
                    Sous-total TTC
                  </span>
                  <span className="text-2xl font-bold text-foreground">
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
                <div className="flex items-start gap-3 rounded-md border border-border bg-muted px-4 py-3 text-xs text-muted-foreground">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  <span>
                    Le total est toujours affiche en TTC, avec le detail HT pour
                    controle.
                  </span>
                </div>
              )}

              <Button
                type="submit"
                disabled={isSubmitting}
                className="h-12 w-full bg-destructive text-sm font-bold uppercase tracking-normal hover:bg-destructive/90">
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Confirmation...
                  </>
                ) : (
                  "Confirmer la commande"
                )}
              </Button>

              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <CreditCard className="size-4" />
                <span>Commande et donnees client protegees</span>
              </div>
            </div>
          </div>
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

function CheckoutPanel({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof User;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-background p-5 shadow-sm sm:p-6">
      <div className="mb-5 flex items-start gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
          <Icon className="size-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        </div>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
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
    <div className="space-y-5">
      <div className="rounded-md border border-border bg-muted/40 px-4 py-3 text-sm leading-6 text-muted-foreground">
        L&apos;adresse selectionnee sera utilisee pour la facturation et la
        livraison.
      </div>

      <div className="grid gap-4 md:grid-cols-2">
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
      </div>

      <Button
        type="button"
        variant="ghost"
        className="h-10 justify-start px-0 text-sm font-semibold text-foreground hover:bg-transparent hover:text-primary"
        onClick={onCreate}>
        <Plus className="size-4" />
        Ajouter une nouvelle adresse
      </Button>
    </div>
  );
}

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
  const lines = [
    address.company,
    address.street,
    address.apartment,
    [address.postalCode, address.city].filter(Boolean).join(" "),
    address.country,
    address.phone,
  ].filter(Boolean);

  return (
    <article
      className={cn(
        "flex min-h-[210px] flex-col border bg-[#f4f4f4] transition-[border-color,box-shadow,background-color]",
        isSelected
          ? "border-2 border-destructive bg-background shadow-sm"
          : "border border-transparent hover:border-border",
      )}>
      <label
        htmlFor={inputId}
        className="flex flex-1 cursor-pointer items-start gap-3 px-4 pt-4 pb-5">
        <input
          id={inputId}
          type="radio"
          name="checkout-saved-address"
          checked={isSelected}
          onChange={onSelect}
          className="mt-1 size-5 accent-destructive"
        />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-bold text-foreground">
              {address.label.trim() || "Mon adresse"}
            </h3>
            {address.isDefault ? (
              <span className="rounded-sm bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                Defaut
              </span>
            ) : null}
          </div>
          <div className="mt-2 space-y-0.5 text-sm leading-5 text-foreground">
            {fullName ? <p>{fullName}</p> : null}
            {lines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        </div>
        <Home className="ml-auto hidden size-5 shrink-0 text-muted-foreground sm:block" />
      </label>

      <div className="mt-auto flex min-h-11 items-center justify-center gap-6 border-t border-border px-4 py-2 text-sm">
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex min-h-10 items-center gap-1.5 font-medium text-foreground hover:text-primary hover:underline">
          <Pencil className="size-4" />
          Modifier
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="inline-flex min-h-10 items-center gap-1.5 font-medium text-foreground hover:text-destructive hover:underline">
          <Trash2 className="size-4" />
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
    <div className="rounded-lg border border-primary/20 bg-background p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase text-primary">
            {mode === "edit" ? "Modifier l'adresse" : "Nouvelle adresse"}
          </p>
          <h3 className="mt-1 text-lg font-bold text-foreground">
            {mode === "edit"
              ? "Mettre a jour l'adresse"
              : "Ajouter une adresse de livraison"}
          </h3>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onCancel}
          aria-label="Fermer l'editeur d'adresse">
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
            label="Prenom"
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
          label="Appartement, batiment, details"
          value={form.apartment}
          onChange={(value) => onFieldChange("apartment", value)}
          autoComplete="address-line2"
          icon={MapPin}
        />

        <div className="grid gap-4 sm:grid-cols-[1fr_150px_170px]">
          <TextField
            id="checkout-address-city"
            label="Ville"
            value={form.city}
            onChange={(value) => onFieldChange("city", value)}
            autoComplete="address-level2"
            required
          />
          <TextField
            id="checkout-address-postal"
            label="Code postal"
            value={form.postalCode}
            onChange={(value) => onFieldChange("postalCode", value)}
            autoComplete="postal-code"
          />
          <CountrySelect
            id="checkout-address-country"
            value={form.country}
            onChange={(value) => onFieldChange("country", value)}
          />
        </div>

        <label
          htmlFor="checkout-address-default"
          className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm font-medium">
          <input
            id="checkout-address-default"
            type="checkbox"
            checked={form.isDefault}
            onChange={(event) =>
              onFieldChange("isDefault", event.target.checked)
            }
            className="size-4 accent-primary"
          />
          Utiliser comme adresse par defaut
        </label>
      </div>

      <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel}>
          Annuler
        </Button>
        <Button type="button" onClick={onSave} disabled={saving}>
          <Save className="size-4" />
          {saving ? "Enregistrement..." : "Enregistrer l&apos;adresse"}
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
          <span>Aucune adresse enregistree pour ce compte.</span>
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
          required
        />
        <TextField
          id="checkout-postal"
          label="Code postal"
          value={form.postalCode}
          onChange={(value) => onFieldChange("postalCode", value)}
          autoComplete="postal-code"
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
