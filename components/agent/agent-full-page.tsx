"use client";

import { useContext } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AgentChat } from "@/components/agent/agent-chat";
import { AgentAdminNavigationContext } from "@/components/agent/agent-admin-navigation-context";
import { useAgentTheme } from "@/components/providers/agent-theme-provider";
import { AgentHeader, useAgentThemeStyle } from "@/components/agent/agent-themed-ui";
import themedStyles from "@/components/agent/agent-themed-ui.module.css";

export function AgentFullPage({ agentName }: { agentName: string }) {
  const theme = useAgentTheme();
  const themeStyle = useAgentThemeStyle();
  const adminNavigation = useContext(AgentAdminNavigationContext);

  return (
    <section data-agent-theme={theme.id} style={themeStyle} className={`${themedStyles.agentFrame} flex h-[calc(100dvh-5rem)] min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white`} aria-label={`${agentName} complet`}>
      <AgentHeader
        titleAs="h1"
        className="px-5 py-3"
        leading={adminNavigation && (
          <button
            type="button"
            onClick={adminNavigation.toggle}
            aria-label={
              adminNavigation.isVisible
                ? "Masquer le menu administratif"
                : "Afficher le menu administratif"
            }
            aria-expanded={adminNavigation.isVisible}
            title={
              adminNavigation.isVisible
                ? "Masquer le menu administratif"
                : "Afficher le menu administratif"
            }
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--agent-focus)]"
          >
            {adminNavigation.isVisible ? (
              <ChevronLeft size={20} aria-hidden="true" />
            ) : (
              <ChevronRight size={20} aria-hidden="true" />
            )}
          </button>
        )}
      />
      <AgentChat agentName={agentName} fullPage />
    </section>
  );
}
