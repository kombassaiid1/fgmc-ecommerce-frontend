// Lancer : node --test components/agent/raw-tool-call.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";

type Module = typeof import("./raw-tool-call");
const modulePath = "./raw-tool-call.ts";
const { isRawToolCallText } = (await import(modulePath)) as Module;

test("détecte les appels d’outil bruts au tout début", () => {
  for (const text of [
    'search_web[ARGS]{"query": "machine à coudre"}',
    '  search_web[ARGS]{"query": "x"}',
    '[TOOL_CALLS][{"name": "search_web"}]',
    '[TOOL_CALL]search_web',
    'search_web{"query": "x"}',
    'read_web_source {"url": "https://a.fr"}',
  ]) assert.equal(isRawToolCallText(text), true, text);
});

test("laisse passer les vraies réponses", () => {
  for (const text of [
    "",
    "Voici le résultat de la recherche.",
    "J’ai utilisé search_web pour vérifier.",
    'Réponse avec {"json": true} plus loin',
    "Le tableau[ARGS] est cité au milieu",
    "# Titre\n\nsearch_web[ARGS]{} n’est pas au début",
  ]) assert.equal(isRawToolCallText(text), false, text);
});
