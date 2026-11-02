"use client";

import Image from "next/image";
import { Bot } from "lucide-react";
import { AgentChat } from "@/components/agent/agent-chat";

export function AgentFullPage() {
  return (
    <section className="flex h-[calc(100dvh-5rem)] min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white" aria-label="Agent FGMC complet">
      <header className="flex shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-5 py-3">
        <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-blue-50 p-1">
          <Image src="/arafet.jpeg" alt="Agent FGMC" width={40} height={40} className="h-full w-full rounded-lg object-cover" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-base font-semibold text-slate-900">Agent FGMC</h1>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500"><span className="size-1.5 rounded-full bg-emerald-500" aria-hidden="true" />En ligne</p>
        </div>
        <Bot size={20} className="text-[#0858b1]" aria-hidden="true" />
      </header>
      <AgentChat fullPage />
    </section>
  );
}
