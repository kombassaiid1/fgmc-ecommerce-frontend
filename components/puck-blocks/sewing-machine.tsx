"use client";

/** Width of one page marker (matches the 32px buttons of the stitch row). */
export const STITCH_SLOT = 32;

const MACHINE_WIDTH = 64;
// viewBox is 72 x 46; the needle sits at x = 18 and ends at y = 36.
const SCALE = MACHINE_WIDTH / 72;
const NEEDLE_X = 18 * SCALE;
const NEEDLE_TIP_Y = 36 * SCALE;

/**
 * A little sewing machine that rides along the stitch row. The needle stands
 * over the current page; the machine slides to the next one, and while it
 * travels it swings, the needle bobs and the hand wheel turns. Everything
 * stays still for visitors who prefer reduced motion.
 */
export function SewingMachine({
  index,
  moving,
  color,
  threadColor,
}: {
  /** Zero-based page the needle stands on. */
  index: number;
  moving: boolean;
  /** Colour of the machine body. */
  color: string;
  /** Colour of the spool and thread (should contrast with the body). */
  threadColor: string;
}) {
  return (
    <>
      <style>{`
        @keyframes fp-sew-swing { from { transform: rotate(-3deg); } to { transform: rotate(3deg); } }
        @keyframes fp-sew-needle { from { transform: translateY(-1px); } to { transform: translateY(3px); } }
        @keyframes fp-sew-wheel { to { transform: rotate(360deg); } }
        @keyframes fp-sew-thread { to { stroke-dashoffset: -8; } }
        .fp-sew-body { transform-origin: 28% 100%; }
        .fp-sew-body[data-moving="true"] { animation: fp-sew-swing 0.3s ease-in-out infinite alternate; }
        .fp-sew-needle { transform-box: fill-box; }
        .fp-sew-body[data-moving="true"] .fp-sew-needle { animation: fp-sew-needle 0.1s linear infinite alternate; }
        .fp-sew-wheel { transform-box: fill-box; transform-origin: center; }
        .fp-sew-body[data-moving="true"] .fp-sew-wheel { animation: fp-sew-wheel 0.45s linear infinite; }
        .fp-sew-body[data-moving="true"] .fp-sew-thread { animation: fp-sew-thread 0.25s linear infinite; }
        @media (prefers-reduced-motion: reduce) {
          .fp-sew-body[data-moving="true"], .fp-sew-body[data-moving="true"] .fp-sew-needle,
          .fp-sew-body[data-moving="true"] .fp-sew-wheel, .fp-sew-body[data-moving="true"] .fp-sew-thread { animation: none; }
        }
      `}</style>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-0 transition-transform duration-500 ease-in-out motion-reduce:transition-none"
        style={{
          width: MACHINE_WIDTH,
          // The needle stands over the page marker and its tip lands on the stitch line.
          transform: `translateX(${index * STITCH_SLOT + STITCH_SLOT / 2 - NEEDLE_X}px)`,
          marginTop: -NEEDLE_TIP_Y,
        }}>
        <svg
          viewBox="0 0 72 46"
          width={MACHINE_WIDTH}
          height={46 * SCALE}
          className="fp-sew-body block overflow-visible"
          data-moving={moving}
          style={{ color }}>
          {/* Body: bed, pillar, arm and head form the classic "C" silhouette. */}
          <rect x="2" y="34" width="60" height="9" rx="4.5" fill="currentColor" />
          <rect x="46" y="14" width="15" height="24" rx="3" fill="currentColor" />
          <rect x="10" y="6" width="51" height="15" rx="6" fill="currentColor" />
          <rect x="10" y="6" width="17" height="25" rx="5" fill="currentColor" />

          {/* Throat plate on the bed, where the needle goes down. */}
          <rect x="7" y="34" width="22" height="2.4" rx="1.2" fill="#fff" opacity="0.85" />

          {/* Highlights and the stitch-selector dial. */}
          <path d="M16 8.6H56" stroke="#fff" strokeWidth="1.3" strokeLinecap="round" opacity="0.35" />
          <circle cx="40" cy="14" r="3.4" fill="#fff" opacity="0.92" />
          <circle cx="40" cy="14" r="1.1" fill="currentColor" />
          <rect x="31" y="11.5" width="3.6" height="5" rx="1" fill="#fff" opacity="0.5" />

          {/* Thread spool on its pin. */}
          <rect x="34.6" y="2" width="1.6" height="4.5" fill="currentColor" />
          <rect x="31" y="-1.5" width="8.8" height="1.8" rx="0.9" fill="currentColor" />
          <rect x="31.8" y="0.3" width="7.2" height="5.4" rx="1" fill={threadColor} />
          <rect x="30.6" y="5.3" width="8.8" height="1.8" rx="0.9" fill="currentColor" />

          {/* Thread: spool, take-up lever, then down to the needle. */}
          <path
            className="fp-sew-thread"
            d="M31.8 3 C27 3 22.5 4 20.4 8.4 L18.6 24"
            fill="none"
            stroke={threadColor}
            strokeWidth="0.9"
            strokeLinecap="round"
            strokeDasharray="4 4"
          />

          {/* Hand wheel on the right of the pillar. */}
          <g className="fp-sew-wheel">
            <circle cx="65" cy="20" r="6" fill="#fff" stroke="currentColor" strokeWidth="1.8" />
            <circle cx="65" cy="20" r="1.5" fill="currentColor" />
            <path d="M65 14.8V25.2M59.8 20H70.2" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
          </g>

          {/* Presser foot and needle: the tip meets the stitch line. */}
          <rect x="13.8" y="29" width="9" height="2.8" rx="1.2" fill="currentColor" />
          <path d="M14.6 31.8H22L23.4 33.2H13.2Z" fill="currentColor" opacity="0.8" />
          <g className="fp-sew-needle">
            <rect x="17.4" y="24" width="1.2" height="12" rx="0.6" fill="#fff" stroke="currentColor" strokeWidth="0.5" />
          </g>
        </svg>
      </span>
    </>
  );
}
