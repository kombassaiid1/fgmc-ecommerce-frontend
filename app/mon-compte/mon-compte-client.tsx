"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import type { ComponentType } from "react";
import {
  PiArrowRightBold,
  PiBellRingingDuotone,
  PiBuildingsDuotone,
  PiHeadsetDuotone,
  PiMapPinAreaDuotone,
  PiPackageDuotone,
  PiReceiptDuotone,
  PiSealCheckDuotone,
  PiSignOutBold,
  PiTicketDuotone,
  PiUserCircleDuotone,
} from "react-icons/pi";

import { getClientAddresses, getOrders, type OrderListItem } from "@/lib/api/orders";
import { clearClientSession, getClientSession, subscribeToClientSession, type ClientSession } from "@/lib/client-auth";

import "./account.css";

type Tone = "blue" | "red" | "green" | "amber";

type AccountRoom = {
  id: string;
  title: string;
  description: string;
  href: string | null;
  icon: ComponentType<{ className?: string }>;
  tone: Tone;
  /** Which figure to show as a badge on the tag. */
  badge?: "orders" | "addresses";
  cta: string;
};

/** The rooms of the account. The ones without a page yet are shown, but not as links, so no one lands on a dead end. */
const PURCHASES: AccountRoom[] = [
  { id: "commandes", title: "Mes commandes", description: "Suivi, factures et achats passés.", href: "/mon-compte/commandes", icon: PiPackageDuotone, tone: "blue", badge: "orders", cta: "Voir mes commandes" },
  { id: "avoirs", title: "Avoirs", description: "Les crédits disponibles sur votre compte.", href: null, icon: PiReceiptDuotone, tone: "green", cta: "" },
  { id: "reductions", title: "Bons de réduction", description: "Vos codes actifs et avantages client.", href: null, icon: PiTicketDuotone, tone: "red", cta: "" },
  { id: "alertes", title: "Mes alertes", description: "Disponibilités et baisses de prix des produits suivis.", href: null, icon: PiBellRingingDuotone, tone: "amber", cta: "" },
];

const PROFILE: AccountRoom[] = [
  { id: "informations", title: "Mes informations", description: "Identité, e-mail et mot de passe.", href: "/mon-compte/informations", icon: PiUserCircleDuotone, tone: "blue", cta: "Modifier" },
  { id: "adresses", title: "Mes adresses", description: "Vos adresses de livraison et de facturation.", href: "/mon-compte/adresses", icon: PiMapPinAreaDuotone, tone: "red", badge: "addresses", cta: "Gérer mes adresses" },
];

function getServerSessionSnapshot() {
  return null;
}

let cachedSession: ClientSession | null = null;
let cachedSessionKey = "";

function getClientSessionSnapshot() {
  const nextSession = getClientSession();
  const nextKey = nextSession ? `${nextSession.token}:${JSON.stringify(nextSession.user)}` : "";
  if (nextKey === cachedSessionKey) return cachedSession;
  cachedSession = nextSession;
  cachedSessionKey = nextKey;
  return cachedSession;
}

const fullName = (session: ClientSession | null) => [session?.user?.firstName, session?.user?.lastName].filter(Boolean).join(" ").trim();

function firstName(session: ClientSession | null) {
  const user = session?.user;
  return user?.firstName?.trim() || user?.username?.trim() || user?.email?.split("@")[0] || "";
}

function initials(session: ClientSession | null) {
  const user = session?.user;
  const letters = [user?.firstName, user?.lastName].filter(Boolean).map((part) => part!.trim()[0]).join("");
  return (letters || user?.username?.[0] || user?.email?.[0] || "?").toUpperCase().slice(0, 2);
}

const isCurrentCustomerOrder = (order: OrderListItem, session: ClientSession) => {
  const email = session.user?.email?.trim().toLowerCase();
  const id = session.user?.id?.trim();
  if (id && order.Client?.id === id) return true;
  if (email && order.Client?.email?.trim().toLowerCase() === email) return true;
  if (email && order.guestEmail?.trim().toLowerCase() === email) return true;
  return false;
};

const formatDate = (value: string, options: Intl.DateTimeFormatOptions = { dateStyle: "long" }) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("fr-FR", options).format(date);
};

const formatEuro = (value: number | null | undefined) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value ?? 0));

const readable = (value: string | null | undefined) => (value ?? "").replace(/_/g, " ").trim().toLowerCase();
const sentence = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

const orderCount = (products: unknown) => (Array.isArray(products) ? products.reduce((sum: number, item: { quantity?: number }) => sum + (Number(item?.quantity) || 1), 0) : 0);

type Overview = { orders: number | null; moreOrders: boolean; last: OrderListItem | null; addresses: number | null };

export function MonCompteClient() {
  const router = useRouter();
  const session = useSyncExternalStore(subscribeToClientSession, getClientSessionSnapshot, getServerSessionSnapshot);
  const [overview, setOverview] = useState<Overview | null>(null);

  // The figures are a bonus: when they cannot be read, the page still works and shows dashes.
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    const search = session.user?.email?.trim() || fullName(session) || session.user?.id || "";
    Promise.allSettled([getOrders({ limit: 30, search }), getClientAddresses(session.token)]).then(([ordersResult, addressesResult]) => {
      if (cancelled) return;
      const mine = ordersResult.status === "fulfilled" ? ordersResult.value.data.filter((order) => isCurrentCustomerOrder(order, session)) : null;
      const sorted = mine ? [...mine].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)) : null;
      setOverview({
        orders: mine ? mine.length : null,
        moreOrders: ordersResult.status === "fulfilled" ? ordersResult.value.meta.hasNextPage : false,
        last: sorted?.[0] ?? null,
        addresses: addressesResult.status === "fulfilled" ? addressesResult.value.data.length : null,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [session]);

  function logout() {
    clearClientSession();
    router.push("/login");
    router.refresh();
  }

  const crumbs = (
    <nav aria-label="Fil d’Ariane" className="ac-crumbs">
      <Link href="/">Accueil</Link>
      <span aria-hidden="true">/</span>
      <span aria-current="page">Mon compte</span>
    </nav>
  );

  if (!session) {
    return (
      <main className="ac">
        <div className="ac-wrap">
          {crumbs}
          <section className="ac-signin" aria-labelledby="ac-signin-title">
            <h1 id="ac-signin-title" className="ac-signin-title">Connectez-vous pour retrouver votre compte</h1>
            <p>Suivez vos commandes, gérez vos adresses et retrouvez vos documents au même endroit.</p>
            <div className="ac-signin-actions">
              <Link href="/login?returnTo=/mon-compte" className="ac-btn is-red">Se connecter<PiArrowRightBold className="size-4" aria-hidden="true" /></Link>
              <Link href="/signup" className="ac-btn is-line">Créer un compte</Link>
            </div>
          </section>
        </div>
      </main>
    );
  }

  const user = session.user;
  const loaded = overview !== null;
  const last = overview?.last ?? null;
  const countOf = (badge?: "orders" | "addresses") => (badge === "orders" ? overview?.orders : badge === "addresses" ? overview?.addresses : null);
  const sinceDate = user?.createdAt ? formatDate(user.createdAt, { month: "long", year: "numeric" }) : "";

  return (
    <main className="ac">
      <div className="ac-wrap">
        {crumbs}

        {/* ------------------------------------------------------------ the mat */}
        <section className="ac-hero" aria-labelledby="ac-name">
          <div className="ac-hero-top">
            <div className="ac-id">
              <span className="ac-avatar" aria-hidden="true">{initials(session)}</span>
              <div className="min-w-0">
                <p className="ac-hello">Bonjour</p>
                <h1 id="ac-name" className="ac-name">{firstName(session) || "à vous"}</h1>
                {user?.email ? <p className="ac-email">{user.email}</p> : null}
                <div className="ac-chips">
                  {user?.company ? <span className="ac-chip"><PiBuildingsDuotone className="size-4" aria-hidden="true" />{user.company}</span> : null}
                  {sinceDate ? <span className="ac-chip"><PiSealCheckDuotone className="size-4" aria-hidden="true" />Client depuis {sinceDate}</span> : null}
                </div>
              </div>
            </div>
            <button type="button" className="ac-logout" onClick={logout}>
              <PiSignOutBold className="size-4" aria-hidden="true" />
              Se déconnecter
            </button>
          </div>

          <ul className="ac-stats" aria-label="Votre compte en chiffres">
            <Stat label="Commandes" value={overview?.orders} suffix={overview?.moreOrders ? "+" : ""} loaded={loaded} />
            <Stat label="Adresses" value={overview?.addresses} loaded={loaded} />
            <li className="ac-stat">
              <p className="ac-stat-value">{!loaded ? <span className="ac-skeleton" style={{ width: "6ch" }} /> : last ? formatDate(last.createdAt, { day: "numeric", month: "short" }) : "–"}</p>
              <p className="ac-stat-label">Dernière commande</p>
            </li>
          </ul>
        </section>

        {/* ------------------------------------------------------------ the last order */}
        <section className="ac-section" aria-labelledby="ac-last">
          <h2 id="ac-last" className="ac-title">Ma dernière commande</h2>
          {!loaded ? (
            <div className="ac-empty" aria-busy="true"><p>Chargement de votre dernière commande…</p></div>
          ) : last ? (
            <article className="ac-ticket">
              <div className="ac-ticket-main">
                <p className="ac-ref">Commande n° {last.reference ?? last.id.slice(-8).toUpperCase()}</p>
                <p className="ac-order-title">{formatDate(last.createdAt)}</p>
                <span className="ac-status"><i aria-hidden="true" />{sentence(readable(last.etat) || "en cours")}</span>
                <p className="ac-order-meta">
                  <span>{orderCount(last.products)} article{orderCount(last.products) > 1 ? "s" : ""}</span>
                  {last.paymentStatus ? <span>Paiement : {readable(last.paymentStatus)}</span> : null}
                </p>
              </div>
              <div className="ac-ticket-side">
                <div>
                  <p className="ac-total-label">Total</p>
                  <p className="ac-total">{formatEuro(last.total)}</p>
                </div>
                <Link href="/mon-compte/commandes" className="ac-btn">Suivre mes commandes<PiArrowRightBold className="size-4" aria-hidden="true" /></Link>
              </div>
            </article>
          ) : (
            <div className="ac-empty">
              <strong>Pas encore de commande</strong>
              <p>Quand vous commanderez, le suivi apparaîtra ici.</p>
              <Link href="/categorie-produit" className="ac-btn is-red">Découvrir la boutique<PiArrowRightBold className="size-4" aria-hidden="true" /></Link>
            </div>
          )}
        </section>

        {/* ------------------------------------------------------------ the rooms */}
        <Rooms title="Mes achats" rooms={PURCHASES} countOf={countOf} />
        <Rooms title="Mon profil" rooms={PROFILE} countOf={countOf} />

        <aside className="ac-help" aria-label="Aide">
          <div className="ac-help-text">
            <span className="ac-help-icon" aria-hidden="true"><PiHeadsetDuotone className="size-7" /></span>
            <p>
              <strong>Une question sur votre compte ou une commande ?</strong>
              <span className="sub">Notre équipe vous répond avec une proposition claire.</span>
            </p>
          </div>
          <Link href="/informations" className="ac-btn is-line">Nous contacter</Link>
        </aside>
      </div>
    </main>
  );
}

function Stat({ label, value, suffix = "", loaded }: { label: string; value: number | null | undefined; suffix?: string; loaded: boolean }) {
  return (
    <li className="ac-stat">
      <p className="ac-stat-value">{!loaded ? <span className="ac-skeleton" /> : value == null ? "–" : `${value}${suffix}`}</p>
      <p className="ac-stat-label">{label}</p>
    </li>
  );
}

function Rooms({ title, rooms, countOf }: { title: string; rooms: AccountRoom[]; countOf: (badge?: "orders" | "addresses") => number | null | undefined }) {
  const headingId = `ac-${title.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <section className="ac-section" aria-labelledby={headingId}>
      <h2 id={headingId} className="ac-title">{title}</h2>
      <ul className="ac-grid">
        {rooms.map((room) => {
          const Icon = room.icon;
          const count = countOf(room.badge);
          const inner = (
            <>
              <div className="ac-tag-head">
                <span className="ac-tag-icon" aria-hidden="true"><Icon className="size-7" /></span>
                {room.href ? (count != null ? <span className="ac-count" aria-label={`${count}`}>{count}</span> : null) : <span className="ac-soon">Bientôt</span>}
              </div>
              <div>
                <h3 className="ac-tag-title">{room.title}</h3>
                <p className="ac-tag-text">{room.description}</p>
              </div>
              {room.href ? <span className="ac-tag-go">{room.cta}<PiArrowRightBold className="size-4" aria-hidden="true" /></span> : null}
            </>
          );
          return (
            <li key={room.id}>
              {room.href ? (
                <Link href={room.href} className={`ac-tag is-${room.tone}`}>{inner}</Link>
              ) : (
                <div className={`ac-tag is-soon is-${room.tone}`} aria-disabled="true">{inner}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
