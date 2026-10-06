"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";

import { AgentPanel } from "@/components/agent/agent-panel";

export function AgentFloatingButton() {
  const [isOpen, setIsOpen] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

const handleClick = () => {
  if (!isOpen && audioRef.current) {
    audioRef.current.currentTime = 0;
    audioRef.current.play().catch(() => {});
  }

  setIsOpen((open) => !open);
};

  return (
    <>
      <AnimatePresence>
        {isOpen && <AgentPanel onClose={() => setIsOpen(false)} />}
      </AnimatePresence>

      <audio
        ref={audioRef}
        src="/agent/arafet-click.mp3"
        preload="auto"
      />

      <motion.button
        type="button"
        aria-label={isOpen ? "Fermer Agent_FGMC" : "Ouvrir Agent FGMC"}
        aria-expanded={isOpen}
        onClick={handleClick}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.96 }}
        className="fixed bottom-5 right-5 z-[70] flex h-28 w-28 items-center justify-center bg-transparent p-0 outline-none focus-visible:rounded-2xl focus-visible:ring-4 focus-visible:ring-blue-200"
      >
        <Image
          src="/agent/arafet-agent-bg-rm.gif"
          alt="Agent FGMC"
          width={800}
          height={1422}
          unoptimized
          draggable={false}
          className="h-full w-full object-contain"
        />
      </motion.button>
    </>
  );
}
