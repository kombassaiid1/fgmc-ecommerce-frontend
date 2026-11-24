"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { AgentTheme } from "@/lib/agent-theme";

const AgentThemeContext = createContext<AgentTheme | null>(null);

export function AgentThemeProvider({
  theme,
  children,
}: {
  theme: AgentTheme;
  children: ReactNode;
}) {
  return <AgentThemeContext.Provider value={theme}>{children}</AgentThemeContext.Provider>;
}

/** Access the server-selected agent theme from a client component. */
export function useAgentTheme(): AgentTheme {
  const theme = useContext(AgentThemeContext);
  if (!theme) {
    throw new Error("useAgentTheme must be used within an AgentThemeProvider");
  }
  return theme;
}
