// Appels réseau des tâches de l'agent, via les routes Next /frontend-api/admin/agent/jobs.
import { AgentJobHttpError, type AgentJobSnapshot } from "./agent-job";
import { AgentRequestError } from "./send-error";

const JOB_STATUSES = ["pending", "running", "done", "error"];

export type StartAgentJobInput = {
  message: string;
  sessionId: string;
  taskId?: string;
  regenerate?: boolean;
  image?: File | null;
};

/** Crée la tâche. Un refus (409 tâche en cours, 4xx, 5xx) est une AgentRequestError avec son statut. */
export async function startAgentJob(input: StartAgentJobInput): Promise<{ jobId: string }> {
  let response: Response;
  if (input.image) {
    const form = new FormData();
    form.set("message", input.message);
    form.set("sessionId", input.sessionId);
    if (input.taskId) form.set("taskId", input.taskId);
    if (input.regenerate) form.set("regenerate", "true");
    form.set("image", input.image, input.image.name || "agent-image");
    response = await fetch("/frontend-api/admin/agent/jobs", { method: "POST", body: form });
  } else {
    response = await fetch("/frontend-api/admin/agent/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: input.message,
        sessionId: input.sessionId,
        ...(input.taskId ? { taskId: input.taskId } : {}),
        ...(input.regenerate ? { regenerate: true } : {}),
      }),
    });
  }
  if (!response.ok) throw await AgentRequestError.fromResponse(response);
  const payload: unknown = await response.json().catch(() => null);
  const jobId = typeof payload === "object" && payload !== null ? (payload as { job_id?: unknown }).job_id : undefined;
  if (typeof jobId !== "string" || !/^[\w-]{1,64}$/.test(jobId)) {
    throw new AgentRequestError(502, "Réponse invalide du service Agent.");
  }
  return { jobId };
}

/** Lit l'état d'une tâche. Toute réponse non valide devient une AgentJobHttpError que le polling sait classer. */
export async function readAgentJob(jobId: string, signal?: AbortSignal): Promise<AgentJobSnapshot> {
  const response = await fetch(`/frontend-api/admin/agent/jobs/${encodeURIComponent(jobId)}`, {
    cache: "no-store",
    signal,
  });
  if (!response.ok) throw new AgentJobHttpError(response.status);
  const payload: unknown = await response.json().catch(() => null);
  if (
    typeof payload !== "object" || payload === null ||
    !JOB_STATUSES.includes(String((payload as { status?: unknown }).status))
  ) {
    throw new AgentJobHttpError(502, "Réponse invalide du service Agent.");
  }
  const job = payload as Partial<AgentJobSnapshot>;
  return {
    job_id: typeof job.job_id === "string" ? job.job_id : jobId,
    status: job.status as AgentJobSnapshot["status"],
    progress: typeof job.progress === "string" ? job.progress : "",
    result: {
      text: typeof job.result?.text === "string" ? job.result.text : "",
      events: Array.isArray(job.result?.events) ? job.result.events : [],
    },
    error: typeof job.error === "string" ? job.error : null,
    created_at: typeof job.created_at === "string" ? job.created_at : "",
    updated_at: typeof job.updated_at === "string" ? job.updated_at : "",
  };
}
