import "server-only";

import { cookies } from "next/headers";
import { getBackendBaseUrl } from "@/lib/backend-url";

export const ADMIN_TOKEN_COOKIE = "admin_ben_token";
const ADMIN_ROLES = new Set(["ADMIN", "STORE_MANAGER"]);

const API_BASE_URL = getBackendBaseUrl();

export type AdminUser = {
  id: string;
  email: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  role: string;
};

type LoginResponse = {
  access_token: string;
  user: AdminUser;
};

export type AdminLoginResult =
  | {
      ok: true;
      user: AdminUser;
    }
  | {
      ok: false;
      error: string;
    };

export async function loginAdmin(
  email: string,
  password: string
): Promise<AdminLoginResult> {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
    cache: "no-store",
  });

  const data = (await response.json().catch(() => null)) as LoginResponse | null;

  if (!response.ok || !data?.access_token || !data.user) {
    return {
      ok: false,
      error: "Adresse e-mail ou mot de passe invalide.",
    };
  }

  if (!ADMIN_ROLES.has(data.user.role)) {
    return {
      ok: false,
      error: "Ce compte n'est pas autorisé à accéder à l'administration.",
    };
  }

  const cookieStore = await cookies();
  cookieStore.set({
    name: ADMIN_TOKEN_COOKIE,
    value: data.access_token,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7,
  });

  return {
    ok: true,
    user: data.user,
  };
}

export async function getAdminUserFromSession(): Promise<AdminUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_TOKEN_COOKIE)?.value;

  if (!token) {
    return null;
  }

  const response = await fetch(`${API_BASE_URL}/auth/me`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  const user = (await response.json().catch(() => null)) as AdminUser | null;
  if (!user || !ADMIN_ROLES.has(user.role)) {
    return null;
  }

  return user;
}

export async function clearAdminSession() {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_TOKEN_COOKIE);
}
