import assert from "node:assert/strict";
import test from "node:test";
import { listOperationMappings } from "./tools.js";
import { loadServerConfigFromEnv, validateOperationListArguments, validateRestCallArguments } from "./validation.js";
import { McpError } from "@modelcontextprotocol/sdk/types.js";

// ─── loadServerConfigFromEnv ──────────────────────────────────────────────────

test("loadServerConfigFromEnv: accepts valid configuration", () => {
  const config = loadServerConfigFromEnv({
    GITEA_TOKEN: "mytoken",
    GITEA_URL: "https://gitea.example.com",
    MCP_GITEA_HOST: "127.0.0.1",
    MCP_GITEA_PORT: "4010",
    DISABLE_TOOLS: "gitea_issues_rest,gitea_rest_misc"
  });
  assert.equal(config.giteaToken, "mytoken");
  assert.equal(config.giteaUrl, "https://gitea.example.com");
  assert.equal(config.host, "127.0.0.1");
  assert.equal(config.port, 4010);
  assert.ok(config.disabledTools.has("gitea_issues_rest"));
  assert.ok(config.disabledTools.has("gitea_rest_misc"));
});

test("loadServerConfigFromEnv: defaults host to 0.0.0.0 and port to 4000", () => {
  const config = loadServerConfigFromEnv({ GITEA_TOKEN: "tok", GITEA_URL: "https://gitea.example.com" });
  assert.equal(config.host, "0.0.0.0");
  assert.equal(config.port, 4000);
  assert.equal(config.disabledTools.size, 0);
});

test("loadServerConfigFromEnv: accepts missing GITEA_TOKEN and marks token as undefined", () => {
  const config = loadServerConfigFromEnv({ GITEA_URL: "https://gitea.example.com" });
  assert.equal(config.giteaToken, undefined);
});

test("loadServerConfigFromEnv: accepts whitespace-only GITEA_TOKEN as undefined", () => {
  const config = loadServerConfigFromEnv({ GITEA_TOKEN: "   ", GITEA_URL: "https://gitea.example.com" });
  assert.equal(config.giteaToken, undefined);
});

test("loadServerConfigFromEnv: throws when GITEA_URL is missing", () => {
  assert.throws(() => loadServerConfigFromEnv({ GITEA_TOKEN: "tok" }), /GITEA_URL/);
});

test("loadServerConfigFromEnv: throws when GITEA_URL is empty", () => {
  assert.throws(() => loadServerConfigFromEnv({ GITEA_TOKEN: "tok", GITEA_URL: "" }), /GITEA_URL/);
});

test("loadServerConfigFromEnv: throws when MCP_GITEA_PORT is non-numeric", () => {
  assert.throws(() => loadServerConfigFromEnv({ GITEA_TOKEN: "tok", GITEA_URL: "https://gitea.example.com", MCP_GITEA_PORT: "xyz" }), /MCP_GITEA_PORT/);
});

test("loadServerConfigFromEnv: throws when MCP_GITEA_PORT is 0", () => {
  assert.throws(() => loadServerConfigFromEnv({ GITEA_TOKEN: "tok", GITEA_URL: "https://gitea.example.com", MCP_GITEA_PORT: "0" }), /MCP_GITEA_PORT/);
});

test("loadServerConfigFromEnv: accepts MCP_AUTH_TOKEN", () => {
  const config = loadServerConfigFromEnv({
    GITEA_TOKEN: "mytoken",
    GITEA_URL: "https://gitea.example.com",
    MCP_AUTH_TOKEN: "supersecrettoken"
  });
  assert.equal(config.mcpAuthToken, "supersecrettoken");
});

test("loadServerConfigFromEnv: mcpAuthToken is undefined when not set", () => {
  const config = loadServerConfigFromEnv({ GITEA_TOKEN: "tok", GITEA_URL: "https://gitea.example.com" });
  assert.equal(config.mcpAuthToken, undefined);
});

test("loadServerConfigFromEnv: whitespace-only MCP_AUTH_TOKEN treated as undefined", () => {
  const config = loadServerConfigFromEnv({
    GITEA_TOKEN: "tok",
    GITEA_URL: "https://gitea.example.com",
    MCP_AUTH_TOKEN: "   "
  });
  assert.equal(config.mcpAuthToken, undefined);
});

// ─── validateOperationListArguments ──────────────────────────────────────────

test("validateOperationListArguments: defaults limit to 50 and offset to 0", () => {
  const parsed = validateOperationListArguments(undefined);
  assert.equal(parsed.limit, 50);
  assert.equal(parsed.offset, 0);
  assert.equal(parsed.family, undefined);
});

test("validateOperationListArguments: accepts valid family filter", () => {
  const parsed = validateOperationListArguments({ family: "gitea_pull_requests_rest" });
  assert.equal(parsed.family, "gitea_pull_requests_rest");
});

test("validateOperationListArguments: clamps limit above 100", () => {
  const parsed = validateOperationListArguments({ limit: 999 });
  assert.equal(parsed.limit, 100);
});

test("validateOperationListArguments: clamps limit below 1 to 1", () => {
  const parsed = validateOperationListArguments({ limit: 0 });
  assert.equal(parsed.limit, 1);
});

test("validateOperationListArguments: clamps offset above 10000", () => {
  const parsed = validateOperationListArguments({ offset: 99999 });
  assert.equal(parsed.offset, 10000);
});

test("validateOperationListArguments: rejects unknown family string", () => {
  assert.throws(
    () => validateOperationListArguments({ family: "gitea_nonexistent_rest" }),
    (err) => err instanceof McpError
  );
});

test("validateOperationListArguments: rejects non-number limit", () => {
  assert.throws(
    () => validateOperationListArguments({ limit: "ten" }),
    (err) => err instanceof McpError
  );
});

test("validateOperationListArguments: rejects negative offset", () => {
  assert.throws(
    () => validateOperationListArguments({ offset: -1 }),
    (err) => err instanceof McpError
  );
});

test("validateOperationListArguments: rejects non-integer offset", () => {
  assert.throws(
    () => validateOperationListArguments({ offset: 1.5 }),
    (err) => err instanceof McpError
  );
});

test("validateOperationListArguments: rejects non-object arguments", () => {
  assert.throws(
    () => validateOperationListArguments("not-an-object"),
    (err) => err instanceof McpError
  );
});

// ─── validateRestCallArguments ────────────────────────────────────────────────

test("validateRestCallArguments: accepts valid args in correct family", () => {
  const operationId = listOperationMappings("gitea_issues_rest")[0].operationId;
  const parsed = validateRestCallArguments("gitea_issues_rest", {
    operationId,
    parameters: { owner: "testorg", repo: "testrepo" }
  });
  assert.equal(parsed.operationId, operationId);
  assert.equal((parsed.parameters as { owner: string }).owner, "testorg");
});

test("validateRestCallArguments: clamps limit to max 100", () => {
  const operationId = listOperationMappings("gitea_issues_rest").find((m) => m.parameterNames.includes("limit"))?.operationId;
  assert.ok(operationId, "expected an operation with limit param");
  const parsed = validateRestCallArguments("gitea_issues_rest", {
    operationId,
    parameters: { limit: 400 }
  });
  assert.equal((parsed.parameters as { limit: number }).limit, 100);
});

test("validateRestCallArguments: defaults limit when supported and missing", () => {
  const operationId = listOperationMappings("gitea_issues_rest").find((m) => m.parameterNames.includes("limit"))?.operationId;
  assert.ok(operationId, "expected an operation with limit param");
  const parsed = validateRestCallArguments("gitea_issues_rest", {
    operationId,
    parameters: {}
  });
  assert.equal((parsed.parameters as { limit?: number }).limit, 30);
});

test("validateRestCallArguments: rejects missing operationId", () => {
  assert.throws(
    () => validateRestCallArguments("gitea_repositories_rest", { parameters: {} }),
    (err) => err instanceof McpError
  );
});

test("validateRestCallArguments: rejects empty operationId string", () => {
  assert.throws(
    () => validateRestCallArguments("gitea_repositories_rest", { operationId: "   " }),
    (err) => err instanceof McpError
  );
});

test("validateRestCallArguments: rejects unknown operationId", () => {
  assert.throws(
    () => validateRestCallArguments("gitea_repositories_rest", { operationId: "fake/operation" }),
    (err) => err instanceof McpError
  );
});

test("validateRestCallArguments: rejects operationId from a different family", () => {
  const prOpId = listOperationMappings("gitea_pull_requests_rest")[0].operationId;
  assert.throws(
    () => validateRestCallArguments("gitea_repositories_rest", { operationId: prOpId, parameters: {} }),
    (err) => err instanceof McpError
  );
});

test("validateRestCallArguments: rejects non-object arguments", () => {
  assert.throws(
    () => validateRestCallArguments("gitea_repositories_rest", null),
    (err) => err instanceof McpError
  );
});
