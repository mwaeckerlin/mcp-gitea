export function parseDisabledTools(value: string): ReadonlySet<string> {
  return new Set(
    value
      .split(/[,\s]+/)
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0)
  );
}

export function loadDisabledToolsFromEnv(env: NodeJS.ProcessEnv = process.env): ReadonlySet<string> {
  return parseDisabledTools(env.DISABLE_TOOLS ?? "");
}

export function isToolDisabled(toolName: string, disabledTools: ReadonlySet<string>): boolean {
  return disabledTools.has(toolName);
}
