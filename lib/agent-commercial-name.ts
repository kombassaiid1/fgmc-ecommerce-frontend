/** Read only this public identity value on the server before passing it to the agent UI. */
export function getAgentCommercialName(): string {
  return process.env.AGENT_NAME_COMMERCIAL?.trim() || "Agent FGMC";
}
