import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";
import {
  AGENT_THEMES,
  AGENT_THEME_IDS,
  DEFAULT_AGENT_THEME_ID,
  resolveAgentTheme,
} from "./agent-theme.ts";

test("maps every commercial agent name to its typed theme", () => {
  const expected = {
    photon: { image: "/agent/theme/photon.jpg", colors: ["#FACC15", "#EAB308"] },
    quantum: { image: "/agent/theme/quantum.jpg", colors: ["#38BDF8", "#EF4444"] },
    plasma: { image: "/agent/theme/plasma.jpg", colors: ["#EC4899", "#8B5CF6"] },
    fusion: { image: "/agent/theme/fusion.jpg", colors: ["#22D3EE", "#FB923C"] },
    proton: { image: "/agent/theme/proton.jpeg", colors: ["#2563EB", "#22C55E", "#EF4444"] },
    pulsar: { image: "/agent/theme/pulsar.jpeg", colors: ["#3B82F6", "#818CF8"] },
    quasar: { image: "/agent/theme/quasar.jpeg", colors: ["#F59E0B", "#A855F7"] },
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
    assert.match(theme.image, /^\/agent\/theme\/.+\.(jpg|jpeg)$/);
    assert.match(theme.colors.primary, /^#[\da-f]{6}$/i);
    assert.match(theme.colors.secondary, /^#[\da-f]{6}$/i);
    assert.match(theme.gradient, /^linear-gradient\(/);
    assert.ok(theme.glow.length > 0);
    assert.ok(["pulse", "orbit", "ripple", "none"].includes(theme.animationType));
  }
});
