import assert from "node:assert/strict";
import test from "node:test";
import { getAgentCommercialName } from "./agent-commercial-name.ts";

test("reads the commercial agent name from the server environment", () => {
  const previous = process.env.AGENT_NAME_COMMERCIAL;
  process.env.AGENT_NAME_COMMERCIAL = "Test Agent";
  try {
    assert.equal(getAgentCommercialName(), "Test Agent");
  } finally {
    if (previous === undefined) delete process.env.AGENT_NAME_COMMERCIAL;
    else process.env.AGENT_NAME_COMMERCIAL = previous;
  }
});

test("uses a generic label when the commercial name is not configured", () => {
  const previous = process.env.AGENT_NAME_COMMERCIAL;
  delete process.env.AGENT_NAME_COMMERCIAL;
  try {
    assert.equal(getAgentCommercialName(), "Agent FGMC");
  } finally {
    if (previous !== undefined) process.env.AGENT_NAME_COMMERCIAL = previous;
  }
});
