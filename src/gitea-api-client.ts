import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { loadGiteaOperations } from "./gitea-operations.js";

const OPERATION_REGISTRY = new Map(loadGiteaOperations().map((operation) => [operation.operationId, operation]));

export interface RestCallResult {
  status: number;
  url: string;
  data: unknown;
  headers: Record<string, string | null>;
}

export class GiteaApiClient {
  private readonly baseUrl: string;
  private readonly token?: string;

  constructor(giteaUrl: string, token?: string) {
    this.baseUrl = giteaUrl.replace(/\/+$/, "") + "/api/v1";
    this.token = token;
  }

  async callRestByOperationId(operationId: string, parameters: Record<string, unknown>): Promise<RestCallResult> {
    const operation = OPERATION_REGISTRY.get(operationId);
    if (!operation) {
      throw new McpError(ErrorCode.InvalidParams, `Unknown operationId: ${operationId}`);
    }

    let path = operation.path;
    const remainingParams: Record<string, unknown> = { ...parameters };

    for (const [key, value] of Object.entries(parameters)) {
      const placeholder = `{${key}}`;
      if (path.includes(placeholder)) {
        path = path.replace(placeholder, encodeURIComponent(String(value)));
        delete remainingParams[key];
      }
    }

    const url = new URL(this.baseUrl + path);
    const bodyParams: Record<string, unknown> = {};

    const isBodyMethod = operation.method === "POST" || operation.method === "PUT" || operation.method === "PATCH";

    for (const [key, value] of Object.entries(remainingParams)) {
      if (isBodyMethod) {
        bodyParams[key] = value;
      } else {
        url.searchParams.set(key, String(value));
      }
    }

    const headers: Record<string, string> = {
      "Accept": "application/json"
    };
    if (this.token) {
      headers["Authorization"] = `token ${this.token}`;
    }
    if (isBodyMethod) {
      headers["Content-Type"] = "application/json";
    }

    const init: RequestInit = { method: operation.method, headers };
    if (isBodyMethod && Object.keys(bodyParams).length > 0) {
      init.body = JSON.stringify(bodyParams);
    }

    try {
      const response = await fetch(url.toString(), init);

      let data: unknown;
      const contentType = response.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        data = await response.json() as unknown;
      } else {
        data = await response.text();
      }

      if (!response.ok) {
        throw normalizeGiteaError(response.status, data);
      }

      return {
        status: response.status,
        url: url.toString(),
        data,
        headers: {
          link: response.headers.get("link"),
          "x-ratelimit-limit": response.headers.get("x-ratelimit-limit"),
          "x-ratelimit-remaining": response.headers.get("x-ratelimit-remaining"),
          "x-ratelimit-reset": response.headers.get("x-ratelimit-reset")
        }
      };
    } catch (error: unknown) {
      if (error instanceof McpError) {
        throw error;
      }
      throw normalizeGiteaError(undefined, error);
    }
  }
}

export function normalizeGiteaError(status: number | undefined, data: unknown): McpError {
  const rawMessage =
    data instanceof Error
      ? data.message
      : data && typeof data === "object" && "message" in data && typeof (data as Record<string, unknown>).message === "string"
        ? String((data as Record<string, unknown>).message)
        : String(data ?? "unknown error");

  const message = redactSecrets(rawMessage);

  if (status === 401 || status === 403) {
    return new McpError(ErrorCode.InternalError, `Gitea authentication or permission error (${status})`);
  }

  if (status === 404) {
    return new McpError(ErrorCode.InternalError, "Gitea resource not found or not accessible");
  }

  if (status !== undefined) {
    return new McpError(ErrorCode.InternalError, `Gitea API error (${status}): ${message}`);
  }

  return new McpError(ErrorCode.InternalError, `Gitea API request failed: ${message}`);
}

export function redactSecrets(value: string): string {
  return value.replace(/\b(token\s+)[A-Za-z0-9_\-]{8,}/gi, "$1[redacted]");
}

export const __testing = { normalizeGiteaError, redactSecrets };
