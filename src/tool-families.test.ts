import assert from "node:assert/strict";
import test from "node:test";
import { classifyOperationToFamily, getRestToolFamilies, REST_TOOL_FAMILY_NAMES } from "./tool-families.js";
import { loadGiteaOperations } from "./gitea-operations.js";

// ─── REST_TOOL_FAMILY_NAMES ───────────────────────────────────────────────────

test("REST_TOOL_FAMILY_NAMES: contains all expected Gitea families", () => {
  const names = new Set(REST_TOOL_FAMILY_NAMES);
  assert.ok(names.has("gitea_issues_rest"));
  assert.ok(names.has("gitea_pull_requests_rest"));
  assert.ok(names.has("gitea_repositories_rest"));
  assert.ok(names.has("gitea_users_rest"));
  assert.ok(names.has("gitea_organizations_rest"));
  assert.ok(names.has("gitea_notifications_rest"));
  assert.ok(names.has("gitea_rest_misc"));
});

// ─── classifyOperationToFamily ────────────────────────────────────────────────

test("classifyOperationToFamily: issue operations go to gitea_issues_rest", () => {
  const ops = loadGiteaOperations().filter((op) => op.operationId.startsWith("issue") && !op.operationId.toLowerCase().includes("pull"));
  assert.ok(ops.length > 0, "expected issue operations");
  for (const op of ops) {
    const family = classifyOperationToFamily(op);
    assert.equal(family, "gitea_issues_rest", `expected gitea_issues_rest for ${op.operationId}, got ${family}`);
  }
});

test("classifyOperationToFamily: pull request operations go to gitea_pull_requests_rest", () => {
  const ops = loadGiteaOperations().filter((op) => op.tags.includes("pull-request"));
  assert.ok(ops.length > 0, "expected pull-request operations");
  for (const op of ops) {
    const family = classifyOperationToFamily(op);
    assert.equal(family, "gitea_pull_requests_rest", `expected gitea_pull_requests_rest for ${op.operationId}`);
  }
});

test("classifyOperationToFamily: repository operations go to gitea_repositories_rest", () => {
  const ops = loadGiteaOperations().filter((op) => op.tags.includes("repository"));
  assert.ok(ops.length > 0, "expected repository operations");
  for (const op of ops) {
    const family = classifyOperationToFamily(op);
    assert.equal(family, "gitea_repositories_rest", `expected gitea_repositories_rest for ${op.operationId}`);
  }
});

test("classifyOperationToFamily: user operations go to gitea_users_rest", () => {
  const ops = loadGiteaOperations().filter((op) => op.tags.includes("user"));
  assert.ok(ops.length > 0, "expected user operations");
  for (const op of ops) {
    const family = classifyOperationToFamily(op);
    assert.equal(family, "gitea_users_rest", `expected gitea_users_rest for ${op.operationId}`);
  }
});

test("classifyOperationToFamily: organization operations go to gitea_organizations_rest", () => {
  const ops = loadGiteaOperations().filter((op) => op.tags.includes("organization"));
  assert.ok(ops.length > 0, "expected organization operations");
  for (const op of ops) {
    const family = classifyOperationToFamily(op);
    assert.equal(family, "gitea_organizations_rest", `expected gitea_organizations_rest for ${op.operationId}`);
  }
});

test("classifyOperationToFamily: notification operations go to gitea_notifications_rest", () => {
  const ops = loadGiteaOperations().filter((op) => op.tags.includes("notification"));
  assert.ok(ops.length > 0, "expected notification operations");
  for (const op of ops) {
    const family = classifyOperationToFamily(op);
    assert.equal(family, "gitea_notifications_rest", `expected gitea_notifications_rest for ${op.operationId}`);
  }
});

test("classifyOperationToFamily: all operations are classified", () => {
  const ops = loadGiteaOperations();
  for (const op of ops) {
    const family = classifyOperationToFamily(op);
    assert.ok(REST_TOOL_FAMILY_NAMES.includes(family), `invalid family ${family} for ${op.operationId}`);
  }
});

// ─── getRestToolFamilies ─────────────────────────────────────────────────────

test("getRestToolFamilies: returns an entry for each family name", () => {
  const families = getRestToolFamilies();
  const familyNames = new Set(families.map((f) => f.name));
  for (const name of REST_TOOL_FAMILY_NAMES) {
    assert.ok(familyNames.has(name), `missing family ${name}`);
  }
});

test("getRestToolFamilies: each family has a non-empty description", () => {
  const families = getRestToolFamilies();
  for (const family of families) {
    assert.ok(typeof family.description === "string" && family.description.length > 0, `empty description for ${family.name}`);
  }
});
