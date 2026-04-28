import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { REST_TOOL_FAMILY_NAMES, type RestToolFamilyName } from "./tool-families.js";
import { loadServerConfigFromEnv, type ServerConfig, validateOperationListArguments } from "./validation.js";

export type GatewayConfig = ServerConfig;

export const ALLOWED_HTTP_GATEWAY_OPERATIONS = {
  gitea_rest_list_operations: {
    description: "List allowlisted Gitea REST operation mappings grouped by tool family."
  }
} as const;

export type HttpToolName = keyof typeof ALLOWED_HTTP_GATEWAY_OPERATIONS;

export function isHttpToolName(value: string): value is HttpToolName {
  return value in ALLOWED_HTTP_GATEWAY_OPERATIONS;
}

export function loadGatewayConfig(env: NodeJS.ProcessEnv = process.env): GatewayConfig {
  return loadServerConfigFromEnv(env);
}

export function validateHttpToolArguments(_toolName: HttpToolName, argumentsValue: unknown): ReturnType<typeof validateOperationListArguments> {
  return validateOperationListArguments(argumentsValue);
}

export function isRestToolFamilyName(value: string): value is RestToolFamilyName {
  return REST_TOOL_FAMILY_NAMES.includes(value as RestToolFamilyName);
}

export function assertRestToolFamilyName(value: string): RestToolFamilyName {
  if (!isRestToolFamilyName(value)) {
    throw new McpError(ErrorCode.InvalidParams, `Unknown tool: ${value}`);
  }
  return value;
}
