"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import {
  PiArrowRightBold,
  PiArrowsClockwiseBold,
  PiCalendarBlankDuotone,
  PiCaretDownBold,
  PiCaretLeftBold,
  PiCaretRightBold,
  PiCheckBold,
  PiCreditCardDuotone,
  PiMagnifyingGlassDuotone,
  PiPackageDuotone,
  PiReceiptDuotone,
  PiShoppingBagDuotone,
  PiSpinnerGapBold,
  PiTruckDuotone,
  PiWarningCircleDuotone,
  PiXCircleDuotone,
} from "react-icons/pi";

import { getImageUrl } from "@/lib/api";
import { getMyOrders, openMyOrderDocument, type OrderListItem, type StoredOrderProduct } from "@/lib/api/orders";
import { getClientSession, subscribeToClientSession, type ClientSession } from "@/lib/client-auth";

import "../account.css";
import { ColissimoOrderPanel } from "./colissimo-order-panel";
import { OrderDocuments } from "./order-documents";
import "./orders.css";

const PAGE_SIZE = 10;

const ALL_VALUE = "all";

const ETAT_OPTIONS = [
  { label: "Toutes", value: ALL_VALUE },
  { label: "En cours", value: "En_cours" },
  { label: "Confirmées", value: "Confirmées" },
  { label: "Expédiées", value: "Expédiées" },
  { label: "Annulées", value: "Annulées" },
  { label: "Retour", value: "Retour" },
];

const PAYMENT_OPTIONS = [
  { label: "Tous", value: ALL_VALUE },
  { label: "Payées", value: "paid" },
  { label: "En attente", value: "pending" },
];

const EMPTY_META = {
  total: 0,
  page: 1,
  limit: PAGE_SIZE,
  totalPages: 1,
  hasNextPage: false,
  hasPreviousPage: false,
};

let cachedSession: ClientSession | null = null;
let cachedSessionKey = "";

function getServerSessionSnapshot() {
  return null;
}

function getClientSessionSnapshot() {
  const nextSession = getClientSession();
  const nextKey = nextSession ? `${nextSession.token}:${JSON.stringify(nextSession.user)}` : "";

  if (nextKey === cachedSessionKey) {
    return cachedSession;
  }

  cachedSession = nextSession;
  cachedSessionKey = nextKey;
  return cachedSession;
}

export function CommandesClient() {
  const session = useSyncExternalStore(subscribeToClientSession, getClientSessionSnapshot, getServerSessionSnapshot);
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [etat, setEtat] = useState(ALL_VALUE);
  const [paymentStatus, setPaymentStatus] = useState(ALL_VALUE);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState(EMPTY_META);
  const [refreshKey, setRefreshKey] = useState(0);

  const customerSearch = getCustomerSearch(session);

  useEffect(() => {
    if (!session?.token || !customerSearch) return;

    let cancelled = false;
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      setError(null);

      try {
        // The server only returns the orders of the signed-in account.
        const response = await getMyOrders(session.token, {
          page,
          limit: PAGE_SIZE,
          etat: etat === ALL_VALUE ? undefined : etat,
          paymentStatus: paymentStatus === ALL_VALUE ? undefined : paymentStatus,
        });

        if (cancelled) return;
        setOrders(response.data);
        setMeta(response.meta);
      } catch (loadError) {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : "Impossible de charger vos commandes.");
        setOrders([]);
        setMeta(EMPTY_META);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [customerSearch, etat, page, paymentStatus, refreshKey, session]);

  const customerOrders = useMemo(() => {
    return orders.filter((order) => isCurrentCustomerOrder(order, session)).filter((order) => matchesLocalQuery(order, query));
  }, [orders, query, session]);

  const stats = useMemo(() => {
    const paidCount = customerOrders.filter((order) => normalizeStatus(order.paymentStatus).includes("pay")).length;
    const activeCount = customerOrders.filter((order) => !normalizeStatus(order.etat).includes("annul")).length;
    const totalSpent = customerOrders.reduce((sum, order) => sum + Number(order.total ?? 0), 0);

    return { paidCount, activeCount, totalSpent };
  }, [customerOrders]);

  function reload() {
    setPage(1);
    setRefreshKey((current) => current + 1);
    setMeta(EMPTY_META);
    setOrders([]);
    setError(null);
  }

  if (!session) {
    return (
      <AccountShell current="Mes commandes">
        <section className="ac-signin" aria-labelledby="oc-signin">
          <h1 id="oc-signin" className="ac-signin-title">Connectez-vous pour voir vos commandes</h1>
          <p>Votre historique est rattaché à votre compte client FGMC.</p>
          <div className="ac-signin-actions">
            <Link href="/login?returnTo=/mon-compte/commandes" className="ac-btn is-red">Se connecter<PiArrowRightBold className="size-4" aria-hidden="true" /></Link>
          </div>
        </section>
      </AccountShell>
    );
  }

  const hasFilters = Boolean(query.trim()) || etat !== ALL_VALUE || paymentStatus !== ALL_VALUE;

  return (
    <AccountShell current="Mes commandes">
      {/* ------------------------------------------------------------ the mat */}
      <section className="ac-hero" aria-labelledby="oc-title">
        <div className="oc-hero-row">
          <div>
            <h1 id="oc-title" className="oc-title">Mes commandes</h1>
            <p className="oc-sub">Retrouvez vos achats, suivez vos colis et téléchargez vos factures.</p>
          </div>
          <button type="button" className="oc-btn is-line" disabled={loading} onClick={reload}>
            {loading ? <PiSpinnerGapBold className="oc-spin size-4" aria-hidden="true" /> : <PiArrowsClockwiseBold className="size-4" aria-hidden="true" />}
            Actualiser
          </button>
        </div>
        <ul className="ac-stats" aria-label="Vos commandes en chiffres">
          <li className="ac-stat">
            <p className="ac-stat-value">{loading ? <span className="ac-skeleton" /> : customerOrders.length}</p>
            <p className="ac-stat-label">Commandes{meta.totalPages > 1 ? ` · page ${meta.page}/${meta.totalPages}` : ""}</p>
          </li>
          <li className="ac-stat">
            <p className="ac-stat-value">{loading ? <span className="ac-skeleton" /> : stats.paidCount}</p>
            <p className="ac-stat-label">Paiements validés · {stats.activeCount} en cours ou terminées</p>
          </li>
          <li className="ac-stat">
            <p className="ac-stat-value">{loading ? <span className="ac-skeleton" style={{ width: "6ch" }} /> : formatEuro(stats.totalSpent)}</p>
            <p className="ac-stat-label">Total TTC affiché</p>
          </li>
        </ul>
      </section>

      {/* ------------------------------------------------------------ filters */}
      <section className="oc-filters" aria-label="Filtrer mes commandes">
        <div className="oc-search">
          <PiMagnifyingGlassDuotone className="size-5" aria-hidden="true" />
          <input id="orders-search" type="search" aria-label="Rechercher une commande" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher une référence, un produit, une ville…" />
        </div>
        <ChipGroup label="État de la commande" options={ETAT_OPTIONS} value={etat} onChange={(value) => { setPage(1); setEtat(value); }} />
        <ChipGroup label="Paiement" options={PAYMENT_OPTIONS} value={paymentStatus} onChange={(value) => { setPage(1); setPaymentStatus(value); }} />
      </section>

      {error ? (
        <div role="alert" className="oc-banner"><PiWarningCircleDuotone className="size-5" aria-hidden="true" /><span>{error}</span></div>
      ) : null}

      {/* ------------------------------------------------------------ the orders */}
      {loading ? (
        <div className="oc-list" aria-busy="true" aria-label="Chargement des commandes">
          {Array.from({ length: 3 }).map((_, index) => <div key={index} className="oc-skeleton" />)}
        </div>
      ) : customerOrders.length === 0 ? (
        <EmptyOrdersState hasFilters={hasFilters} />
      ) : (
        <ul className="oc-list">
          {customerOrders.map((order) => (
            <li key={order.id} className="oc-item"><OrderCard order={order} defaultOpen={false} /></li>
          ))}
        </ul>
      )}

      <div className="oc-pager">
        <p>{`Page ${String(meta.page)} sur ${String(Math.max(1, meta.totalPages))}`}</p>
        <div>
          <button type="button" className="oc-btn is-line" disabled={loading || !meta.hasPreviousPage} onClick={() => setPage((current) => Math.max(1, current - 1))}>
            <PiCaretLeftBold className="size-4" aria-hidden="true" />Précédent
          </button>
          <button type="button" className="oc-btn is-line" disabled={loading || !meta.hasNextPage} onClick={() => setPage((current) => Math.min(Math.max(1, meta.totalPages), current + 1))}>
            Suivant<PiCaretRightBold className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </AccountShell>
  );
}

function AccountShell({ children, current }: { children: ReactNode; current: string }) {
  return (
    <main className="ac">
      <div className="ac-wrap is-wide">
        <nav aria-label="Fil d’Ariane" className="ac-crumbs">
          <Link href="/">Accueil</Link>
          <span aria-hidden="true">/</span>
          <Link href="/mon-compte">Mon compte</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{current}</span>
        </nav>
        {children}
      </div>
    </main>
  );
}

function ChipGroup({ label, options, value, onChange }: { label: string; options: Array<{ label: string; value: string }>; value: string; onChange: (value: string) => void }) {
  return (
    <div className="oc-group" role="group" aria-label={label}>
      <span className="oc-group-label" aria-hidden="true">{label}</span>
      <ul className="oc-chips">
        {options.map((option) => (
          <li key={option.value}>
            <button type="button" className="oc-chip" aria-pressed={value === option.value} onClick={() => onChange(option.value)}>{option.label}</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ one order */

const STEPS = ["Commande reçue", "Confirmée", "Expédiée", "Livrée"];

/** Where an order stands on the four steps, from its state name. Cancelled and returned orders have no steps. */
function progressOf(etat: string): { kind: "steps"; step: number } | { kind: "cancelled" } | { kind: "returned" } {
  const status = normalizeStatus(etat);
  if (status.includes("annul") || status.includes("echou")) return { kind: "cancelled" };
  if (status.includes("retour") || status.includes("rembours")) return { kind: "returned" };
  if (/\blivre(e|es|s)?\b/.test(status)) return { kind: "steps", step: 4 };
  if (status.includes("exp")) return { kind: "steps", step: 3 };
  if (status.includes("confirm") || status.includes("prepar") || status.includes("pay")) return { kind: "steps", step: 2 };
  return { kind: "steps", step: 1 };
}

function OrderCard({ order, defaultOpen }: { order: OrderListItem; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const products = getProducts(order);
  const address = getDeliveryAddress(order);
  const progress = progressOf(order.etat);
  const pieces = products.reduce((sum, product) => sum + Math.max(1, Number(product.quantity ?? 1)), 0);
  const reference = order.reference ?? shortOrderId(order.id);
  const first = products[0]?.title?.trim();

  return (
    <article className="oc-card" aria-labelledby={`order-${order.id}`}>
      <div className="oc-card-main">
      <div className="oc-card-top">
        <div className="min-w-0">
          <p className="oc-ref">Commande</p>
          <h2 id={`order-${order.id}`} className="oc-order">{reference}</h2>
          <p className="oc-date"><PiCalendarBlankDuotone className="size-5" aria-hidden="true" />{formatDate(order.createdAt)}</p>
          <div className="oc-chips-row">
            <StatusPill value={order.etat} type="order" />
            <StatusPill value={order.paymentStatus} type="payment" />
          </div>
        </div>
      </div>

      {progress.kind === "steps" ? (
        <ol className="oc-track" style={{ "--p": (progress.step - 1) / 3 } as React.CSSProperties} aria-label={`Avancement : ${STEPS[progress.step - 1]}`}>
          {STEPS.map((label, index) => (
            <li key={label} className={`oc-step ${index < progress.step ? "is-done" : ""} ${index === progress.step - 1 ? "is-current" : ""}`} aria-current={index === progress.step - 1 ? "step" : undefined}>
              <span className="oc-dot" aria-hidden="true"><PiCheckBold className="size-4" /></span>
              {label}
            </li>
          ))}
        </ol>
      ) : (
        <p className={`oc-alert ${progress.kind === "cancelled" ? "is-red" : "is-amber"}`}>
          <PiXCircleDuotone className="size-5" aria-hidden="true" />
          {progress.kind === "cancelled" ? "Cette commande a été annulée." : "Cette commande fait l’objet d’un retour."}
        </p>
      )}

      {products.length > 0 ? (
        <div className="oc-items">
          <div className="oc-thumbs" aria-hidden="true">
            {products.slice(0, 4).map((product, index) => {
              const image = product.image?.trim() ? getImageUrl(product.image) : null;
              return (
                <span key={`${product.id ?? product.title ?? "p"}-${index}`} className="oc-thumb">
                  {image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={image} alt="" loading="lazy" />
                  ) : (
                    <PiShoppingBagDuotone className="size-6" />
                  )}
                </span>
              );
            })}
            {products.length > 4 ? <span className="oc-thumb is-more">+{products.length - 4}</span> : null}
          </div>
          <p className="oc-items-text">
            <strong>{first || "Produit"}{products.length > 1 ? ` et ${products.length - 1} autre${products.length > 2 ? "s" : ""}` : ""}</strong>
            {pieces} pièce{pieces > 1 ? "s" : ""}
          </p>
        </div>
      ) : null}
      </div>

      <aside className="oc-card-side">
        <div className="oc-total">
          <p className="oc-total-label">Total TTC</p>
          <p className="oc-total-value">{formatEuro(order.total)}</p>
        </div>
        <OrderDocuments order={order} />
      </aside>

      <details className="oc-details" open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
        <summary>
          {open ? "Masquer le détail" : "Voir le détail et le suivi"}
          <PiCaretDownBold className="size-4" aria-hidden="true" />
        </summary>
        {open ? (
          <div className="oc-details-body">
            <div>
              <h3 className="oc-block-title"><PiPackageDuotone className="size-5" aria-hidden="true" />Articles commandés</h3>
              {products.length === 0 ? (
                <p className="oc-empty-lines">Aucun détail produit disponible.</p>
              ) : (
                <ul className="oc-lines">
                  {products.map((product, index) => (
                    <ProductLine key={`${product.id ?? product.title ?? "product"}-${index}`} product={product} />
                  ))}
                </ul>
              )}
            </div>

            <dl className="oc-facts">
              <Fact icon={PiTruckDuotone} label="Livraison" value={address || "Adresse non disponible"} />
              <Fact icon={PiCreditCardDuotone} label="Paiement" value={sentence(readableStatus(order.paymentStatus))} />
              <Fact
                icon={PiReceiptDuotone}
                label="Facture"
                value={
                  order.dolibarrInvoice ? (
                    <>
                      {order.dolibarrInvoice.reference} · {sentence(readableStatus(order.dolibarrInvoice.status ?? "validated"))}
                      {!/^\(?PROV/i.test(order.dolibarrInvoice.reference) ? (
                        <>
                          <br />
                          <button
                            type="button"
                            className="underline"
                            onClick={() => {
                              const token = getClientSession()?.token;
                              if (token) void openMyOrderDocument(token, order.id, "invoice").catch(() => undefined);
                            }}>
                            Télécharger la facture PDF
                          </button>
                        </>
                      ) : null}
                    </>
                  ) : order.dolibarrId ? "En attente de synchronisation" : "Pas encore disponible"
                }
              />
            </dl>

            <div className="oc-wide">
              <ColissimoOrderPanel orderId={order.id} />
            </div>
          </div>
        ) : null}
      </details>

    </article>
  );
}

function ProductLine({ product }: { product: StoredOrderProduct }) {
  const image = product.image?.trim() ? getImageUrl(product.image) : null;
  const title = product.title?.trim() || "Produit";
  const quantity = Math.max(0, Number(product.quantity ?? 0));

  return (
    <li className="oc-line">
      <span className="oc-line-img">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" loading="lazy" />
        ) : (
          <PiShoppingBagDuotone className="size-6" aria-hidden="true" />
        )}
      </span>
      <div className="oc-line-body">
        <p className="oc-line-title">{title}</p>
        {product.variantLabel ? <p className="oc-line-meta"><span>{product.variantLabel}</span></p> : null}
        <p className="oc-line-meta">
          <span>{String(quantity)} pièce{quantity > 1 ? "s" : ""}</span>
          <strong>{formatEuro(product.totalPrice ?? product.unitPrice ?? 0)}</strong>
        </p>
      </div>
    </li>
  );
}

function Fact({ icon: Icon, label, value }: { icon: typeof PiTruckDuotone; label: string; value: ReactNode }) {
  return (
    <div className="oc-fact">
      <span className="oc-fact-icon" aria-hidden="true"><Icon className="size-5" /></span>
      <div>
        <dt>{label}</dt>
        <dd>{value}</dd>
      </div>
    </div>
  );
}

function EmptyOrdersState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="oc-empty">
      <span className="oc-empty-icon" aria-hidden="true">{hasFilters ? <PiMagnifyingGlassDuotone className="size-9" /> : <PiShoppingBagDuotone className="size-9" />}</span>
      <h2 className="oc-empty-title">{hasFilters ? "Aucune commande trouvée" : "Aucune commande pour le moment"}</h2>
      <p>{hasFilters ? "Essayez avec un autre filtre ou une autre référence." : "Vos prochaines commandes apparaîtront ici dès leur validation."}</p>
      {!hasFilters ? <Link href="/categorie-produit" className="ac-btn is-red">Continuer mes achats<PiArrowRightBold className="size-4" aria-hidden="true" /></Link> : null}
    </div>
  );
}

function StatusPill({ value, type }: { value: string; type: "order" | "payment" }) {
  const status = normalizeStatus(value);
  let tone: "blue" | "green" | "amber" | "red" | "grey" = "amber";
  if (status.includes("annul") || status.includes("echou") || status.includes("refus")) tone = "red";
  else if (type === "payment") tone = status.includes("pay") || status.includes("accept") ? "green" : status.includes("attente") || status.includes("pend") ? "amber" : "grey";
  else if (/\blivre/.test(status) || status.includes("exp")) tone = "green";
  else if (status.includes("confirm")) tone = "blue";
  else if (status.includes("retour")) tone = "grey";

  return (
    <span className={`oc-pill is-${tone}`}>
      <i aria-hidden="true" />
      {type === "payment" ? "Paiement : " : ""}
      {sentence(readableStatus(value))}
    </span>
  );
}

/* ------------------------------------------------------------------ data helpers */

function getCustomerSearch(session: ClientSession | null) {
  const user = session?.user;
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim();

  return user?.email?.trim() || fullName || user?.id || "";
}

function isCurrentCustomerOrder(order: OrderListItem, session: ClientSession | null) {
  const user = session?.user;
  const email = user?.email?.trim().toLowerCase();
  const id = user?.id?.trim();

  if (id && order.Client?.id === id) return true;
  if (email && order.Client?.email?.trim().toLowerCase() === email) return true;
  if (email && order.guestEmail?.trim().toLowerCase() === email) return true;

  return false;
}

function matchesLocalQuery(order: OrderListItem, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;

  const products = getProducts(order);
  const haystack = [
    order.id,
    order.reference ?? "",
    readableStatus(order.etat),
    readableStatus(order.paymentStatus),
    getDeliveryAddress(order),
    ...products.flatMap((product) => [product.title ?? "", product.slug ?? "", product.variantId ?? ""]),
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(normalizedQuery);
}

function getProducts(order: OrderListItem): StoredOrderProduct[] {
  return Array.isArray(order.products) ? (order.products as StoredOrderProduct[]) : [];
}

function getDeliveryAddress(order: OrderListItem) {
  if (order.Address) {
    return [order.Address.City, order.Address.state].filter(Boolean).join(", ");
  }

  return order.guestAddress?.trim() || "";
}

function shortOrderId(id: string) {
  return `#${id.slice(0, 10).toUpperCase()}`;
}

function normalizeStatus(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/_/g, " ")
    .trim()
    .toLowerCase();
}

function readableStatus(value: string | null | undefined) {
  return (value ?? "-").replace(/_/g, " ").trim() || "-";
}

/** "EN COURS" or "en_cours" gives "En cours". */
function sentence(value: string) {
  const lower = value.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(date);
}

function formatEuro(value: number | null | undefined) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value ?? NaN) ? Number(value) : 0);
}
