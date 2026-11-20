"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Banner, BlockStack, Button, ButtonGroup, Card, EmptyState, InlineStack, Pagination, Spinner, Text, TextField } from "@shopify/polaris";
import { toast } from "sonner";

type Message = { id: string; name: string; email: string; phone: string | null; subject: string | null; message: string; isRead: boolean; createdAt: string };
type Result = { data: Message[]; meta: { total: number; page: number; totalPages: number; hasNextPage: boolean; hasPreviousPage: boolean } };

const LIMIT = 15;

async function call<T>(path = "", init?: RequestInit): Promise<T> {
  const response = await fetch(`/frontend-api/admin/contact${path}`, { cache: "no-store", ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(Array.isArray(data.message) ? data.message.join(" ") : data.message || "Action impossible.");
  return data as T;
}

const formatDate = (value: string) => new Date(value).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" });

/** The messages visitors send from the contact form. */
export default function MessagesPage() {
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // The search waits for a pause in typing.
  useEffect(() => {
    const id = window.setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(id);
  }, [search]);

  const load = useCallback(() => {
    const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
    if (query) params.set("search", query);
    if (filter === "unread") params.set("isRead", "false");
    call<Result>(`?${params.toString()}`)
      .then((loaded) => {
        setResult(loaded);
        setError(null);
      })
      .catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : "Impossible de charger les messages."));
  }, [page, query, filter]);
  useEffect(load, [load]);

  const selected = result?.data.find((message) => message.id === selectedId) ?? null;

  async function open(message: Message) {
    setSelectedId(message.id);
    if (message.isRead) return;
    try {
      await call(`/${message.id}/read`, { method: "PATCH" });
      setResult((current) => (current ? { ...current, data: current.data.map((item) => (item.id === message.id ? { ...item, isRead: true } : item)) } : current));
    } catch {
      // Reading the message still works; it just stays marked as new.
    }
  }

  async function remove(message: Message) {
    if (!window.confirm(`Supprimer le message de ${message.name} ? Cette action est définitive.`)) return;
    try {
      await call(`/${message.id}`, { method: "DELETE" });
      toast.success("Message supprimé.");
      setSelectedId(null);
      load();
    } catch (deleteError) {
      toast.error(deleteError instanceof Error ? deleteError.message : "Suppression impossible.");
    }
  }

  return (
    <BlockStack gap="400">
      <div className="flex flex-col gap-2 border-b border-[#dce4ea] pb-5">
        <Text as="h1" variant="heading2xl">Messages</Text>
        <Text as="p" tone="subdued">Les messages envoyés par vos visiteurs depuis le formulaire de contact.</Text>
      </div>

      {error ? <Banner tone="critical" title="Messages indisponibles">{error}</Banner> : null}

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Card padding="0">
          <div className="space-y-3 border-b border-[#edf0f3] p-4">
            <TextField label="Rechercher un message" labelHidden placeholder="Rechercher par nom, e-mail ou contenu" value={search} onChange={setSearch} autoComplete="off" clearButton onClearButtonClick={() => setSearch("")} />
            <ButtonGroup variant="segmented">
              <Button pressed={filter === "all"} onClick={() => { setFilter("all"); setPage(1); }}>Tous</Button>
              <Button pressed={filter === "unread"} onClick={() => { setFilter("unread"); setPage(1); }}>Non lus</Button>
            </ButtonGroup>
          </div>

          {!result ? (
            <div className="flex justify-center p-10"><Spinner accessibilityLabel="Chargement des messages" /></div>
          ) : result.data.length === 0 ? (
            <EmptyState heading={query || filter === "unread" ? "Aucun message ne correspond" : "Aucun message pour le moment"} image="">
              <p>{query || filter === "unread" ? "Essayez une autre recherche." : "Les messages du formulaire de contact apparaîtront ici."}</p>
            </EmptyState>
          ) : (
            <ul>
              {result.data.map((message) => (
                <li key={message.id} className="border-b border-[#edf0f3] last:border-b-0">
                  <button type="button" onClick={() => void open(message)} aria-current={message.id === selectedId ? "true" : undefined} className={`flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors hover:bg-[#f6f8fb] focus-visible:outline-2 focus-visible:outline-[#2456a6] ${message.id === selectedId ? "bg-[#eef4fc]" : ""}`}>
                    <span className="flex items-center justify-between gap-3">
                      <span className={`truncate text-sm ${message.isRead ? "font-medium text-[#344054]" : "font-bold text-[#0b1f4d]"}`}>{message.name}</span>
                      <span className="shrink-0 text-xs text-[#667085]">{formatDate(message.createdAt)}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      {!message.isRead ? <Badge tone="attention">Nouveau</Badge> : null}
                      <span className="truncate text-sm text-[#667085]">{message.subject || message.message}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {result && result.meta.totalPages > 1 ? (
            <div className="flex justify-center border-t border-[#edf0f3] p-3">
              <Pagination hasPrevious={result.meta.hasPreviousPage} hasNext={result.meta.hasNextPage} onPrevious={() => setPage((value) => value - 1)} onNext={() => setPage((value) => value + 1)} label={`Page ${result.meta.page} sur ${result.meta.totalPages}`} />
            </div>
          ) : null}
        </Card>

        <Card>
          {selected ? (
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="start" gap="300">
                <BlockStack gap="100">
                  <Text as="h2" variant="headingLg">{selected.subject || "Sans sujet"}</Text>
                  <Text as="p" tone="subdued">{formatDate(selected.createdAt)}</Text>
                </BlockStack>
                <ButtonGroup>
                  <Button variant="primary" url={`mailto:${selected.email}?subject=${encodeURIComponent(`Re : ${selected.subject || "votre message"}`)}`}>Répondre par e-mail</Button>
                  <Button tone="critical" onClick={() => void remove(selected)}>Supprimer</Button>
                </ButtonGroup>
              </InlineStack>

              <dl className="grid gap-3 rounded-xl bg-[#f6f8fb] p-4 text-sm sm:grid-cols-2">
                <div><dt className="text-xs font-semibold text-[#667085]">Nom</dt><dd className="mt-0.5 font-semibold text-[#1d2433]">{selected.name}</dd></div>
                <div><dt className="text-xs font-semibold text-[#667085]">E-mail</dt><dd className="mt-0.5"><a className="font-semibold text-[#2456a6] hover:underline" href={`mailto:${selected.email}`}>{selected.email}</a></dd></div>
                {selected.phone ? <div><dt className="text-xs font-semibold text-[#667085]">Téléphone</dt><dd className="mt-0.5"><a className="font-semibold text-[#2456a6] hover:underline" href={`tel:${selected.phone.replace(/\s+/g, "")}`}>{selected.phone}</a></dd></div> : null}
              </dl>

              <p className="whitespace-pre-wrap text-[15px] leading-7 text-[#1d2433]">{selected.message}</p>
            </BlockStack>
          ) : (
            <div className="grid min-h-48 place-items-center text-center text-sm text-[#667085]">Choisissez un message dans la liste pour le lire.</div>
          )}
        </Card>
      </div>
    </BlockStack>
  );
}
