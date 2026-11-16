/** Client helpers for /admin_ben/users: go through the Next proxy (httpOnly cookie). */

export type StaffRole = "ADMIN" | "STORE_MANAGER";

export type StaffUser = {
  id: string;
  email: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  phoneNumber: string | null;
  role: StaffRole;
  adminRoleId: string | null;
  adminRole: { id: string; name: string } | null;
  createdAt: string;
};

export type AdminRoleItem = {
  id: string;
  name: string;
  description: string | null;
  permissions: string[];
  _count?: { users: number };
};

export type StaffUserPayload = {
  email: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  phoneNumber?: string;
  role: StaffRole;
  adminRoleId?: string | null;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/admin${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
    cache: "no-store",
  });
  const data = (await response.json().catch(() => null)) as
    | (T & { message?: string | string[] })
    | null;
  if (!response.ok) {
    const message = data?.message;
    throw new Error(
      (Array.isArray(message) ? message.join(", ") : message) ||
        `Erreur ${response.status}`,
    );
  }
  return data as T;
}

export function listStaffUsers(params: { page: number; search?: string; role?: string }) {
  const query = new URLSearchParams({ page: String(params.page), limit: "10" });
  if (params.search?.trim()) query.set("search", params.search.trim());
  if (params.role) query.set("role", params.role);
  return request<{
    data: StaffUser[];
    meta: { total: number; page: number; totalPages: number };
  }>(`/users?${query.toString()}`);
}

export const createStaffUser = (payload: StaffUserPayload) =>
  request<StaffUser>("/users", { method: "POST", body: JSON.stringify(payload) });

export const updateStaffUser = (id: string, payload: Partial<StaffUserPayload>) =>
  request<StaffUser>(`/users/${id}`, { method: "PATCH", body: JSON.stringify(payload) });

export const deleteStaffUser = (id: string) =>
  request<{ deleted: true }>(`/users/${id}`, { method: "DELETE" });

export const listAdminRoles = () => request<AdminRoleItem[]>("/roles");

export const createAdminRole = (payload: {
  name: string;
  description?: string;
  permissions: string[];
}) => request<AdminRoleItem>("/roles", { method: "POST", body: JSON.stringify(payload) });

export const updateAdminRole = (
  id: string,
  payload: { name?: string; description?: string; permissions?: string[] },
) => request<AdminRoleItem>(`/roles/${id}`, { method: "PATCH", body: JSON.stringify(payload) });

export const deleteAdminRole = (id: string) =>
  request<{ deleted: true }>(`/roles/${id}`, { method: "DELETE" });
