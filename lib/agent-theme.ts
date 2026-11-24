export const AGENT_THEME_IDS = [
  "photon",
  "quantum",
  "plasma",
  "fusion",
  "proton",
  "pulsar",
  "quasar",
] as const;

export type AgentThemeId = (typeof AGENT_THEME_IDS)[number];
export type AgentThemeAnimationType = "pulse" | "orbit" | "ripple" | "none";

export type AgentTheme = {
  id: AgentThemeId;
  name: string;
  image: `/agent/theme/${string}`;
  colors: {
    primary: `#${string}`;
    secondary: `#${string}`;
    accent?: `#${string}`;
  };
  gradient: string;
  glow: string;
  animationType: AgentThemeAnimationType;
};

export const DEFAULT_AGENT_THEME_ID: AgentThemeId = "plasma";

/** Single source of truth for agent identity and future visual tokens. */
export const AGENT_THEMES = {
  photon: {
    id: "photon",
    name: "NÉO Photon",
    image: "/agent/theme/photon.jpg",
    colors: { primary: "#FACC15", secondary: "#EAB308" },
    gradient: "linear-gradient(135deg, #FACC15 0%, #EAB308 100%)",
    glow: "0 0 32px rgba(250, 204, 21, 0.45)",
    animationType: "pulse",
  },
  quantum: {
    id: "quantum",
    name: "NÉO Quantum",
    image: "/agent/theme/quantum.jpg",
    colors: { primary: "#38BDF8", secondary: "#EF4444" },
    gradient: "linear-gradient(135deg, #38BDF8 0%, #EF4444 100%)",
    glow: "0 0 32px rgba(56, 189, 248, 0.4), 0 0 48px rgba(239, 68, 68, 0.24)",
    animationType: "orbit",
  },
  plasma: {
    id: "plasma",
    name: "NÉO Plasma",
    image: "/agent/theme/plasma.jpg",
    colors: { primary: "#EC4899", secondary: "#8B5CF6" },
    gradient: "linear-gradient(135deg, #EC4899 0%, #8B5CF6 100%)",
    glow: "0 0 32px rgba(236, 72, 153, 0.4), 0 0 48px rgba(139, 92, 246, 0.28)",
    animationType: "ripple",
  },
  fusion: {
    id: "fusion",
    name: "NÉO Fusion",
    image: "/agent/theme/fusion.jpg",
    colors: { primary: "#22D3EE", secondary: "#FB923C" },
    gradient: "linear-gradient(135deg, #22D3EE 0%, #FB923C 100%)",
    glow: "0 0 32px rgba(34, 211, 238, 0.4), 0 0 48px rgba(251, 146, 60, 0.25)",
    animationType: "pulse",
  },
  proton: {
    id: "proton",
    name: "NÉO Proton",
    image: "/agent/theme/proton.jpeg",
    colors: { primary: "#2563EB", secondary: "#22C55E", accent: "#EF4444" },
    gradient: "linear-gradient(135deg, #2563EB 0%, #22C55E 55%, #EF4444 100%)",
    glow: "0 0 32px rgba(37, 99, 235, 0.4), 0 0 48px rgba(34, 197, 94, 0.22)",
    animationType: "orbit",
  },
  pulsar: {
    id: "pulsar",
    name: "NÉO Pulsar",
    image: "/agent/theme/pulsar.jpeg",
    colors: { primary: "#3B82F6", secondary: "#818CF8" },
    gradient: "linear-gradient(135deg, #3B82F6 0%, #818CF8 100%)",
    glow: "0 0 32px rgba(59, 130, 246, 0.42), 0 0 48px rgba(129, 140, 248, 0.28)",
    animationType: "pulse",
  },
  quasar: {
    id: "quasar",
    name: "NÉO Quasar",
    image: "/agent/theme/quasar.jpeg",
    colors: { primary: "#F59E0B", secondary: "#A855F7" },
    gradient: "linear-gradient(135deg, #F59E0B 0%, #A855F7 100%)",
    glow: "0 0 32px rgba(245, 158, 11, 0.42), 0 0 48px rgba(168, 85, 247, 0.28)",
    animationType: "ripple",
  },
} as const satisfies Record<AgentThemeId, AgentTheme>;

export const DEFAULT_AGENT_COMMERCIAL_NAME = AGENT_THEMES[DEFAULT_AGENT_THEME_ID].name;

function normalizeCommercialName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("fr");
}

const THEME_ID_BY_NAME: Readonly<Record<string, AgentThemeId>> = Object.fromEntries(
  Object.values(AGENT_THEMES).map((theme) => [normalizeCommercialName(theme.name), theme.id]),
) as Readonly<Record<string, AgentThemeId>>;

/** Resolve a commercial name to its theme; unknown and empty names use Plasma. */
export function resolveAgentTheme(commercialName: string | null | undefined): AgentTheme {
  const normalizedName = normalizeCommercialName(commercialName ?? "");
  const id = THEME_ID_BY_NAME[normalizedName] ?? DEFAULT_AGENT_THEME_ID;
  return AGENT_THEMES[id];
}
