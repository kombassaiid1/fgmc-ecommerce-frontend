import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getRetryContext,
  IDLE_TASK_GRACE_MS,
  isAgentChatBusy,
  isInterruptedStreamError,
  nextInterruptedStreamStep,
  shouldFailMissingTask,
} from "./agent-chat-state.ts";

describe("agent chat task state", () => {
  it("does not fail an idle task during the grace period", () => {
    assert.equal(shouldFailMissingTask("ready", 10_000, 10_000 + IDLE_TASK_GRACE_MS - 1), false);
    assert.equal(shouldFailMissingTask("ready", 10_000, 10_000 + IDLE_TASK_GRACE_MS), true);
  });

  it("keeps an idle task while the browser stream is open", () => {
    assert.equal(shouldFailMissingTask("submitted", 0, 60_000), false);
    assert.equal(shouldFailMissingTask("streaming", 0, 60_000), false);
  });

  it("retries the last user message in the same session", () => {
    const retry = getRetryContext("session-current", [
      { role: "user", parts: [{ type: "text", text: "Ancien message" }] },
      { role: "assistant", parts: [{ type: "text", text: "Réponse" }] },
      { role: "user", parts: [{ type: "text", text: "À relancer" }] },
    ]);

    assert.deepEqual(retry, { sessionId: "session-current", message: "À relancer" });
  });

  it("locks the composer while streaming or while the backend task is running", () => {
    assert.equal(isAgentChatBusy("streaming", "failed"), true);
    assert.equal(isAgentChatBusy("submitted", "idle"), true);
    assert.equal(isAgentChatBusy("ready", "running"), true);
    assert.equal(isAgentChatBusy("ready", "failed"), false);
  });
});

describe("agent chat interrupted stream recovery", () => {
  it("flux coupé puis tâche completed : pas d'erreur", () => {
    assert.equal(nextInterruptedStreamStep("completed", 0), "completed");
    assert.equal(nextInterruptedStreamStep("completed", IDLE_TASK_GRACE_MS * 2), "completed");
  });

  it("flux coupé puis tâche failed : erreur après la période de grâce", () => {
    assert.equal(nextInterruptedStreamStep("failed", 0), "wait");
    assert.equal(nextInterruptedStreamStep("failed", IDLE_TASK_GRACE_MS), "error");
    assert.equal(nextInterruptedStreamStep("stopped", IDLE_TASK_GRACE_MS), "error");
    assert.equal(nextInterruptedStreamStep("idle", IDLE_TASK_GRACE_MS), "error");
  });

  it("tâche encore running : on garde l'état occupé quel que soit le délai", () => {
    assert.equal(nextInterruptedStreamStep("running", 0), "running");
    assert.equal(nextInterruptedStreamStep("running", 10 * IDLE_TASK_GRACE_MS), "running");
  });

  it("seules les coupures réseau et les 5xx déclenchent la vérification serveur", () => {
    assert.equal(isInterruptedStreamError(new TypeError("Failed to fetch")), true);
    assert.equal(isInterruptedStreamError(Object.assign(new Error("Bad Gateway"), { statusCode: 502 })), true);
    assert.equal(isInterruptedStreamError(Object.assign(new Error("Unauthorized"), { statusCode: 401 })), false);
    assert.equal(isInterruptedStreamError(Object.assign(new Error("Too many"), { statusCode: 429 })), false);
    assert.equal(isInterruptedStreamError("texte"), false);
  });
});
