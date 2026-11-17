"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertCircle, CreditCard, Loader2, PackageCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getImageUrl } from "@/lib/api";
import { getOrder, type OrderDetail, type StoredOrderProduct } from "@/lib/api/orders";
import { confirmStripePayment, createStripeCheckoutSession } from "@/lib/api/stripe";
import { Fireworks } from "./fireworks";

type Props =
  | { kind: "paid"; orderId: string; sessionId: string }
  | { kind: "cancelled"; orderId: string; sessionId?: undefined };

type Status = "checking" | "paid" | "unpaid" | "error" | "cancelled";

const euro = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

function money(value: number | null | undefined) {
  return euro.format(Number.isFinite(value) ? Number(value) : 0);
}

export function StripeReturn(props: Props) {
  const { kind, orderId, sessionId } = props;
  const [status, setStatus] = useState<Status>(kind === "paid" ? "checking" : "cancelled");
  const [mode, setMode] = useState<"sandbox" | "live" | null>(null);
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    if (kind !== "paid" || !sessionId) return;
    let cancelled = false;
    confirmStripePayment(orderId, sessionId)
      .then((result) => {
        if (cancelled) return;
        setMode(result.mode);
        setStatus(result.paid ? "paid" : "unpaid");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setMessage(error instanceof Error ? error.message : "Vérification impossible.");
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [kind, orderId, sessionId]);

  useEffect(() => {
    if (status !== "paid") return;
    let cancelled = false;
    getOrder(orderId)
      .then((data) => {
        if (!cancelled) setOrder(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [status, orderId]);

  async function retryPayment() {
    setIsRetrying(true);
    setMessage(null);
    try {
      const { url } = await createStripeCheckoutSession(orderId);
      window.location.assign(url);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Impossible de relancer le paiement.");
      setIsRetrying(false);
    }
  }

  if (status === "paid") {
    return <PaidReceipt orderId={orderId} order={order} testMode={mode === "sandbox"} />;
  }

  const copy: Record<Exclude<Status, "paid">, { title: string; text: string }> = {
    checking: { title: "Vérification du paiement", text: "Nous confirmons votre paiement auprès de Stripe." },
    unpaid: { title: "Paiement non confirmé", text: "Stripe n'a pas encore confirmé le règlement de cette commande." },
    error: { title: "Vérification impossible", text: "Nous n'avons pas pu confirmer le paiement." },
    cancelled: { title: "Paiement annulé", text: "Aucun débit n'a été effectué. Votre commande est enregistrée et attend son règlement." },
  };
  const current = copy[status];
  const canRetry = status === "cancelled" || status === "unpaid";

  return (
    <main className="min-h-[calc(100dvh-5rem)] bg-muted px-4 py-12 text-foreground">
      <div className="mx-auto max-w-xl overflow-hidden rounded-xl border border-border bg-background">
        <div className="flex flex-col items-center px-6 pt-10 pb-8 text-center">
          <div aria-hidden="true" className="grid size-14 place-items-center rounded-full bg-primary/10 text-primary">
            {status === "checking" ? (
              <Loader2 className="size-7 animate-spin" />
            ) : status === "cancelled" ? (
              <CreditCard className="size-7" />
            ) : (
              <AlertCircle className="size-7" />
            )}
          </div>
          <h1 className="mt-5! text-3xl! font-bold!" role="status">{current.title}</h1>
          <p className="mt-2! max-w-sm text-sm! leading-6 text-muted-foreground">{current.text}</p>
          <p className="mt-5! rounded-md bg-muted px-4 py-2 text-sm! font-semibold!">
            Commande n° {orderId.slice(-8)}
          </p>
          {message ? (
            <p role="alert" className="mt-4! max-w-sm text-sm! text-destructive">{message}</p>
          ) : null}
        </div>
        <div className="flex flex-col gap-3 border-t border-dashed border-border px-6 py-5 sm:flex-row sm:justify-center">
          {canRetry ? (
            <Button
              type="button"
              onClick={() => void retryPayment()}
              disabled={isRetrying}
              className="h-12 bg-destructive font-bold hover:bg-destructive/90">
              {isRetrying ? <Loader2 className="size-4 animate-spin" /> : <CreditCard className="size-4" />}
              Reprendre le paiement
            </Button>
          ) : null}
          <Button asChild variant={canRetry ? "outline" : "default"} className="h-12">
            <Link href="/">Continuer mes achats</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}

function PaidReceipt({
  orderId,
  order,
  testMode,
}: {
  orderId: string;
  order: OrderDetail | null;
  testMode: boolean;
}) {
  const products: StoredOrderProduct[] = Array.isArray(order?.products)
    ? (order.products as StoredOrderProduct[])
    : [];
  const date = order?.createdAt
    ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short" }).format(new Date(order.createdAt))
    : null;
  const quantity = products.reduce((sum, product) => sum + (product.quantity ?? 0), 0);

  return (
    <main className="min-h-[calc(100dvh-5rem)] bg-muted px-4 py-10 text-foreground sm:py-14">
      <Fireworks />
      <div className="mx-auto max-w-2xl">
        <div className="relative rounded-t-xl border border-b-0 border-border bg-background">
          <div
            aria-hidden="true"
            className="stamp-in pointer-events-none mx-5 mt-6 grid w-fit place-items-center rounded-md border-[3px] border-primary px-3 py-1 text-2xl font-bold leading-none tracking-widest text-primary sm:absolute sm:top-8 sm:right-8 sm:m-0 sm:px-4 sm:py-1.5 sm:text-3xl">
            PAYÉ
          </div>

          <header className="border-b border-dashed border-border px-5 pt-5 pb-6 sm:px-8 sm:pt-8">
            <h1 className="max-w-[12ch] text-4xl! leading-none! font-bold! sm:text-5xl!" role="status">
              Paiement reçu
            </h1>
            <p className="mt-3! max-w-md text-base! leading-6 text-muted-foreground">
              Merci, votre commande est confirmée et réglée par carte bancaire.
            </p>
            <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-3 text-sm">
              <div>
                <dt className="text-muted-foreground">Commande</dt>
                <dd className="font-semibold tabular-nums">n° {orderId.slice(-8)}</dd>
              </div>
              {date ? (
                <div>
                  <dt className="text-muted-foreground">Date</dt>
                  <dd className="font-semibold">{date}</dd>
                </div>
              ) : null}
              <div>
                <dt className="text-muted-foreground">Paiement</dt>
                <dd className="flex flex-wrap items-center gap-2 font-semibold">
                  Carte bancaire · Stripe
                  {testMode ? (
                    <span className="rounded-sm bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-900">
                      Paiement de test
                    </span>
                  ) : null}
                </dd>
              </div>
            </dl>
          </header>

          <section aria-label="Articles commandés" className="border-b border-dashed border-border px-5 py-6 sm:px-8">
            {order ? (
              products.length > 0 ? (
                <ul className="space-y-4">
                  {products.map((product, index) => {
                    const image = product.image?.trim() ? getImageUrl(product.image) : null;
                    return (
                      <li key={`${product.id ?? "item"}-${product.variantId ?? index}`} className="flex gap-4">
                        <div className="relative size-16 shrink-0 overflow-hidden rounded-md bg-muted">
                          {image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={image} alt={product.title ?? ""} className="h-full w-full object-cover" loading="lazy" />
                          ) : (
                            <div className="grid h-full w-full place-items-center text-muted-foreground">
                              <PackageCheck className="size-5" aria-hidden="true" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 text-sm! font-semibold!">{product.title}</p>
                          <p className="mt-1! text-xs! text-muted-foreground tabular-nums">
                            {product.quantity ?? 1} × {money(product.unitPrice)}
                          </p>
                        </div>
                        <p className="text-sm! font-bold! tabular-nums">{money(product.totalPrice)}</p>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm! text-muted-foreground">Le détail des articles n&apos;est pas disponible.</p>
              )
            ) : (
              <div className="space-y-3" aria-hidden="true">
                <div className="h-16 animate-pulse rounded-md bg-muted motion-reduce:animate-none" />
              </div>
            )}
          </section>

          {order ? (
            <section aria-label="Montants" className="space-y-3 px-5 py-6 text-sm sm:px-8">
              {order.priceHT != null ? <Row label="Produits HT" value={money(order.priceHT)} /> : null}
              {order.tva != null ? <Row label="TVA" value={money(order.tva)} /> : null}
              <Row label="Livraison" value={order.deliveryFee ? money(order.deliveryFee) : "Gratuit"} />
              <div className="flex items-baseline justify-between gap-4 border-t border-border pt-4">
                <span className="text-lg font-semibold">
                  Total payé{quantity ? ` · ${quantity} article${quantity > 1 ? "s" : ""}` : ""}
                </span>
                <span className="text-4xl font-bold leading-none tabular-nums">{money(order.total)}</span>
              </div>
            </section>
          ) : null}
        </div>
        <div
          aria-hidden="true"
          className="h-2 w-full"
          style={{
            background:
              "radial-gradient(circle at 8px 0, var(--muted) 5px, var(--background) 5.5px) 0 0 / 16px 8px repeat-x",
          }}
        />

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button asChild className="h-12 flex-1 text-base font-bold">
            <Link href="/">Continuer mes achats</Link>
          </Button>
          <Button asChild variant="outline" className="h-12 flex-1 text-base font-semibold">
            <Link href="/mon-compte/commandes">Voir mes commandes</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );
}
