// Lancer : node --test components/agent/send-error.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";

type Module = typeof import("./send-error");
const modulePath = "./send-error.ts";
const { AgentRequestError, describeSendError, TASK_IN_PROGRESS_MESSAGE } = (await import(modulePath)) as Module;

test("409 : message fixe, même sans corps ou avec un autre corps", async () => {
  for (const body of ["", '{"code":"TASK_IN_PROGRESS","message":"x"}', "n’importe quoi"]) {
    const error = await AgentRequestError.fromResponse(new Response(body, { status: 409 }));
    assert.deepEqual(describeSendError(error), { message: TASK_IN_PROGRESS_MESSAGE, conflict: true, retryable: false });
  }
  assert.equal(TASK_IN_PROGRESS_MESSAGE, "Une réponse est déjà en cours. Attendez sa fin ou cliquez sur Arrêter.");
});

test("5xx et réseau : message clair et relance possible", async () => {
  const server = describeSendError(await AgentRequestError.fromResponse(new Response("", { status: 502 })));
  assert.equal(server.retryable, true);
  assert.equal(server.conflict, false);
  const network = describeSendError(new TypeError("Failed to fetch"));
  assert.equal(network.retryable, true);
  assert.match(network.message, /indisponible/);
});

test("401 et 403 : pas de relance, 400 : message du serveur si court", async () => {
  assert.equal(describeSendError(new AgentRequestError(401, "")).retryable, false);
  assert.equal(describeSendError(new AgentRequestError(403, "")).retryable, false);
  assert.equal(describeSendError(new AgentRequestError(400, "Message trop long.")).message, "Message trop long.");
  assert.match(describeSendError(new AgentRequestError(400, "x".repeat(300))).message, /n’a pas pu être envoyée/);
});

test("le corps JSON du serveur est lu sans planter sur du texte brut", async () => {
  assert.equal((await AgentRequestError.fromResponse(new Response('{"message":["a","b"]}', { status: 400 }))).serverMessage, "a, b");
  assert.equal((await AgentRequestError.fromResponse(new Response("<html>", { status: 500 }))).serverMessage, "");
});
