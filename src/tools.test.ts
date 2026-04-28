import assert from "node:assert/strict";
import test from "node:test";
import { getToolDefinitions, getOperationFamily, listOperationMappings } from "./tools.js";
import { REST_TOOL_FAMILY_NAMES } from "./tool-families.js";

// ─── getToolDefinitions ───────────────────────────────────────────────────────

test("getToolDefinitions: includes gitea_rest_list_operations", () => {
  const defs = getToolDefinitions();
  assert.ok(defs.some((d) => d.name === "gitea_rest_list_operations"), "expected gitea_rest_list_operations");
});

test("getToolDefinitions: includes all REST family tools", () => {
  const defs = getToolDefinitions();
  const names = new Set(defs.map((d) => d.name));
  for (const family of REST_TOOL_FAMILY_NAMES) {
    assert.ok(names.has(family), `missing family tool ${family}`);
  }
});

test("getToolDefinitions: respects disabled tools filter", () => {
  const defs = getToolDefinitions(new Set(["gitea_issues_rest"]));
  assert.ok(!defs.some((d) => d.name === "gitea_issues_rest"), "gitea_issues_rest should be excluded");
  assert.ok(defs.some((d) => d.name === "gitea_repositories_rest"), "gitea_repositories_rest should still be included");
});

test("getToolDefinitions: each tool has name, description, and inputSchema", () => {
  const defs = getToolDefinitions();
  for (const def of defs) {
    assert.ok(typeof def.name === "string" && def.name.length > 0);
    assert.ok(typeof def.description === "string" && def.description.length > 0);
    assert.ok(def.inputSchema && typeof def.inputSchema === "object");
  }
});

// ─── getOperationFamily ───────────────────────────────────────────────────────

test("getOperationFamily: returns family for known operation", () => {
  const family = getOperationFamily("issueListIssues");
  assert.equal(family, "gitea_issues_rest");
});

test("getOperationFamily: returns family for repo operation", () => {
  const family = getOperationFamily("repoGet");
  assert.equal(family, "gitea_repositories_rest");
});

test("getOperationFamily: returns family for user operation", () => {
  const family = getOperationFamily("userGetCurrent");
  assert.equal(family, "gitea_users_rest");
});

test("getOperationFamily: returns undefined for unknown operation", () => {
  const family = getOperationFamily("notARealOperation");
  assert.equal(family, undefined);
});

// ─── listOperationMappings ────────────────────────────────────────────────────

test("listOperationMappings: returns all operations when no family filter", () => {
  const mappings = listOperationMappings();
  assert.ok(mappings.length > 0, "expected operations");
});

test("listOperationMappings: returns sorted operations", () => {
  const mappings = listOperationMappings();
  for (let i = 1; i < mappings.length; i++) {
    assert.ok(
      mappings[i - 1].operationId.localeCompare(mappings[i].operationId) <= 0,
      `operations not sorted: ${mappings[i - 1].operationId} > ${mappings[i].operationId}`
    );
  }
});

test("listOperationMappings: family filter returns only matching family", () => {
  const mappings = listOperationMappings("gitea_issues_rest");
  assert.ok(mappings.length > 0, "expected issue operations");
  for (const m of mappings) {
    assert.equal(m.family, "gitea_issues_rest");
  }
});

test("listOperationMappings: each mapping has required fields", () => {
  const mappings = listOperationMappings();
  for (const m of mappings) {
    assert.ok(typeof m.operationId === "string");
    assert.ok(typeof m.family === "string");
    assert.ok(typeof m.method === "string");
    assert.ok(typeof m.path === "string");
    assert.ok(Array.isArray(m.parameterNames));
  }
});
