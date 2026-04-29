import assert from "node:assert/strict";
import type { IncomingMessage } from "node:http";
import test from "node:test";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { runToolWithArguments, __testing } from "./server.js";
import { getToolDefinitions, getOperationFamily, listOperationMappings } from "./tools.js";
import { REST_TOOL_FAMILY_NAMES } from "./tool-families.js";

const { extractRequestToken, isAuthTokenValid } = __testing;

const mockedApiClient = {
  async callRestByOperationId(operationId: string, parameters: Record<string, unknown>) {
    return {
      status: 200,
      url: `https://gitea.example.com/api/v1/mock/${operationId}`,
      data: { ok: true, operationId, parameters },
      headers: {}
    };
  }
};

// ─── operation registry ───────────────────────────────────────────────────────

test("all operations are classified into a tool family", () => {
  const mappings = listOperationMappings();
  assert.ok(mappings.length > 0, `expected operations, got ${mappings.length}`);
  for (const mapping of mappings) {
    assert.ok(getOperationFamily(mapping.operationId), `no family for ${mapping.operationId}`);
  }
});

// ─── gitea_rest_list_operations ───────────────────────────────────────────────

test("gitea_rest_list_operations: returns bounded pages with correct structure", async () => {
  const text = await runToolWithArguments(
    "gitea_rest_list_operations",
    { family: "gitea_pull_requests_rest", limit: 3, offset: 1 },
    mockedApiClient,
    new Set()
  );
  const parsed = JSON.parse(text) as {
    total: number;
    count: number;
    offset: number;
    limit: number;
    operations: Array<{ family: string }>;
  };
  assert.equal(parsed.count, 3);
  assert.equal(parsed.limit, 3);
  assert.equal(parsed.offset, 1);
  assert.ok(typeof parsed.total === "number" && parsed.total > 0);
  assert.ok(parsed.operations.every((op) => op.family === "gitea_pull_requests_rest"));
});

test("gitea_rest_list_operations: lists all operations when no family filter", async () => {
  const text = await runToolWithArguments("gitea_rest_list_operations", { limit: 100 }, mockedApiClient, new Set());
  const parsed = JSON.parse(text) as { total: number; count: number };
  assert.ok(parsed.total > 0);
  assert.equal(parsed.count, 100);
});

test("gitea_rest_list_operations: offset beyond total returns empty operations", async () => {
  const text = await runToolWithArguments(
    "gitea_rest_list_operations",
    { family: "gitea_pull_requests_rest", limit: 10, offset: 10000 },
    mockedApiClient,
    new Set()
  );
  const parsed = JSON.parse(text) as { count: number; operations: unknown[] };
  assert.equal(parsed.count, 0);
  assert.equal(parsed.operations.length, 0);
});

// ─── REST family tools ────────────────────────────────────────────────────────

test("each REST family tool can execute at least one mapped operation", async () => {
  const definitions = getToolDefinitions().filter(
    (def) => def.name.endsWith("_rest") && def.name !== "gitea_rest_list_operations"
  );

  for (const definition of definitions) {
    const operation = listOperationMappings(definition.name as (typeof REST_TOOL_FAMILY_NAMES)[number])[0];
    assert.ok(operation, `no mapped operation for ${definition.name}`);
    const output = await runToolWithArguments(
      definition.name,
      { operationId: operation.operationId, parameters: {} },
      mockedApiClient,
      new Set()
    );
    const parsed = JSON.parse(output) as { operationId: string; family: string };
    assert.equal(parsed.operationId, operation.operationId);
    assert.equal(typeof parsed.family, "string");
  }
});

test("REST tool rejects operation from another family", async () => {
  const prOperation = listOperationMappings("gitea_pull_requests_rest")[0];
  await assert.rejects(
    () =>
      runToolWithArguments(
        "gitea_repositories_rest",
        { operationId: prOperation.operationId, parameters: {} },
        mockedApiClient,
        new Set()
      ),
    (err) => err instanceof McpError
  );
});

test("REST tool rejects missing operationId", async () => {
  await assert.rejects(
    () => runToolWithArguments("gitea_repositories_rest", { parameters: {} }, mockedApiClient, new Set()),
    (err) => err instanceof McpError
  );
});

test("REST tool rejects unknown operationId", async () => {
  await assert.rejects(
    () =>
      runToolWithArguments(
        "gitea_repositories_rest",
        { operationId: "not/an/operation" },
        mockedApiClient,
        new Set()
      ),
    (err) => err instanceof McpError
  );
});

test("REST tool propagates McpError from API client", async () => {
  const operation = listOperationMappings("gitea_repositories_rest")[0];
  const failingClient = {
    async callRestByOperationId(): Promise<never> {
      throw new McpError(ErrorCode.InternalError, "Gitea API down");
    }
  };
  await assert.rejects(
    () =>
      runToolWithArguments(
        "gitea_repositories_rest",
        { operationId: operation.operationId, parameters: {} },
        failingClient,
        new Set()
      ),
    (err) => err instanceof McpError
  );
});

// ─── disabled tools ───────────────────────────────────────────────────────────

test("disabled tool returns McpError", async () => {
  await assert.rejects(
    () =>
      runToolWithArguments(
        "gitea_rest_list_operations",
        {},
        mockedApiClient,
        new Set(["gitea_rest_list_operations"])
      ),
    (err) => err instanceof McpError
  );
});

test("disabled family tool returns McpError", async () => {
  await assert.rejects(
    () =>
      runToolWithArguments(
        "gitea_repositories_rest",
        { operationId: listOperationMappings("gitea_repositories_rest")[0].operationId },
        mockedApiClient,
        new Set(["gitea_repositories_rest"])
      ),
    (err) => err instanceof McpError
  );
});

// ─── unknown tool ─────────────────────────────────────────────────────────────

test("unknown tool returns McpError", async () => {
  await assert.rejects(
    () => runToolWithArguments("not_a_real_tool", {}, mockedApiClient, new Set()),
    (err) => err instanceof McpError
  );
});

test("partially-matching tool name returns McpError", async () => {
  await assert.rejects(
    () => runToolWithArguments("gitea_repositories", {}, mockedApiClient, new Set()),
    (err) => err instanceof McpError
  );
});

// ─── token gating ─────────────────────────────────────────────────────────────

test("without token, listOperationMappings filters to only GET/HEAD operations", async () => {
  const allOpsOutput = await runToolWithArguments(
    "gitea_rest_list_operations",
    { limit: 1000 },
    mockedApiClient,
    new Set(),
    true
  );
  const allOps = JSON.parse(allOpsOutput) as { total: number; operations: Array<{ method: string }> };

  const limitedOpsOutput = await runToolWithArguments(
    "gitea_rest_list_operations",
    { limit: 1000 },
    mockedApiClient,
    new Set(),
    false
  );
  const limitedOps = JSON.parse(limitedOpsOutput) as { total: number; operations: Array<{ method: string }> };

  assert.ok(limitedOps.total < allOps.total, `Without token should have fewer ops. With: ${allOps.total}, without: ${limitedOps.total}`);

  for (const op of limitedOps.operations) {
    assert.ok(op.method === "GET" || op.method === "HEAD", `Expected GET/HEAD, got ${op.method}`);
  }
});

// ─── MCP_AUTH_TOKEN: extractRequestToken ─────────────────────────────────────

function makeMockRequest(headers: Record<string, string>): IncomingMessage {
  return { headers } as unknown as IncomingMessage;
}

test("extractRequestToken: returns token from Authorization Bearer header", () => {
  const req = makeMockRequest({ authorization: "Bearer mysecrettoken" });
  const url = new URL("http://localhost/");
  assert.equal(extractRequestToken(req, url), "mysecrettoken");
});

test("extractRequestToken: returns token from ?token= query param", () => {
  const req = makeMockRequest({});
  const url = new URL("http://localhost/?token=querysecret");
  assert.equal(extractRequestToken(req, url), "querysecret");
});

test("extractRequestToken: prefers Authorization header over query param", () => {
  const req = makeMockRequest({ authorization: "Bearer headertoken" });
  const url = new URL("http://localhost/?token=querytoken");
  assert.equal(extractRequestToken(req, url), "headertoken");
});

test("extractRequestToken: returns undefined when no token provided", () => {
  const req = makeMockRequest({});
  const url = new URL("http://localhost/");
  assert.equal(extractRequestToken(req, url), undefined);
});

test("extractRequestToken: returns undefined for non-Bearer Authorization header", () => {
  const req = makeMockRequest({ authorization: "Basic dXNlcjpwYXNz" });
  const url = new URL("http://localhost/");
  assert.equal(extractRequestToken(req, url), undefined);
});

// ─── MCP_AUTH_TOKEN: isAuthTokenValid ─────────────────────────────────────────

test("isAuthTokenValid: returns true when no mcpAuthToken configured", () => {
  const req = makeMockRequest({});
  const url = new URL("http://localhost/");
  assert.equal(isAuthTokenValid(req, url, undefined), true);
});

test("isAuthTokenValid: returns true when correct token in Authorization header", () => {
  const req = makeMockRequest({ authorization: "Bearer correcttoken" });
  const url = new URL("http://localhost/");
  assert.equal(isAuthTokenValid(req, url, "correcttoken"), true);
});

test("isAuthTokenValid: returns true when correct token in query param", () => {
  const req = makeMockRequest({});
  const url = new URL("http://localhost/?token=correcttoken");
  assert.equal(isAuthTokenValid(req, url, "correcttoken"), true);
});

test("isAuthTokenValid: returns false when wrong token provided", () => {
  const req = makeMockRequest({ authorization: "Bearer wrongtoken" });
  const url = new URL("http://localhost/");
  assert.equal(isAuthTokenValid(req, url, "correcttoken"), false);
});

test("isAuthTokenValid: returns false when no token provided but required", () => {
  const req = makeMockRequest({});
  const url = new URL("http://localhost/");
  assert.equal(isAuthTokenValid(req, url, "correcttoken"), false);
});

