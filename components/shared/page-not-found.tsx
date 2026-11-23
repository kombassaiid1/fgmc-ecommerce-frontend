"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Store } from "lucide-react";

import "./page-not-found.css";

export type NotFoundShelf = { title: string; slug: string };

/* -------------------------------------------------------------------------- */
/* The torn fabric                                                            */
/* -------------------------------------------------------------------------- */

const W = 800;
const H = 420;
/** The rip across the cloth: a jagged line, the same on every visit. */
const TEAR: Array<[number, number]> = [
  [0, 222], [36, 206], [70, 228], [104, 200], [140, 219], [176, 196], [210, 224], [246, 203], [282, 230], [318, 198],
  [352, 216], [388, 193], [424, 225], [460, 201], [494, 229], [530, 197], [566, 221], [602, 199], [638, 227], [674, 205],
  [710, 224], [746, 202], [778, 218], [800, 208],
];
const tearPoints = TEAR.map(([x, y]) => `${x},${y}`).join(" ");
const TOP = `0,0 ${W},0 ${[...TEAR].reverse().map(([x, y]) => `${x},${y}`).join(" ")}`;
const BOTTOM = `${tearPoints} ${W},${H} 0,${H}`;

/** Height of the rip at x, between its points. */
function tearY(x: number) {
  for (let i = 1; i < TEAR.length; i++) {
    const [x0, y0] = TEAR[i - 1];
    const [x1, y1] = TEAR[i];
    if (x <= x1) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }
  return TEAR[TEAR.length - 1][1];
}

/** A zigzag stitch over the rip, the kind a machine sews to mend a tear. */
const ZIGZAG = (() => {
  const points: string[] = [];
  for (let x = 6, i = 0; x <= W - 6; x += 11, i++) points.push(`${x},${tearY(x) + (i % 2 ? 11 : -11)}`);
  return `M${points.join(" L")}`;
})();

/** One half of the cloth with « 404 » printed on it. Both halves draw everything; each shows its own side of the rip. */
function Cloth({ clip }: { clip: string }) {
  return (
    <g clipPath={`url(#${clip})`}>
      <rect width={W} height={H} rx="26" className="nf-denim" />
      <rect width={W} height={H} rx="26" fill="url(#nf-twill)" />
      <rect x="18" y="18" width={W - 36} height={H - 36} rx="16" className="nf-hem" />
      <text x={W / 2} y="322" textAnchor="middle" className="nf-digits">404</text>
      <polyline points={tearPoints} className="nf-fray" />
    </g>
  );
}

/* -------------------------------------------------------------------------- */
/* The loop: sew, admire, rip, wait, again                                    */
/* -------------------------------------------------------------------------- */

const SEW = 2.8;
const HOLD = 1.6;
const RIP = 0.45;
const REST = 1.1;
const CYCLE = SEW + HOLD + RIP + REST;

/** Where the loop is at a moment: how much of the rip is sewn, and whether the needle is running. */
function phaseAt(seconds: number): { progress: number; sewing: boolean } {
  const t = seconds % CYCLE;
  if (t < SEW) return { progress: t / SEW, sewing: true };
  if (t < SEW + HOLD) return { progress: 1, sewing: false };
  if (t < SEW + HOLD + RIP) {
    // The rip: fast at first, like cloth giving way.
    const k = (t - SEW - HOLD) / RIP;
    return { progress: 1 - (1 - (1 - k) * (1 - k)), sewing: false };
  }
  return { progress: 0, sewing: false };
}

/** Plays the loop while the page is shown. People who prefer less motion get the torn cloth, still. */
function useSewingLoop() {
  const [state, setState] = useState({ progress: 0, sewing: false });
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    const started = performance.now();
    const tick = (now: number) => {
      setState(phaseAt((now - started) / 1000));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);
  return state;
}

/* -------------------------------------------------------------------------- */
/* The page                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Page introuvable: the page is a piece of denim printed « 404 », torn in two. On its own, again and again, a needle
 * runs along the rip laying a zigzag stitch while the halves close up; the mended cloth holds for a moment, then rips
 * open again. Two links lead back into the shop. Nothing technical is ever shown.
 */
export function PageNotFound({
  title = "Oups, cette page s’est déchirée",
}: {
  title?: string;
  /** Kept so existing callers still compile; the explanation line is no longer shown. */
  message?: string;
  /** Kept so existing callers still compile; the categories are no longer listed here. */
  shelves?: NotFoundShelf[];
}) {
  const { progress, sewing } = useSewingLoop();
  const open = 1 - progress;
  const needleX = Math.min(W - 4, Math.max(4, progress * W));
  const needleY = tearY(needleX);

  return (
    <main className="nf">
      <div className="nf-stage">
        <p className="nf-kicker">Erreur 404</p>
        <h1 className="nf-title">{title}</h1>

        <div className="nf-art">
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Un tissu imprimé 404, déchiré, qu’une aiguille recoud." focusable="false">
            <defs>
              <pattern id="nf-twill" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(-35)">
                <rect width="9" height="9" fill="transparent" />
                <line x1="0" y1="0" x2="0" y2="9" stroke="#ffffff" strokeOpacity="0.06" strokeWidth="3" />
              </pattern>
              <clipPath id="nf-top"><polygon points={TOP} /></clipPath>
              <clipPath id="nf-bottom"><polygon points={BOTTOM} /></clipPath>
            </defs>

            <g className="nf-half" style={{ transform: `translate(${-12 * open}px, ${-26 * open}px) rotate(${-2.6 * open}deg)` }}>
              <Cloth clip="nf-top" />
            </g>
            <g className="nf-half" style={{ transform: `translate(${14 * open}px, ${24 * open}px) rotate(${2.1 * open}deg)` }}>
              <Cloth clip="nf-bottom" />
            </g>

            {/* The mend: a zigzag stitch laid down as far as the needle has gone. */}
            <path d={ZIGZAG} pathLength={1} className="nf-zigzag" style={{ strokeDashoffset: 1 - progress }} />

            {/* The needle and its presser foot, riding the rip while it sews. */}
            <g className="nf-needle" data-sewing={sewing || undefined} style={{ transform: `translate(${needleX}px, ${needleY}px)` }}>
              <rect x="-26" y="-12" width="52" height="8" rx="3" className="nf-foot" />
              <g className="nf-needle-bar">
                <rect x="-3" y="-120" width="6" height="96" rx="2" className="nf-bar" />
                <path d="M-1.6 -26 L1.6 -26 L0 10 Z" className="nf-needle-tip" />
              </g>
            </g>
          </svg>
        </div>

        <div className="nf-actions">
          <Link href="/categorie-produit" className="nf-btn">
            <Store className="size-4" aria-hidden="true" />
            Voir la boutique
          </Link>
          <Link href="/" className="nf-link">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Retour à l’accueil
          </Link>
        </div>
      </div>
    </main>
  );
}
