// Lancer : node --test components/agent/resource-links.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";

type Module = typeof import("./resource-links");
const modulePath = "./resource-links.ts";
const { collectResourceLinks, MAX_RESOURCE_LINKS } = (await import(modulePath)) as Module;

test("sources d’outils et liens de texte, titre ou domaine comme libellé", () => {
  const links = collectResourceLinks([
    {
      text: "Voir [Brother](https://www.brother.fr/a) et https://exemple.fr/page.",
      sources: [{ url: "https://www.qualitysewing.com/p", title: "Quality Sewing", domain: "qualitysewing.com" }, { url: "https://b.fr/x", domain: "b.fr" }],
    },
  ]);
  assert.deepEqual(links.map((link) => link.label).sort(), ["Brother", "Quality Sewing", "b.fr", "exemple.fr"].sort());
  assert.ok(links.some((link) => link.url === "https://exemple.fr/page"));
});

test("pas de doublon, le plus récent d’abord", () => {
  const links = collectResourceLinks([
    { text: "", sources: [{ url: "https://a.fr/1", title: "A1" }, { url: "https://a.fr/2", title: "A2" }] },
    { text: "[A1 bis](https://a.fr/1)", sources: [{ url: "https://c.fr/3", title: "C3" }] },
  ]);
  assert.deepEqual(links.map((link) => link.url), ["https://a.fr/1", "https://c.fr/3", "https://a.fr/2"]);
  assert.equal(links[0].label, "A1 bis");
});

test("javascript:, data: et ftp: refusés, sources invalides ignorées", () => {
  const links = collectResourceLinks([
    {
      text: "[x](javascript:alert(1)) [y](data:text/html,x) ftp://a.fr/f",
      sources: [{ url: "javascript:alert(1)" }, { url: "data:text/html,x" }, { url: 42 }, null, "https://a.fr", { title: "sans url" }],
    },
  ]);
  assert.deepEqual(links, []);
});

test("20 liens au maximum, les plus récents conservés", () => {
  const messages = Array.from({ length: 30 }, (_, index) => ({ text: "", sources: [{ url: `https://site${index}.fr/`, title: `S${index}` }] }));
  const links = collectResourceLinks(messages);
  assert.equal(MAX_RESOURCE_LINKS, 20);
  assert.equal(links.length, 20);
  assert.equal(links[0].label, "S29");
  assert.equal(links[19].label, "S10");
});

test("aucun lien : liste vide", () => {
  assert.deepEqual(collectResourceLinks([]), []);
  assert.deepEqual(collectResourceLinks([{ text: "bonjour", sources: [] }]), []);
});
