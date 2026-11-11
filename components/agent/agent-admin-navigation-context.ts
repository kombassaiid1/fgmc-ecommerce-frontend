"use client";

import { createContext } from "react";

export type AgentAdminNavigationContextValue = {
  isVisible: boolean;
  toggle: () => void;
};

export const AgentAdminNavigationContext =
  createContext<AgentAdminNavigationContextValue | null>(null);
