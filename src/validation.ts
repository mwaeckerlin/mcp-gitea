import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { loadGiteaOperations } from "./gitea-operations.js";
import { getOperationFamily } from "./tools.js";
import { REST_TOOL_FAMILY_NAMES, type RestToolFamilyName } from "./tool-families.js";

const OPERATION_REGISTRY = new Map(loadGiteaOperations().map((operation) => [operation.operationId, operation]));
const PAGE_SIZE_KEYS = new Set(["per_page", "perPage", "first", "last", "limit", "pageSize"]);
const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 30;
const MAX_OFFSET = 10000;
const DEFAULT_LIMIT = 50;

export interface ServerConfig {
  giteaToken?: string;
  mcpAuthToken?: string;
  giteaUrl: string;
  host: string;
  port: number;
  disabledTools: ReadonlySet<string>;
}

function asObject(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new McpError(ErrorCode.InvalidParams, `${name} must be an object`);
  }
  return value as Record<string, unknown>;
}

function clampPageSize(value: number): number {
  return Math.max(1, Math.min(MAX_PAGE_SIZE, Math.floor(value)));
}

function clampPagination(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => clampPagination(entry));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (PAGE_SIZE_KEYS.has(key) && typeof entry === "number" && Number.isFinite(entry)) {
      result[key] = clampPageSize(entry);
    } else {
      result[key] = clampPagination(entry);
    }
  }

  return result;
}

function parseDisabledTools(disabledToolsValue: string | undefined): ReadonlySet<string> {
  return new Set<string>(
    (disabledToolsValue ?? "")
      .split(",")
      .map((entry: string) => entry.trim())
      .filter((entry: string) => entry.length > 0)
  );
}

export function loadServerConfigFromEnv(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const giteaToken = env.GITEA_TOKEN?.trim();
  const mcpAuthToken = env.MCP_AUTH_TOKEN?.trim();

  const giteaUrl = env.GITEA_URL?.trim();
  if (!giteaUrl || giteaUrl.length === 0) {
    throw new Error("GITEA_URL is required");
  }

  const host = env.MCP_GITEA_HOST?.trim() || "0.0.0.0";
  const rawPort = env.MCP_GITEA_PORT?.trim() || "4000";
  const port = Number.parseInt(rawPort, 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("MCP_GITEA_PORT must be an integer between 1 and 65535");
  }

  const disabledTools = parseDisabledTools(env.DISABLE_TOOLS);

  return {
    giteaToken: giteaToken && giteaToken.length > 0 ? giteaToken : undefined,
    mcpAuthToken: mcpAuthToken && mcpAuthToken.length > 0 ? mcpAuthToken : undefined,
    giteaUrl,
    host,
    port,
    disabledTools
  };
}

export function validateOperationListArguments(argumentsValue: unknown): { family?: RestToolFamilyName; limit: number; offset: number } {
  const args = argumentsValue === undefined ? {} : asObject(argumentsValue, "arguments");

  const family = args.family;
  if (family !== undefined && (typeof family !== "string" || !REST_TOOL_FAMILY_NAMES.includes(family as RestToolFamilyName))) {
    throw new McpError(ErrorCode.InvalidParams, "family must be a valid REST tool family name");
  }

  const limitRaw = args.limit;
  const offsetRaw = args.offset;

  const limit = limitRaw === undefined ? DEFAULT_LIMIT : typeof limitRaw === "number" ? clampPageSize(limitRaw) : NaN;
  const offset = offsetRaw === undefined ? 0 : typeof offsetRaw === "number" && Number.isInteger(offsetRaw) && offsetRaw >= 0 ? Math.min(offsetRaw, MAX_OFFSET) : NaN;

  if (!Number.isFinite(limit)) {
    throw new McpError(ErrorCode.InvalidParams, "limit must be a positive integer");
  }
  if (!Number.isFinite(offset)) {
    throw new McpError(ErrorCode.InvalidParams, "offset must be a non-negative integer");
  }

  return {
    family: family as RestToolFamilyName | undefined,
    limit,
    offset
  };
}

export function validateRestCallArguments(toolName: RestToolFamilyName, argumentsValue: unknown): { operationId: string; parameters: Record<string, unknown> } {
  const args = asObject(argumentsValue, "arguments");
  const operationId = args.operationId;

  if (typeof operationId !== "string" || operationId.trim().length < 1) {
    throw new McpError(ErrorCode.InvalidParams, "operationId must be a non-empty string");
  }

  const operation = OPERATION_REGISTRY.get(operationId);
  if (!operation) {
    throw new McpError(ErrorCode.InvalidParams, `Unknown operationId: ${operationId}`);
  }

  const family = getOperationFamily(operationId);
  if (family !== toolName) {
    throw new McpError(ErrorCode.InvalidParams, `operationId ${operationId} is not allowlisted for tool ${toolName}`);
  }

  const rawParameters = args.parameters ?? {};
  const parameters = asObject(rawParameters, "parameters");

  const clampedParameters = clampPagination(parameters) as Record<string, unknown>;

  if (operation.parameterNames.includes("limit") && clampedParameters.limit === undefined) {
    clampedParameters.limit = DEFAULT_PAGE_SIZE;
  }

  return {
    operationId,
    parameters: clampedParameters
  };
}
