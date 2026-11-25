"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import type { AgentTheme } from "@/lib/agent-theme";
import type { createImageMotionRenderer } from "./image-motion/renderer";
import styles from "./agent-themed-ui.module.css";

export function AgentAnimatedImage({ theme, motion }: { theme: AgentTheme; motion: "idle" | "thinking" }) {
  const rootRef = useRef<HTMLSpanElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let renderer: ReturnType<typeof createImageMotionRenderer> | undefined;
    let frame = 0;
    let previousFrame = 0;
    let elapsed = 0;
    let visible = true;
    let disposed = false;
    let loading = false;
    let failed = false;
    const image = new window.Image();
    const hideCanvas = () => { root.dataset.ready = "false"; };
    const stop = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      previousFrame = 0;
    };
    const allowed = () => !disposed && !reduced.matches && visible && !document.hidden;
    const draw = (now: number) => {
      frame = 0;
      if (!allowed() || !renderer) return;
      if (!previousFrame || now - previousFrame >= 1000 / 30) {
        elapsed += previousFrame ? Math.min((now - previousFrame) / 1000, .1) : 0;
        previousFrame = now;
        renderer.render(elapsed, motion === "thinking");
        root.dataset.ready = "true";
      }
      frame = requestAnimationFrame(draw);
    };
    const sync = () => {
      if (!allowed()) {
        stop();
        if (reduced.matches) hideCanvas();
        return;
      }
      if (renderer && !frame) frame = requestAnimationFrame(draw);
      if (!renderer && !loading && !failed) {
        loading = true;
        image.src = theme.image;
        void Promise.all([import("./image-motion/renderer"), image.decode()]).then(([module]) => {
          if (!allowed()) { loading = false; return; }
          renderer = module.createImageMotionRenderer(canvas, image, theme.id);
          loading = false;
          sync();
        }).catch(() => {
          loading = false;
          failed = true;
          hideCanvas();
        });
      }
    };
    const onLost = (event: Event) => {
      event.preventDefault();
      stop();
      renderer?.dispose();
      renderer = undefined;
      hideCanvas();
    };
    const onRestored = () => { failed = false; sync(); };
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); });
    observer.observe(root);
    reduced.addEventListener("change", sync);
    document.addEventListener("visibilitychange", sync);
    canvas.addEventListener("webglcontextlost", onLost);
    canvas.addEventListener("webglcontextrestored", onRestored);
    sync();
    return () => {
      disposed = true;
      stop();
      observer.disconnect();
      reduced.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", sync);
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
      renderer?.dispose();
      hideCanvas();
    };
  }, [theme.id, theme.image, motion]);

  return (
    <span ref={rootRef} className={styles.animatedImage} aria-hidden="true">
      <Image src={theme.image} alt="" fill sizes="64px" className={styles.avatarImage} />
      <canvas ref={canvasRef} className={styles.imageCanvas} />
    </span>
  );
}
