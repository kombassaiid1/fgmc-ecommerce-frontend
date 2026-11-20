"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

import "./splash.css";

const SEEN_KEY = "fgmc-splash-seen";
/** The intro always plays at least this long, so the film is never cut short on a fast connection. */
const MIN_MS = 2600;
/** A page that is slow to finish loading never keeps the visitor waiting longer than this. */
const MAX_MS = 6500;
const LEAVE_MS = 1100;

/**
 * Opening sequence shown once per visit: the logo is revealed while a seam is stitched across the screen,
 * stitch by stitch as the page really loads. When the page is ready the seam tears open and the site appears.
 */
export function SplashScreen() {
  const pathname = usePathname();
  const hidden = pathname.startsWith("/admin_ben");
  const [phase, setPhase] = useState<"show" | "leave" | "gone">("show");
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (hidden) return;
    const html = document.documentElement;
    let alreadySeen = false;
    try {
      alreadySeen = window.sessionStorage.getItem(SEEN_KEY) === "1";
    } catch {}
    if (alreadySeen) {
      const id = window.requestAnimationFrame(() => setPhase("gone"));
      return () => window.cancelAnimationFrame(id);
    }

    html.classList.add("fgmc-splash-lock");
    const start = performance.now();
    let loaded = document.readyState === "complete";
    const onLoad = () => {
      loaded = true;
    };
    window.addEventListener("load", onLoad);

    let progress = 0;
    let frame = 0;
    let leaving = false;
    let timer = 0;

    const tick = (now: number) => {
      const elapsed = now - start;
      const ready = (loaded && elapsed >= MIN_MS) || elapsed >= MAX_MS;
      // While loading, creep towards 90 %; once ready, finish the seam.
      const target = ready ? 1 : 0.9 * (1 - Math.exp(-elapsed / 1100));
      progress += (target - progress) * (ready ? 0.14 : 0.07);
      root.current?.style.setProperty("--p", progress.toFixed(4));
      if (ready && progress > 0.995 && !leaving) {
        leaving = true;
        root.current?.style.setProperty("--p", "1");
        setPhase("leave");
        timer = window.setTimeout(() => setPhase("gone"), LEAVE_MS);
        return;
      }
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
      window.removeEventListener("load", onLoad);
      html.classList.remove("fgmc-splash-lock");
    };
  }, [hidden]);

  useEffect(() => {
    if (phase !== "gone") return;
    document.documentElement.classList.remove("fgmc-splash-lock");
    try {
      window.sessionStorage.setItem(SEEN_KEY, "1");
    } catch {}
  }, [phase]);

  if (hidden || phase === "gone") return null;

  return (
    <div ref={root} className="fgmc-splash" data-phase={phase} role="status" aria-live="polite" aria-label="Chargement de France Général Machines à Coudre">
      <SplashHalf half="top" />
      <SplashHalf half="bottom" />
    </div>
  );
}

/** One half of the screen. Both halves draw the whole scene and show their own half, so the seam can open. */
function SplashHalf({ half }: { half: "top" | "bottom" }) {
  return (
    <div className={`fgmc-splash-half fgmc-splash-${half}`} aria-hidden={half === "bottom" ? "true" : undefined}>
      <div className="fgmc-splash-scene">
        <div className="fgmc-splash-glow" />
        <div className="fgmc-splash-logo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-fgmc.webp" alt={half === "top" ? "France Général Machines à Coudre" : ""} width={1452} height={460} fetchPriority="high" decoding="async" />
        </div>
        <div className="fgmc-splash-stitch fgmc-splash-stitch-blue" />
        <div className="fgmc-splash-stitch fgmc-splash-stitch-red" />
        <SewingMachine />
        <p className="fgmc-splash-label">Chargement</p>
      </div>
    </div>
  );
}

/** A small sewing machine riding the seam: the handwheel turns and the needle bar goes up and down as it stitches. */
function SewingMachine() {
  return (
    <svg className="fgmc-splash-machine" viewBox="-4 0 84 66" width="118" height="92" aria-hidden="true" focusable="false">
      {/* thread from the spool to the needle */}
      <path d="M35 6 Q55 -4 65 38" fill="none" stroke="#e2232d" strokeWidth="1" opacity="0.75" />
      {/* spool */}
      <rect x="28" y="1" width="14" height="2.5" rx="1.2" fill="#0b1f4d" />
      <rect x="30" y="3.5" width="10" height="6" fill="#e2232d" />
      <rect x="28" y="9.5" width="14" height="2.5" rx="1.2" fill="#0b1f4d" />
      {/* body: arm, pillar, head and base */}
      <rect x="6" y="12" width="68" height="16" rx="7" fill="#0b1f4d" />
      <rect x="6" y="12" width="16" height="40" rx="5" fill="#0b1f4d" />
      <rect x="58" y="12" width="16" height="30" rx="5" fill="#0b1f4d" />
      <rect x="2" y="50" width="76" height="7" rx="3.5" fill="#0b1f4d" />
      <rect x="26" y="18" width="26" height="4" rx="2" fill="#0b4fb3" />
      <rect x="62" y="38" width="8" height="3" rx="1.5" fill="#0b4fb3" />
      {/* handwheel */}
      <g className="fgmc-splash-wheel">
        <circle cx="2" cy="20" r="7" fill="#e2232d" />
        <circle cx="2" cy="20" r="2" fill="#fff" />
        <path d="M2 14.5V25.5M-3.5 20H7.5" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" />
      </g>
      {/* needle bar */}
      <g className="fgmc-splash-needle-bar">
        <rect x="64" y="40" width="2" height="14" fill="#d5dbe8" />
        <path d="M64 54H66L65 64Z" fill="#aeb8cc" />
      </g>
    </svg>
  );
}
