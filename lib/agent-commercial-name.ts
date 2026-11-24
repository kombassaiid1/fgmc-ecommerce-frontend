import { DEFAULT_AGENT_COMMERCIAL_NAME } from "./agent-theme.ts";

/** Read only this public identity value on the server before passing it to the agent UI. */
export function getAgentCommercialName(): string {
  return process.env.AGENT_NAME_COMMERCIAL?.trim() || DEFAULT_AGENT_COMMERCIAL_NAME;
}
