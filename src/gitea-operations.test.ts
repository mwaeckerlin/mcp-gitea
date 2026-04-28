import assert from "node:assert/strict";
import test from "node:test";
import { loadGiteaOperations } from "./gitea-operations.js";

test("loadGiteaOperations: returns a non-empty array of operations", () => {
  const ops = loadGiteaOperations();
  assert.ok(ops.length > 0, `expected operations, got ${ops.length}`);
});

test("loadGiteaOperations: all operations have required fields", () => {
  const ops = loadGiteaOperations();
  for (const op of ops) {
    assert.ok(typeof op.operationId === "string" && op.operationId.length > 0, `missing operationId: ${JSON.stringify(op)}`);
    assert.ok(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"].includes(op.method), `invalid method ${op.method} for ${op.operationId}`);
    assert.ok(typeof op.path === "string" && op.path.startsWith("/"), `invalid path for ${op.operationId}`);
    assert.ok(Array.isArray(op.tags), `tags not array for ${op.operationId}`);
    assert.ok(Array.isArray(op.parameterNames), `parameterNames not array for ${op.operationId}`);
  }
});

test("loadGiteaOperations: operation IDs are unique", () => {
  const ops = loadGiteaOperations();
  const ids = new Set<string>();
  for (const op of ops) {
    assert.ok(!ids.has(op.operationId), `duplicate operationId: ${op.operationId}`);
    ids.add(op.operationId);
  }
});

test("loadGiteaOperations: operations are sorted by operationId", () => {
  const ops = loadGiteaOperations();
  for (let i = 1; i < ops.length; i++) {
    assert.ok(
      ops[i - 1].operationId.localeCompare(ops[i].operationId) <= 0,
      `operations not sorted: ${ops[i - 1].operationId} > ${ops[i].operationId}`
    );
  }
});

test("loadGiteaOperations: contains operations from each expected tag", () => {
  const ops = loadGiteaOperations();
  const tagSet = new Set(ops.flatMap((op) => op.tags));
  assert.ok(tagSet.has("issue"), "expected tag 'issue'");
  assert.ok(tagSet.has("repository"), "expected tag 'repository'");
  assert.ok(tagSet.has("pull-request"), "expected tag 'pull-request'");
  assert.ok(tagSet.has("user"), "expected tag 'user'");
  assert.ok(tagSet.has("organization"), "expected tag 'organization'");
  assert.ok(tagSet.has("notification"), "expected tag 'notification'");
});

test("loadGiteaOperations: contains key issue operations", () => {
  const ops = loadGiteaOperations();
  const ids = new Set(ops.map((op) => op.operationId));
  assert.ok(ids.has("issueListIssues"), "expected issueListIssues");
  assert.ok(ids.has("issueCreateIssue"), "expected issueCreateIssue");
  assert.ok(ids.has("issueGetIssue"), "expected issueGetIssue");
  assert.ok(ids.has("issueEditIssue"), "expected issueEditIssue");
});

test("loadGiteaOperations: contains key repository operations", () => {
  const ops = loadGiteaOperations();
  const ids = new Set(ops.map((op) => op.operationId));
  assert.ok(ids.has("repoGet"), "expected repoGet");
  assert.ok(ids.has("repoSearch"), "expected repoSearch");
  assert.ok(ids.has("repoGetContents"), "expected repoGetContents");
  assert.ok(ids.has("repoListBranches"), "expected repoListBranches");
});

test("loadGiteaOperations: contains key pull request operations", () => {
  const ops = loadGiteaOperations();
  const ids = new Set(ops.map((op) => op.operationId));
  assert.ok(ids.has("repoListPullRequests"), "expected repoListPullRequests");
  assert.ok(ids.has("repoCreatePullRequest"), "expected repoCreatePullRequest");
  assert.ok(ids.has("repoMergePullRequest"), "expected repoMergePullRequest");
});

test("loadGiteaOperations: contains key user operations", () => {
  const ops = loadGiteaOperations();
  const ids = new Set(ops.map((op) => op.operationId));
  assert.ok(ids.has("userGetCurrent"), "expected userGetCurrent");
  assert.ok(ids.has("userGetByLogin"), "expected userGetByLogin");
  assert.ok(ids.has("userSearch"), "expected userSearch");
});

test("loadGiteaOperations: contains key org operations", () => {
  const ops = loadGiteaOperations();
  const ids = new Set(ops.map((op) => op.operationId));
  assert.ok(ids.has("orgGet"), "expected orgGet");
  assert.ok(ids.has("orgCreate"), "expected orgCreate");
  assert.ok(ids.has("orgListMembers"), "expected orgListMembers");
});
