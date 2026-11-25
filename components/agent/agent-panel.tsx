"use client";

import { X } from "lucide-react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";

import { AgentChat } from "@/components/agent/agent-chat";
import { AgentHeader } from "@/components/agent/agent-themed-ui";
import { useAgentTheme } from "@/components/providers/agent-theme-provider";
import themedStyles from "@/components/agent/agent-themed-ui.module.css";

type AgentPanelProps = {
  onClose: () => void;
  agentName: string;
};

export function AgentPanel({ onClose, agentName }: AgentPanelProps) {
  const router = useRouter();
  const theme = useAgentTheme();

  return (
    <motion.section
      initial={{ opacity: 0, scale: 0.94, y: 16 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.94, y: 16 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      aria-label={agentName}
      className={`${themedStyles.agentFrame} fixed bottom-20 right-3 z-[60] flex h-[min(680px,calc(100dvh-7rem))] min-h-0 w-[calc(100vw-1.5rem)] max-w-[460px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:bottom-24 sm:right-5 sm:w-[460px]`}
      data-agent-theme={theme.id}
      style={{ fontFamily: "Arial, Helvetica, sans-serif", letterSpacing: "normal", fontStretch: "normal" }}
    >
      <AgentHeader className="py-3.5">
        <button
          type="button"
          aria-label={`Fermer le panneau ${agentName}`}
          onClick={onClose}
          className="flex size-9 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--agent-focus)]"
        >
          <X size={19} aria-hidden="true" />
        </button>
      </AgentHeader>
      <AgentChat agentName={agentName} onOpenFullPage={() => router.push("/admin_ben/agent")} />
    </motion.section>
  );
}
