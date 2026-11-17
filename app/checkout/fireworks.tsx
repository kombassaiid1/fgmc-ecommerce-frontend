"use client";

import { useEffect } from "react";

/* ------------------------------------------------------------------ */
/* Palette, colour helpers and glow sprites                            */
/* ------------------------------------------------------------------ */

const GOLD = "#ffc83d";
const PALE_GOLD = "#ffe7a3";
const RED = "#ff4b55";
const BLUE = "#4aa3ff";
const WHITE = "#ffffff";
const SKY = "#7fd4ff";
const EMBER = "#ff5a14";
const CLASSIC_COLORS = [GOLD, RED, BLUE, WHITE];

function rgbOf(hex: string): [number, number, number] {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

function lerpHex(from: string, to: string, t: number) {
  const a = rgbOf(from);
  const b = rgbOf(to);
  const channel = (i: number) => Math.round(a[i] + (b[i] - a[i]) * t).toString(16).padStart(2, "0");
  return `#${channel(0)}${channel(1)}${channel(2)}`;
}

const spriteCache = new Map<string, HTMLCanvasElement>();

/** A soft glowing dot: white-hot core, coloured halo, transparent edge. */
function getSprite(color: string) {
  const cached = spriteCache.get(color);
  if (cached) return cached;
  const size = 48;
  const sprite = document.createElement("canvas");
  sprite.width = size;
  sprite.height = size;
  const context = sprite.getContext("2d")!;
  const [r, g, b] = rgbOf(color);
  const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.18, "rgba(255,255,255,0.9)");
  gradient.addColorStop(0.4, `rgba(${r},${g},${b},0.75)`);
  gradient.addColorStop(1, `rgba(${r},${g},${b},0)`);
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
  spriteCache.set(color, sprite);
  return sprite;
}

/* ------------------------------------------------------------------ */
/* The sewing machine, drawn once as a line-art icon then sampled      */
/* ------------------------------------------------------------------ */

type ShapePoint = { x: number; y: number; color: string };
const MACHINE_COLORS = [GOLD, RED, SKY, WHITE];
let machinePoints: ShapePoint[] | null = null;
let machineAspect = 0.77;

function nearestMachineColor(r: number, g: number, b: number) {
  let best = MACHINE_COLORS[0];
  let bestDistance = Infinity;
  for (const hex of MACHINE_COLORS) {
    const [hr, hg, hb] = rgbOf(hex);
    const distance = (r - hr) ** 2 + (g - hg) ** 2 + (b - hb) ** 2;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = hex;
    }
  }
  return best;
}

/** Points of a front-view sewing machine, centred on 0,0 and normalised to width 1. */
function getMachinePoints(): ShapePoint[] {
  if (machinePoints) return machinePoints;
  const scale = 2;
  const canvas = document.createElement("canvas");
  canvas.width = 240 * scale;
  canvas.height = 190 * scale;
  const context = canvas.getContext("2d", { willReadFrequently: true })!;
  context.scale(scale, scale);
  context.translate(14, 24);
  context.lineJoin = "round";
  context.lineCap = "round";

  // Body: bed, pillar and arm form a single "C" outline.
  context.strokeStyle = GOLD;
  context.lineWidth = 5.5;
  context.beginPath();
  context.moveTo(6, 146);
  context.lineTo(6, 128);
  context.lineTo(138, 128);
  context.lineTo(138, 70);
  context.lineTo(22, 70);
  context.lineTo(22, 32);
  context.quadraticCurveTo(22, 22, 32, 22);
  context.lineTo(176, 22);
  context.lineTo(176, 128);
  context.lineTo(192, 128);
  context.lineTo(192, 146);
  context.closePath();
  context.stroke();

  // Hand wheel.
  context.strokeStyle = RED;
  context.beginPath();
  context.arc(190, 46, 15, 0, Math.PI * 2);
  context.stroke();
  context.beginPath();
  context.arc(190, 46, 4, 0, Math.PI * 2);
  context.stroke();

  // Needle bar and presser foot.
  context.strokeStyle = SKY;
  context.lineWidth = 4.5;
  context.beginPath();
  context.moveTo(36, 70);
  context.lineTo(36, 124);
  context.moveTo(27, 112);
  context.lineTo(45, 112);
  context.stroke();

  // Stitch dial on the arm, and a running stitch along the bed.
  context.strokeStyle = SKY;
  context.lineWidth = 4;
  context.beginPath();
  context.arc(100, 46, 9, 0, Math.PI * 2);
  context.stroke();
  context.strokeStyle = WHITE;
  context.lineWidth = 3.2;
  context.beginPath();
  for (let x = 22; x <= 110; x += 18) {
    context.moveTo(x, 137);
    context.lineTo(x + 9, 137);
  }
  context.stroke();

  // Spool on top and the thread running down to the needle.
  context.strokeStyle = WHITE;
  context.lineWidth = 4;
  context.strokeRect(72, 4, 16, 14);
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(80, 4);
  context.quadraticCurveTo(36, -16, 36, 40);
  context.stroke();

  const { data, width, height } = context.getImageData(0, 0, canvas.width, canvas.height);
  const raw: ShapePoint[] = [];
  const step = 6;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = (y * width + x) * 4;
      if (data[i + 3] < 200) continue;
      raw.push({ x, y, color: nearestMachineColor(data[i], data[i + 1], data[i + 2]) });
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }
  const spanX = maxX - minX || 1;
  machineAspect = (maxY - minY) / spanX;
  machinePoints = raw.map((p) => ({
    x: (p.x - (minX + maxX) / 2) / spanX,
    y: (p.y - (minY + maxY) / 2) / spanX,
    color: p.color,
  }));
  return machinePoints;
}

/* ------------------------------------------------------------------ */
/* Show                                                                */
/* ------------------------------------------------------------------ */

type Kind = "peony" | "willow" | "machine";
type Launch = { at: number; kind: Kind; x: number; scale?: number };
type Rocket = { x: number; y: number; vx: number; vy: number; targetY: number; kind: Kind; scale: number };

/** One burning star. Position is integrated with gravity and quadratic air drag. */
type Star = {
  x: number;
  y: number;
  px: number;
  py: number;
  vx: number;
  vy: number;
  life: number;
  decay: number;
  size: number;
  color: string;
  gravity: number;
  drag: number;
  /** Cools from its colour through orange to a dull red as it dies, like a real ember. */
  ember: boolean;
  /** Blinks on and off near the end of its life, like a strobe star. */
  strobe: boolean;
  /** Sheds falling glitter as it drops (willow). */
  sheds: boolean;
};

/** A star that flies out of the shell and settles into a point of the drawing. */
type Dot = {
  sx: number;
  sy: number;
  tx: number;
  ty: number;
  delay: number;
  travel: number;
  hold: number;
  age: number;
  size: number;
  color: string;
  phase: number;
};

type Flash = { x: number; y: number; life: number; decay: number; radius: number; color: string; strength: number };

const SCHEDULE: Launch[] = [
  { at: 250, kind: "peony", x: 0.2 },
  { at: 700, kind: "machine", x: 0.5, scale: 1 },
  { at: 1750, kind: "willow", x: 0.84 },
  { at: 2250, kind: "peony", x: 0.12 },
  { at: 2900, kind: "machine", x: 0.26, scale: 0.7 },
  { at: 3300, kind: "machine", x: 0.76, scale: 0.7 },
  { at: 4300, kind: "peony", x: 0.9 },
  { at: 4600, kind: "machine", x: 0.5, scale: 1.2 },
  { at: 4950, kind: "willow", x: 0.1 },
  { at: 5250, kind: "peony", x: 0.34 },
  { at: 5500, kind: "peony", x: 0.66 },
];

const STEP_MS = 1000 / 60; // fixed physics step: the show runs at the same speed at any frame rate
const ROCKET_GRAVITY = 0.22;
const STAR_GRAVITY = 0.045;
const NIGHT_OPACITY = "0.6";
const TOP_LAYER = "2147483646"; // above every header, menu and dialog on the page

const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)];
const rand = (min: number, max: number) => min + Math.random() * (max - min);

/**
 * A one-off fireworks show over the whole page, header included. The canvas and a
 * dimmed "night sky" are attached straight to <body> so no layout, sticky bar or
 * stacking context can sit above them.
 *
 * Physics: a rocket climbs under gravity and bursts at its apex. Stars leave a
 * spherical shell and are slowed by quadratic air drag, so they fly out fast
 * and then hang before falling. Embers cool from white to orange to red, willow
 * stars shed glitter and some stars strobe. Some bursts fly into a sewing machine.
 *
 * It ignores pointer events, is hidden from assistive tech, renders nothing when
 * the visitor asks for reduced motion, and removes itself when done.
 */
export function Fireworks() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const sky = document.createElement("div");
    Object.assign(sky.style, {
      position: "fixed",
      inset: "0",
      zIndex: String(Number(TOP_LAYER) - 1),
      background: "#020617",
      opacity: "0",
      transition: "opacity 700ms ease",
      pointerEvents: "none",
    });
    const canvas = document.createElement("canvas");
    Object.assign(canvas.style, {
      position: "fixed",
      inset: "0",
      width: "100%",
      height: "100%",
      zIndex: TOP_LAYER,
      pointerEvents: "none",
    });
    sky.setAttribute("aria-hidden", "true");
    canvas.setAttribute("aria-hidden", "true");
    document.body.append(sky, canvas);

    const context = canvas.getContext("2d");
    if (!context) {
      sky.remove();
      canvas.remove();
      return;
    }
    const ctx = context;

    let width = 0;
    let height = 0;
    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);
    const fadeIn = requestAnimationFrame(() => {
      sky.style.opacity = NIGHT_OPACITY;
    });

    const small = () => width < 640;
    /** Scales bursts to the viewport so they look right on a phone and on a big monitor. */
    const sizeFactor = () => Math.min(Math.max(Math.min(width, height) / 650, 0.65), 1.5);
    const machineSpan = (scale: number) => Math.min(width * (small() ? 0.84 : 0.52), height * 0.95, 560) * scale;

    const rockets: Rocket[] = [];
    const stars: Star[] = [];
    const dots: Dot[] = [];
    const flashes: Flash[] = [];
    const pending = [...SCHEDULE];
    let simTime = 0;

    function launch(item: Launch) {
      const scale = item.scale ?? 1;
      const wanted = height * rand(0.16, 0.4);
      const halfMachine = (machineSpan(scale) * machineAspect) / 2;
      const targetY = item.kind === "machine" ? Math.max(wanted, halfMachine + 28) : wanted;
      // Initial speed chosen so gravity brings the rocket to rest at the target height.
      const distance = height + 10 - targetY;
      rockets.push({
        x: width * item.x,
        y: height + 10,
        vx: rand(-0.12, 0.12),
        vy: -Math.sqrt(2 * ROCKET_GRAVITY * distance) * 1.03,
        targetY,
        kind: item.kind,
        scale,
      });
    }

    function addStar(x: number, y: number, vx: number, vy: number, extra: Partial<Star>) {
      stars.push({
        x,
        y,
        px: x,
        py: y,
        vx,
        vy,
        life: 1,
        decay: 0.01,
        size: 3,
        color: WHITE,
        gravity: STAR_GRAVITY,
        drag: 0.02,
        ember: false,
        strobe: false,
        sheds: false,
        ...extra,
      });
    }

    /** Stars on a sphere, seen from the side: dense bright rim, thinner centre. */
    function shell(x: number, y: number, count: number, speed: number, make: (index: number) => Partial<Star>) {
      for (let i = 0; i < count; i += 1) {
        const z = rand(-1, 1);
        const phi = rand(0, Math.PI * 2);
        const ring = Math.sqrt(1 - z * z);
        const v = speed * rand(0.82, 1);
        addStar(x, y, Math.cos(phi) * ring * v, Math.sin(phi) * ring * v, make(i));
      }
    }

    function addFlash(x: number, y: number, color: string, f: number) {
      flashes.push({ x, y, life: 1, decay: 0.13, radius: 85 * f, color, strength: 0.5 });
      flashes.push({ x, y, life: 1, decay: 0.032, radius: Math.max(width, height) * 0.42, color, strength: 0.14 });
    }

    function explode(rocket: Rocket) {
      const { x, y } = rocket;
      const f = sizeFactor();
      const density = small() ? 0.62 : 1;

      if (rocket.kind === "peony") {
        const main = pick(CLASSIC_COLORS);
        const accent = pick(CLASSIC_COLORS);
        addFlash(x, y, main, f);
        shell(x, y, Math.round(130 * density), 15 * f, () => ({
          color: Math.random() < 0.3 ? accent : main,
          decay: rand(0.0075, 0.0115),
          size: rand(2.6, 3.6),
          drag: 0.021,
          ember: main === GOLD,
          strobe: Math.random() < 0.18,
        }));
        // A smaller inner shell gives the burst a visible core.
        shell(x, y, Math.round(34 * density), 7 * f, () => ({
          color: accent,
          decay: rand(0.01, 0.014),
          size: 2.4,
          drag: 0.025,
        }));
      } else if (rocket.kind === "willow") {
        addFlash(x, y, GOLD, f);
        shell(x, y, Math.round(90 * density), 10 * f, () => ({
          color: Math.random() < 0.5 ? GOLD : PALE_GOLD,
          decay: rand(0.0036, 0.0052),
          size: 2.6,
          drag: 0.034,
          gravity: 0.034,
          ember: true,
          sheds: true,
        }));
      } else {
        addFlash(x, y, GOLD, f);
        shell(x, y, Math.round(44 * density), 11 * f, () => ({
          color: Math.random() < 0.5 ? GOLD : WHITE,
          decay: rand(0.016, 0.024),
          size: 2.4,
          drag: 0.03,
          ember: true,
        }));
        const span = machineSpan(rocket.scale);
        const radius = (small() ? 3.1 : 3.9) * Math.max(rocket.scale, 0.75);
        for (const point of getMachinePoints()) {
          dots.push({
            sx: x,
            sy: y,
            tx: x + point.x * span,
            ty: y + point.y * span,
            delay: rand(0, 140),
            travel: rand(850, 1300),
            hold: rand(1700, 2000),
            age: 0,
            size: radius,
            color: point.color,
            phase: rand(0, Math.PI * 2),
          });
        }
      }
    }

    /** Advances the whole simulation by one fixed step. */
    function simulate() {
      simTime += STEP_MS;
      while (pending.length && simTime >= pending[0].at) launch(pending.shift()!);

      for (let i = flashes.length - 1; i >= 0; i -= 1) {
        flashes[i].life -= flashes[i].decay;
        if (flashes[i].life <= 0) flashes.splice(i, 1);
      }

      for (let i = rockets.length - 1; i >= 0; i -= 1) {
        const rocket = rockets[i];
        rocket.x += rocket.vx;
        rocket.y += rocket.vy;
        rocket.vy += ROCKET_GRAVITY;
        // Burning fuse: sparks thrown backwards, against the direction of travel.
        for (let t = 0; t < 2; t += 1) {
          addStar(rocket.x + rand(-1, 1), rocket.y + 4, rand(-0.4, 0.4) - rocket.vx * 0.2, -rocket.vy * 0.14 + rand(-0.3, 0.5), {
            life: 0.75,
            decay: rand(0.035, 0.055),
            size: 1.5,
            color: GOLD,
            drag: 0.07,
            gravity: 0.05,
            ember: true,
          });
        }
        if (rocket.vy >= -0.7 || rocket.y <= rocket.targetY - 60) {
          explode(rocket);
          rockets.splice(i, 1);
        }
      }

      for (let i = stars.length - 1; i >= 0; i -= 1) {
        const star = stars[i];
        star.px = star.x;
        star.py = star.y;
        // Quadratic air drag: v' = -k|v|v, solved implicitly so it stays stable.
        const speed = Math.hypot(star.vx, star.vy);
        const slow = 1 / (1 + star.drag * speed);
        star.vx *= slow;
        star.vy = star.vy * slow + star.gravity;
        star.x += star.vx + 0.015; // a faint breeze
        star.y += star.vy;
        star.life -= star.decay;
        if (star.life <= 0) {
          stars.splice(i, 1);
          continue;
        }
        if (star.sheds && Math.random() < 0.14) {
          addStar(star.x, star.y, rand(-0.25, 0.25), rand(-0.1, 0.3), {
            life: 0.5,
            decay: rand(0.03, 0.05),
            size: 1.3,
            color: PALE_GOLD,
            drag: 0.05,
            gravity: 0.06,
            ember: true,
          });
        }
      }

      for (let i = dots.length - 1; i >= 0; i -= 1) {
        const dot = dots[i];
        dot.age += STEP_MS;
        const t = dot.age - dot.delay;
        if (t < dot.travel + dot.hold) continue;
        // The drawing lets go: each point becomes a falling ember.
        const p = dotPosition(dot, t);
        addStar(p.x, p.y, rand(-0.5, 0.5), rand(-0.4, 0.3), {
          life: rand(0.75, 1),
          decay: rand(0.011, 0.02),
          size: dot.size * 0.85,
          color: dot.color,
          drag: 0.03,
          ember: dot.color === GOLD,
        });
        dots.splice(i, 1);
      }
    }

    function dotPosition(dot: Dot, t: number) {
      if (t < dot.travel) {
        const eased = 1 - Math.pow(1 - t / dot.travel, 3.6);
        return { x: dot.sx + (dot.tx - dot.sx) * eased, y: dot.sy + (dot.ty - dot.sy) * eased };
      }
      return { x: dot.tx + Math.sin(t * 0.004 + dot.phase) * 0.6, y: dot.ty + Math.cos(t * 0.004 + dot.phase) * 0.6 };
    }

    function glow(color: string, x: number, y: number, radius: number, alpha: number) {
      ctx.globalAlpha = Math.max(0, Math.min(alpha, 1));
      ctx.drawImage(getSprite(color), x - radius, y - radius, radius * 2, radius * 2);
    }

    function render(frameMs: number) {
      // Fade the previous frame instead of clearing it: this leaves the light trails.
      ctx.globalCompositeOperation = "destination-out";
      ctx.globalAlpha = 1;
      ctx.fillStyle = `rgba(0, 0, 0, ${1 - Math.pow(0.82, frameMs / STEP_MS)})`;
      ctx.fillRect(0, 0, width, height);
      ctx.globalCompositeOperation = "lighter";
      ctx.lineCap = "round";

      for (const flash of flashes) glow(flash.color, flash.x, flash.y, flash.radius * (1.2 - flash.life * 0.35), flash.life * flash.strength);

      for (const rocket of rockets) glow(WHITE, rocket.x, rocket.y, 7, 1);

      for (const star of stars) {
        // Brightness holds, then drops sharply as the star burns out.
        let brightness = star.life < 0.3 ? star.life / 0.3 : 1;
        if (star.strobe && star.life < 0.55 && Math.floor(simTime / 70 + star.x) % 2 === 0) brightness *= 0.1;
        const coolness = star.ember ? Math.min(Math.max(1 - star.life / 0.45, 0), 1) : 0;
        const color = star.ember ? lerpHex(star.color, EMBER, Math.round(coolness * 4) / 4) : star.color;

        ctx.globalAlpha = brightness * 0.6;
        ctx.strokeStyle = color;
        ctx.lineWidth = star.size * 0.7;
        ctx.beginPath();
        ctx.moveTo(star.px, star.py);
        ctx.lineTo(star.x, star.y);
        ctx.stroke();
        glow(color, star.x, star.y, star.size * 2.3, brightness);
      }

      for (const dot of dots) {
        const t = dot.age - dot.delay;
        if (t < 0) continue;
        const p = dotPosition(dot, t);
        const twinkle = t > dot.travel ? 0.82 + 0.18 * Math.sin(t * 0.012 + dot.phase) : 1;
        glow(dot.color, p.x, p.y, dot.size * 1.7, twinkle);
      }

      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    }

    let frame = 0;
    let finished = false;
    let accumulator = 0;
    let previous = performance.now();
    const timers: number[] = [];

    function tick(now: number) {
      const frameMs = Math.min(now - previous, 100);
      previous = now;
      accumulator += frameMs;
      let steps = 0;
      while (accumulator >= STEP_MS && steps < 6) {
        simulate();
        accumulator -= STEP_MS;
        steps += 1;
      }
      if (steps > 0) render(steps * STEP_MS);

      if (pending.length || rockets.length || stars.length || dots.length || flashes.length) {
        frame = requestAnimationFrame(tick);
      } else {
        finish();
      }
    }

    function finish() {
      if (finished) return;
      finished = true;
      sky.style.opacity = "0";
      timers.push(
        window.setTimeout(() => {
          sky.remove();
          canvas.remove();
        }, 800),
      );
    }

    getMachinePoints(); // build the shape before the first machine rocket lands
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(fadeIn);
      timers.forEach((timer) => window.clearTimeout(timer));
      window.removeEventListener("resize", resize);
      sky.remove();
      canvas.remove();
    };
  }, []);

  return null;
}
