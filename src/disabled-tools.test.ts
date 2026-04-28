import assert from "node:assert/strict";
import test from "node:test";
import { parseDisabledTools, loadDisabledToolsFromEnv, isToolDisabled } from "./disabled-tools.js";

// ─── parseDisabledTools ───────────────────────────────────────────────────────

test("parseDisabledTools: parses comma-separated list", () => {
  const set = parseDisabledTools("gitea_issues_rest,gitea_repositories_rest");
  assert.ok(set.has("gitea_issues_rest"));
  assert.ok(set.has("gitea_repositories_rest"));
  assert.equal(set.size, 2);
});

test("parseDisabledTools: trims whitespace around entries", () => {
  const set = parseDisabledTools("  gitea_issues_rest , gitea_repositories_rest  ");
  assert.ok(set.has("gitea_issues_rest"));
  assert.ok(set.has("gitea_repositories_rest"));
});

test("parseDisabledTools: handles whitespace-only string", () => {
  const set = parseDisabledTools("   ");
  assert.equal(set.size, 0);
});

test("parseDisabledTools: handles empty string", () => {
  const set = parseDisabledTools("");
  assert.equal(set.size, 0);
});

test("parseDisabledTools: handles newline-separated entries", () => {
  const set = parseDisabledTools("gitea_issues_rest\ngitea_repositories_rest");
  assert.ok(set.has("gitea_issues_rest"));
  assert.ok(set.has("gitea_repositories_rest"));
});

test("parseDisabledTools: ignores duplicate entries", () => {
  const set = parseDisabledTools("gitea_issues_rest,gitea_issues_rest");
  assert.equal(set.size, 1);
});

// ─── loadDisabledToolsFromEnv ─────────────────────────────────────────────────

test("loadDisabledToolsFromEnv: reads DISABLE_TOOLS env variable", () => {
  const set = loadDisabledToolsFromEnv({ DISABLE_TOOLS: "gitea_issues_rest" });
  assert.ok(set.has("gitea_issues_rest"));
});

test("loadDisabledToolsFromEnv: returns empty set when DISABLE_TOOLS not set", () => {
  const set = loadDisabledToolsFromEnv({});
  assert.equal(set.size, 0);
});

// ─── isToolDisabled ───────────────────────────────────────────────────────────

test("isToolDisabled: returns true when tool is in the set", () => {
  const set = new Set(["gitea_issues_rest"]);
  assert.equal(isToolDisabled("gitea_issues_rest", set), true);
});

test("isToolDisabled: returns false when tool is not in the set", () => {
  const set = new Set(["gitea_issues_rest"]);
  assert.equal(isToolDisabled("gitea_repositories_rest", set), false);
});

test("isToolDisabled: returns false for empty set", () => {
  assert.equal(isToolDisabled("gitea_issues_rest", new Set()), false);
});
