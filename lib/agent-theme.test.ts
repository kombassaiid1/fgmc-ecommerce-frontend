import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import {
  AGENT_THEMES,
  AGENT_THEME_IDS,
  DEFAULT_AGENT_THEME_ID,
  resolveAgentTheme,
} from "./agent-theme.ts";

test("maps every commercial agent name to its typed theme", () => {
  const expected = {
    photon: { image: "/agent/theme/photon-transparent.png", colors: ["#FACC15", "#EAB308"] },
    quantum: { image: "/agent/theme/quantum-transparent.png", colors: ["#38BDF8", "#EF4444"] },
    plasma: { image: "/agent/theme/plasma-transparent.png", colors: ["#EC4899", "#8B5CF6"] },
    fusion: { image: "/agent/theme/fusion-transparent.png", colors: ["#22D3EE", "#FB923C"] },
    proton: { image: "/agent/theme/proton-transparent.png", colors: ["#2563EB", "#22C55E", "#EF4444"] },
    pulsar: { image: "/agent/theme/pulsar-transparent.png", colors: ["#3B82F6", "#818CF8"] },
    quasar: { image: "/agent/theme/quasar-transparent.png", colors: ["#F59E0B", "#A855F7"] },
  } as const;

  for (const id of AGENT_THEME_IDS) {
    const theme = AGENT_THEMES[id];
    assert.equal(resolveAgentTheme(theme.name), theme);
    assert.equal(theme.image, expected[id].image);
    assert.deepEqual(
      [
        theme.colors.primary,
        theme.colors.secondary,
        ...("accent" in theme.colors ? [theme.colors.accent] : []),
      ],
      expected[id].colors,
    );
  }
});

test("matches names regardless of case and surrounding whitespace", () => {
  assert.equal(resolveAgentTheme("  néo plasma ").id, "plasma");
});

test("uses the default theme for an absent or unknown commercial name", () => {
  assert.equal(DEFAULT_AGENT_THEME_ID, "plasma");
  assert.equal(resolveAgentTheme(undefined).id, DEFAULT_AGENT_THEME_ID);
  assert.equal(resolveAgentTheme("").id, DEFAULT_AGENT_THEME_ID);
  const unknownNameFallback = resolveAgentTheme("NÉO Inconnu");
  assert.equal(unknownNameFallback.id, DEFAULT_AGENT_THEME_ID);
  assert.equal(unknownNameFallback.name, AGENT_THEMES[DEFAULT_AGENT_THEME_ID].name);
});

test("each registered theme has the data required by the provider", () => {
  for (const id of AGENT_THEME_IDS) {
    const theme = AGENT_THEMES[id];
    assert.equal(existsSync(new URL(`../public${theme.image}`, import.meta.url)), true);
    assert.match(theme.image, /^\/agent\/theme\/.+\.(jpg|jpeg|png)$/);
    assert.match(theme.colors.primary, /^#[\da-f]{6}$/i);
    assert.match(theme.colors.secondary, /^#[\da-f]{6}$/i);
    assert.match(theme.gradient, /^linear-gradient\(/);
    assert.ok(theme.glow.length > 0);
    assert.equal(theme.animationType.length > 0, true);
  }
});

test("assigns a distinct motion signature to every registered agent", () => {
  const animationTypes = AGENT_THEME_IDS.map((id) => AGENT_THEMES[id].animationType);
  assert.equal(new Set(animationTypes).size, AGENT_THEME_IDS.length);
  assert.deepEqual(animationTypes, [
    "photon-particles",
    "quantum-oscillation",
    "plasma-pulse",
    "fusion-convergence",
    "proton-halo",
    "pulsar-waves",
    "quasar-radiance",
  ]);
});

test("disables decorative motion when reduced motion is requested", () => {
  const css = readFileSync(new URL("../components/agent/agent-themed-ui.module.css", import.meta.url), "utf8");
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  assert.match(css, /\.spinner[\s\S]*?animation:\s*none\s*!important/);
  assert.match(css, /\.feedbackSuccess[\s\S]*?animation:\s*none\s*!important/);
});

test("provides every agent avatar as a PNG with an alpha channel", () => {
  for (const id of AGENT_THEME_IDS) {
    const png = readFileSync(new URL(`../public${AGENT_THEMES[id].image}`, import.meta.url));
    assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", id);
    assert.equal(png.readUInt8(25), 6, `${id} needs an RGBA image`);
  }
});

test("provides distinct, short sound signatures with bounded levels for every identity", () => {
  const signatures = new Set<string>();
  for (const id of AGENT_THEME_IDS) {
    const { sound } = resolveAgentTheme(AGENT_THEMES[id].name);
    assert.ok(sound.voices.length > 0 && sound.voices.length <= 4, id);
    let totalGain = 0;
    for (const voice of sound.voices) {
      assert.ok(["sine", "triangle"].includes(voice.waveform), id);
      assert.ok(Number.isFinite(voice.start) && voice.start >= 0, id);
      assert.ok(Number.isFinite(voice.duration) && voice.duration >= .05, id);
      assert.ok(voice.start + voice.duration <= 1, `${id}: signature is too long`);
      assert.ok(Number.isFinite(voice.gain) && voice.gain > 0, id);
      totalGain += voice.gain;
      for (const frequency of [voice.frequency, voice.endFrequency ?? voice.frequency]) {
        assert.ok(Number.isFinite(frequency) && frequency >= 100 && frequency <= 3000, id);
      }
    }
    assert.ok(totalGain <= 1, `${id}: combined voice gain exceeds the headroom budget`);
    signatures.add(JSON.stringify(sound));
  }
  assert.equal(signatures.size, AGENT_THEME_IDS.length);
  assert.equal(resolveAgentTheme(undefined).sound, AGENT_THEMES.plasma.sound);
  assert.equal(resolveAgentTheme("unknown").sound, AGENT_THEMES.plasma.sound);
});
