import type { ClientAuthResponse, ClientAuthUser } from "@/lib/api/clients";

const CLIENT_AUTH_TOKEN_KEY = "fgmc_client_token";
const CLIENT_AUTH_USER_KEY = "fgmc_client_user";
const CLIENT_SESSION_EVENT = "fgmc-client-session";
const CLIENT_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

export type ClientSession = {
  token: string;
  user: ClientAuthUser | null;
};

function getStorage() {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;

  const cookies = document.cookie ? document.cookie.split("; ") : [];
  for (const cookie of cookies) {
    const [key, ...valueParts] = cookie.split("=");
    if (key === name) {
      return decodeURIComponent(valueParts.join("="));
    }
  }

  return null;
}

function setCookie(name: string, value: string, maxAge: number) {
  if (typeof document === "undefined") return;

  const secure =
    typeof window !== "undefined" && window.location.protocol === "https:"
      ? "; Secure"
      : "";

  document.cookie = `${name}=${encodeURIComponent(
    value,
  )}; Max-Age=${maxAge}; Path=/; SameSite=Lax${secure}`;
}

function removeCookie(name: string) {
  setCookie(name, "", 0);
}

function emitClientSessionChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(CLIENT_SESSION_EVENT));
}

export function getClientAuthToken(response: ClientAuthResponse): string {
  return response.access_token ?? response.token ?? "";
}

export function getClientAuthUser(
  response: ClientAuthResponse,
): ClientAuthUser | null {
  return response.client ?? response.user ?? null;
}

export function saveClientSession(response: ClientAuthResponse): ClientSession {
  const token = getClientAuthToken(response);
  const user = getClientAuthUser(response);

  if (!token) {
    throw new Error("La connexion a reussi, mais le serveur n'a pas renvoye de jeton.");
  }

  const storage = getStorage();
  setCookie(CLIENT_AUTH_TOKEN_KEY, token, CLIENT_COOKIE_MAX_AGE);
  storage?.setItem(CLIENT_AUTH_TOKEN_KEY, token);
  if (user) {
    storage?.setItem(CLIENT_AUTH_USER_KEY, JSON.stringify(user));
  } else {
    storage?.removeItem(CLIENT_AUTH_USER_KEY);
  }

  emitClientSessionChange();

  return { token, user };
}

export function getClientSession(): ClientSession | null {
  const storage = getStorage();
  const token =
    getCookie(CLIENT_AUTH_TOKEN_KEY) ?? storage?.getItem(CLIENT_AUTH_TOKEN_KEY);

  if (!token) return null;

  const rawUser = storage?.getItem(CLIENT_AUTH_USER_KEY);
  let user: ClientAuthUser | null = null;

  if (rawUser) {
    try {
      user = JSON.parse(rawUser) as ClientAuthUser;
    } catch {
      user = null;
    }
  }

  return { token, user };
}

export function clearClientSession() {
  const storage = getStorage();
  removeCookie(CLIENT_AUTH_TOKEN_KEY);
  storage?.removeItem(CLIENT_AUTH_TOKEN_KEY);
  storage?.removeItem(CLIENT_AUTH_USER_KEY);
  emitClientSessionChange();
}

export function subscribeToClientSession(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};

  window.addEventListener(CLIENT_SESSION_EVENT, onStoreChange);
  window.addEventListener("storage", onStoreChange);

  return () => {
    window.removeEventListener(CLIENT_SESSION_EVENT, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}
