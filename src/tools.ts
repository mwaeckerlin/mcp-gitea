import { loadGiteaOperations } from "./gitea-operations.js";
import { classifyOperationToFamily, getRestToolFamilies, type RestToolFamilyName } from "./tool-families.js";

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: readonly string[];
    additionalProperties: false;
  };
}

const operationFamilyMap = new Map<string, RestToolFamilyName>();
const operationsByFamily = new Map<RestToolFamilyName, string[]>();
const operationDetailsMap = new Map<
  string,
  {
    operationId: string;
    family: RestToolFamilyName;
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD";
    path: string;
    parameterNames: string[];
  }
>();

for (const operation of loadGiteaOperations()) {
  const family = classifyOperationToFamily(operation);
  operationFamilyMap.set(operation.operationId, family);
  operationsByFamily.set(family, [...(operationsByFamily.get(family) ?? []), operation.operationId]);
  operationDetailsMap.set(operation.operationId, {
    operationId: operation.operationId,
    family,
    method: operation.method,
    path: operation.path,
    parameterNames: [...operation.parameterNames]
  });
}

const REST_CALL_SCHEMA = {
  type: "object" as const,
  properties: {
    operationId: {
      type: "string",
      description: "Gitea API operationId for the selected tool family"
    },
    parameters: {
      type: "object",
      description: "Arguments for the selected operation (route and query/body fields)",
      additionalProperties: true
    }
  },
  required: ["operationId"],
  additionalProperties: false as const
};

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: "gitea_rest_list_operations",
    description: "List allowlisted Gitea REST operations and the matching MCP tool family.",
    inputSchema: {
      type: "object",
      properties: {
        family: {
          type: "string",
          enum: [...new Set(operationFamilyMap.values())]
        },
        limit: { type: "integer", minimum: 1, maximum: 100 },
        offset: { type: "integer", minimum: 0, maximum: 10000 }
      },
      additionalProperties: false
    }
  },
  ...getRestToolFamilies().map((family) => {
    return {
      name: family.name,
      description: family.description,
      inputSchema: REST_CALL_SCHEMA
    };
  })
];

export function getToolDefinitions(disabledTools: ReadonlySet<string> = new Set()): ToolDefinition[] {
  return TOOL_DEFINITIONS.filter((tool) => !disabledTools.has(tool.name));
}

export function getOperationFamily(operationId: string): RestToolFamilyName | undefined {
  return operationFamilyMap.get(operationId);
}

export function listOperationMappings(family?: RestToolFamilyName): Array<{
  operationId: string;
  family: RestToolFamilyName;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD";
  path: string;
  parameterNames: string[];
}> {
  const mappings: Array<{
    operationId: string;
    family: RestToolFamilyName;
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD";
    path: string;
    parameterNames: string[];
  }> = [];
  for (const details of operationDetailsMap.values()) {
    if (!family || family === details.family) {
      mappings.push({
        operationId: details.operationId,
        family: details.family,
        method: details.method,
        path: details.path,
        parameterNames: [...details.parameterNames]
      });
    }
  }
  mappings.sort((a, b) => a.operationId.localeCompare(b.operationId));
  return mappings;
}

export function getOperationsForFamily(family: RestToolFamilyName): string[] {
  return [...(operationsByFamily.get(family) ?? [])].sort((a, b) => a.localeCompare(b));
}
