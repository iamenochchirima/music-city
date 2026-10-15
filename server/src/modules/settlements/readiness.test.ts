import assert from "node:assert/strict";
import test from "node:test";
import { settlementChain } from "./settlement-chain.js";
import type { SettlementConfig } from "@music-city/shared";
const config = { assetCode: "USDC", assetIssuer: "issuer" } as SettlementConfig;
test("financial readiness checks trustline authorization, limits, liabilities, USDC and spendable XLM", async () => {
  const original = globalThis.fetch;
  const line = {
    asset_type: "credit_alphanum4",
    asset_code: "USDC",
    asset_issuer: "issuer",
    balance: "100",
    limit: "200",
    is_authorized: true,
    buying_liabilities: "0",
    selling_liabilities: "0",
  };
  let account = {
    subentry_count: 1,
    balances: [
      { asset_type: "native", balance: "10", selling_liabilities: "0" },
      { ...line },
    ],
  };
  globalThis.fetch = async (input) =>
    new Response(
      JSON.stringify(
        String(input).includes("/ledgers?")
          ? { _embedded: { records: [{ base_reserve_in_stroops: 5000000 }] } }
          : account,
      ),
      { status: 200 },
    );
  try {
    assert.equal(
      (await settlementChain.readiness("wallet", config, "700000000", true))
        .nativeAvailableUnits,
      85000000n,
    );
    await assert.rejects(
      settlementChain.readiness("wallet", config, "1010000000", false),
      /insufficient USDC/,
    );
    await assert.rejects(
      settlementChain.readiness("wallet", config, "1010000000", true),
      /trustline limit/,
    );
    account.balances[1] = { ...line, is_authorized: false };
    await assert.rejects(
      settlementChain.readiness("wallet", config, "1", true),
      /not authorized/,
    );
    account.balances[1] = { ...line, asset_issuer: "foreign" };
    await assert.rejects(
      settlementChain.readiness("wallet", config, "1", true),
      /Add the configured USDC trustline/,
    );
    account.balances[1] = { ...line };
    account.balances[0] = {
      asset_type: "native",
      balance: "1.5",
      selling_liabilities: "0",
    };
    await assert.rejects(
      settlementChain.readiness("wallet", config, "1", true),
      /above your account reserve/,
    );
    globalThis.fetch = async () => new Response("", { status: 404 });
    await assert.rejects(
      settlementChain.readiness("wallet", config, "1", true),
      /Fund this Stellar account/,
    );
  } finally {
    globalThis.fetch = original;
  }
});
