import assert from "node:assert/strict";
import test from "node:test";
import { errorMessage } from "./error-message.js";

test("errorMessage preserves Error and structured RPC messages", () => {
  assert.equal(errorMessage(new Error("ordinary failure"), "fallback"), "ordinary failure");
  assert.equal(errorMessage({ code: -32000, message: "ledger pruned" }, "fallback"), "ledger pruned");
});

test("errorMessage uses the fallback for unknown or unsafe error shapes", () => {
  assert.equal(errorMessage(null, "fallback"), "fallback");
  assert.equal(errorMessage({ code: -32000 }, "fallback"), "fallback");
  assert.equal(errorMessage({ message: { detail: "do not serialize" } }, "fallback"), "fallback");
});
