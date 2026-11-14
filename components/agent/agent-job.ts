// Logique pure des tâches asynchrones de l'agent (aucun import : testable avec `node --test`).
// Le navigateur crée une tâche (POST), puis l'interroge toutes les 2 s jusqu'à « done » ou « error ».

export type AgentJobStatus = "pending" | "running" | "done" | "error";

export type AgentJobSnapshot = {
  job_id: string;
  status: AgentJobStatus;
  progress: string;
  result: { text: string; events: unknown[] };
  error: string | null;
  created_at: string;
  updated_at: string;
};

export const AGENT_JOB_POLL_MS = 2_000;
export const AGENT_JOB_MAX_FAILURES = 5;
export const AGENT_JOB_MAX_DURATION_MS = 10 * 60_000;

export const AGENT_JOB_TIMEOUT_MESSAGE =
  "L’agent met plus de 10 minutes à répondre : le suivi a été arrêté. Vérifiez la conversation ou relancez la demande.";
export const AGENT_JOB_NETWORK_MESSAGE =
  "La connexion avec l’agent est interrompue. Vous pouvez relancer la demande.";
export const AGENT_JOB_LOST_MESSAGE =
  "Cette demande n’est plus suivie par le serveur (redémarrage possible). Vous pouvez la relancer.";
export const AGENT_JOB_AUTH_MESSAGE = "Votre session administrateur a expiré. Reconnectez-vous pour continuer.";
export const AGENT_JOB_FAILED_MESSAGE = "L’agent n’a pas pu terminer cette demande. Vous pouvez la relancer.";

export class AgentJobHttpError extends Error {
  readonly statusCode: number;

  constructor(statusCode: number, message = `HTTP ${statusCode}`) {
    super(message);
    this.name = "AgentJobHttpError";
    this.statusCode = statusCode;
  }
}

export type AgentJobOutcome =
  | { kind: "done"; job: AgentJobSnapshot }
  | { kind: "error"; job: AgentJobSnapshot; message: string }
  | { kind: "auth"; message: string }
  | { kind: "lost"; message: string }
  | { kind: "timeout"; message: string }
  | { kind: "network"; message: string }
  | { kind: "aborted" };

export type PollAgentJobOptions = {
  jobId: string;
  /** Début de la tâche (ms) : conservé après un rafraîchissement pour borner la durée totale. */
  startedAt: number;
  fetchJob: (jobId: string, signal?: AbortSignal) => Promise<AgentJobSnapshot>;
  onUpdate?: (job: AgentJobSnapshot) => void;
  signal?: AbortSignal;
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
  now?: () => number;
  pollMs?: number;
  maxFailures?: number;
  maxDurationMs?: number;
};

function defaultSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve();
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      resolve();
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * Interroge la tâche jusqu'à son état final. Une panne réseau ou 5xx passagère est retentée
 * (5 échecs consécutifs au plus) ; un 404 signifie que le serveur ne connaît plus la tâche.
 */
export async function pollAgentJob(options: PollAgentJobOptions): Promise<AgentJobOutcome> {
  const {
    jobId, startedAt, fetchJob, onUpdate, signal,
    sleep = defaultSleep,
    now = Date.now,
    pollMs = AGENT_JOB_POLL_MS,
    maxFailures = AGENT_JOB_MAX_FAILURES,
    maxDurationMs = AGENT_JOB_MAX_DURATION_MS,
  } = options;
  let failures = 0;
  for (;;) {
    if (signal?.aborted) return { kind: "aborted" };
    if (now() - startedAt >= maxDurationMs) return { kind: "timeout", message: AGENT_JOB_TIMEOUT_MESSAGE };
    let job: AgentJobSnapshot;
    try {
      job = await fetchJob(jobId, signal);
      failures = 0;
    } catch (error) {
      if (signal?.aborted) return { kind: "aborted" };
      const status = error instanceof AgentJobHttpError ? error.statusCode : undefined;
      if (status === 404) return { kind: "lost", message: AGENT_JOB_LOST_MESSAGE };
      if (status === 401 || status === 403) return { kind: "auth", message: AGENT_JOB_AUTH_MESSAGE };
      failures += 1;
      if (failures >= maxFailures) return { kind: "network", message: AGENT_JOB_NETWORK_MESSAGE };
      await sleep(pollMs, signal);
      continue;
    }
    if (job.status === "done") return { kind: "done", job };
    if (job.status === "error") {
      return { kind: "error", job, message: job.error?.trim() || AGENT_JOB_FAILED_MESSAGE };
    }
    onUpdate?.(job);
    await sleep(pollMs, signal);
  }
}

/** « 0:45 », « 12:03 » : durée écoulée affichée pendant le traitement. */
export function formatElapsed(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

// --- Reprise après rafraîchissement de la page -----------------------------

export type ActiveAgentJob = {
  jobId: string;
  sessionId: string;
  startedAt: number;
  message: string;
  hasImage: boolean;
};

export type JobStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export const ACTIVE_JOB_STORAGE_KEY = "fgmc-agent-active-job";

export function saveActiveJob(storage: JobStorage, job: ActiveAgentJob): void {
  try {
    storage.setItem(ACTIVE_JOB_STORAGE_KEY, JSON.stringify(job));
  } catch {
    // Stockage indisponible (navigation privée) : la reprise après rafraîchissement est perdue, rien d'autre.
  }
}

export function clearActiveJob(storage: JobStorage): void {
  try {
    storage.removeItem(ACTIVE_JOB_STORAGE_KEY);
  } catch {
    // Rien à nettoyer si le stockage est indisponible.
  }
}

/** Relit la tâche en cours ; une valeur invalide ou plus vieille que la durée maximale est ignorée et effacée. */
export function loadActiveJob(
  storage: JobStorage,
  now: number = Date.now(),
  maxDurationMs: number = AGENT_JOB_MAX_DURATION_MS,
): ActiveAgentJob | null {
  let raw: string | null;
  try {
    raw = storage.getItem(ACTIVE_JOB_STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (
      typeof value === "object" && value !== null &&
      typeof (value as ActiveAgentJob).jobId === "string" && /^[\w-]{1,64}$/.test((value as ActiveAgentJob).jobId) &&
      typeof (value as ActiveAgentJob).sessionId === "string" &&
      typeof (value as ActiveAgentJob).startedAt === "number" &&
      Number.isFinite((value as ActiveAgentJob).startedAt) &&
      now - (value as ActiveAgentJob).startedAt < maxDurationMs
    ) {
      const job = value as ActiveAgentJob;
      return {
        jobId: job.jobId,
        sessionId: job.sessionId,
        startedAt: job.startedAt,
        message: typeof job.message === "string" ? job.message : "",
        hasImage: job.hasImage === true,
      };
    }
  } catch {
    // JSON illisible : traité comme absent.
  }
  clearActiveJob(storage);
  return null;
}
