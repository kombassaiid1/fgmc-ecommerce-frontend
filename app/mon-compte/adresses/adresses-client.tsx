"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import countries from "world-countries";
import {
  PiBuildingsDuotone,
  PiCaretDownBold,
  PiCheckBold,
  PiCheckCircleDuotone,
  PiFloppyDiskBold,
  PiGlobeHemisphereWestDuotone,
  PiHouseDuotone,
  PiHouseLineDuotone,
  PiMailboxDuotone,
  PiMapPinAreaDuotone,
  PiPencilSimpleDuotone,
  PiPlusBold,
  PiReceiptDuotone,
  PiSpinnerGapBold,
  PiStarFill,
  PiTagDuotone,
  PiTrashDuotone,
  PiUserDuotone,
  PiWarningCircleDuotone,
  PiXBold,
} from "react-icons/pi";

import "@/components/client-auth/auth.css";
import { AuthChoice, AuthField } from "@/components/client-auth/auth-fields";
import { Input } from "@/components/ui/input";
import { createClientAddress, deleteClientAddress, getClientAddresses, updateClientAddress } from "@/lib/api/orders";
import { getClientSession, subscribeToClientSession, type ClientSession } from "@/lib/client-auth";

import "../account.css";
import "./adresses.css";

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
  const [loadingAddresses, setLoadingAddresses] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);

  useEffect(() => {
    if (!session?.token) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setLoadingAddresses(true);
    });
    void getClientAddresses(session.token)
      .then(({ data }) => {
        if (cancelled) return;
        const cached = parseAddresses(getAddressStorageSnapshot(currentStorageKey));
        const cachedById = new Map(cached.map((address) => [address.id, address]));
        const loaded: CustomerAddress[] = data.map((address, index) => {
          const saved = cachedById.get(address.id);
          const streetParts = address.street.split(",").map((part) => part.trim());
          const timestamp = address.createdAt ?? new Date().toISOString();
          return {
            ...(saved ?? EMPTY_FORM),
            id: address.id,
            label: saved?.label ?? "Mon adresse",
            kind: saved?.kind ?? "mixte",
            firstName: saved?.firstName ?? session.user?.firstName ?? "",
            lastName: saved?.lastName ?? session.user?.lastName ?? "",
            company: saved?.company ?? session.user?.company ?? "",
            phone: saved?.phone ?? "",
            street: saved?.street ?? streetParts[0] ?? address.street,
            apartment: saved?.apartment ?? streetParts.slice(1).join(", "),
            city: address.City,
            postalCode: address.zipCode,
            country: address.country,
            isDefault: saved?.isDefault ?? index === 0,
            createdAt: saved?.createdAt ?? timestamp,
            updatedAt: saved?.updatedAt ?? timestamp,
          };
        });
        writeAddresses(currentStorageKey, normalizeAddresses(loaded));
        setError(null);
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Impossible de charger vos adresses.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingAddresses(false);
      });
    return () => { cancelled = true; };
  }, [session?.token, session?.user?.firstName, session?.user?.lastName, session?.user?.company, currentStorageKey]);

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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
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

    setSavingAddress(true);
    try {
      const apiFields = {
        country: cleanForm.country,
        street: [cleanForm.street, cleanForm.apartment].filter(Boolean).join(", "),
        City: cleanForm.city,
        state: cleanForm.city || cleanForm.country,
        zipCode: cleanForm.postalCode || "-",
      };
      const saved = session?.token
        ? editingId
          ? await updateClientAddress(session.token, editingId, apiFields)
          : await createClientAddress(session.token, apiFields)
        : null;

      if (editingId) {
        persist(addresses.map((address) =>
          address.id === editingId
            ? { ...address, ...cleanForm, updatedAt: now }
            : cleanForm.isDefault ? { ...address, isDefault: false } : address,
        ));
        setSuccess("Adresse mise a jour.");
      } else {
        const nextAddress: CustomerAddress = {
          id: saved?.id ?? createId(),
          ...cleanForm,
          isDefault: cleanForm.isDefault || addresses.length === 0,
          createdAt: saved?.createdAt ?? now,
          updatedAt: saved?.createdAt ?? now,
        };
        persist(nextAddress.isDefault
          ? addresses.map((address) => ({ ...address, isDefault: false })).concat(nextAddress)
          : addresses.concat(nextAddress));
        setSuccess("Adresse ajoutee.");
      }
      setForm(formFromSession(session));
      setEditingId(null);
      setIsFormOpen(false);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Impossible d'enregistrer l'adresse.");
    } finally {
      setSavingAddress(false);
    }
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

  async function handleDelete(id: string) {
    if (session?.token) {
      try {
        await deleteClientAddress(session.token, id);
      } catch (deleteError) {
        setError(deleteError instanceof Error ? deleteError.message : "Impossible de supprimer l'adresse.");
        setDeleteId(null);
        return;
      }
    }
    const nextAddresses = addresses.filter((address) => address.id !== id);
    persist(nextAddresses);
    setDeleteId(null);
    setSuccess("Adresse supprimee.");
    if (editingId === id) {
      cancelForm();
    }
  }

  // On a phone the panel sits below the list: bring it into view when it opens.
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!isFormOpen) return;
    panelRef.current?.scrollIntoView({ block: "nearest", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, [isFormOpen, editingId]);

  const defaultAddress = addresses.find((address) => address.isDefault);

  return (
    <main className="ac">
      <div className="ac-wrap is-wide">
        <nav aria-label="Fil d’Ariane" className="ac-crumbs">
          <Link href="/">Accueil</Link>
          <span aria-hidden="true">/</span>
          <Link href="/mon-compte">Mon compte</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">Mes adresses</span>
        </nav>

        {/* ------------------------------------------------------------ the mat */}
        <section className="ac-hero" aria-labelledby="ad-title">
          <div className="ad-hero-row">
            <div>
              <h1 id="ad-title" className="ad-title">Mes adresses</h1>
              <p className="ad-sub">Enregistrez vos adresses de livraison et de facturation pour commander plus vite.</p>
            </div>
            <button type="button" className="ad-add" onClick={startCreate}>
              <PiPlusBold className="size-5" aria-hidden="true" />
              Ajouter une adresse
            </button>
          </div>
          <ul className="ac-stats" aria-label="Vos adresses en chiffres" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
            <li className="ac-stat">
              <p className="ac-stat-value">{loadingAddresses && addresses.length === 0 ? <span className="ac-skeleton" /> : addresses.length}</p>
              <p className="ac-stat-label">Adresse{addresses.length > 1 ? "s" : ""} enregistrée{addresses.length > 1 ? "s" : ""}</p>
            </li>
            <li className="ac-stat">
              <p className="ac-stat-value ad-stat-value-text">{defaultAddress ? [defaultAddress.postalCode, defaultAddress.city].filter(Boolean).join(" ") : "–"}</p>
              <p className="ac-stat-label">Adresse par défaut</p>
            </li>
          </ul>
        </section>

        <div className="ad-layout">
          <section className="min-w-0" aria-label="Mes adresses enregistrées">
            {error ? <Alert tone="bad" icon={PiWarningCircleDuotone}>{error}</Alert> : null}
            {success ? <Alert tone="ok" icon={PiCheckCircleDuotone}>{success}</Alert> : null}
            {!session ? <Alert tone="info" icon={PiWarningCircleDuotone}>Vous n’êtes pas connecté : vos adresses sont conservées uniquement sur ce navigateur. <Link href="/login?returnTo=/mon-compte/adresses" className="underline">Se connecter</Link></Alert> : null}
            {session && loadingAddresses ? <p className="ad-loading" role="status">Chargement de vos adresses…</p> : null}

            {addresses.length === 0 && !loadingAddresses ? (
              <EmptyState onCreate={startCreate} />
            ) : (
              <ul className="ad-grid">
                {addresses.map((address) => (
                  <li key={address.id}>
                    <AddressCard
                      address={address}
                      isConfirmingDelete={deleteId === address.id}
                      onEdit={() => startEdit(address)}
                      onSetDefault={() => handleSetDefault(address.id)}
                      onAskDelete={() => setDeleteId(address.id)}
                      onCancelDelete={() => setDeleteId(null)}
                      onConfirmDelete={() => handleDelete(address.id)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <aside className="ad-aside" aria-label={editingId ? "Modifier l’adresse" : "Ajouter une adresse"}>
            <div ref={panelRef}>
              {isFormOpen ? (
                <div className="ad-panel">
                  <div className="ad-panel-head">
                    <div className="ad-panel-title">
                      <span className="ad-panel-icon" aria-hidden="true">{editingId ? <PiPencilSimpleDuotone className="size-7" /> : <PiMapPinAreaDuotone className="size-7" />}</span>
                      <div>
                        <h2 className="ad-panel-h">{editingId ? "Modifier l’adresse" : "Nouvelle adresse"}</h2>
                        <p className="ad-panel-sub">{editingId ? "Vos changements s’appliquent aux prochaines commandes." : "Elle sera proposée lors de vos commandes."}</p>
                      </div>
                    </div>
                    <button type="button" className="ad-close" onClick={cancelForm} aria-label="Fermer le formulaire"><PiXBold className="size-5" aria-hidden="true" /></button>
                  </div>
                  <div className="ad-seam" aria-hidden="true" />
                  <AddressForm form={form} editingId={editingId} onSubmit={handleSubmit} onCancel={cancelForm} onFieldChange={updateField} isSaving={savingAddress} />
                </div>
              ) : (
                <div className="ad-placeholder">
                  <span className="ad-placeholder-icon" aria-hidden="true"><PiMapPinAreaDuotone className="size-8" /></span>
                  <p>Choisissez « Modifier » sur une adresse, ou ajoutez une nouvelle adresse à votre carnet.</p>
                  <button type="button" className="ad-btn" onClick={startCreate}><PiPlusBold className="size-4" aria-hidden="true" />Ajouter une adresse</button>
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

function Alert({ tone, icon: Icon, children }: { tone: "ok" | "bad" | "info"; icon: typeof PiUserDuotone; children: ReactNode }) {
  return (
    <div role={tone === "bad" ? "alert" : "status"} className={`ad-alert is-${tone}`}>
      <Icon className="size-5" aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="ad-empty">
      <span className="ad-empty-icon" aria-hidden="true"><PiMapPinAreaDuotone className="size-10" /></span>
      <h2 className="ad-empty-title">Aucune adresse enregistrée</h2>
      <p>Ajoutez votre première adresse pour accélérer vos prochaines commandes.</p>
      <button type="button" className="ad-add" onClick={onCreate}><PiPlusBold className="size-5" aria-hidden="true" />Ajouter une adresse</button>
    </div>
  );
}

const KIND_STYLE: Record<AddressKind, { icon: typeof PiUserDuotone; className: string }> = {
  livraison: { icon: PiHouseLineDuotone, className: "" },
  facturation: { icon: PiReceiptDuotone, className: "is-billing" },
  mixte: { icon: PiHouseDuotone, className: "is-both" },
};

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
  const lines = [address.street, address.apartment, [address.postalCode, address.city].filter(Boolean).join(" "), address.country].filter(Boolean);
  const kind = KIND_STYLE[address.kind];
  const KindIcon = kind.icon;

  return (
    <article className={`ad-card ${address.isDefault ? "is-default" : ""}`} aria-label={address.label}>
      <div className="ad-card-top">
        <span className={`ad-kind ${kind.className}`}><KindIcon className="size-5" aria-hidden="true" />{kindLabel(address.kind)}</span>
        {address.isDefault ? <span className="ad-default"><PiStarFill className="size-4" aria-hidden="true" />Par défaut</span> : null}
      </div>
      <div className="ad-card-body">
        <p className="ad-label">{address.label}</p>
        <p className="ad-name">{fullName || "—"}</p>
        <address className="ad-lines">
          {lines.map((line) => (
            <span key={line}>{line}</span>
          ))}
        </address>
        <div className="ad-barcode" aria-hidden="true" />
      </div>
      <div className="ad-tear" aria-hidden="true" />

      {isConfirmingDelete ? (
        <div className="ad-confirm" role="alertdialog" aria-label="Confirmer la suppression">
          <p>Supprimer cette adresse ?</p>
          <div>
            <button type="button" className="ad-btn is-solid-danger" onClick={onConfirmDelete}>Supprimer</button>
            <button type="button" className="ad-btn" onClick={onCancelDelete}>Annuler</button>
          </div>
        </div>
      ) : (
        <div className="ad-actions">
          <button type="button" className="ad-btn" onClick={onEdit}><PiPencilSimpleDuotone className="size-5" aria-hidden="true" />Modifier</button>
          {!address.isDefault ? <button type="button" className="ad-btn" onClick={onSetDefault}><PiStarFill className="size-4" aria-hidden="true" />Par défaut</button> : null}
          <button type="button" className="ad-btn is-danger" onClick={onAskDelete}><PiTrashDuotone className="size-5" aria-hidden="true" />Supprimer</button>
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
  isSaving,
}: {
  form: AddressFormState;
  editingId: string | null;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
  isSaving: boolean;
  onFieldChange: <K extends keyof AddressFormState>(key: K, value: AddressFormState[K]) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="ad-form" noValidate>
      <div className="auth-scope ad-form">
        <AuthField id="address-label" label="Nom de l’adresse" value={form.label} onChange={(value) => onFieldChange("label", value)} icon={PiTagDuotone} placeholder="Maison, Atelier, Bureau…" required />

        <AuthChoice
          label="Type"
          value={form.kind}
          onChange={(value) => onFieldChange("kind", value)}
          options={[
            { value: "livraison", label: "Livraison" },
            { value: "facturation", label: "Facturation" },
            { value: "mixte", label: "Les deux" },
          ]}
        />

        <div className="ad-row is-two">
          <AuthField id="address-first-name" label="Prénom" value={form.firstName} onChange={(value) => onFieldChange("firstName", value)} autoComplete="given-name" icon={PiUserDuotone} required />
          <AuthField id="address-last-name" label="Nom" value={form.lastName} onChange={(value) => onFieldChange("lastName", value)} autoComplete="family-name" icon={PiUserDuotone} required />
        </div>

        <AuthField id="address-street" label="Adresse" value={form.street} onChange={(value) => onFieldChange("street", value)} autoComplete="street-address" icon={PiMapPinAreaDuotone} placeholder="Numéro et nom de la rue" required />
        <AuthField id="address-apartment" label="Complément d’adresse" value={form.apartment} onChange={(value) => onFieldChange("apartment", value)} icon={PiBuildingsDuotone} placeholder="Bâtiment, étage, digicode…" optional />

        <div className="ad-row is-two">
          <AuthField id="address-postal-code" label="Code postal" value={form.postalCode} onChange={(value) => onFieldChange("postalCode", value)} autoComplete="postal-code" icon={PiMailboxDuotone} />
          <AuthField id="address-city" label="Ville" value={form.city} onChange={(value) => onFieldChange("city", value)} autoComplete="address-level2" icon={PiMapPinAreaDuotone} required />
        </div>

        <CountrySelect value={form.country} onChange={(value) => onFieldChange("country", value)} />

        <label className="ad-switch">
          <input type="checkbox" checked={form.isDefault} onChange={(event) => onFieldChange("isDefault", event.target.checked)} />
          <span className="ad-switch-track" aria-hidden="true" />
          Utiliser comme adresse par défaut
        </label>

        <div className="ad-submit-row">
          <button type="submit" className="ad-submit" disabled={isSaving}>
            {isSaving ? <PiSpinnerGapBold className="size-5 animate-spin" aria-hidden="true" /> : <PiFloppyDiskBold className="size-5" aria-hidden="true" />}
            {isSaving ? "Enregistrement…" : editingId ? "Enregistrer" : "Ajouter l’adresse"}
          </button>
          <button type="button" className="ad-cancel" disabled={isSaving} onClick={onCancel}>Annuler</button>
        </div>
      </div>
    </form>
  );
}

const COUNTRY_INPUT = "h-12 rounded-xl border-2 border-[var(--auth-line)] bg-white pr-12 pl-11 text-[15px] text-[var(--auth-ink)] shadow-none placeholder:text-[#8793aa] focus-visible:border-[var(--auth-blue)] focus-visible:ring-4 focus-visible:ring-[var(--auth-blue)]/15";

function CountrySelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const options = value && !countryOptions.some((country) => country.name === value) ? [{ code: "custom", name: value }, ...countryOptions] : countryOptions;
  const normalizedQuery = query.trim().toLocaleLowerCase("fr");
  const filteredOptions = normalizedQuery ? options.filter((country) => country.name.toLocaleLowerCase("fr").includes(normalizedQuery)) : options;

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
      setActiveIndex((current) => (filteredOptions.length === 0 ? 0 : Math.min(current + 1, filteredOptions.length - 1)));
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
      className="ad-country"
      onBlur={(event) => {
        const nextFocus = event.relatedTarget instanceof Node ? event.relatedTarget : null;

        if (!nextFocus || !event.currentTarget.contains(nextFocus)) {
          setIsOpen(false);
          setQuery("");
          setActiveIndex(0);
        }
      }}>
      <label htmlFor="address-country" className="ad-label-strong">
        Pays<span aria-hidden="true" style={{ color: "var(--ac-red)", marginLeft: 3 }}>*</span>
      </label>
      <div className="ad-country-box">
        <PiGlobeHemisphereWestDuotone className="lead size-[18px]" aria-hidden="true" />
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
          className={COUNTRY_INPUT}
        />
        <button
          type="button"
          className="ad-country-toggle"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            setIsOpen((open) => !open);
            setQuery("");
            setActiveIndex(0);
          }}
          aria-label={isOpen ? "Fermer la liste des pays" : "Ouvrir la liste des pays"}>
          <PiCaretDownBold className={isOpen ? "size-4 rotate-180 transition-transform" : "size-4 transition-transform"} aria-hidden="true" />
        </button>
      </div>

      {isOpen ? (
        <div id="address-country-listbox" role="listbox" className="ad-listbox">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((country, index) => {
              const isSelected = country.name === value;
              return (
                <button
                  key={country.code}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={`ad-option ${index === activeIndex ? "is-active" : ""}`}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => selectCountry(country.name)}>
                  <span>{country.name}</span>
                  {isSelected ? <PiCheckBold className="size-4" style={{ color: "var(--ac-blue)" }} aria-hidden="true" /> : null}
                </button>
              );
            })
          ) : (
            <div className="ad-none">Aucun pays trouvé.</div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function kindLabel(kind: AddressKind) {
  if (kind === "facturation") return "Facturation";
  if (kind === "mixte") return "Livraison et facturation";
  return "Livraison";
}
