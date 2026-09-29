import { getBackendBaseUrl } from "@/lib/backend-url";

const API_BASE_URL = getBackendBaseUrl();

type RequestOptions = RequestInit & {
  path: string;
};

type ErrorResponse = {
  message?: string | string[];
};

const DEFAULT_REQUEST_TIMEOUT_MS = 15000;

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function apiRequest<T>({
  path,
  headers,
  ...options
}: RequestOptions): Promise<T> {
  const isFormDataPayload =
    typeof FormData !== "undefined" && options.body instanceof FormData;
  const controller =
    options.signal == null ? new AbortController() : null;
  const timeoutId =
    controller == null
      ? null
      : setTimeout(() => controller.abort(), DEFAULT_REQUEST_TIMEOUT_MS);

  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      signal: options.signal ?? controller?.signal,
      headers: {
        ...(isFormDataPayload ? {} : { "Content-Type": "application/json" }),
        ...headers,
      },
      cache: "no-store",
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiError("La requete a expire.", 408);
    }
    throw error;
  } finally {
    if (timeoutId != null) {
      clearTimeout(timeoutId);
    }
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | ErrorResponse
      | null;
    const message = Array.isArray(payload?.message)
      ? payload?.message.join(", ")
      : payload?.message ?? "Une erreur est survenue.";
    throw new ApiError(message, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
