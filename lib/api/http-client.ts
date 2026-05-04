import { getBackendBaseUrl } from "@/lib/backend-url";

const API_BASE_URL = getBackendBaseUrl();

type RequestOptions = RequestInit & {
  path: string;
};

type ErrorResponse = {
  message?: string | string[];
};

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

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(isFormDataPayload ? {} : { "Content-Type": "application/json" }),
      ...headers,
    },
    cache: "no-store",
  });

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
