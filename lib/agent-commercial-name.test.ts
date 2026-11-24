import assert from "node:assert/strict";
import test from "node:test";
import { getAgentCommercialName } from "./agent-commercial-name.ts";
import { DEFAULT_AGENT_COMMERCIAL_NAME, DEFAULT_AGENT_THEME_ID, resolveAgentTheme } from "./agent-theme.ts";

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

test("uses the default theme identity when the commercial name is not configured", () => {
  const previous = process.env.AGENT_NAME_COMMERCIAL;
  delete process.env.AGENT_NAME_COMMERCIAL;
  try {
    const commercialName = getAgentCommercialName();
    assert.equal(commercialName, DEFAULT_AGENT_COMMERCIAL_NAME);
    assert.equal(resolveAgentTheme(commercialName).id, DEFAULT_AGENT_THEME_ID);
  } finally {
    if (previous !== undefined) process.env.AGENT_NAME_COMMERCIAL = previous;
  }
});
