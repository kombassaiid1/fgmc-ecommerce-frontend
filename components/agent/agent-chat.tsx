"use client";

import { FormEvent, KeyboardEvent, useMemo, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, isTextUIPart } from "ai";
import {
  ArrowUp,
  Bot,
  Check,
  CircleCheck,
  LoaderCircle,
  Sparkles,
  X,
} from "lucide-react";

type ConfirmationState = {
  status: "confirming" | "cancelling" | "confirmed" | "cancelled" | "error";
  result?: unknown;
  error?: string;
};

type ProductRecord = Record<string, unknown>;

const CONFIRMATION_ID_PATTERN =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i;

function findConfirmationId(text: string): string | null {
  if (!/(confirmation|required|confirmer|confirme|brouillon)/i.test(text)) {
    return null;
  }
  return text.match(CONFIRMATION_ID_PATTERN)?.[0] ?? null;
}

function isRecord(value: unknown): value is ProductRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readActionResponse(response: Response): Promise<unknown> {
  const payload: unknown = await response.json().catch(() => null);
  if (response.ok) return payload;

  if (response.status === 401) {
    throw new Error("Votre session administrateur a expiré. Reconnectez-vous.");
  }
  if (response.status === 403) {
    throw new Error("Votre compte n’a pas accès à cette action Agent.");
  }
  if (response.status === 502) {
    throw new Error("Le service Agent est momentanément indisponible.");
  }
  if (isRecord(payload) && typeof payload.message === "string") {
    throw new Error(payload.message);
  }
  throw new Error("L’action n’a pas pu aboutir. Réessayez.");
}

const QUICK_ACTIONS = [
  { label: "Ajouter un produit", prompt: "Aide-moi à ajouter un produit." },
  { label: "Rechercher un produit", prompt: "Aide-moi à rechercher un produit." },
  { label: "Améliorer une fiche", prompt: "Aide-moi à améliorer une fiche produit." },
];

function getErrorMessage(error: Error | undefined): string | null {
  if (!error) return null;
  const message = error.message.toLowerCase();
  const statusCode =
    "statusCode" in error && typeof error.statusCode === "number"
      ? error.statusCode
      : undefined;

  if (statusCode === 401 || message.includes("401") || message.includes("unauthorized")) {
    return "Votre session administrateur a expiré. Reconnectez-vous pour continuer.";
  }
  if (statusCode === 403 || message.includes("403") || message.includes("forbidden")) {
    return "Votre compte n’a pas accès à l’Agent FGMC.";
  }
  if (
    statusCode === 429 ||
    message.includes("429") ||
    message.includes("rate limit") ||
    message.includes("rate-limited")
  ) {
    return "Le modèle est temporairement limité par son fournisseur. Réessayez dans un instant.";
  }
  if (
    statusCode === 502 ||
    message.includes("502") ||
    message.includes("failed to fetch") ||
    message.includes("network") ||
    message.includes("fetch")
  ) {
    return "Le service Agent est momentanément indisponible. Réessayez dans un instant.";
  }
  return "La réponse n’a pas pu être générée. Réessayez.";
}

export function AgentChat() {
  const [input, setInput] = useState("");
  const [confirmationStates, setConfirmationStates] = useState<
    Record<string, ConfirmationState>
  >({});
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/admin/agent/chat",
        prepareSendMessagesRequest: ({ messages }) => {
          const lastUserMessage = [...messages]
            .reverse()
            .find((message) => message.role === "user");
          const message =
            lastUserMessage?.parts
              .filter(isTextUIPart)
              .map((part) => part.text)
              .join("") ?? "";

          return { body: { message } };
        },
      }),
    [],
  );
  const { messages, sendMessage, status, error, clearError } = useChat({ transport });
  const isBusy = status === "submitted" || status === "streaming";
  const friendlyError = getErrorMessage(error);

  async function runConfirmationAction(
    confirmationId: string,
    action: "confirm" | "cancel",
  ) {
    setConfirmationStates((current) => ({
      ...current,
      [confirmationId]: { status: action === "confirm" ? "confirming" : "cancelling" },
    }));

    try {
      const response = await fetch(`/api/admin/agent/chat/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmationId }),
      });
      const payload = await readActionResponse(response);
      setConfirmationStates((current) => ({
        ...current,
        [confirmationId]:
          action === "confirm"
            ? {
                status: "confirmed",
                result: isRecord(payload) ? payload.response : payload,
              }
            : { status: "cancelled" },
      }));
    } catch (actionError: unknown) {
      setConfirmationStates((current) => ({
        ...current,
        [confirmationId]: {
          status: "error",
          error:
            actionError instanceof Error
              ? actionError.message
              : "L’action n’a pas pu aboutir. Réessayez.",
        },
      }));
    }
  }

  async function submitMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isBusy) return;

    clearError();
    setInput("");
    await sendMessage({ text: trimmed });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitMessage(input);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submitMessage(input);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#f8fafc]">
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-5 sm:px-5">
        {messages.length === 0 ? (
          <div className="flex flex-1 flex-col justify-center">
            <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-blue-50 text-[#0858b1]">
              <Sparkles size={22} />
            </div>
            <h3 className="text-center text-base font-semibold text-slate-900">
              Bonjour, comment puis-je vous aider ?
            </h3>
            <p className="mx-auto mt-2 max-w-xs text-center text-sm leading-6 text-slate-500">
              Posez une question à votre assistant d’administration FGMC.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {QUICK_ACTIONS.map((action) => (
                <button
                  key={action.label}
                  type="button"
                  disabled={isBusy}
                  onClick={() => setInput(action.prompt)}
                  className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-[#0858b1] disabled:opacity-50"
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message) => {
            const text = message.parts
              .filter(isTextUIPart)
              .map((part) => part.text)
              .join("");
            if (!text) return null;

            const isUser = message.role === "user";
            const confirmationId = isUser ? null : findConfirmationId(text);
            const confirmation = confirmationId
              ? confirmationStates[confirmationId]
              : undefined;
            const confirmationBusy =
              confirmation?.status === "confirming" ||
              confirmation?.status === "cancelling";
            const productSummary = confirmationId
              ? text.replace(CONFIRMATION_ID_PATTERN, "").trim()
              : "";
            const createdProduct = isRecord(confirmation?.result)
              ? confirmation.result
              : null;

            return (
              <div
                key={message.id}
                className={`flex items-end gap-2 ${isUser ? "justify-end" : "justify-start"}`}
              >
                {!isUser && (
                  <span className="mb-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[#0858b1]">
                    <Bot size={15} />
                  </span>
                )}
                <div
                  className={`flex max-w-[84%] flex-col gap-2 ${isUser ? "items-end" : "items-start"}`}
                >
                  <div
                    className={`max-w-full whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-sm leading-6 ${
                    isUser
                      ? "rounded-br-md bg-[#0858b1] text-white"
                      : "rounded-bl-md border border-slate-100 bg-white text-slate-700 shadow-sm"
                    }`}
                  >
                    {text}
                  </div>
                {confirmationId && (
                  <section
                    aria-label="Confirmation de création du brouillon produit"
                    className="w-full rounded-2xl border border-blue-100 bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-start gap-2.5">
                      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#0858b1]">
                        <Sparkles size={16} aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-semibold text-slate-900">
                          {confirmation?.status === "confirmed"
                            ? "Brouillon créé"
                            : confirmation?.status === "cancelled"
                              ? "Action annulée"
                              : "Confirmer la création du brouillon"}
                        </h4>
                        <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-5 text-slate-600">
                          {productSummary || "Le produit sera créé en statut DRAFT."}
                        </p>
                        {(confirmation?.status === "confirming" ||
                          confirmation?.status === "cancelling") && (
                          <p className="mt-2 flex items-center gap-2 text-xs text-slate-500" aria-live="polite">
                            <LoaderCircle size={14} className="animate-spin" />
                            {confirmation.status === "confirming"
                              ? "Création du brouillon…"
                              : "Annulation…"}
                          </p>
                        )}
                        {confirmation?.status === "confirmed" && createdProduct && (
                          <div className="mt-3 rounded-xl bg-emerald-50 px-3 py-2.5 text-xs text-emerald-900">
                            <p className="flex items-center gap-1.5 font-semibold">
                              <CircleCheck size={15} aria-hidden="true" />
                              {typeof createdProduct.title === "string"
                                ? createdProduct.title
                                : "Produit enregistré"}
                            </p>
                            <p className="mt-1 text-emerald-800">
                              {typeof createdProduct.sku === "string"
                                ? `SKU : ${createdProduct.sku} · `
                                : ""}
                              Statut : {typeof createdProduct.status === "string" ? createdProduct.status : "DRAFT"}
                            </p>
                            {typeof createdProduct.price === "string" && (
                              <p className="mt-1 text-emerald-800">Prix : {createdProduct.price}</p>
                            )}
                            {isRecord(createdProduct.brand) && typeof createdProduct.brand.name === "string" && (
                              <p className="mt-1 text-emerald-800">Marque : {createdProduct.brand.name}</p>
                            )}
                            {Array.isArray(createdProduct.categories) && createdProduct.categories.length > 0 && (
                              <p className="mt-1 text-emerald-800">
                                Catégories : {createdProduct.categories
                                  .filter((category): category is ProductRecord => isRecord(category))
                                  .map((category) => category.name)
                                  .filter((name): name is string => typeof name === "string")
                                  .join(", ")}
                              </p>
                            )}
                            {typeof createdProduct.id === "string" && (
                              <p className="mt-1 break-all text-emerald-800">
                                Référence : {createdProduct.id}
                              </p>
                            )}
                          </div>
                        )}
                        {confirmation?.status === "cancelled" && (
                          <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-slate-600" role="status">
                            <X size={14} aria-hidden="true" />
                            La création a été annulée. Aucun produit n’a été créé.
                          </p>
                        )}
                        {confirmation?.status === "error" && (
                          <p className="mt-2 text-xs leading-5 text-red-700" role="alert">
                            {confirmation.error}
                          </p>
                        )}
                        {!confirmation ||
                        confirmation.status === "error" ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={isBusy || confirmationBusy}
                              onClick={() => void runConfirmationAction(confirmationId, "confirm")}
                              className="inline-flex items-center gap-1.5 rounded-xl bg-[#0858b1] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#064990] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {confirmationBusy ? (
                                <LoaderCircle size={14} className="animate-spin" />
                              ) : (
                                <Check size={14} />
                              )}
                              Confirmer
                            </button>
                            <button
                              type="button"
                              disabled={isBusy || confirmationBusy}
                              onClick={() => void runConfirmationAction(confirmationId, "cancel")}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <X size={14} />
                              Annuler
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </section>
                )}
                </div>
              </div>
            );
          })
        )}
        {status === "submitted" && (
          <div className="flex items-end gap-2" aria-live="polite">
            <span className="flex size-7 items-center justify-center rounded-full bg-blue-100 text-[#0858b1]">
              <Bot size={15} />
            </span>
            <div className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-slate-100 bg-white px-3.5 py-3 text-xs text-slate-500 shadow-sm">
              <LoaderCircle size={15} className="animate-spin text-[#0858b1]" />
              L’agent réfléchit…
            </div>
          </div>
        )}
        {friendlyError && (
          <p
            role="alert"
            className="rounded-xl border border-red-100 bg-red-50 px-3.5 py-3 text-sm leading-5 text-red-700"
          >
            {friendlyError}
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="shrink-0 border-t border-slate-200 bg-white p-3 sm:p-4">
        <div className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm transition focus-within:border-blue-300 focus-within:ring-2 focus-within:ring-blue-100">
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Écrivez votre message…"
            aria-label="Votre message"
            rows={1}
            disabled={isBusy}
            className="max-h-28 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-sm leading-5 text-slate-800 outline-none placeholder:text-slate-400 disabled:opacity-60"
          />
          <button
            type="submit"
            aria-label="Envoyer le message"
            disabled={!input.trim() || isBusy}
            className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#0858b1] text-white transition hover:bg-[#064990] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
          >
            {isBusy ? <LoaderCircle size={18} className="animate-spin" /> : <ArrowUp size={19} />}
          </button>
        </div>
        <p className="mt-2 text-center text-[10px] text-slate-400">
          Entrée pour envoyer · Maj + Entrée pour une nouvelle ligne
        </p>
      </form>
    </div>
  );
}
