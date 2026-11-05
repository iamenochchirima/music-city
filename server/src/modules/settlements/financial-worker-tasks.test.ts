import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createFinancialWorkerTasks,
  runFinancialWorkerTasks,
  type FinancialWorkerActions,
} from "./financial-worker-tasks.js";

const actions = (run: (name: string) => Promise<unknown>): FinancialWorkerActions => ({
  agreementFinalization: () => run("agreement"),
  supportPayments: () => run("support"),
  trackCheckout: () => run("checkout"),
  settlement: () => run("settlement"),
  ramp: () => run("ramp"),
  cashOut: () => run("cash-out"),
});

test("unverified settlement configuration leaves ramp and cash-out scheduled", async () => {
  const ran: string[] = [];
  const tasks = createFinancialWorkerTasks(
    actions(async (name) => void ran.push(name)),
    { settlementReady: false },
  );

  assert.deepEqual(tasks.map(({ name }) => name), [
    "Agreement finalization",
    "Support payments",
    "Track checkout",
    "Ramp",
    "Cash-out",
  ]);
  await runFinancialWorkerTasks(tasks, assert.fail);
  assert.deepEqual(ran, ["agreement", "support", "checkout", "ramp", "cash-out"]);
});

test("a failed worker task does not prevent later independent tasks", async () => {
  const completed: string[] = [];
  const failures: string[] = [];

  await runFinancialWorkerTasks(
    createFinancialWorkerTasks(
      actions(async (name) => {
        if (name === "settlement") throw new Error("settlement configuration unavailable");
        completed.push(name);
      }),
    ),
    (name) => failures.push(name),
  );

  assert.deepEqual(failures, ["Settlement"]);
  assert.deepEqual(completed, ["agreement", "support", "checkout", "ramp", "cash-out"]);
});
