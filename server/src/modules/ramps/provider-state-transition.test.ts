import assert from "node:assert/strict";
import test from "node:test";
import { canTransitionProviderState } from "./provider-state-transition.js";

test("provider completion can progress through a distinct refund lifecycle", () => {
  assert.equal(canTransitionProviderState("completed", "refund_pending"), true);
  assert.equal(canTransitionProviderState("completed", "refunded"), true);
  assert.equal(canTransitionProviderState("completed", "refund_failed"), true);
  assert.equal(canTransitionProviderState("refund_pending", "refunded"), true);
  assert.equal(canTransitionProviderState("refund_pending", "refund_failed"), true);
  assert.equal(canTransitionProviderState("refund_failed", "refund_pending"), true);
  assert.equal(canTransitionProviderState("refund_failed", "completed"), true);
});

test("provider regressions remain conflicts while unknown observations can recover", () => {
  assert.equal(canTransitionProviderState("completed", "processing"), false);
  assert.equal(canTransitionProviderState("refunded", "completed"), false);
  assert.equal(canTransitionProviderState("failed", "completed"), false);
  assert.equal(canTransitionProviderState("cancelled", "processing"), false);
  assert.equal(canTransitionProviderState("unknown", "processing"), true);
  assert.equal(canTransitionProviderState("processing", "unknown"), true);
});
