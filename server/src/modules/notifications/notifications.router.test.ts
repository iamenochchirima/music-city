import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import { Keypair } from "@stellar/stellar-sdk";
import { notificationsRouter } from "./notifications.router.js";
import { notificationsService } from "./notifications.service.js";
import { tokenService } from "../../services/token.service.js";
import { errorHandler } from "../../middleware/error-handler.js";

test("inbox HTTP routes authenticate and derive recipient ownership from the session", async () => {
  const wallet = Keypair.random().publicKey();
  const token = tokenService.issueSession({
    walletAddress: wallet,
    displayName: "Recipient",
    primaryIntent: "artist",
    artistAccess: true,
    onboardingStatus: "complete",
    onboardingStep: "complete",
    onboardingVersion: 1,
    profileCompletion: {
      percentage: 100,
      completed: [],
      missing: [],
      requiredComplete: true,
    },
  });
  const original = { ...notificationsService };
  const calls: unknown[][] = [];
  notificationsService.list = async (recipient, cursor) => {
    calls.push(["list", recipient, cursor]);
    return { items: [], unreadCount: 0, nextCursor: null };
  };
  notificationsService.read = async (recipient, id) => {
    calls.push(["read", recipient, id]);
  };
  const app = express();
  app.use(express.json());
  app.use("/notifications", notificationsRouter);
  app.use(errorHandler);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}/notifications`;
  const id = "a".repeat(64);
  try {
    assert.equal((await fetch(base)).status, 401);
    assert.equal(
      (await fetch(base, { headers: { Authorization: "Bearer invalid" } }))
        .status,
      401,
    );
    assert.equal(calls.length, 0);
    const headers = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
    assert.equal(
      (await fetch(base + "?recipient=forged", { headers })).status,
      200,
    );
    assert.deepEqual(calls.pop(), ["list", wallet, undefined]);
    assert.equal(
      (await fetch(base + `?before=${id}`, { headers })).status,
      200,
    );
    assert.deepEqual(calls.pop(), ["list", wallet, id]);
    assert.equal(
      (await fetch(base + "?before=invalid", { headers })).status,
      400,
    );
    assert.equal(
      (
        await fetch(base + `/${id}/read`, {
          headers,
          method: "POST",
          body: JSON.stringify({ recipient: "forged" }),
        })
      ).status,
      204,
    );
    assert.deepEqual(calls.pop(), ["read", wallet, id]);
    assert.equal(
      (await fetch(base + "/read", { headers, method: "POST" })).status,
      204,
    );
    assert.deepEqual(calls.pop(), ["read", wallet, undefined]);
  } finally {
    Object.assign(notificationsService, original);
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
