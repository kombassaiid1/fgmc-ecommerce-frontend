"use client";

import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { AnimatePresence } from "framer-motion";

import { AgentPanel } from "@/components/agent/agent-panel";
import { AgentAvatar, useAgentThemeStyle } from "@/components/agent/agent-themed-ui";
import { useAgentTheme } from "@/components/providers/agent-theme-provider";
import themedStyles from "@/components/agent/agent-themed-ui.module.css";
import { useAgentSound } from "./use-agent-sound";

const STORAGE_KEY = "fgmc-agent-button-position";
/** The button is 64 px (size-16); this much of the screen edge always stays free around it. */
const SIZE = 64;
const MARGIN = 8;
/** A press that moves less than this is a click, not a drag. */
const DRAG_THRESHOLD = 5;

/** Distances from the right and bottom edges of the window, so the button keeps its corner when the window is resized. */
type Position = { right: number; bottom: number };

const clamp = (position: Position): Position => ({
  right: Math.min(Math.max(position.right, MARGIN), Math.max(window.innerWidth - SIZE - MARGIN, MARGIN)),
  bottom: Math.min(Math.max(position.bottom, MARGIN), Math.max(window.innerHeight - SIZE - MARGIN, MARGIN)),
});

function readPosition(): Position | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<Position>;
    return Number.isFinite(value.right) && Number.isFinite(value.bottom) ? clamp(value as Position) : null;
  } catch {
    return null;
  }
}

function writePosition(position: Position) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(position));
  } catch {
    // Private mode or full storage: the button simply starts in its corner next time.
  }
}

/** The assistant's round button. It can be dragged anywhere on the screen; its place is remembered in this browser. */
export function AgentFloatingButton({ agentName }: { agentName: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<Position | null>(null);
  const [dragging, setDragging] = useState(false);
  const themeStyle = useAgentThemeStyle();
  const theme = useAgentTheme();
  const agentSound = useAgentSound(theme.sound);
  const triggerSurface = "bg-transparent border-0 p-0";
  const drag = useRef<{ startX: number; startY: number; right: number; bottom: number; moved: boolean } | null>(null);
  const latest = useRef<Position | null>(null);
  const justDragged = useRef(false);

  useEffect(() => {
    const saved = readPosition();
    latest.current = saved;
    startTransition(() => setPosition(saved));
  }, []);

  // A smaller window must not leave the button out of reach.
  useEffect(() => {
    const onResize = () => {
      if (!latest.current) return;
      const next = clamp(latest.current);
      latest.current = next;
      setPosition(next);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const handleClick = () => {
    // The click that ends a drag must not open or close the panel.
    if (justDragged.current) {
      justDragged.current = false;
      return;
    }
    if (isOpen) agentSound.stop();
    else agentSound.play();
    setIsOpen((open) => !open);
  };

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    // A new press starts clean: a drag whose click never arrived must not swallow this one.
    justDragged.current = false;
    const rect = event.currentTarget.getBoundingClientRect();
    drag.current = {
      startX: event.clientX,
      startY: event.clientY,
      right: window.innerWidth - rect.right,
      bottom: window.innerHeight - rect.bottom,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }, []);

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    const state = drag.current;
    if (!state) return;
    const dx = event.clientX - state.startX;
    const dy = event.clientY - state.startY;
    if (!state.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    if (!state.moved) {
      state.moved = true;
      setDragging(true);
    }
    const next = clamp({ right: state.right - dx, bottom: state.bottom - dy });
    latest.current = next;
    setPosition(next);
  }, []);

  const endDrag = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    const state = drag.current;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (!state?.moved) return;
    justDragged.current = true;
    setDragging(false);
    if (latest.current) writePosition(latest.current);
  }, []);

  // Keyboard users can move it too: Shift + arrow keys.
  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!event.shiftKey) return;
    const step = 24;
    const delta: Record<string, [number, number]> = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    const move = delta[event.key];
    if (!move) return;
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const base = latest.current ?? { right: window.innerWidth - rect.right, bottom: window.innerHeight - rect.bottom };
    const next = clamp({ right: base.right + move[0], bottom: base.bottom + move[1] });
    latest.current = next;
    setPosition(next);
    writePosition(next);
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && <AgentPanel agentName={agentName} onClose={() => setIsOpen(false)} />}
      </AnimatePresence>

      <button
        type="button"
        aria-label={isOpen ? `Fermer ${agentName}` : `Ouvrir ${agentName}`}
        aria-expanded={isOpen}
        aria-describedby="agent-floating-button-help"
        title="Glissez pour déplacer"
        onClick={handleClick}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
        style={{
          ...themeStyle,
          ...(position ? { right: position.right, bottom: position.bottom } : {}),
          background: "none",
          border: 0,
          padding: 0,
          boxShadow: "0 0 22px color-mix(in srgb, var(--agent-primary) 20%, transparent), 0 0 30px color-mix(in srgb, var(--agent-secondary) 18%, transparent)",
          touchAction: "none",
        }}
        data-agent-theme={theme.id}
        className={`${themedStyles.floatingTrigger} fixed z-[70] flex size-16 select-none items-center justify-center rounded-full ${triggerSurface} outline-none focus-visible:ring-4 focus-visible:ring-[var(--agent-focus)] ${position ? "" : "bottom-3 right-3 sm:bottom-5 sm:right-5"} ${dragging ? "cursor-grabbing shadow-2xl" : "cursor-grab"}`}
      >
        <AgentAvatar size="xl" motion={dragging ? "none" : "idle"} decorative className="pointer-events-none" />
      </button>
      <span id="agent-floating-button-help" className="sr-only">
        Glissez pour déplacer le bouton, ou utilisez Maj et les flèches du clavier.
      </span>
    </>
  );
}
