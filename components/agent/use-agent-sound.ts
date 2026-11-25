"use client";

import { useCallback, useEffect, useRef } from "react";
import type { AgentSound } from "@/lib/agent-sound";
import { playAgentSound } from "./agent-sound-player";

export function useAgentSound(sound: AgentSound) {
  const stopRef = useRef<(() => void) | null>(null);
  const stop = useCallback(() => {
    stopRef.current?.();
    stopRef.current = null;
  }, []);
  useEffect(() => stop, [sound, stop]);
  const play = useCallback(() => {
    stop();
    stopRef.current = playAgentSound(sound);
  }, [sound, stop]);
  return { play, stop };
}
