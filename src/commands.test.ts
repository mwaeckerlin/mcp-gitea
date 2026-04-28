import assert from "node:assert/strict";
import test from "node:test";
import { McpError } from "@modelcontextprotocol/sdk/types.js";
import { isHttpToolName, loadGatewayConfig, validateHttpToolArguments, isRestToolFamilyName, assertRestToolFamilyName } from "./commands.js";

// ─── isHttpToolName ───────────────────────────────────────────────────────────

test("isHttpToolName: true for gitea_rest_list_operations", () => {
  assert.equal(isHttpToolName("gitea_rest_list_operations"), true);
});

test("isHttpToolName: false for REST family tool names", () => {
  assert.equal(isHttpToolName("gitea_repositories_rest"), false);
  assert.equal(isHttpToolName("gitea_pull_requests_rest"), false);
});

test("isHttpToolName: false for completely unknown names", () => {
  assert.equal(isHttpToolName("not_a_tool"), false);
  assert.equal(isHttpToolName(""), false);
});

// ─── loadGatewayConfig ────────────────────────────────────────────────────────

test("loadGatewayConfig: reads port correctly", () => {
  const config = loadGatewayConfig({ GITEA_TOKEN: "tok", GITEA_URL: "https://gitea.example.com", MCP_GITEA_PORT: "4020" });
  assert.equal(config.port, 4020);
  assert.equal(config.giteaToken, "tok");
});

test("loadGatewayConfig: defaults port to 4000 and host to 0.0.0.0", () => {
  const config = loadGatewayConfig({ GITEA_TOKEN: "tok", GITEA_URL: "https://gitea.example.com" });
  assert.equal(config.port, 4000);
  assert.equal(config.host, "0.0.0.0");
});

test("loadGatewayConfig: accepts missing GITEA_TOKEN and marks token as undefined", () => {
  const config = loadGatewayConfig({ GITEA_URL: "https://gitea.example.com" });
  assert.equal(config.giteaToken, undefined);
});

test("loadGatewayConfig: accepts blank GITEA_TOKEN as undefined", () => {
  const config = loadGatewayConfig({ GITEA_TOKEN: "   ", GITEA_URL: "https://gitea.example.com" });
  assert.equal(config.giteaToken, undefined);
});

test("loadGatewayConfig: throws when GITEA_URL is missing", () => {
  assert.throws(() => loadGatewayConfig({ GITEA_TOKEN: "tok" }), /GITEA_URL/);
});

test("loadGatewayConfig: throws when MCP_GITEA_PORT is non-numeric", () => {
  assert.throws(() => loadGatewayConfig({ GITEA_TOKEN: "tok", GITEA_URL: "https://gitea.example.com", MCP_GITEA_PORT: "abc" }), /MCP_GITEA_PORT/);
});

test("loadGatewayConfig: throws when MCP_GITEA_PORT is out of range", () => {
  assert.throws(() => loadGatewayConfig({ GITEA_TOKEN: "tok", GITEA_URL: "https://gitea.example.com", MCP_GITEA_PORT: "0" }), /MCP_GITEA_PORT/);
  assert.throws(() => loadGatewayConfig({ GITEA_TOKEN: "tok", GITEA_URL: "https://gitea.example.com", MCP_GITEA_PORT: "65536" }), /MCP_GITEA_PORT/);
});

// ─── validateHttpToolArguments ────────────────────────────────────────────────

test("validateHttpToolArguments: clamps limit above 100", () => {
  const parsed = validateHttpToolArguments("gitea_rest_list_operations", { limit: 500, offset: 0 });
  assert.equal(parsed.limit, 100);
});

test("validateHttpToolArguments: clamps offset above 10000", () => {
  const parsed = validateHttpToolArguments("gitea_rest_list_operations", { limit: 10, offset: 20000 });
  assert.equal(parsed.offset, 10000);
});

test("validateHttpToolArguments: accepts undefined arguments and applies defaults", () => {
  const parsed = validateHttpToolArguments("gitea_rest_list_operations", undefined);
  assert.equal(parsed.limit, 50);
  assert.equal(parsed.offset, 0);
});

test("validateHttpToolArguments: rejects non-number limit", () => {
  assert.throws(() => validateHttpToolArguments("gitea_rest_list_operations", { limit: "ten" }));
});

test("validateHttpToolArguments: rejects negative offset", () => {
  assert.throws(() => validateHttpToolArguments("gitea_rest_list_operations", { offset: -1 }));
});

// ─── isRestToolFamilyName ─────────────────────────────────────────────────────

test("isRestToolFamilyName: true for all defined family names", () => {
  assert.equal(isRestToolFamilyName("gitea_repositories_rest"), true);
  assert.equal(isRestToolFamilyName("gitea_pull_requests_rest"), true);
  assert.equal(isRestToolFamilyName("gitea_issues_rest"), true);
  assert.equal(isRestToolFamilyName("gitea_users_rest"), true);
  assert.equal(isRestToolFamilyName("gitea_organizations_rest"), true);
  assert.equal(isRestToolFamilyName("gitea_rest_misc"), true);
});

test("isRestToolFamilyName: false for non-family names", () => {
  assert.equal(isRestToolFamilyName("gitea_rest_list_operations"), false);
  assert.equal(isRestToolFamilyName(""), false);
  assert.equal(isRestToolFamilyName("github_issues_rest"), false);
});

// ─── assertRestToolFamilyName ─────────────────────────────────────────────────

test("assertRestToolFamilyName: returns name for valid family", () => {
  assert.equal(assertRestToolFamilyName("gitea_repositories_rest"), "gitea_repositories_rest");
});

test("assertRestToolFamilyName: throws McpError for unknown name", () => {
  assert.throws(() => assertRestToolFamilyName("unknown_tool"), (err) => err instanceof McpError);
});
