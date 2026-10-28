import assert from "node:assert/strict";
import test from "node:test";
import type { RampOrder } from "@music-city/shared";
import { reconcileRampOrders } from "./ramp-worker.js";

test("reconciliation isolates provider errors and never treats missing records as success", async () => {
  const queue = ["failed-lookup", "missing", "observed"].map((id) => ({ id }) as RampOrder);
  const released: Array<[string, boolean]> = [];
  const saved: string[] = [];
  const repository = {
    async lease() { return queue.shift() ?? null; },
    async observe(id: string) { saved.push(id); },
    async release(id: string, failed: boolean) { released.push([id, failed]); },
  };
  await reconcileRampOrders(repository, {
    async lookup(order) {
      if (order.id === "failed-lookup") throw new Error("provider error");
      if (order.id === "missing") return null;
      return { id: "provider", externalId: order.id, state: "processing", originalStatus: "pending", updatedAt: "2026-10-28T00:00:00.000Z" };
    },
  });
  assert.deepEqual(saved, ["observed"]);
  assert.deepEqual(released, [["failed-lookup", true], ["missing", false], ["observed", false]]);
});

test("reconciliation bounds work per cycle and backs off on persistence errors", async () => {
  let leases = 0;
  const released: boolean[] = [];
  await reconcileRampOrders({
    async lease() { leases++; return { id: String(leases) } as RampOrder; },
    async observe() { throw new Error("database error"); },
    async release(_id, failed) { released.push(failed); },
  }, {
    async lookup(order) {
      return { id: "provider", externalId: order.id, state: "processing", originalStatus: "pending", updatedAt: "2026-10-28T00:00:00.000Z" };
    },
  }, 2);
  assert.equal(leases, 2);
  assert.deepEqual(released, [true, true]);
});
