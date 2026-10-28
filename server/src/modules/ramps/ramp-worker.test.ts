import assert from "node:assert/strict";
import test from "node:test";
import type { RampOrder } from "@music-city/shared";
import { reconcileRampOrders } from "./ramp-worker.js";

test("reconciliation isolates provider errors and never treats missing records as success", async () => {
  const queue = ["failed-lookup", "missing", "observed"].map((id) => ({ id }) as RampOrder);
  const released: Array<[string, string | null]> = [];
  const saved: string[] = [];
  const repository = {
    async lease() { const order = queue.shift(); return order ? { order, token: `lease-${order.id}` } : null; },
    async observe(id: string) { saved.push(id); },
    async recordIncomingDelivery() { assert.fail("unexpected delivery"); },
    async release(id: string, token: string, error: "provider_check_failed" | "delivery_check_failed" | null) { assert.equal(token, `lease-${id}`); released.push([id, error]); },
  };
  await reconcileRampOrders(repository, {
    async lookup(order) {
      if (order.id === "failed-lookup") throw new Error("provider error");
      if (order.id === "missing") return null;
      return { id: "provider", externalId: order.id, state: "processing", originalStatus: "pending", updatedAt: "2026-10-28T00:00:00.000Z" };
    },
  });
  assert.deepEqual(saved, ["observed"]);
  assert.deepEqual(released, [["failed-lookup", "provider_check_failed"], ["missing", null], ["observed", null]]);
});

test("reconciliation bounds work per cycle and backs off on persistence errors", async () => {
  let leases = 0;
  const released: Array<string | null> = [];
  await reconcileRampOrders({
    async lease() { leases++; return { order: { id: String(leases) } as RampOrder, token: "lease" }; },
    async observe() { throw new Error("database error"); },
    async recordIncomingDelivery() { assert.fail("unexpected delivery"); },
    async release(_id, _token, error) { released.push(error); },
  }, {
    async lookup(order) {
      return { id: "provider", externalId: order.id, state: "processing", originalStatus: "pending", updatedAt: "2026-10-28T00:00:00.000Z" };
    },
  }, 2);
  assert.equal(leases, 2);
  assert.deepEqual(released, ["provider_check_failed", "provider_check_failed"]);
});


test("the worker confirms a delivery only after provider observation and chain verification", async () => {
  const order = { id: "one", terms: { direction: "buy" } } as RampOrder;
  const steps: string[] = [];
  const observation = { id: "provider", externalId: "one", state: "completed" as const, originalStatus: "completed", updatedAt: "2026-10-28T00:00:00.000Z", chainHash: "a".repeat(64), assetUnits: "10" };
  const receipt = { transactionHash: "a".repeat(64), operationId: "123", ledger: 1, assetUnits: "10" };
  await reconcileRampOrders({
    async lease() { return { order, token: "lease" }; },
    async observe() { steps.push("provider"); },
    async recordIncomingDelivery(_id, _observation, result, token) { assert.deepEqual(result, receipt); assert.equal(token, "lease"); steps.push("saved"); },
    async release(_id, _token, error) { assert.equal(error, null); steps.push("released"); },
  }, { async lookup() { return observation; } }, 1, async () => { steps.push("verified"); return receipt; });
  assert.deepEqual(steps, ["provider", "verified", "saved", "released"]);
});


test("the worker records delivery verification errors separately from provider errors", async () => {
  let result: string | null = null;
  const order = { id: "one", terms: { direction: "buy" } } as RampOrder;
  await reconcileRampOrders({
    async lease() { return { order, token: "lease" }; }, async observe() {},
    async recordIncomingDelivery() { assert.fail("unverified delivery must not be saved"); },
    async release(_id, _token, error) { result = error; },
  }, { async lookup() { return { id: "provider", externalId: "one", state: "completed", originalStatus: "completed", updatedAt: "2026-10-28T00:00:00.000Z", chainHash: "a".repeat(64), assetUnits: "10" }; } }, 1,
  async () => { throw new Error("Stellar unavailable"); });
  assert.equal(result, "delivery_check_failed");
});
