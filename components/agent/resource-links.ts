export type ResourceLink = { url: string; label: string };
export type ResourceLinkMessage = { text: string; sources: readonly unknown[] };

export const MAX_RESOURCE_LINKS = 20;
const MAX_LABEL_LENGTH = 200;
const TEXT_LINK_PATTERN = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|(?<![\w(])https?:\/\/[^\s)\]]+/g;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parsePublicUrl(raw: string): URL | null {
  try {
    const url = new URL(raw);
    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

function cleanLabel(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, MAX_LABEL_LENGTH) : "";
}

function hostLabel(url: URL): string {
  return url.hostname.replace(/^www\./, "");
}

function messageLinks(message: ResourceLinkMessage): ResourceLink[] {
  const links: ResourceLink[] = [];
  for (const item of message.sources) {
    if (!isRecord(item) || typeof item.url !== "string") continue;
    const url = parsePublicUrl(item.url);
    if (!url) continue;
    links.push({ url: url.href, label: cleanLabel(item.title) || cleanLabel(item.domain) || hostLabel(url) });
  }
  for (const match of message.text.matchAll(TEXT_LINK_PATTERN)) {
    const url = parsePublicUrl(match[2] ?? match[0].replace(/[.,;:!?]+$/, ""));
    if (!url) continue;
    links.push({ url: url.href, label: (match[1] ? cleanLabel(match[1]) : "") || hostLabel(url) });
  }
  return links;
}

// Messages dans l'ordre de la conversation ; résultat : liens les plus récents d'abord, sans doublon.
export function collectResourceLinks(messages: readonly ResourceLinkMessage[]): ResourceLink[] {
  const seen = new Set<string>();
  const result: ResourceLink[] = [];
  for (const message of [...messages].reverse()) {
    for (const link of messageLinks(message).reverse()) {
      if (seen.has(link.url)) continue;
      seen.add(link.url);
      result.push(link);
      if (result.length >= MAX_RESOURCE_LINKS) return result;
    }
  }
  return result;
}
