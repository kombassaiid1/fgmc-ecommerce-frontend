"use client";

import { createContext, useContext } from "react";
import { can } from "@/lib/permissions";

type AdminSession = { userId: string; permissions: string[] };

export const AdminSessionContext = createContext<AdminSession>({ userId: "", permissions: [] });

export function useAdminSession() {
  const session = useContext(AdminSessionContext);
  return { ...session, can: (permission: string) => can(session.permissions, permission) };
}
