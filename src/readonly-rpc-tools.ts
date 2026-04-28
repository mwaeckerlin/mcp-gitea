import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { REST_TOOL_FAMILY_NAMES, type RestToolFamilyName } from "./tool-families.js";
import { validateRestCallArguments } from "./validation.js";

export type ReadonlyRpcToolName = RestToolFamilyName;

export function isReadonlyRpcToolName(value: string): value is ReadonlyRpcToolName {
  return REST_TOOL_FAMILY_NAMES.includes(value as ReadonlyRpcToolName);
}

export function validateReadonlyRpcToolArguments(toolName: ReadonlyRpcToolName, argumentsValue: unknown): ReturnType<typeof validateRestCallArguments> {
  return validateRestCallArguments(toolName, argumentsValue);
}

export async function runReadonlyRpcToolWithArguments(
  toolName: ReadonlyRpcToolName,
  toolArguments: unknown,
  client: { callRestByOperationId(operationId: string, parameters: Record<string, unknown>): Promise<unknown> }
): Promise<string> {
  const { operationId, parameters } = validateReadonlyRpcToolArguments(toolName, toolArguments);
  const result = await client.callRestByOperationId(operationId, parameters);
  return JSON.stringify({ operationId, ...((result as Record<string, unknown>) ?? {}) }, null, 2);
}

export function assertReadonlyRpcToolName(value: string): ReadonlyRpcToolName {
  if (!isReadonlyRpcToolName(value)) {
    throw new McpError(ErrorCode.InvalidParams, `Unknown tool: ${value}`);
  }
  return value;
}
