export type AgentChatStatus = "submitted" | "streaming" | "ready" | "error";
export type AgentTaskState = "idle" | "running" | "completed" | "failed" | "stopped";

export const IDLE_TASK_GRACE_MS = 15_000;

export function isAgentChatBusy(chatStatus: AgentChatStatus, taskStatus: AgentTaskState): boolean {
  return chatStatus === "submitted" || chatStatus === "streaming" || taskStatus === "running";
}

export function isChatStreamOpen(chatStatus: AgentChatStatus): boolean {
  return chatStatus === "submitted" || chatStatus === "streaming";
}

export function shouldFailMissingTask(
  chatStatus: AgentChatStatus,
  sentAt: number | null,
  now: number,
  graceMs = IDLE_TASK_GRACE_MS,
): boolean {
  return sentAt !== null && !isChatStreamOpen(chatStatus) && now - sentAt >= graceMs;
}

type RetryMessage = {
  role: "system" | "user" | "assistant";
  parts: Array<{ type?: string; text?: string }>;
};

export function getRetryContext(
  sessionId: string | null,
  messages: RetryMessage[],
): { sessionId: string; message: string } | null {
  if (!sessionId) return null;
  const lastUserMessage = messages.findLast((message) => message.role === "user");
  if (!lastUserMessage) return null;
  return {
    sessionId,
    message: lastUserMessage.parts
      .filter((part) => part.type === "text")
      .map((part) => part.text ?? "")
      .join(""),
  };
}

export type InterruptedStreamStep = "running" | "completed" | "wait" | "error";

// Flux coupé : le serveur peut avoir fini la tâche sans que le navigateur reçoive la fin.
// running = garder l'état occupé et poursuivre le polling ; completed = recharger l'historique sans erreur ;
// wait = attendre encore pendant la période de grâce ; error = afficher l'erreur.
export function nextInterruptedStreamStep(
  taskStatus: AgentTaskState,
  elapsedMs: number,
  graceMs = IDLE_TASK_GRACE_MS,
): InterruptedStreamStep {
  if (taskStatus === "running") return "running";
  if (taskStatus === "completed") return "completed";
  return elapsedMs < graceMs ? "wait" : "error";
}

// Coupure réseau (pas de statut HTTP) ou erreur serveur 5xx : seules ces erreurs justifient une vérification serveur.
export function isInterruptedStreamError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const status = "statusCode" in error && typeof error.statusCode === "number" ? error.statusCode : undefined;
  return status === undefined || status >= 500;
}
