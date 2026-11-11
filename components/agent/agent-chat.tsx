"use client";

import { ClipboardEvent, FormEvent, KeyboardEvent, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { AgentActivity, type AgentEvent } from "./agent-activity";
import { SiteFavicon, getPublicSiteDomain } from "./site-favicon";
import { parseBlocks, parseInline, type InlineNode } from "./markdown-parser";
import { RAW_TOOL_CALL_NOTICE, isRawToolCallText } from "./raw-tool-call";
import { collectResourceLinks } from "./resource-links";
import { describeSendError, type SendFailure } from "./send-error";
import { useChat } from "@ai-sdk/react";
import { SupplierBatchCard, type SupplierBatch } from "./supplier-batch-card";
import { isFileUIPart, isTextUIPart } from "ai";
import Image from "next/image";
import { type AgentUIMessage, type AgentTaskStatus, useAgentChatStore } from "./agent-chat-store";
import {
  ArrowUp,
  Bot,
  Check,
  Clock3,
  ExternalLink,
  CircleCheck,
  LoaderCircle,
  MessageSquarePlus,
  RotateCw,
  History,
  Sparkles,
  Square,
  X,
} from "lucide-react";

type ConfirmationState = {
  status: "confirming" | "cancelling" | "confirmed" | "cancelled" | "error" | "expired";
  result?: unknown;
  error?: string;
};

type ProductRecord = Record<string, unknown>;

type AgentConversationSummary = {
  sessionId: string;
  title: string;
  updatedAt: string;
  messageCount: number;
};

type AgentHistoryItem = {
  id: string;
  role: "user" | "assistant";
  content: string;
  events?: AgentEvent[];
};

async function fetchAgentConversations(): Promise<AgentConversationSummary[]> {
  const response = await fetch("/api/admin/agent/chat/conversations", {
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Impossible de charger les conversations.");
  const result: unknown = await response.json();
  return Array.isArray(result) ? (result as AgentConversationSummary[]) : [];
}

async function fetchAgentHistory(sessionId: string): Promise<AgentHistoryItem[]> {
  const response = await fetch(
    `/api/admin/agent/chat?sessionId=${encodeURIComponent(sessionId)}`,
    { cache: "no-store" },
  );
  if (!response.ok) throw new Error("Impossible de charger la conversation.");
  const result: unknown = await response.json();
  return Array.isArray(result) ? (result as AgentHistoryItem[]) : [];
}

async function fetchAgentTaskStatus(sessionId: string): Promise<AgentTaskStatus> {
  const response = await fetch(
    `/api/admin/agent/chat/task?sessionId=${encodeURIComponent(sessionId)}`,
    { cache: "no-store" },
  );
  if (!response.ok) throw new Error("Impossible de vérifier l’avancement de l’Agent.");
  const result: unknown = await response.json();
  if (!isRecord(result) || !["idle", "running", "completed", "failed"].includes(String(result.status))) {
    return { status: "idle" };
  }
  return result as AgentTaskStatus;
}

async function fetchSupplierBatch(sessionId: string): Promise<SupplierBatch | null> {
  const response = await fetch(`/api/admin/agent/chat/batches?sessionId=${encodeURIComponent(sessionId)}`, { cache: "no-store" });
  if (!response.ok) throw new Error("Impossible de charger le lot fournisseur.");
  const result: unknown = await response.json();
  return isRecord(result) && typeof result.id === "string" ? result as unknown as SupplierBatch : null;
}

function toUiMessages(
  history: AgentHistoryItem[],
  task?: AgentTaskStatus,
): AgentUIMessage[] {
  const messages = history.map((item): AgentUIMessage => ({
    id: item.id,
    role: item.role,
    parts: [{ type: "text", text: item.content }, ...(item.events ?? []).map(event => ({ type: "data-agent-event" as const, id: event.id, data: event }))],
  }));
  const lastUserContent = history.findLast((item) => item.role === "user")?.content;
  const alreadyInHistory = lastUserContent !== undefined && lastUserContent.startsWith(task?.message ?? "\u0000");
  // Relance : le dernier message utilisateur est déjà dans l'historique, ne pas l'afficher deux fois.
  if (task?.status === "running" && task.message && history.at(-1)?.role !== "user" && !alreadyInHistory) {
    messages.push({
      id: `pending-${task.taskId ?? "agent"}`,
      role: "user",
      parts: [{ type: "text", text: `${task.message}${task.hasImage ? "\n[Image jointe]" : ""}` }],
    });
  }
  return messages;
}

function formatConversationDate(value: string): string {
  const date = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
  }).format(new Date(value));
  const time = new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
  return `${date}, ${time}`;
}

function formatWorkedDuration(durationMs: number): string {
  const totalSeconds = Math.max(1, Math.round(durationMs / 1000));
  if (totalSeconds < 60) return `A travaillé pendant ${totalSeconds} s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return seconds
    ? `A travaillé pendant ${minutes} min ${seconds} s`
    : `A travaillé pendant ${minutes} min`;
}


const CONFIRMATION_ID_PATTERN =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i;

function findConfirmationId(text: string): string | null {
  if (!/(confirmation|required|confirmer|confirme|brouillon|publier|publication)/i.test(text)) {
    return null;
  }
  return text.match(CONFIRMATION_ID_PATTERN)?.[0] ?? null;
}

function isRecord(value: unknown): value is ProductRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function renderInlineNodes(nodes: InlineNode[], keyPrefix: string): ReactNode[] {
  return nodes.map((node, index) => {
    const key = `${keyPrefix}-${index}`;
    switch (node.type) {
      case "image":
        return (
          <Image
            key={key}
            src={node.url}
            alt={node.alt || "Image extraite du fournisseur"}
            width={480}
            height={360}
            unoptimized
            className="my-2 max-h-56 max-w-full rounded-lg object-contain"
          />
        );
      case "link": {
        const siteDomain = getPublicSiteDomain(node.url);
        if (siteDomain) {
          return (
            <a
              key={key}
              href={node.url}
              target="_blank"
              rel="noopener noreferrer"
              title={node.text}
              className="inline-flex max-w-full items-center gap-1.5 align-bottom text-[#0858b1] underline"
            >
              <SiteFavicon domain={siteDomain} />
              <span className="min-w-0 truncate">{node.text}</span>
            </a>
          );
        }
        return (
          <a
            key={key}
            href={node.url}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all text-[#0858b1] underline"
          >
            {node.text}
          </a>
        );
      }
      case "strong":
        return <strong key={key} className="font-semibold">{renderInlineNodes(node.children, key)}</strong>;
      case "em":
        return <em key={key}>{renderInlineNodes(node.children, key)}</em>;
      case "code":
        return <code key={key} className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.9em]">{node.text}</code>;
      default:
        return node.text;
    }
  });
}

function renderInlineMarkdown(text: string, keyPrefix: string): ReactNode[] {
  return renderInlineNodes(parseInline(text), keyPrefix);
}

function renderAgentMarkdown(text: string): ReactNode {
  const blocks = parseBlocks(text).map((block, index): ReactNode => {
    switch (block.type) {
      case "hr":
        return <hr key={`hr-${index}`} className="my-3 border-slate-200" />;
      case "heading":
        return (
          <p
            key={`heading-${index}`}
            role="heading"
            aria-level={block.level}
            className={`mt-1 font-semibold text-slate-800 ${block.level <= 2 ? "text-[15px]" : ""}`}
          >
            {renderInlineMarkdown(block.text, `heading-${index}`)}
          </p>
        );
      case "list": {
        const List = block.ordered ? "ol" : "ul";
        return (
          <List key={`list-${index}`} className={`${block.ordered ? "list-decimal" : "list-disc"} space-y-1 pl-5`}>
            {block.items.map((item, itemIndex) => (
              <li key={`item-${itemIndex}`}>{renderInlineMarkdown(item, `list-${index}-${itemIndex}`)}</li>
            ))}
          </List>
        );
      }
      default:
        return (
          <p key={`paragraph-${index}`}>
            {block.lines.flatMap((part, partIndex) => [
              ...(partIndex > 0 ? [<br key={`break-${index}-${partIndex}`} />] : []),
              ...renderInlineMarkdown(part, `paragraph-${index}-${partIndex}`),
            ])}
          </p>
        );
    }
  });

  return <div className="space-y-2">{blocks}</div>;
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
  if (response.status === 410) {
    if (isRecord(payload) && typeof payload.message === "string") {
      throw new Error(payload.message);
    }
    throw new Error("Cette confirmation a expiré. Renvoyez la demande à l’Agent pour préparer un nouveau lot.");
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

// Délai sans changement de updatedAt au-delà duquel une tâche « running » est jugée bloquée.
const TASK_STALE_TIMEOUT_MS = 90_000;
const TASK_STALE_MESSAGE = "L’agent ne répond plus. Vous pouvez relancer la demande.";
const MAX_AGENT_IMAGE_BYTES = 5 * 1024 * 1024;
const MIN_HISTORY_WIDTH = 280;
const MAX_HISTORY_WIDTH = 320;
const MIN_RESOURCES_WIDTH = 180;
const MIN_CHAT_WIDTH = 300;
const RESIZE_HANDLE_WIDTH = 8;
const ALLOWED_AGENT_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Impossible de lire l’image copiée."));
    };
    reader.onerror = () => reject(new Error("Impossible de lire l’image copiée."));
    reader.readAsDataURL(file);
  });
}

function getErrorMessage(error: Error | undefined): string | null {
  if (!error) return null;
  let rawMessage = error.message;
  try {
    const parsed = JSON.parse(error.message) as { message?: unknown };
    if (typeof parsed.message === "string") rawMessage = parsed.message;
    else if (Array.isArray(parsed.message)) rawMessage = parsed.message.join(", ");
  } catch {
    // The SDK may provide a plain-text response body instead of JSON.
  }
  const message = rawMessage.toLowerCase();
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
  if (/rerank|vision|image.*(modèle|model)|modèle.*image|model.*image/i.test(error.message)) {
    return rawMessage;
  }
  if (process.env.NODE_ENV !== "production" && rawMessage.trim()) {
    return rawMessage.trim().slice(0, 300);
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

type AgentChatProps = {
  fullPage?: boolean;
  onOpenFullPage?: () => void;
};

export function AgentChat({ fullPage = false, onOpenFullPage }: AgentChatProps) {
  const [input, setInput] = useState("");
  const responseDurations = useAgentChatStore((state) => state.responseDurations);
  const agentProgress = useAgentChatStore((state) => state.agentProgress);
  const task = useAgentChatStore((state) => state.task);
  const activeSessionId = useAgentChatStore((state) => state.sessionId);
  const setTask = useAgentChatStore((state) => state.setTask);
  const markRequestStarted = useAgentChatStore((state) => state.markRequestStarted);
  const sharedChat = useAgentChatStore((state) => state.chat);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const chatGridRef = useRef<HTMLDivElement>(null);
  const [historyWidth, setHistoryWidth] = useState(300);
  const [resourcesWidth, setResourcesWidth] = useState(200);
  const [resourcesOpen, setResourcesOpen] = useState(true);
  const resizeRef = useRef<{
    side: "history" | "resources";
    pointerId: number;
    startX: number;
    historyWidth: number;
    resourcesWidth: number;
    containerWidth: number;
  } | null>(null);
  const [historyReady, setHistoryReady] = useState(false);
  const [conversations, setConversations] = useState<AgentConversationSummary[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [inputError, setInputError] = useState<string | null>(null);
  const imagePreviewRef = useRef<string | null>(null);
  const [confirmationStates, setConfirmationStates] = useState<
    Record<string, ConfirmationState>
  >({});
  const [supplierBatch, setSupplierBatch] = useState<SupplierBatch | null>(null);
  const [stoppedUserId, setStoppedUserId] = useState<string | null>(null);
  const [sendFailure, setSendFailure] = useState<(SendFailure & { text: string; image: File | null }) | null>(null);
  const taskActivityRef = useRef<{ updatedAt: string | undefined; at: number }>({ updatedAt: undefined, at: 0 });
  const { messages, sendMessage, status, error, clearError, setMessages, regenerate, stop } = useChat<AgentUIMessage>({
    chat: sharedChat,
  });

  useEffect(() => {
    let cancelled = false;
    const sessionId = useAgentChatStore.getState().initializeSession();

    void fetchAgentConversations()
      .then((items) => {
        if (!cancelled) setConversations(items);
      })
      .catch(() => {
        // Keep the current chat usable if the conversation list is unavailable.
      });

    void Promise.all([
      fetchAgentHistory(sessionId),
      fetchAgentTaskStatus(sessionId).catch((): AgentTaskStatus => ({ status: "idle" })),
    ])
      .then(([history, taskStatus]) => {
        const currentStatus = useAgentChatStore.getState().chat.status;
        if (!cancelled) {
          setTask(taskStatus);
          if (currentStatus !== "submitted" && currentStatus !== "streaming") {
            setMessages(toUiMessages(history, taskStatus));
          }
        }
      })
      .catch(() => {
        if (!cancelled) setInputError("L’historique n’a pas pu être chargé. Le contexte sera récupéré à l’envoi.");
      })
      .finally(() => {
        if (!cancelled) setHistoryReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, [setMessages, setTask]);

  useEffect(() => {
    if (!activeSessionId) return;
    let cancelled = false;
    void fetchSupplierBatch(activeSessionId)
      .then((batch) => { if (!cancelled) setSupplierBatch(batch); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [activeSessionId]);

  const supplierBatchId = supplierBatch?.id;
  const supplierBatchStatus = supplierBatch?.status;
  useEffect(() => {
    if (!activeSessionId || !supplierBatchId || supplierBatchStatus !== "PROCESSING") return;
    let cancelled = false;
    const refresh = async () => {
      try {
        const current = await fetchSupplierBatch(activeSessionId);
        if (!cancelled && current?.id === supplierBatchId) setSupplierBatch(current);
      } catch { /* Keep the last persisted progress visible during a network interruption. */ }
    };
    const timer = window.setInterval(() => void refresh(), 1800);
    void refresh();
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [activeSessionId, supplierBatchId, supplierBatchStatus]);

  useEffect(() => {
    if (!activeSessionId || task.status !== "running") return;
    let cancelled = false;
    taskActivityRef.current = { updatedAt: undefined, at: Date.now() };
    const pollTask = async () => {
      try {
        const taskStatus = await fetchAgentTaskStatus(activeSessionId);
        if (cancelled) return;
        if (taskStatus.status === "running") {
          const activity = taskActivityRef.current;
          if (taskStatus.updatedAt !== activity.updatedAt) {
            const updatedTime = taskStatus.updatedAt ? Date.parse(taskStatus.updatedAt) : Number.NaN;
            // Au premier relevé, une tâche déjà ancienne compte depuis sa dernière mise à jour.
            const isFirstReading = activity.updatedAt === undefined;
            taskActivityRef.current = {
              updatedAt: taskStatus.updatedAt,
              at: isFirstReading && Number.isFinite(updatedTime) ? Math.min(updatedTime, Date.now()) : Date.now(),
            };
          }
          if (Date.now() - taskActivityRef.current.at > TASK_STALE_TIMEOUT_MS) {
            stop();
            setTask({ ...taskStatus, status: "failed", error: TASK_STALE_MESSAGE });
            return;
          }
        }
        if (taskStatus.status === "completed" || taskStatus.status === "failed" || taskStatus.status === "stopped") {
          const history = await fetchAgentHistory(activeSessionId);
          if (cancelled) return;
          // Tâche terminée côté serveur mais flux navigateur encore ouvert : on le ferme,
          // sinon le statut du chat reste « busy » et le spinner tourne indéfiniment.
          const chatStatus = useAgentChatStore.getState().chat.status;
          const streamStillOpen = chatStatus === "submitted" || chatStatus === "streaming";
          if (streamStillOpen) stop();
          if (!streamStillOpen || taskStatus.status === "completed") setMessages(toUiMessages(history));
          if (taskStatus.status === "completed") clearError();
          setTask(taskStatus);
          void fetchAgentConversations().then(setConversations).catch(() => undefined);
          return;
        }
        if (taskStatus.status === "idle") {
          setTask({
            ...useAgentChatStore.getState().task,
            status: "failed",
            error: "Le statut de cette demande est introuvable. Vous pouvez la relancer.",
          });
        } else {
          setTask(taskStatus);
        }
      } catch {
        // Une panne passagère de polling ne change pas le statut du travail serveur.
      }
    };
    const timer = window.setInterval(() => void pollTask(), 2500);
    void pollTask();
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [activeSessionId, clearError, setConversations, setMessages, setTask, stop, task.status]);
  const isBusy = status === "submitted" || status === "streaming" || task.status === "running";
  useEffect(() => {
    if (!isBusy) return;
    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) stopResponse();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  });
  const latestUserIndex = messages.findLastIndex((message) => message.role === "user");
  const activeAssistantMessage = isBusy
    ? messages.slice(latestUserIndex + 1).find((message) => message.role === "assistant")
    : undefined;
  const activeAssistantHasContent = activeAssistantMessage?.parts.some((part) =>
    (isTextUIPart(part) && part.text.trim().length > 0 && !isRawToolCallText(part.text)) ||
    isFileUIPart(part) ||
    (part.type === "data-agent-event" && (
      part.data.phase === "tool" || Boolean(part.data.confirmation)
    ))
  );
  const lastMessage = messages.at(-1);
  const rawToolCallError = !isBusy && lastMessage?.role === "assistant" &&
    isRawToolCallText(lastMessage.parts.filter(isTextUIPart).map((part) => part.text).join(""));
  const friendlyError = sendFailure
    ? sendFailure.message
    : rawToolCallError
      ? RAW_TOOL_CALL_NOTICE
      : task.status === "failed"
        ? task.error || "L’Agent n’a pas pu terminer cette demande. Vous pouvez réessayer."
        : getErrorMessage(error);
  const canRetryDemand = !sendFailure && (task.status === "failed" || rawToolCallError);
  const externalLinks = collectResourceLinks(messages.map((message) => ({
    text: message.parts.filter(isTextUIPart).map((part) => part.text).join("\n"),
    sources: message.parts.flatMap((part) => part.type === "data-agent-event" ? (part.data.sources ?? []) : []),
  })));

  useEffect(() => {
    const textarea = inputRef.current;
    if (!textarea) return;

    const maxHeight = 160;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [input]);

  useEffect(() => () => {
    if (imagePreviewRef.current) URL.revokeObjectURL(imagePreviewRef.current);
  }, []);

  function selectImage(file: File) {
    if (!ALLOWED_AGENT_IMAGE_TYPES.has(file.type.toLowerCase())) {
      setInputError("Format image non accepté. Utilisez JPEG, PNG, WebP ou GIF.");
      return;
    }
    if (file.size <= 0 || file.size > MAX_AGENT_IMAGE_BYTES) {
      setInputError("L’image doit peser au maximum 5 Mo.");
      return;
    }
    if (imagePreviewRef.current) URL.revokeObjectURL(imagePreviewRef.current);
    const previewUrl = URL.createObjectURL(file);
    imagePreviewRef.current = previewUrl;
    setImagePreviewUrl(previewUrl);
    setPendingImage(file);
    setInputError(null);
    clearError();
  }

  function removeImage() {
    if (imagePreviewRef.current) URL.revokeObjectURL(imagePreviewRef.current);
    imagePreviewRef.current = null;
    setImagePreviewUrl(null);
    setPendingImage(null);
    setInputError(null);
  }

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
      const message = actionError instanceof Error ? actionError.message : "";
      const expired = /confirmation.*(expir|invalidée)|a expiré/i.test(message);
      setConfirmationStates((current) => ({
        ...current,
        [confirmationId]: {
          status: expired ? "expired" : "error",
          error:
            actionError instanceof TypeError || /network|fetch/i.test(message)
              ? "Le service Agent est indisponible. Vérifiez votre connexion puis réessayez."
              : message || "L’action n’a pas pu aboutir. Réessayez.",
        },
      }));
    }
  }

  function refreshConversationList() {
    void fetchAgentConversations()
      .then(setConversations)
      .catch(() => {
        // A list refresh must not hide a successfully sent message.
      });
  }

  function startNewConversation() {
    if (isBusy) return;
    const sessionId = crypto.randomUUID();
    useAgentChatStore.getState().setSessionId(sessionId);
    setMessages([]);
    setStoppedUserId(null);
    useAgentChatStore.setState({ responseDurations: {} });
    setTask({ status: "idle" });
    setSendFailure(null);
    setInput("");
    removeImage();
    setConfirmationStates({});
    setSupplierBatch(null);
    setHistoryOpen(false);
    setInputError(null);
    clearError();
    setHistoryReady(true);
  }

  async function openConversation(sessionId: string) {
    if (isBusy) return;
    setHistoryReady(false);
    setInputError(null);
    clearError();
    setMessages([]);
    setStoppedUserId(null);
    useAgentChatStore.setState({ responseDurations: {} });
    removeImage();
    setConfirmationStates({});
    setSupplierBatch(null);
    useAgentChatStore.getState().setSessionId(sessionId);
    setTask({ status: "idle" });
    setSendFailure(null);
    setHistoryOpen(false);
    try {
      const history = await fetchAgentHistory(sessionId);
      setMessages(toUiMessages(history));
    } catch {
      setInputError("Cette conversation n’a pas pu être chargée. Réessayez.");
    } finally {
      setHistoryReady(true);
    }
  }

  // Après l'état « task » local d'un envoi refusé : on reprend l'état réel du serveur.
  async function syncTaskWithServer() {
    const sessionId = useAgentChatStore.getState().sessionId;
    if (!sessionId) return setTask({ status: "idle" });
    try {
      const serverTask = await fetchAgentTaskStatus(sessionId);
      setTask(serverTask.status === "running" ? serverTask : { status: "idle" });
    } catch {
      setTask({ status: "idle" });
    }
  }

  // Envoi refusé ou en échec avant toute réponse : le dernier message est encore celui de l'utilisateur.
  function detectSendFailure(): SendFailure | null {
    const chat = useAgentChatStore.getState().chat;
    if (chat.status !== "error" || chat.messages.at(-1)?.role !== "user") return null;
    return describeSendError(chat.error);
  }

  async function recoverFromFailedSend(failure: SendFailure, text: string, image: File | null) {
    setMessages(useAgentChatStore.getState().chat.messages.slice(0, -1));
    clearError();
    useAgentChatStore.setState({ responseStartedAt: null });
    setInput(text);
    if (image) selectImage(image);
    setSendFailure({ ...failure, text, image });
    if (failure.conflict) await syncTaskWithServer();
    else setTask({ status: "idle" });
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }

  async function submitMessage(text: string) {
    const trimmed = text.trim();
    if ((!trimmed && !pendingImage) || isBusy || !historyReady) return;
    const urls = trimmed.match(/https?:\/\/[^\s<>"']+/gi) ?? [];
    if (urls.length > 100) {
      setInputError("Un lot est limité à 100 URL. Découpez la demande en plusieurs lots.");
      return;
    }
    if (urls.length >= 2) {
      if (pendingImage) {
        setInputError("Retirez l’image jointe pour lancer un lot d’URL fournisseur.");
        return;
      }
      setInputError(null);
      setInput("");
      const sessionId = useAgentChatStore.getState().sessionId;
      if (!sessionId) {
        setInputError("La conversation n’est pas encore prête. Réessayez.");
        return;
      }
      try {
        const response = await fetch("/api/admin/agent/chat/batches", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, message: trimmed }),
        });
        const payload: unknown = await response.json().catch(() => null);
        if (!response.ok) throw new Error(payload && typeof payload === "object" && "message" in payload ? String(payload.message) : "Le lot n’a pas pu démarrer.");
        if (!isRecord(payload) || typeof payload.id !== "string") throw new Error("Le serveur n’a pas retourné le lot.");
        setSupplierBatch(payload as unknown as SupplierBatch);
        const history = await fetchAgentHistory(sessionId);
        setMessages(toUiMessages(history));
        refreshConversationList();
      } catch (cause) {
        setInputError(cause instanceof Error ? cause.message : "Le lot n’a pas pu démarrer.");
        setInput(trimmed);
      }
      return;
    }
    const imageToSend = pendingImage;
    setInput("");
    removeImage();
    await deliverMessage(trimmed, imageToSend);
  }

  async function deliverMessage(trimmed: string, imageToSend: File | null) {
    clearError();
    setStoppedUserId(null);
    setInputError(null);
    setSendFailure(null);
    if (imageToSend) {
      try {
        const imageDataUrl = await fileToDataUrl(imageToSend);
        useAgentChatStore.getState().beginTask(trimmed || "Analyse l’image jointe et réponds à ma question.", true);
        markRequestStarted();
        await sendMessage({
          text: trimmed,
          files: [
            {
              type: "file",
              mediaType: imageToSend.type,
              filename: imageToSend.name,
              url: imageDataUrl,
            },
          ],
        });
        const failure = detectSendFailure();
        if (failure) await recoverFromFailedSend(failure, trimmed, imageToSend);
      } catch {
        setInputError("Impossible de préparer l’image. Collez-la de nouveau puis réessayez.");
      } finally {
        refreshConversationList();
      }
      return;
    }
    try {
      useAgentChatStore.getState().beginTask(trimmed);
      markRequestStarted();
      await sendMessage({ text: trimmed });
      const failure = detectSendFailure();
      if (failure) await recoverFromFailedSend(failure, trimmed, null);
    } finally {
      refreshConversationList();
    }
  }

  async function retryFailedSend() {
    if (!sendFailure || isBusy) return;
    const { text, image } = sendFailure;
    setInput("");
    removeImage();
    await deliverMessage(text, image);
  }

  function stopResponse() {
    if (!isBusy) return;
    const lastUser = messages.findLast((message) => message.role === "user");
    if (activeSessionId) {
      void fetch("/api/admin/agent/chat/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: activeSessionId }),
      })
        .then((response) => {
          if (!response.ok) throw new Error("stop failed");
        })
        .catch(() => setInputError("L’arrêt n’a pas pu être confirmé côté serveur. La demande peut se terminer en arrière-plan."));
    }
    stop();
    setStoppedUserId(lastUser?.id ?? null);
    setTask({ status: "idle" });
    useAgentChatStore.setState({
      responseStartedAt: null,
      agentProgress: "Je réfléchis à votre demande…",
    });
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }

  async function retryFailedTask() {
    const lastUser = messages.findLast((message) => message.role === "user");
    if (isBusy || !lastUser) return;
    clearError();
    setStoppedUserId(null);
    const lastUserText = lastUser.parts.filter(isTextUIPart).map((part) => part.text).join("");
    useAgentChatStore.getState().beginTask(task.message ?? (lastUserText || undefined));
    markRequestStarted();
    const messagesBefore = messages;
    try {
      await regenerate();
      const failure = detectSendFailure();
      if (failure) {
        // Relance refusée : on garde la conversation telle qu'elle était.
        setMessages(messagesBefore);
        clearError();
        useAgentChatStore.setState({ responseStartedAt: null });
        if (failure.conflict) {
          setSendFailure({ ...failure, text: "", image: null });
          await syncTaskWithServer();
        } else {
          setTask({ status: "failed", error: failure.message });
        }
      }
    } finally {
      refreshConversationList();
    }
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

  function handlePaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const imageItem = Array.from(event.clipboardData.items).find(
      (item) => item.kind === "file" && item.type.toLowerCase().startsWith("image/"),
    );
    const hasNonImageFile = Array.from(event.clipboardData.items).some(
      (item) => item.kind === "file" && !item.type.toLowerCase().startsWith("image/"),
    );
    if (!imageItem) {
      if (hasNonImageFile) setInputError("Seules les images peuvent être ajoutées au chat.");
      return;
    }
    const file = imageItem.getAsFile();
    if (!file) {
      setInputError("Impossible de lire l’image copiée.");
      return;
    }
    event.preventDefault();
    selectImage(file);
  }

  function beginPanelResize(
    side: "history" | "resources",
    event: ReactPointerEvent<HTMLButtonElement>,
  ) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    resizeRef.current = {
      side,
      pointerId: event.pointerId,
      startX: event.clientX,
      historyWidth,
      resourcesWidth,
      containerWidth: chatGridRef.current?.clientWidth ?? 0,
    };
  }

  function movePanelResize(event: ReactPointerEvent<HTMLButtonElement>) {
    const resize = resizeRef.current;
    if (!resize || resize.pointerId !== event.pointerId) return;

    const delta = event.clientX - resize.startX;
    const availableWidth = resize.containerWidth - MIN_CHAT_WIDTH - RESIZE_HANDLE_WIDTH * (resourcesOpen ? 2 : 1);
    if (resize.side === "history") {
      const maxWidth = Math.min(MAX_HISTORY_WIDTH, Math.max(MIN_HISTORY_WIDTH, availableWidth - (resourcesOpen ? resize.resourcesWidth : 0)));
      setHistoryWidth(Math.min(maxWidth, Math.max(MIN_HISTORY_WIDTH, resize.historyWidth + delta)));
      return;
    }

    const maxWidth = Math.max(MIN_RESOURCES_WIDTH, availableWidth - resize.historyWidth);
    setResourcesWidth(Math.min(maxWidth, Math.max(MIN_RESOURCES_WIDTH, resize.resourcesWidth - delta)));
  }

  function endPanelResize(event: ReactPointerEvent<HTMLButtonElement>) {
    if (resizeRef.current?.pointerId !== event.pointerId) return;
    resizeRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function resizePanelWithKeyboard(side: "history" | "resources", direction: -1 | 1) {
    const containerWidth = chatGridRef.current?.clientWidth ?? 0;
    const availableWidth = containerWidth - MIN_CHAT_WIDTH - RESIZE_HANDLE_WIDTH * (resourcesOpen ? 2 : 1);
    if (side === "history") {
      const maxWidth = Math.min(MAX_HISTORY_WIDTH, Math.max(MIN_HISTORY_WIDTH, availableWidth - (resourcesOpen ? resourcesWidth : 0)));
      setHistoryWidth((width) => Math.min(maxWidth, Math.max(MIN_HISTORY_WIDTH, width + direction * 16)));
      return;
    }

    const maxWidth = Math.max(MIN_RESOURCES_WIDTH, availableWidth - historyWidth);
    setResourcesWidth((width) => Math.min(maxWidth, Math.max(MIN_RESOURCES_WIDTH, width + direction * 16)));
  }

  function handleResizeKeyDown(
    side: "history" | "resources",
    event: KeyboardEvent<HTMLButtonElement>,
  ) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const direction = event.key === "ArrowRight" ? 1 : -1;
    resizePanelWithKeyboard(side, side === "history" ? direction : direction === 1 ? -1 : 1);
  }

  return (
    <div className={fullPage
      ? "grid h-full min-h-0 min-w-0 flex-1 grid-cols-1 grid-rows-[auto_minmax(0,1fr)] overflow-hidden bg-white lg:grid-rows-1 lg:grid-cols-[var(--agent-columns)]"
      : "flex h-full min-h-0 min-w-0 flex-1 flex-col bg-[#f8fafc]"}
      ref={fullPage ? chatGridRef : undefined}
      style={{
        fontFamily: "Arial, Helvetica, sans-serif",
        letterSpacing: "normal",
        fontStretch: "normal",
        ...(fullPage
          ? { "--agent-columns": `${historyWidth}px ${RESIZE_HANDLE_WIDTH}px minmax(${MIN_CHAT_WIDTH}px, 1fr) ${resourcesOpen ? `${RESIZE_HANDLE_WIDTH}px ${resourcesWidth}px` : "0px 0px"}` }
          : {}),
      } as CSSProperties}
    >
      {fullPage && (
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-3 py-2 lg:hidden">
          <span className="text-xs font-medium text-slate-600">Agent FGMC</span>
          <button
            type="button"
            aria-expanded={historyOpen}
            onClick={() => setHistoryOpen((open) => !open)}
            className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          >
            <History size={15} aria-hidden="true" />
            {historyOpen ? "Fermer l’historique" : `Historique (${conversations.length})`}
          </button>
        </div>
      )}
      {fullPage && (
        <aside className="hidden min-h-0 flex-col bg-slate-50 p-4 lg:flex">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Historique</h3>
              <p className="mt-1 text-xs text-slate-500">{conversations.length} conversation{conversations.length > 1 ? "s" : ""}</p>
            </div>
            <History size={17} className="text-slate-400" aria-hidden="true" />
          </div>
          <button
            type="button"
            onClick={startNewConversation}
            disabled={isBusy || !historyReady}
            className="mt-4 inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-[#0858b1] px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-[#064990] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <MessageSquarePlus size={16} aria-hidden="true" />
            Nouvelle conversation
          </button>
          <div className="mt-4 flex min-h-0 flex-col gap-2 overflow-y-auto">
            {conversations.length === 0 ? <p className="rounded-xl border border-dashed border-slate-300 bg-white p-3 text-xs leading-5 text-slate-500">Aucune conversation enregistrée pour le moment.</p> : conversations.map((conversation) => (
            <button key={conversation.sessionId} type="button" onClick={() => void openConversation(conversation.sessionId)} disabled={isBusy || !historyReady} aria-pressed={activeSessionId === conversation.sessionId} className={`w-full rounded-xl border px-3 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:opacity-50 ${activeSessionId === conversation.sessionId ? "border-[#0858b1] bg-blue-50 shadow-sm ring-1 ring-blue-100" : "border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/60 hover:shadow-sm"}`}>
                <span className="line-clamp-2 min-h-10 break-words text-sm font-medium leading-5 text-slate-800">{conversation.title}</span>
                <span className="mt-2 flex min-w-0 items-center gap-1.5 whitespace-nowrap text-[11px] leading-4 text-slate-500"><span>{conversation.messageCount} message{conversation.messageCount > 1 ? "s" : ""}</span><span aria-hidden="true">·</span><time dateTime={conversation.updatedAt}>{formatConversationDate(conversation.updatedAt)}</time></span>
              </button>
            ))}
          </div>
        </aside>
      )}
      {fullPage && (
        <button
          type="button"
          role="separator"
          aria-orientation="vertical"
          aria-label="Redimensionner l’historique"
          aria-valuemin={MIN_HISTORY_WIDTH}
          aria-valuemax={Math.min(MAX_HISTORY_WIDTH, Math.max(MIN_HISTORY_WIDTH, (chatGridRef.current?.clientWidth ?? historyWidth + resourcesWidth + MIN_CHAT_WIDTH + RESIZE_HANDLE_WIDTH * 2) - MIN_CHAT_WIDTH - (resourcesOpen ? resourcesWidth : 0) - RESIZE_HANDLE_WIDTH * (resourcesOpen ? 2 : 1)))}
          aria-valuenow={historyWidth}
          onPointerDown={(event) => beginPanelResize("history", event)}
          onPointerMove={movePanelResize}
          onPointerUp={endPanelResize}
          onPointerCancel={endPanelResize}
          onKeyDown={(event) => handleResizeKeyDown("history", event)}
          className="group hidden w-2 cursor-col-resize touch-none items-center justify-center bg-transparent hover:bg-blue-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-400 lg:flex"
        >
          <span className="h-10 w-1 rounded-full bg-slate-200 group-hover:bg-[#0858b1]" />
        </button>
      )}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-[#f8fafc]">
      <div className="flex shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-3 py-2">
        {!fullPage && <>
        <button
          type="button"
          onClick={startNewConversation}
          disabled={isBusy || !historyReady}
          className="inline-flex h-10 min-w-0 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-[#0858b1] px-3 text-xs font-semibold text-white transition hover:bg-[#064990] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <MessageSquarePlus size={15} className="shrink-0" aria-hidden="true" />
          Nouvelle conversation
        </button>
        <button
            type="button"
            onClick={onOpenFullPage}
            disabled={isBusy || !historyReady}
            aria-label="Ouvrir l’Agent complet"
            className="inline-flex h-10 min-w-0 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Bot size={15} className="shrink-0" aria-hidden="true" />
            Agent complet
          </button>
        </>}
        {fullPage && (
          <button
            type="button"
            aria-label={resourcesOpen ? "Masquer les liens et ressources" : "Afficher les liens et ressources"}
            aria-expanded={resourcesOpen}
            onClick={() => setResourcesOpen((open) => !open)}
            className="ml-auto hidden min-h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 lg:inline-flex"
          >
            <ExternalLink size={14} aria-hidden="true" />
            {resourcesOpen ? "Masquer les ressources" : "Afficher les ressources"}
          </button>
        )}
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-4 py-5 sm:px-5">
        {historyOpen ? (
          <div id="agent-mobile-history" className="flex flex-1 flex-col">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-slate-900">Conversations précédentes</h3>
              <button
                type="button"
                onClick={startNewConversation}
                disabled={isBusy || !historyReady}
                className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-[#0858b1] px-2.5 text-xs font-semibold text-white transition hover:bg-[#064990] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-1 disabled:opacity-50"
              >
                <MessageSquarePlus size={14} aria-hidden="true" />
                Nouvelle
              </button>
            </div>
            {conversations.length === 0 ? (
              <p className="rounded-xl border border-slate-200 bg-white px-3 py-4 text-center text-sm text-slate-500">
                Aucune conversation enregistrée pour le moment.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {conversations.map((conversation) => (
                  <button
                    key={conversation.sessionId}
                    type="button"
                    onClick={() => void openConversation(conversation.sessionId)}
                    aria-pressed={activeSessionId === conversation.sessionId}
                    className={`w-full rounded-xl border px-3 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${activeSessionId === conversation.sessionId ? "border-[#0858b1] bg-blue-50 shadow-sm ring-1 ring-blue-100" : "border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/60 hover:shadow-sm"}`}
                  >
                    <span className="line-clamp-2 min-h-10 break-words text-sm font-medium leading-5 text-slate-800">{conversation.title}</span>
                    <span className="mt-2 flex min-w-0 items-center gap-1.5 whitespace-nowrap text-[11px] leading-4 text-slate-500">
                      <span>{conversation.messageCount} message{conversation.messageCount > 1 ? "s" : ""}</span>
                      <span aria-hidden="true">·</span>
                      <time dateTime={conversation.updatedAt}>{formatConversationDate(conversation.updatedAt)}</time>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex w-full flex-1 flex-col items-center justify-center py-4 text-center">
            <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-blue-50 text-[#0858b1]">
              <Sparkles size={22} />
            </div>
            <h3 className="text-center text-base font-semibold text-slate-900">
              Bonjour, comment puis-je vous aider ?
            </h3>
            <p className="mt-2 w-full max-w-xs self-center text-center text-sm leading-6 text-slate-500">
              Posez une question à votre assistant d’administration FGMC.
            </p>
            <div className="mt-6 flex w-full flex-wrap items-center justify-center gap-2.5 xl:flex-nowrap">
              {QUICK_ACTIONS.map((action) => (
                <button
                  key={action.label}
                  type="button"
                  disabled={isBusy}
                  onClick={() => setInput(action.prompt)}
                  className="whitespace-nowrap rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-[#0858b1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-1 disabled:opacity-50"
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message) => {
            const rawText = message.parts
              .filter(isTextUIPart)
              .map((part) => part.text)
              .join("");
            // Appel d'outil brut : jamais affiché comme réponse.
            const text = message.role !== "user" && isRawToolCallText(rawText) ? "" : rawText;
            const imageParts = message.parts.filter(isFileUIPart);
            const events = message.parts.flatMap(part => part.type === "data-agent-event" ? [part.data] : []);
            const visibleEvents = events.filter(event => event.phase === "tool" || event.confirmation);
            if (!text && imageParts.length === 0 && !visibleEvents.length) return null;

            const isUser = message.role === "user";
            const confirmationId = isUser || events.length > 0 ? null : findConfirmationId(text);
            const isUpdateConfirmation = confirmationId !== null && /(?:modification du produit|mise à jour du produit|update_product)/i.test(text);
            const isPublishConfirmation =
              !isUpdateConfirmation && confirmationId !== null && /(publier|publication|visible publiquement)/i.test(text);
            const isBatchConfirmation =
              confirmationId !== null &&
              /(?:deux|2|plusieurs|\d+)\s+(?:brouillons?|produits?)|brouillons?\s+(?:du lot|ensemble)/i.test(text);
            const confirmation = confirmationId
              ? confirmationStates[confirmationId]
              : undefined;
            const confirmationBusy =
              confirmation?.status === "confirming" ||
              confirmation?.status === "cancelling";
            const productSummary = confirmationId
              ? text.replace(CONFIRMATION_ID_PATTERN, "").trim()
              : "";
            const confirmationResult = confirmation?.result;
            const createdProducts = isRecord(confirmationResult) &&
              Array.isArray(confirmationResult.createdProducts)
              ? confirmationResult.createdProducts.filter(isRecord)
              : isRecord(confirmationResult)
                ? [confirmationResult]
                : [];
            const responseDuration = responseDurations[message.id];

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
                  {!isUser && <AgentActivity events={visibleEvents} states={confirmationStates} busy={isBusy} active={activeAssistantMessage?.id === message.id} onAction={(id, action) => void runConfirmationAction(id, action)} />}
                  {(isUser || text || imageParts.length > 0) && <div
                    className={`max-w-full whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-sm leading-6 ${
                    isUser
                      ? "rounded-br-md bg-[#0858b1] text-white"
                      : "rounded-bl-md border border-slate-100 bg-white text-slate-700 shadow-sm"
                    }`}
                  >
                    {!isUser && responseDuration !== undefined && (
                      <div className="mb-1.5 flex items-center gap-1.5 text-[11px] leading-4 text-slate-400">
                        <Clock3 size={12} aria-hidden="true" />
                        <span>{formatWorkedDuration(responseDuration)}</span>
                      </div>
                    )}
                    {isUser ? text : renderAgentMarkdown(text)}
                    {imageParts.map((part, index) => (
                      <Image
                        key={`${message.id}-image-${index}`}
                        src={part.url}
                        alt={part.filename ?? "Image envoyée à l’Agent"}
                        width={640}
                        height={480}
                        unoptimized
                        className="mt-2 max-h-48 max-w-full rounded-xl object-contain"
                      />
                    ))}
                  </div>}
                {isUser && message.id === stoppedUserId && !isBusy && (
                  <p className="px-1 text-[11px] leading-4 text-slate-400">Réponse arrêtée</p>
                )}
                {confirmationId && (
                  <section
                    aria-label={
                      isUpdateConfirmation
                        ? "Confirmation de modification du produit"
                        : isPublishConfirmation
                        ? "Confirmation de publication du produit"
                        : isBatchConfirmation
                          ? "Confirmation de création groupée des brouillons produits"
                          : "Confirmation de création du brouillon produit"
                    }
                    className="w-full rounded-2xl border border-blue-100 bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-start gap-2.5">
                      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#0858b1]">
                        <Sparkles size={16} aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-semibold text-slate-900">
                          {confirmation?.status === "confirmed"
                            ? isUpdateConfirmation
                              ? "Produit modifié"
                              : isPublishConfirmation
                              ? "Produit publié"
                              : isBatchConfirmation
                                ? "Brouillons créés"
                                : "Brouillon créé"
                            : confirmation?.status === "cancelled"
                              ? isPublishConfirmation
                                ? "Publication annulée"
                                : "Action annulée"
                              : isUpdateConfirmation
                                ? "Confirmer la modification du produit"
                                : isPublishConfirmation
                                ? "Publication du produit"
                                : isBatchConfirmation
                                  ? "Confirmer la création des brouillons"
                                  : "Confirmer la création du brouillon"}
                        </h4>
                        <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-5 text-slate-600">
                          {productSummary ||
                            (isUpdateConfirmation
                              ? "Seuls les changements présentés seront appliqués après confirmation."
                              : isPublishConfirmation
                              ? "Cette action rendra le produit visible publiquement."
                              : "Le produit sera créé en statut DRAFT.")}
                        </p>
                        {isPublishConfirmation && confirmation?.status !== "confirmed" && confirmation?.status !== "cancelled" && (
                          <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium leading-5 text-amber-900">
                            Cette action rendra le produit visible publiquement.
                          </p>
                        )}
                        {(confirmation?.status === "confirming" ||
                          confirmation?.status === "cancelling") && (
                          <p className="mt-2 flex items-center gap-2 text-xs text-slate-500" aria-live="polite">
                            <LoaderCircle size={14} className="animate-spin" />
                            {confirmation.status === "confirming"
                              ? isUpdateConfirmation
                                ? "Modification du produit…"
                                : isPublishConfirmation
                                ? "Publication du produit…"
                                : isBatchConfirmation
                                  ? "Création des brouillons…"
                                  : "Création du brouillon…"
                              : "Annulation…"}
                          </p>
                        )}
                        {confirmation?.status === "confirmed" && createdProducts.length > 0 && (
                          <div className="mt-3 space-y-2">
                            {createdProducts.map((createdProduct, index) => (
                              <div key={typeof createdProduct.id === "string" ? createdProduct.id : index} className="rounded-xl bg-emerald-50 px-3 py-2.5 text-xs text-emerald-900">
                                <p className="flex items-center gap-1.5 font-semibold">
                                  <CircleCheck size={15} aria-hidden="true" />
                                  {typeof createdProduct.title === "string" ? createdProduct.title : "Produit enregistré"}
                                </p>
                                <p className="mt-1 font-medium">
                                  {createdProduct.outcome === "ALREADY_EXISTS" ? "Déjà présent — aucune nouvelle création." : "Opération confirmée."}
                                </p>
                                <p className="mt-1 text-emerald-800">
                                  {typeof createdProduct.sku === "string" ? `SKU : ${createdProduct.sku} · ` : ""}
                                  Statut : {typeof createdProduct.status === "string" ? createdProduct.status : "DRAFT"}
                                </p>
                                {typeof createdProduct.price === "string" && <p className="mt-1 text-emerald-800">Prix : {createdProduct.price}</p>}
                                {isRecord(createdProduct.brand) && typeof createdProduct.brand.name === "string" && <p className="mt-1 text-emerald-800">Marque : {createdProduct.brand.name}</p>}
                                {Array.isArray(createdProduct.categories) && createdProduct.categories.length > 0 && (
                                  <p className="mt-1 text-emerald-800">
                                    Catégories : {createdProduct.categories
                                      .filter((category): category is ProductRecord => isRecord(category))
                                      .map((category) => category.name)
                                      .filter((name): name is string => typeof name === "string")
                                      .join(", ")}
                                  </p>
                                )}
                                {typeof createdProduct.id === "string" && <p className="mt-1 break-all text-emerald-800">Référence : {createdProduct.id}</p>}
                              </div>
                            ))}
                          </div>
                        )}
                        {confirmation?.status === "cancelled" && (
                          <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-slate-600" role="status">
                            <X size={14} aria-hidden="true" />
                            {isPublishConfirmation
                              ? "La publication a été annulée. Le produit reste en brouillon."
                              : "La création a été annulée. Aucun produit n’a été créé."}
                          </p>
                        )}
                        {(confirmation?.status === "error" || confirmation?.status === "expired") && (
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
                              {isUpdateConfirmation
                                ? "Confirmer les modifications"
                                : isPublishConfirmation
                                ? "Confirmer la publication"
                                : isBatchConfirmation
                                  ? "Confirmer le lot"
                                  : "Confirmer"}
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
        {supplierBatch && <SupplierBatchCard batch={supplierBatch} onRefresh={async () => {
          const sessionId = useAgentChatStore.getState().sessionId;
          if (!sessionId) return;
          const latest = await fetchSupplierBatch(sessionId);
          if (latest?.id === supplierBatch.id) setSupplierBatch(latest);
        }} />}
        {isBusy && !activeAssistantHasContent && (
          <div className="flex items-end gap-2" aria-live="polite">
            <span className="flex size-7 items-center justify-center rounded-full bg-blue-100 text-[#0858b1]">
              <Bot size={15} />
            </span>
            <div className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-slate-100 bg-white px-3.5 py-3 text-xs text-slate-500 shadow-sm">
              <LoaderCircle size={15} className="animate-spin text-[#0858b1]" />
              {task.progress || agentProgress}
            </div>
          </div>
        )}
        {(task.status === "running" || task.error === TASK_STALE_MESSAGE) && task.partialText && !isRawToolCallText(task.partialText) && !activeAssistantHasContent && (
          <div
            role="status"
            aria-live="polite"
            className="ml-9 max-w-3xl rounded-2xl rounded-bl-md border border-slate-100 bg-white px-3.5 py-3 text-sm leading-6 text-slate-700 shadow-sm"
          >
            {renderAgentMarkdown(task.partialText)}
          </div>
        )}
        {friendlyError && (
          <div
            role="alert"
            className="rounded-xl border border-red-100 bg-red-50 px-3.5 py-3 text-sm leading-5 text-red-700"
          >
            <p>{friendlyError}</p>
            {(canRetryDemand || sendFailure?.retryable) && (
              <button
                type="button"
                onClick={() => void (sendFailure ? retryFailedSend() : retryFailedTask())}
                className="mt-2 inline-flex min-h-8 items-center rounded-lg bg-[#0858b1] px-3 text-xs font-semibold text-white transition hover:bg-[#064990] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              >
                {sendFailure ? "Relancer l’envoi" : "Relancer la demande"}
              </button>
            )}
          </div>
        )}
        {!isBusy && task.status !== "failed" && !rawToolCallError && !sendFailure && historyReady && messages.some((message) => message.role === "user") && (
          <div className="-mt-1 flex pl-9">
            <button
              type="button"
              onClick={() => void retryFailedTask()}
              aria-label="Régénérer la réponse"
              title="Régénérer la réponse"
              className="flex size-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-[#0858b1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              <RotateCw size={15} aria-hidden="true" />
            </button>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="mt-auto shrink-0 border-t border-slate-200 bg-white p-3 sm:p-4">
        {pendingImage && imagePreviewUrl && (
          <div className="mb-3 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-2.5">
            <Image src={imagePreviewUrl} alt="Aperçu de l’image à envoyer" width={56} height={56} unoptimized className="size-14 rounded-lg object-cover" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-slate-700">{pendingImage.name || "Image copiée"}</p>
              <p className="text-[10px] text-slate-500">{(pendingImage.size / 1024 / 1024).toFixed(2)} Mo</p>
            </div>
            <button type="button" onClick={removeImage} disabled={isBusy} aria-label="Supprimer l’image" className="flex size-8 items-center justify-center rounded-lg text-slate-500 hover:bg-white hover:text-red-600 disabled:opacity-50">
              <X size={16} />
            </button>
          </div>
        )}
        <div className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm transition focus-within:border-blue-300 focus-within:ring-2 focus-within:ring-blue-100">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onPaste={handlePaste}
            onKeyDown={handleKeyDown}
            placeholder={historyReady ? "Écrivez ou collez une image…" : "Chargement de la conversation…"}
            aria-label="Votre message"
            rows={1}
            disabled={isBusy}
            className="max-h-40 min-h-10 flex-1 resize-none overflow-y-hidden bg-transparent px-2 py-2 text-sm leading-5 text-slate-800 outline-none placeholder:text-slate-400 disabled:opacity-60"
          />
          {isBusy && (
            <button
              type="button"
              onClick={stopResponse}
              aria-label="Arrêter la réponse"
              title="Arrêter la réponse"
              className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#0858b1] text-white transition hover:bg-[#064990] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2"
            >
              <Square size={14} fill="currentColor" aria-hidden="true" />
            </button>
          )}
          <button
            type="submit"
            aria-label="Envoyer le message"
            title={isBusy ? "Une réponse est en cours. Arrêtez-la pour envoyer un autre message." : undefined}
            disabled={isBusy || (!input.trim() && !pendingImage) || !historyReady}
            className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#0858b1] text-white transition hover:bg-[#064990] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
          >
            <ArrowUp size={19} />
          </button>
        </div>
        {inputError && <p role="alert" className="mt-2 text-center text-xs text-red-600">{inputError}</p>}
        <p className="mt-2 text-center text-[11px] text-slate-500">
          IA vous fait gagner du temps
        </p>
      </form>
      </div>
      {fullPage && resourcesOpen && (
        <>
        <button
          type="button"
          role="separator"
          aria-orientation="vertical"
          aria-label="Redimensionner les liens et ressources"
          aria-valuemin={MIN_RESOURCES_WIDTH}
          aria-valuemax={Math.max(MIN_RESOURCES_WIDTH, (chatGridRef.current?.clientWidth ?? historyWidth + resourcesWidth + MIN_CHAT_WIDTH + RESIZE_HANDLE_WIDTH * 2) - MIN_CHAT_WIDTH - historyWidth - RESIZE_HANDLE_WIDTH * 2)}
          aria-valuenow={resourcesWidth}
          onPointerDown={(event) => beginPanelResize("resources", event)}
          onPointerMove={movePanelResize}
          onPointerUp={endPanelResize}
          onPointerCancel={endPanelResize}
          onKeyDown={(event) => handleResizeKeyDown("resources", event)}
          className="group hidden w-2 cursor-col-resize touch-none items-center justify-center bg-transparent hover:bg-blue-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-400 lg:flex"
        >
          <span className="h-10 w-1 rounded-full bg-slate-200 group-hover:bg-[#0858b1]" />
        </button>
        <aside className="hidden min-h-0 min-w-0 flex-col overflow-hidden bg-slate-50 p-4 lg:flex">
          <h3 className="text-sm font-semibold text-slate-900">Liens et ressources</h3>
          <p className="mt-1 text-xs leading-5 text-slate-600">Retrouvez ici les sources et pages partagées dans la conversation.</p>
          <div className="mt-4 flex min-h-0 flex-col gap-2 overflow-y-auto">
            {externalLinks.length ? externalLinks.map((link) => {
              const faviconDomain = getPublicSiteDomain(link.url);
              return (
                <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer" title={link.label} className="flex min-w-0 items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 text-xs font-medium text-[#0858b1] hover:border-blue-200 hover:bg-blue-50">
                  {faviconDomain ? <SiteFavicon domain={faviconDomain} /> : <ExternalLink size={14} className="shrink-0" aria-hidden="true" />}
                  <span className="min-w-0 flex-1 truncate">{link.label}</span>
                </a>
              );
            }) : <p className="rounded-xl border border-dashed border-slate-300 bg-white p-3 text-xs leading-5 text-slate-600">Aucun lien pour le moment. Les liens cités par l’Agent apparaîtront dans cette liste.</p>}
          </div>
        </aside>
        </>
      )}
    </div>
  );
}
