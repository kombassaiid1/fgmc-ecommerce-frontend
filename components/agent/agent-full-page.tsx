"use client";

import { useContext } from "react";
import Image from "next/image";
import { Bot, ChevronLeft, ChevronRight } from "lucide-react";
import { AgentChat } from "@/components/agent/agent-chat";
import { AgentAdminNavigationContext } from "@/components/agent/agent-admin-navigation-context";

export function AgentFullPage() {
  const adminNavigation = useContext(AgentAdminNavigationContext);

  return (
    <section className="flex h-[calc(100dvh-5rem)] min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white" aria-label="Agent FGMC complet">
      <header className="flex shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-5 py-3">
        {adminNavigation && (
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
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0858b1]"
          >
            {adminNavigation.isVisible ? (
              <ChevronLeft size={20} aria-hidden="true" />
            ) : (
              <ChevronRight size={20} aria-hidden="true" />
            )}
          </button>
        )}
        <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-blue-50 p-1">
          <Image src="/arafet.jpeg" alt="Agent FGMC" width={40} height={40} className="h-full w-full rounded-lg object-cover" />
        </span>
        <div className="min-w-0">
          <h1 className="text-base font-semibold text-slate-900">Agent FGMC</h1>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500"><span className="size-1.5 rounded-full bg-emerald-500" aria-hidden="true" />En ligne</p>
        </div>
        <Bot size={20} className="ml-auto shrink-0 text-[#0858b1]" aria-hidden="true" />
      </header>
      <AgentChat fullPage />
    </section>
  );
}
