// Filet de sécurité : un appel d'outil brut ne doit jamais être affiché comme réponse.
export const RAW_TOOL_CALL_NOTICE = "La demande n’a pas pu être traitée. Vous pouvez la relancer.";

const RAW_TOOL_CALL_PATTERNS = [
  /^\[TOOL_CALLS?\]/i,
  /^[a-z_]\w*\s*\[ARGS\]/i,
  /^[a-z][a-z0-9]*(?:_[a-z0-9]+)+\s*\{/i,
];

export function isRawToolCallText(text: string): boolean {
  const start = text.trimStart();
  return start.length > 0 && RAW_TOOL_CALL_PATTERNS.some((pattern) => pattern.test(start));
}
