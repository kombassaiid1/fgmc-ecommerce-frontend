import { isValidRecoId } from "@/lib/reco/utils";

const SESSION_STORAGE_KEY = "fgmc-reco-session";

/** Used when localStorage is unavailable (private mode, blocked storage...). */
let memorySessionId: string | null = null;

function createSessionId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  // randomUUID only exists in secure contexts (HTTPS or localhost).
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
  return [
    hex.slice(0, 4).join(""),
    hex.slice(4, 6).join(""),
    hex.slice(6, 8).join(""),
    hex.slice(8, 10).join(""),
    hex.slice(10, 16).join(""),
  ].join("-");
}

/**
 * Anonymous, random browser identifier used only for recommendation events.
 * Never derived from the client account.
 */
export function getRecoSessionId(): string {
  try {
    const stored = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (isValidRecoId(stored)) return stored;
    const sessionId = createSessionId();
    window.localStorage.setItem(SESSION_STORAGE_KEY, sessionId);
    return sessionId;
  } catch {
    memorySessionId ??= createSessionId();
    return memorySessionId;
  }
}
