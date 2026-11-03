// Lancer : node --test components/agent/markdown-parser.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";

type Parser = typeof import("./markdown-parser");
const modulePath = "./markdown-parser.ts";
const { parseBlocks, parseInline } = (await import(modulePath)) as Parser;

test("titres de # à ###### sans afficher les #", () => {
  for (let level = 1; level <= 6; level++) {
    assert.deepEqual(parseBlocks(`${"#".repeat(level)} Titre proposé :`), [{ type: "heading", level, text: "Titre proposé :" }]);
  }
  assert.deepEqual(parseBlocks("####### sept"), [{ type: "paragraph", lines: ["####### sept"] }]);
});

test("séparateurs --- *** ___ seuls sur une ligne", () => {
  for (const rule of ["---", "***", "___", "-----"]) assert.deepEqual(parseBlocks(rule), [{ type: "hr" }]);
  assert.deepEqual(parseBlocks("avant\n---\naprès"), [
    { type: "paragraph", lines: ["avant"] }, { type: "hr" }, { type: "paragraph", lines: ["après"] },
  ]);
});

test("les listes ne changent pas", () => {
  assert.deepEqual(parseBlocks("- a\n- b\n1. c"), [
    { type: "list", ordered: false, items: ["a", "b"] }, { type: "list", ordered: true, items: ["c"] },
  ]);
});

test("lien dans du gras", () => {
  const nodes = parseInline("**Caractéristiques vérifiées (source : [Quality Sewing](https://www.qualitysewing.com/p)) :**");
  assert.equal(nodes.length, 1);
  assert.equal(nodes[0].type, "strong");
  const children = (nodes[0] as Extract<(typeof nodes)[number], { type: "strong" }>).children;
  assert.deepEqual(children.map((node) => node.type), ["text", "link", "text"]);
  assert.deepEqual(children[1], { type: "link", text: "Quality Sewing", url: "https://www.qualitysewing.com/p" });
});

test("lien dans de l’italique", () => {
  const nodes = parseInline("*voir [Brother](https://www.brother.fr)*");
  assert.equal(nodes[0].type, "em");
  assert.ok((nodes[0] as { children: { type: string }[] }).children.some((node) => node.type === "link"));
});

test("URL javascript: ou data: refusée, même dans du gras", () => {
  for (const url of ["javascript:alert(1)", "data:text/html,x", "ftp://exemple.fr/f"]) {
    const nodes = parseInline(`**[piège](${url})** et [piège](${url})`);
    const flat = JSON.stringify(nodes);
    assert.ok(!flat.includes('"type":"link"'), url);
  }
});

test("image, code en ligne et gras simple inchangés", () => {
  assert.deepEqual(parseInline("![Image produit](https://a.fr/i.png)"), [{ type: "image", alt: "Image produit", url: "https://a.fr/i.png" }]);
  assert.deepEqual(parseInline("`a_b`"), [{ type: "code", text: "a_b" }]);
  assert.deepEqual(parseInline("**Gras**"), [{ type: "strong", children: [{ type: "text", text: "Gras" }] }]);
});

test("astérisques et soulignés isolés restent du texte", () => {
  assert.deepEqual(parseInline("2 * 3 * 4"), [{ type: "text", text: "2 * 3 * 4" }]);
  assert.deepEqual(parseInline("ref_produit_12"), [{ type: "text", text: "ref_produit_12" }]);
});
