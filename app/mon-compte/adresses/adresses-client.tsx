"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState, useSyncExternalStore } from "react";
import type { ComponentType, KeyboardEvent, ReactNode, SVGProps } from "react";
import countries from "world-countries";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Check,
  ChevronDown,
  Home,
  Mailbox,
  MapPin,
  Pencil,
  Plus,
  Save,
  Search,
  Star,
  Trash2,
  User,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getClientSession,
  subscribeToClientSession,
  type ClientSession,
} from "@/lib/client-auth";

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

type AddressFormState = Omit<CustomerAddress, "id" | "createdAt" | "updatedAt">;

const countryOptions = countries
  .map((country) => ({
    code: country.cca2,
    name: country.translations.fra?.common ?? country.name.common,
  }))
  .filter((country) => country.code && country.name)
  .sort((a, b) => a.name.localeCompare(b.name, "fr"));

const EMPTY_FORM: AddressFormState = {
  label: "",
  kind: "livraison",
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

const ADDRESS_STORAGE_EVENT = "fgmc-account-addresses-change";

let cachedSession: ClientSession | null = null;
let cachedSessionKey = "";

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

function storageKey(session: ClientSession | null) {
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
  window.localStorage.setItem(key, JSON.stringify(addresses));
  window.dispatchEvent(new Event(ADDRESS_STORAGE_EVENT));
}

function isCustomerAddress(value: unknown): value is CustomerAddress {
  if (!value || typeof value !== "object") return false;
  const address = value as Partial<CustomerAddress>;
  return (
    typeof address.id === "string" &&
    typeof address.label === "string" &&
    typeof address.street === "string" &&
    typeof address.city === "string" &&
    typeof address.country === "string"
  );
}

function formFromSession(session: ClientSession | null): AddressFormState {
  return {
    ...EMPTY_FORM,
    firstName: session?.user?.firstName ?? "",
    lastName: session?.user?.lastName ?? "",
    label: "Adresse principale",
  };
}

function formFromAddress(address: CustomerAddress): AddressFormState {
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

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
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

export function AdressesClient() {
  const session = useSyncExternalStore(
    subscribeToClientSession,
    getClientSessionSnapshot,
    getServerSessionSnapshot,
  );
  const currentStorageKey = storageKey(session);
  const rawAddresses = useSyncExternalStore(
    (onStoreChange) => subscribeAddressStorage(currentStorageKey, onStoreChange),
    () => getAddressStorageSnapshot(currentStorageKey),
    getServerAddressStorageSnapshot,
  );
  const [form, setForm] = useState<AddressFormState>(() =>
    formFromSession(getClientSessionSnapshot()),
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const addresses = useMemo(() => {
    return parseAddresses(rawAddresses);
  }, [rawAddresses]);

  function persist(nextAddresses: CustomerAddress[]) {
    const normalized = normalizeAddresses(nextAddresses);
    writeAddresses(currentStorageKey, normalized);
  }

  function updateField<K extends keyof AddressFormState>(
    key: K,
    value: AddressFormState[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
    setError(null);
    setSuccess(null);
  }

  function startCreate() {
    setForm({
      ...formFromSession(session),
      isDefault: addresses.length === 0,
    });
    setEditingId(null);
    setIsFormOpen(true);
    setDeleteId(null);
    setError(null);
    setSuccess(null);
  }

  function startEdit(address: CustomerAddress) {
    setForm(formFromAddress(address));
    setEditingId(address.id);
    setIsFormOpen(true);
    setDeleteId(null);
    setError(null);
    setSuccess(null);
  }

  function cancelForm() {
    setForm(formFromSession(session));
    setEditingId(null);
    setIsFormOpen(false);
    setError(null);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!form.firstName.trim() || !form.lastName.trim()) {
      setError("Le prenom et le nom sont obligatoires.");
      return;
    }

    if (!form.street.trim() || !form.city.trim() || !form.country.trim()) {
      setError("L'adresse, la ville et le pays sont obligatoires.");
      return;
    }

    const now = new Date().toISOString();
    const cleanForm = {
      ...form,
      label: form.label.trim() || "Adresse",
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      company: form.company.trim(),
      phone: form.phone.trim(),
      street: form.street.trim(),
      apartment: form.apartment.trim(),
      city: form.city.trim(),
      postalCode: form.postalCode.trim(),
      country: form.country.trim(),
    };

    if (editingId) {
      persist(
        addresses.map((address) =>
          address.id === editingId
            ? { ...address, ...cleanForm, updatedAt: now }
            : cleanForm.isDefault
              ? { ...address, isDefault: false }
              : address,
        ),
      );
      setSuccess("Adresse mise a jour.");
    } else {
      const nextAddress: CustomerAddress = {
        id: createId(),
        ...cleanForm,
        isDefault: cleanForm.isDefault || addresses.length === 0,
        createdAt: now,
        updatedAt: now,
      };
      persist(
        nextAddress.isDefault
          ? addresses.map((address) => ({ ...address, isDefault: false })).concat(nextAddress)
          : addresses.concat(nextAddress),
      );
      setSuccess("Adresse ajoutee.");
    }

    setForm(formFromSession(session));
    setEditingId(null);
    setIsFormOpen(false);
  }

  function handleSetDefault(id: string) {
    persist(
      addresses.map((address) => ({
        ...address,
        isDefault: address.id === id,
      })),
    );
    setSuccess("Adresse par defaut mise a jour.");
  }

  function handleDelete(id: string) {
    const nextAddresses = addresses.filter((address) => address.id !== id);
    persist(nextAddresses);
    setDeleteId(null);
    setSuccess("Adresse supprimee.");
    if (editingId === id) {
      cancelForm();
    }
  }

  return (
    <main className="min-h-screen bg-[#f5f6f8] text-[#172033]">
      <div className="border-t-2 border-destructive bg-[#ededed]">
        <nav
          aria-label="Fil d'Ariane"
          className="mx-auto flex min-h-11 w-full max-w-[1320px] flex-wrap items-center gap-2 px-4 text-sm text-[#172033] sm:px-8">
          <Link href="/" className="hover:text-primary hover:underline">
            Accueil
          </Link>
          <BreadcrumbSeparator />
          <Link href="/mon-compte" className="hover:text-primary hover:underline">
            Mon compte
          </Link>
          <BreadcrumbSeparator />
          <span aria-current="page">Adresses</span>
        </nav>
      </div>

      <section className="mx-auto w-full max-w-[1320px] px-4 pt-6 pb-16 sm:px-8">
        <Link
          href="/mon-compte"
          className="inline-flex min-h-10 items-center gap-2 rounded-md text-sm font-semibold text-primary hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
          <ArrowLeft className="size-4" />
          Retour a mon compte
        </Link>

        <div className="mt-4 overflow-hidden rounded-md border border-border bg-white shadow-[0_12px_28px_rgba(16,24,40,0.08)]">
          <div className="border-b border-border bg-linear-to-r from-primary/10 via-white to-destructive/10 px-5 py-6 sm:px-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase text-primary">
                  Carnet d&apos;adresses
                </p>
                <h1 className="mt-2 text-2xl font-bold text-[#101828] sm:text-3xl">
                  Mes adresses
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[#667085]">
                  Ajoutez et organisez vos adresses de livraison et de
                  facturation pour commander plus rapidement.
                </p>
              </div>
              <Button
                type="button"
                className="h-11 px-5 font-semibold"
                onClick={startCreate}>
                <Plus className="size-4" />
                Ajouter une adresse
              </Button>
            </div>
          </div>

          <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_420px] lg:p-8">
            <section className="min-w-0">
              {error ? (
                <StatusMessage tone="error" icon={AlertCircle}>
                  {error}
                </StatusMessage>
              ) : null}

              {success ? (
                <StatusMessage tone="success" icon={CheckCircle2}>
                  {success}
                </StatusMessage>
              ) : null}

              {!session ? (
                <div className="mb-4">
                  <StatusMessage tone="error" icon={AlertCircle}>
                    Vous n&apos;etes pas connecte. Les adresses sont conservees
                    localement sur ce navigateur.
                  </StatusMessage>
                </div>
              ) : null}

              {addresses.length === 0 ? (
                <EmptyState onCreate={startCreate} />
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {addresses.map((address) => (
                    <AddressCard
                      key={address.id}
                      address={address}
                      isConfirmingDelete={deleteId === address.id}
                      onEdit={() => startEdit(address)}
                      onSetDefault={() => handleSetDefault(address.id)}
                      onAskDelete={() => setDeleteId(address.id)}
                      onCancelDelete={() => setDeleteId(null)}
                      onConfirmDelete={() => handleDelete(address.id)}
                    />
                  ))}
                </div>
              )}
            </section>

            <aside className="min-w-0">
              <div className="sticky top-28 rounded-md border border-[#d8dde6] bg-[#fbfcfe] p-5">
                <div className="mb-5 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase text-primary">
                      {editingId ? "Modifier" : "Nouvelle adresse"}
                    </p>
                    <h2 className="mt-1 text-lg font-bold text-[#101828]">
                      {editingId ? "Modifier l'adresse" : "Ajouter une adresse"}
                    </h2>
                  </div>
                  {isFormOpen ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={cancelForm}
                      aria-label="Fermer le formulaire">
                      <X className="size-4" />
                    </Button>
                  ) : null}
                </div>

                {isFormOpen ? (
                  <AddressForm
                    form={form}
                    editingId={editingId}
                    onSubmit={handleSubmit}
                    onCancel={cancelForm}
                    onFieldChange={updateField}
                  />
                ) : (
                  <div className="rounded-md border border-dashed border-[#c8d0dc] bg-white p-5 text-sm leading-6 text-[#667085]">
                    Selectionnez une adresse a modifier ou ajoutez une nouvelle
                    adresse a votre carnet.
                  </div>
                )}
              </div>
            </aside>
          </div>
        </div>
      </section>
    </main>
  );
}

function BreadcrumbSeparator() {
  return (
    <span aria-hidden className="text-[#667085]">
      /
    </span>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center rounded-md border border-dashed border-[#c8d0dc] bg-[#fbfcfe] px-6 py-12 text-center">
      <div className="grid size-14 place-items-center rounded-md bg-primary/10 text-primary">
        <MapPin className="size-7" />
      </div>
      <h2 className="mt-5 text-xl font-bold text-[#101828]">
        Aucune adresse enregistree
      </h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-[#667085]">
        Ajoutez votre premiere adresse pour accelerer vos prochaines commandes.
      </p>
      <Button type="button" className="mt-6 h-11 px-5" onClick={onCreate}>
        <Plus className="size-4" />
        Ajouter une adresse
      </Button>
    </div>
  );
}

function AddressCard({
  address,
  isConfirmingDelete,
  onEdit,
  onSetDefault,
  onAskDelete,
  onCancelDelete,
  onConfirmDelete,
}: {
  address: CustomerAddress;
  isConfirmingDelete: boolean;
  onEdit: () => void;
  onSetDefault: () => void;
  onAskDelete: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
}) {
  const fullName = [address.firstName, address.lastName].filter(Boolean).join(" ");
  const lines = [
    address.street,
    address.apartment,
    [address.postalCode, address.city].filter(Boolean).join(" "),
    address.country,
  ].filter(Boolean);

  return (
    <article className="rounded-md border border-[#d8dde6] bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-bold text-[#101828]">{address.label}</h3>
            {address.isDefault ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
                <Star className="size-3 fill-current" />
                Defaut
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-xs font-bold uppercase text-[#667085]">
            {kindLabel(address.kind)}
          </p>
        </div>
        <div className="grid size-10 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
          <Home className="size-5" />
        </div>
      </div>

      <div className="mt-4 space-y-1 text-sm leading-6 text-[#344054]">
        <p className="font-semibold text-[#172033]">{fullName}</p>
        {lines.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>

      {isConfirmingDelete ? (
        <div className="mt-5 rounded-md border border-destructive/30 bg-destructive/10 p-3">
          <p className="text-sm font-medium text-destructive">
            Supprimer cette adresse ?
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={onConfirmDelete}>
              Supprimer
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={onCancelDelete}>
              Annuler
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-5 flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onEdit}>
            <Pencil className="size-4" />
            Modifier
          </Button>
          {!address.isDefault ? (
            <Button type="button" variant="outline" size="sm" onClick={onSetDefault}>
              <Star className="size-4" />
              Definir par defaut
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={onAskDelete}>
            <Trash2 className="size-4" />
            Supprimer
          </Button>
        </div>
      )}
    </article>
  );
}

function AddressForm({
  form,
  editingId,
  onSubmit,
  onCancel,
  onFieldChange,
}: {
  form: AddressFormState;
  editingId: string | null;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
  onFieldChange: <K extends keyof AddressFormState>(
    key: K,
    value: AddressFormState[K],
  ) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <TextField
        id="address-label"
        label="Nom de l'adresse"
        value={form.label}
        onChange={(value) => onFieldChange("label", value)}
        icon={Mailbox}
        required
      />

      <div className="space-y-2">
        <Label htmlFor="address-kind">Type</Label>
        <Select
          value={form.kind}
          onValueChange={(value) => onFieldChange("kind", value as AddressKind)}>
          <SelectTrigger id="address-kind" className="h-12 w-full bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="livraison">Livraison</SelectItem>
            <SelectItem value="facturation">Facturation</SelectItem>
            <SelectItem value="mixte">Livraison et facturation</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        <TextField
          id="address-first-name"
          label="Prenom"
          value={form.firstName}
          onChange={(value) => onFieldChange("firstName", value)}
          autoComplete="given-name"
          icon={User}
          required
        />
        <TextField
          id="address-last-name"
          label="Nom"
          value={form.lastName}
          onChange={(value) => onFieldChange("lastName", value)}
          autoComplete="family-name"
          icon={User}
          required
        />
      </div>

      <TextField
        id="address-street"
        label="Adresse"
        value={form.street}
        onChange={(value) => onFieldChange("street", value)}
        autoComplete="street-address"
        icon={MapPin}
        required
      />

      <TextField
        id="address-apartment"
        label="Complement d'adresse"
        value={form.apartment}
        onChange={(value) => onFieldChange("apartment", value)}
        icon={Home}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        <TextField
          id="address-postal-code"
          label="Code postal"
          value={form.postalCode}
          onChange={(value) => onFieldChange("postalCode", value)}
          autoComplete="postal-code"
          icon={Mailbox}
        />
        <TextField
          id="address-city"
          label="Ville"
          value={form.city}
          onChange={(value) => onFieldChange("city", value)}
          autoComplete="address-level2"
          icon={MapPin}
          required
        />
      </div>

      <CountrySelect
        value={form.country}
        onChange={(value) => onFieldChange("country", value)}
      />

      <label className="flex min-h-11 items-center gap-3 rounded-md border border-[#d8dde6] bg-white px-3 py-2 text-sm font-medium text-[#344054]">
        <Checkbox
          checked={form.isDefault}
          onCheckedChange={(checked) =>
            onFieldChange("isDefault", checked === true)
          }
        />
        Utiliser comme adresse par defaut
      </label>

      <div className="flex flex-col gap-2 pt-2 sm:flex-row">
        <Button type="submit" className="h-11 flex-1">
          <Save className="size-4" />
          {editingId ? "Enregistrer" : "Ajouter"}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-11 flex-1"
          onClick={onCancel}>
          Annuler
        </Button>
      </div>
    </form>
  );
}

function TextField({
  id,
  label,
  value,
  onChange,
  icon: Icon,
  type = "text",
  required = false,
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  type?: string;
  required?: boolean;
  autoComplete?: string;
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
          required={required}
          className="h-12 bg-white pl-10"
        />
      </div>
    </div>
  );
}

function CountrySelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
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
      <Label htmlFor="address-country">
        Pays
        <span className="text-destructive">*</span>
      </Label>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id="address-country"
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-controls="address-country-listbox"
          aria-expanded={isOpen}
          aria-required
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
          className="h-12 bg-white pr-10 pl-10"
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
          aria-label={isOpen ? "Fermer la liste des pays" : "Ouvrir la liste des pays"}>
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
          id="address-country-listbox"
          role="listbox"
          className="absolute z-50 mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-[#d8dde6] bg-white p-1 shadow-lg">
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
                  className={
                    isActive
                      ? "flex min-h-10 w-full items-center justify-between gap-3 rounded-sm bg-primary/10 px-3 py-2 text-left text-sm text-[#172033]"
                      : "flex min-h-10 w-full items-center justify-between gap-3 rounded-sm px-3 py-2 text-left text-sm text-[#172033] hover:bg-primary/5"
                  }
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => selectCountry(country.name)}>
                  <span>{country.name}</span>
                  {isSelected ? <Check className="size-4 text-primary" /> : null}
                </button>
              );
            })
          ) : (
            <div className="px-3 py-4 text-sm text-[#667085]">
              Aucun pays trouve.
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function StatusMessage({
  children,
  icon: Icon,
  tone,
}: {
  children: ReactNode;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  tone: "error" | "success";
}) {
  const isError = tone === "error";

  return (
    <div
      role={isError ? "alert" : "status"}
      className={
        isError
          ? "mb-4 flex items-start gap-3 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          : "mb-4 flex items-start gap-3 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
      }>
      <Icon className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

function kindLabel(kind: AddressKind) {
  if (kind === "facturation") return "Facturation";
  if (kind === "mixte") return "Livraison et facturation";
  return "Livraison";
}
