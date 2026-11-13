import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getRetryContext,
  IDLE_TASK_GRACE_MS,
  isAgentChatBusy,
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
