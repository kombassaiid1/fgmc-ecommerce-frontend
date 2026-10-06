"use client";

import { Bot, X } from "lucide-react";
import { motion } from "framer-motion";

import { AgentChat } from "@/components/agent/agent-chat";
import Image from "next/image";

type AgentPanelProps = {
  onClose: () => void;
};

export function AgentPanel({ onClose }: AgentPanelProps) {
  return (
    <motion.section
      initial={{ opacity: 0, scale: 0.94, y: 16 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.94, y: 16 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      aria-label="Agent FGMC"
      className="fixed bottom-[8.5rem] right-3 z-[60] flex h-[min(680px,calc(100dvh-9.5rem))] w-[calc(100vw-1.5rem)] max-w-[460px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:right-5 sm:w-[460px]"
    >
      <header className="flex shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 py-3.5">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#0858b1]">
          <Image
              src="/arafet.jpeg"
              alt="Agent FGMC"
              width={40}
              height={40}
              className="h-full w-full object-cover"/>
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold text-slate-900">
            Agent FGMC
          </h2>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
            <span
              className="size-1.5 rounded-full bg-emerald-500"
              aria-hidden="true"
            />
            En ligne
          </p>
        </div>
        <button
          type="button"
          aria-label="Fermer le panneau Agent FGMC"
          onClick={onClose}
          className="flex size-9 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
        >
          <X size={19} aria-hidden="true" />
        </button>
      </header>
      <AgentChat />
    </motion.section>
  );
}
