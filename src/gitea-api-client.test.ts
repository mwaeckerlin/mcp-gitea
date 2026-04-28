import assert from "node:assert/strict";
import test from "node:test";
import { normalizeGiteaError, redactSecrets, __testing } from "./gitea-api-client.js";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";

const { normalizeGiteaError: norm, redactSecrets: redact } = __testing;

// ── redactSecrets ─────────────────────────────────────────────────────────────

test("redactSecrets: redacts token in authorization messages", () => {
  const result = redact("Authorization: token abc123defghij");
  assert.ok(!result.includes("abc123defghij"), "token should be redacted");
  assert.ok(result.includes("[redacted]"), "should contain [redacted]");
});

test("redactSecrets: leaves unrelated strings alone", () => {
  const result = redact("hello world, no tokens here");
  assert.equal(result, "hello world, no tokens here");
});

test("redactSecrets: handles empty string", () => {
  assert.equal(redact(""), "");
});

// ── normalizeGiteaError ────────────────────────────────────────────────────────

test("normalizeGiteaError: returns McpError for 401", () => {
  const err = norm(401, "Unauthorized");
  assert.ok(err instanceof McpError);
  assert.ok(err.message.includes("401"));
});

test("normalizeGiteaError: returns McpError for 403", () => {
  const err = norm(403, "Forbidden");
  assert.ok(err instanceof McpError);
  assert.ok(err.message.includes("403"));
});

test("normalizeGiteaError: returns McpError for 404", () => {
  const err = norm(404, "Not found");
  assert.ok(err instanceof McpError);
  assert.ok(err.message.toLowerCase().includes("not found"));
});

test("normalizeGiteaError: returns McpError for other status codes", () => {
  const err = norm(500, "Internal server error");
  assert.ok(err instanceof McpError);
  assert.ok(err.message.includes("500"));
});

test("normalizeGiteaError: handles object data with message field", () => {
  const err = norm(422, { message: "validation failed" });
  assert.ok(err instanceof McpError);
  assert.ok(err.message.includes("validation failed"));
});

test("normalizeGiteaError: handles Error instance as data", () => {
  const err = norm(undefined, new Error("network failure"));
  assert.ok(err instanceof McpError);
  assert.ok(err.message.includes("network failure"));
});

test("normalizeGiteaError: handles unknown status (undefined)", () => {
  const err = norm(undefined, "some error");
  assert.ok(err instanceof McpError);
  assert.equal(err.code, ErrorCode.InternalError);
});

// ── module exports ─────────────────────────────────────────────────────────────

test("normalizeGiteaError exported from module", () => {
  assert.equal(typeof normalizeGiteaError, "function");
});

test("redactSecrets exported from module", () => {
  assert.equal(typeof redactSecrets, "function");
});
