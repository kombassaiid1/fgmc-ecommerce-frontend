// Erreur d'envoi vers /frontend-api/admin/agent/chat : conserve le statut HTTP pour réagir (409, 5xx…).
export class AgentRequestError extends Error {
  readonly statusCode: number;
  readonly serverMessage: string;

  constructor(statusCode: number, serverMessage: string) {
    super(serverMessage || `HTTP ${statusCode}`);
    this.name = "AgentRequestError";
    this.statusCode = statusCode;
    this.serverMessage = serverMessage;
  }

  static async fromResponse(response: Response): Promise<AgentRequestError> {
    let serverMessage = "";
    try {
      const raw = (await response.text()).slice(0, 2000);
      try {
        const parsed = JSON.parse(raw) as { message?: unknown };
        if (typeof parsed.message === "string") serverMessage = parsed.message;
        else if (Array.isArray(parsed.message)) serverMessage = parsed.message.filter((item) => typeof item === "string").join(", ");
      } catch {
        serverMessage = "";
      }
    } catch {
      serverMessage = "";
    }
    return new AgentRequestError(response.status, serverMessage);
  }
}

export const TASK_IN_PROGRESS_MESSAGE = "Une réponse est déjà en cours. Attendez sa fin ou cliquez sur Arrêter.";

export type SendFailure = { message: string; conflict: boolean; retryable: boolean };

// Le statut compte, pas le corps : un 409 est un refus « tâche en cours » même sans message.
export function describeSendError(error: unknown): SendFailure {
  const status = error instanceof AgentRequestError ? error.statusCode : undefined;
  if (status === 409) return { message: TASK_IN_PROGRESS_MESSAGE, conflict: true, retryable: false };
  if (status === 401) return { message: "Votre session administrateur a expiré. Reconnectez-vous pour continuer.", conflict: false, retryable: false };
  if (status === 403) return { message: "Votre compte n’a pas accès à l’Agent FGMC.", conflict: false, retryable: false };
  if (status === 429) return { message: "Le modèle est temporairement limité par son fournisseur. Réessayez dans un instant.", conflict: false, retryable: true };
  if (status !== undefined && status >= 500) {
    return { message: "Le service Agent est momentanément indisponible. Réessayez dans un instant.", conflict: false, retryable: true };
  }
  if (status !== undefined) {
    const detail = error instanceof AgentRequestError ? error.serverMessage.trim() : "";
    return { message: detail && detail.length <= 200 ? detail : "La demande n’a pas pu être envoyée. Réessayez.", conflict: false, retryable: true };
  }
  return { message: "Le service Agent est indisponible. Vérifiez votre connexion puis réessayez.", conflict: false, retryable: true };
}
