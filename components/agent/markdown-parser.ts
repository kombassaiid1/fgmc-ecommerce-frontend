export type InlineNode =
  | { type: "text"; text: string }
  | { type: "code"; text: string }
  | { type: "image"; alt: string; url: string }
  | { type: "link"; text: string; url: string }
  | { type: "strong"; children: InlineNode[] }
  | { type: "em"; children: InlineNode[] };

export type BlockNode =
  | { type: "heading"; level: number; text: string }
  | { type: "hr" }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "paragraph"; lines: string[] };

// Seuls les liens et images http(s) sont reconnus : tout autre schéma (javascript:, data:…) reste du texte.
const INLINE_PATTERN = new RegExp(
  [
    String.raw`!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)`,
    String.raw`\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)`,
    String.raw`\x60([^\x60]+)\x60`,
    String.raw`\*\*(.+?)\*\*`,
    String.raw`(?<![*\w])\*(?![\s*])(.+?)(?<![\s*])\*(?![*\w])`,
    String.raw`(?<!\w)_(?!\s)(.+?)(?<!\s)_(?!\w)`,
  ].join("|"),
  "g",
);

export function parseInline(text: string, depth = 0): InlineNode[] {
  const nodes: InlineNode[] = [];
  let last = 0;
  for (const match of text.matchAll(INLINE_PATTERN)) {
    if (match.index > last) nodes.push({ type: "text", text: text.slice(last, match.index) });
    const [, imageAlt, imageUrl, linkText, linkUrl, code, strong, starEm, underscoreEm] = match;
    if (imageUrl !== undefined) nodes.push({ type: "image", alt: imageAlt, url: imageUrl });
    else if (linkUrl !== undefined) nodes.push({ type: "link", text: linkText, url: linkUrl });
    else if (code !== undefined) nodes.push({ type: "code", text: code });
    else if (strong !== undefined) {
      nodes.push({ type: "strong", children: depth < 2 ? parseInline(strong, depth + 1) : [{ type: "text", text: strong }] });
    } else {
      const em = starEm ?? underscoreEm;
      nodes.push({ type: "em", children: depth < 2 ? parseInline(em, depth + 1) : [{ type: "text", text: em }] });
    }
    last = match.index + match[0].length;
  }
  if (last < text.length) nodes.push({ type: "text", text: text.slice(last) });
  return nodes;
}

const LIST_ITEM = /^([-*]|\d+\.)\s+(.+)$/;
const HEADING = /^#{1,6}\s+(.+)$/;
const RULE = /^(?:-{3,}|\*{3,}|_{3,})$/;

export function parseBlocks(text: string): BlockNode[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: BlockNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index].trim();
    if (!line) {
      index += 1;
      continue;
    }

    if (RULE.test(line)) {
      blocks.push({ type: "hr" });
      index += 1;
      continue;
    }

    const listMatch = line.match(LIST_ITEM);
    if (listMatch) {
      const ordered = listMatch[1].endsWith(".");
      const items: string[] = [];
      while (index < lines.length) {
        const itemMatch = lines[index].trim().match(LIST_ITEM);
        if (!itemMatch || itemMatch[1].endsWith(".") !== ordered) break;
        items.push(itemMatch[2]);
        index += 1;
      }
      blocks.push({ type: "list", ordered, items });
      continue;
    }

    const headingMatch = line.match(HEADING);
    if (headingMatch) {
      blocks.push({
        type: "heading",
        level: line.indexOf(" "),
        text: headingMatch[1].replace(/\s+#+\s*$/, "").trim(),
      });
      index += 1;
      continue;
    }

    const paragraph: string[] = [];
    while (index < lines.length && lines[index].trim()) {
      const current = lines[index].trim();
      if (LIST_ITEM.test(current) || HEADING.test(current) || RULE.test(current)) break;
      paragraph.push(current);
      index += 1;
    }
    blocks.push({ type: "paragraph", lines: paragraph });
  }

  return blocks;
}
