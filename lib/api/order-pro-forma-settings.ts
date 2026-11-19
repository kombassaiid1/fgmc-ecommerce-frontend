type Numbering = {
  useSequence: boolean;
  prefix: string;
  digits: number;
  includeYear: boolean;
};

export type ProFormaSettingsInput = Numbering & { nextNumber?: number; logoMediaId?: string | null };
export type ProFormaSettings = Numbering & {
  nextNumber: number;
  logoMediaId: string | null;
  logoPreview: string | null;
  logoUrl: string | null;
};

export type OrderDocumentKind = "pro-forma" | "delivery-slip" | "credit-note";

const settingsPath = {
  "pro-forma": "order-pro-forma-settings",
  "delivery-slip": "delivery-slip-settings",
  "credit-note": "credit-note-settings",
};

async function request(kind: OrderDocumentKind, input?: ProFormaSettingsInput): Promise<ProFormaSettings> {
  const path = settingsPath[kind];
  const response = await fetch(`/frontend-api/admin/${path}`, {
    cache: "no-store",
    ...(input ? {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    } : {}),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = Array.isArray(data.message) ? data.message.join(" ") : data.message;
    throw new Error(message || "Action impossible.");
  }
  return data as ProFormaSettings;
}

export const documentSettingsApi = {
  get: (kind: OrderDocumentKind) => request(kind),
  save: (kind: OrderDocumentKind, input: ProFormaSettingsInput) => request(kind, input),
};
