"use client";

import Link from "next/link";
import { type ReactNode, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock3,
  CreditCard,
  Eye,
  Loader2,
  PackageCheck,
  ReceiptText,
  RefreshCw,
  Search,
  ShoppingBag,
  Truck,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
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
  getOrders,
  type OrderListItem,
  type StoredOrderProduct,
} from "@/lib/api/orders";
import {
  getClientSession,
  subscribeToClientSession,
  type ClientSession,
} from "@/lib/client-auth";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 10;

const ALL_VALUE = "all";

const ETAT_OPTIONS = [
  { label: "Tous les etats", value: ALL_VALUE },
  { label: "En cours", value: "En_cours" },
  { label: "Confirmees", value: "Confirmées" },
  { label: "Expediees", value: "Expédiées" },
  { label: "Annulees", value: "Annulées" },
  { label: "Retour", value: "Retour" },
];

const PAYMENT_OPTIONS = [
  { label: "Tous les paiements", value: ALL_VALUE },
  { label: "Payees", value: "paid" },
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

export function CommandesClient() {
  const session = useSyncExternalStore(
    subscribeToClientSession,
    getClientSessionSnapshot,
    getServerSessionSnapshot,
  );
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
    if (!session || !customerSearch) return;

    let cancelled = false;
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await getOrders({
          page,
          limit: PAGE_SIZE,
          search: customerSearch,
          etat: etat === ALL_VALUE ? undefined : etat,
          paymentStatus:
            paymentStatus === ALL_VALUE ? undefined : paymentStatus,
        });

        if (cancelled) return;
        setOrders(response.data);
        setMeta(response.meta);
      } catch (loadError) {
        if (cancelled) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Impossible de charger vos commandes.",
        );
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
    return orders
      .filter((order) => isCurrentCustomerOrder(order, session))
      .filter((order) => matchesLocalQuery(order, query));
  }, [orders, query, session]);

  const stats = useMemo(() => {
    const paidCount = customerOrders.filter((order) =>
      normalizeStatus(order.paymentStatus).includes("pay"),
    ).length;
    const activeCount = customerOrders.filter(
      (order) => !normalizeStatus(order.etat).includes("annul"),
    ).length;
    const totalSpent = customerOrders.reduce(
      (sum, order) => sum + Number(order.total ?? 0),
      0,
    );

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
      <AccountShell current="Commandes">
        <section className="mx-auto flex min-h-[420px] max-w-xl flex-col items-center justify-center rounded-md border border-border bg-white px-6 py-12 text-center shadow-sm">
          <div className="grid size-14 place-items-center rounded-md bg-primary/10 text-primary">
            <ReceiptText className="size-7" />
          </div>
          <h1 className="mt-5 text-2xl font-bold text-[#101828]">
            Connectez-vous pour voir vos commandes
          </h1>
          <p className="mt-2 text-sm leading-6 text-[#667085]">
            Votre historique est rattache a votre compte client FGMC.
          </p>
          <Button asChild className="mt-6 h-11 px-5">
            <Link href="/login">Connexion client</Link>
          </Button>
        </section>
      </AccountShell>
    );
  }

  return (
    <AccountShell current="Commandes">
      <section className="overflow-hidden rounded-md border border-border bg-white shadow-[0_12px_28px_rgba(16,24,40,0.08)]">
        <div className="border-b border-border bg-linear-to-r from-primary/10 via-white to-destructive/10 px-5 py-6 sm:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase text-primary">
                Historique client
              </p>
              <h1 className="mt-2 text-2xl font-bold text-[#101828] sm:text-3xl">
                Mes commandes
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#667085]">
                Consultez vos achats, les statuts de livraison et les details de
                paiement.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="h-11 bg-white"
              disabled={loading}
              onClick={reload}>
              {loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              Actualiser
            </Button>
          </div>
        </div>

        <div className="grid gap-4 border-b border-border p-5 sm:grid-cols-3 sm:p-6 lg:p-8">
          <SummaryCard
            icon={ShoppingBag}
            label="Commandes"
            value={String(customerOrders.length)}
            helper={`Page ${String(meta.page)} / ${String(Math.max(1, meta.totalPages))}`}
          />
          <SummaryCard
            icon={CheckCircle2}
            label="Paiements valides"
            value={String(stats.paidCount)}
            helper={`${String(stats.activeCount)} commande(s) actives`}
          />
          <SummaryCard
            icon={CreditCard}
            label="Total page"
            value={formatEuro(stats.totalSpent)}
            helper="Montant TTC affiche"
          />
        </div>

        <div className="border-b border-border p-5 sm:p-6 lg:p-8">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_210px_220px]">
            <div className="space-y-2">
              <Label htmlFor="orders-search">Recherche</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#667085]" />
                <Input
                  id="orders-search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Reference, produit, adresse..."
                  className="h-11 bg-white pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="orders-status">Etat</Label>
              <Select
                value={etat}
                onValueChange={(value) => {
                  setPage(1);
                  setEtat(value);
                }}>
                <SelectTrigger id="orders-status" className="h-11 w-full bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ETAT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="orders-payment">Paiement</Label>
              <Select
                value={paymentStatus}
                onValueChange={(value) => {
                  setPage(1);
                  setPaymentStatus(value);
                }}>
                <SelectTrigger id="orders-payment" className="h-11 w-full bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="p-5 sm:p-6 lg:p-8">
          {error ? (
            <StatusMessage tone="error" icon={AlertCircle}>
              {error}
            </StatusMessage>
          ) : null}

          {loading ? (
            <div className="grid gap-4">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={index}
                  className="h-44 animate-pulse rounded-md border border-border bg-[#f7f8fa]"
                />
              ))}
            </div>
          ) : customerOrders.length === 0 ? (
            <EmptyOrdersState hasFilters={Boolean(query.trim()) || etat !== ALL_VALUE || paymentStatus !== ALL_VALUE} />
          ) : (
            <div className="grid gap-4">
              {customerOrders.map((order) => (
                <OrderCard key={order.id} order={order} />
              ))}
            </div>
          )}

          <div className="mt-6 flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-[#667085]">
              {`Page ${String(meta.page)} sur ${String(Math.max(1, meta.totalPages))}`}
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={loading || !meta.hasPreviousPage}
                onClick={() => setPage((current) => Math.max(1, current - 1))}>
                Precedent
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={loading || !meta.hasNextPage}
                onClick={() =>
                  setPage((current) =>
                    Math.min(Math.max(1, meta.totalPages), current + 1),
                  )
                }>
                Suivant
              </Button>
            </div>
          </div>
        </div>
      </section>
    </AccountShell>
  );
}

function AccountShell({
  children,
  current,
}: {
  children: React.ReactNode;
  current: string;
}) {
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
          <span aria-current="page">{current}</span>
        </nav>
      </div>

      <section className="mx-auto w-full max-w-[1320px] px-4 pt-6 pb-16 sm:px-8">
        <Link
          href="/mon-compte"
          className="inline-flex min-h-10 items-center gap-2 rounded-md text-sm font-semibold text-primary hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
          <ArrowLeft className="size-4" />
          Retour a mon compte
        </Link>
        <div className="mt-4">{children}</div>
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

function SummaryCard({
  icon: Icon,
  label,
  value,
  helper,
}: {
  icon: typeof ShoppingBag;
  label: string;
  value: ReactNode;
  helper: string;
}) {
  return (
    <article className="rounded-md border border-[#d8dde6] bg-[#fbfcfe] p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase text-[#667085]">{label}</p>
          <p className="mt-2 text-2xl font-bold text-[#101828]">{value}</p>
          <p className="mt-1 text-sm text-[#667085]">{helper}</p>
        </div>
        <div className="grid size-10 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
          <Icon className="size-5" />
        </div>
      </div>
    </article>
  );
}

function OrderCard({ order }: { order: OrderListItem }) {
  const products = getProducts(order);
  const address = getDeliveryAddress(order);

  return (
    <article className="rounded-md border border-[#d8dde6] bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-border p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-bold text-[#101828]">
              Commande {shortOrderId(order.id)}
            </h2>
            <StatusBadge value={order.etat} type="order" />
            <StatusBadge value={order.paymentStatus} type="payment" />
          </div>
          <p className="mt-2 flex items-center gap-2 text-sm text-[#667085]">
            <CalendarDays className="size-4" />
            {formatDate(order.createdAt)}
          </p>
        </div>

        <div className="flex items-center justify-between gap-4 sm:block sm:text-right">
          <p className="text-xs font-bold uppercase text-[#667085]">Total TTC</p>
          <p className="mt-1 text-2xl font-bold text-destructive">
            {formatEuro(order.total)}
          </p>
        </div>
      </div>

      <div className="grid gap-5 p-4 lg:grid-cols-[minmax(0,1fr)_280px] sm:p-5">
        <div className="min-w-0">
          <div className="mb-3 flex items-center gap-2 text-sm font-bold text-[#101828]">
            <PackageCheck className="size-4 text-primary" />
            Articles commandes
          </div>
          {products.length === 0 ? (
            <p className="rounded-md border border-dashed border-border bg-[#fbfcfe] px-4 py-3 text-sm text-[#667085]">
              Aucun detail produit disponible.
            </p>
          ) : (
            <div className="grid gap-3">
              {products.map((product, index) => (
                <ProductLine key={`${product.id ?? product.title ?? "product"}-${index}`} product={product} />
              ))}
            </div>
          )}
        </div>

        <aside className="grid content-start gap-3 rounded-md border border-[#e4e7ec] bg-[#fbfcfe] p-4 text-sm">
          <DetailRow
            icon={Truck}
            label="Livraison"
            value={address || "Adresse non disponible"}
          />
          <DetailRow
            icon={CreditCard}
            label="Paiement"
            value={readableStatus(order.paymentStatus)}
          />
          <DetailRow
            icon={Clock3}
            label="Etat"
            value={readableStatus(order.etat)}
          />
          <DetailRow
            icon={ReceiptText}
            label="Facture Dolibarr"
            value={order.dolibarrInvoice ? (
              <span className="grid gap-1">
                <span>{order.dolibarrInvoice.reference} - {readableStatus(order.dolibarrInvoice.status ?? "validated")}</span>
                {order.dolibarrInvoice.invoiceUrl ? (
                  <a
                    href={order.dolibarrInvoice.invoiceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-primary underline underline-offset-2"
                  >
                    Telecharger la facture PDF
                  </a>
                ) : null}
              </span>
            ) : order.dolibarrId ? "En attente de synchronisation" : "Pas encore disponible"}
            wrap
          />
          <DetailRow
            icon={ReceiptText}
            label="Reference commande"
            value={order.id}
            wrap
          />
        </aside>
      </div>
    </article>
  );
}

function ProductLine({ product }: { product: StoredOrderProduct }) {
  const image = product.image?.trim() ? getImageUrl(product.image) : null;
  const title = product.title?.trim() || "Produit";
  const quantity = Math.max(0, Number(product.quantity ?? 0));

  return (
    <div className="flex gap-3 rounded-md border border-border bg-white p-3">
      <div className="relative size-16 shrink-0 overflow-hidden rounded-md bg-[#eef2f7]">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt={title}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-[#667085]">
            <ShoppingBag className="size-5" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-sm font-semibold text-[#101828]">
          {title}
        </p>
        {product.variantId ? (
          <p className="mt-1 break-words text-xs text-[#667085]">
            Variante: {product.variantId}
          </p>
        ) : null}
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="text-[#667085]">{String(quantity)} piece(s)</span>
          <span className="font-bold text-[#101828]">
            {formatEuro(product.totalPrice ?? product.unitPrice ?? 0)}
          </span>
        </div>
      </div>
    </div>
  );
}

function DetailRow({
  icon: Icon,
  label,
  value,
  wrap = false,
}: {
  icon: typeof Truck;
  label: string;
  value: ReactNode;
  wrap?: boolean;
}) {
  return (
    <div className="flex gap-3">
      <div className="grid size-8 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
        <Icon className="size-4" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase text-[#667085]">{label}</p>
        <p
          className={cn(
            "mt-0.5 text-sm font-medium text-[#101828]",
            wrap ? "break-all" : "break-words",
          )}>
          {value}
        </p>
      </div>
    </div>
  );
}

function EmptyOrdersState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center rounded-md border border-dashed border-[#c8d0dc] bg-[#fbfcfe] px-6 py-12 text-center">
      <div className="grid size-14 place-items-center rounded-md bg-primary/10 text-primary">
        {hasFilters ? <Search className="size-7" /> : <Eye className="size-7" />}
      </div>
      <h2 className="mt-5 text-xl font-bold text-[#101828]">
        {hasFilters ? "Aucune commande trouvee" : "Aucune commande pour le moment"}
      </h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-[#667085]">
        {hasFilters
          ? "Essayez avec un autre filtre ou une autre reference."
          : "Vos prochaines commandes apparaitront ici apres validation."}
      </p>
      {!hasFilters ? (
        <Button asChild className="mt-6 h-11 px-5">
          <Link href="/">Continuer mes achats</Link>
        </Button>
      ) : null}
    </div>
  );
}

function StatusMessage({
  children,
  icon: Icon,
  tone,
}: {
  children: React.ReactNode;
  icon: typeof AlertCircle;
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

function StatusBadge({
  value,
  type,
}: {
  value: string;
  type: "order" | "payment";
}) {
  const normalized = normalizeStatus(value);
  const variant =
    normalized.includes("annul") || normalized.includes("echou")
      ? "destructive"
      : normalized.includes("pay") ||
          normalized.includes("confirm") ||
          normalized.includes("exp")
        ? "default"
        : "secondary";

  return (
    <Badge
      variant={variant}
      className={type === "payment" && variant === "default" ? "bg-[#101828]" : ""}>
      {readableStatus(value)}
    </Badge>
  );
}

function getCustomerSearch(session: ClientSession | null) {
  const user = session?.user;
  const fullName = [user?.firstName, user?.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();

  return user?.email?.trim() || fullName || user?.id || "";
}

function isCurrentCustomerOrder(
  order: OrderListItem,
  session: ClientSession | null,
) {
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
    readableStatus(order.etat),
    readableStatus(order.paymentStatus),
    getDeliveryAddress(order),
    ...products.flatMap((product) => [
      product.title ?? "",
      product.slug ?? "",
      product.variantId ?? "",
    ]),
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(normalizedQuery);
}

function getProducts(order: OrderListItem): StoredOrderProduct[] {
  return Array.isArray(order.products)
    ? (order.products as StoredOrderProduct[])
    : [];
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
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/_/g, " ")
    .trim()
    .toLowerCase();
}

function readableStatus(value: string | null | undefined) {
  return (value ?? "-").replace(/_/g, " ").trim() || "-";
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
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
