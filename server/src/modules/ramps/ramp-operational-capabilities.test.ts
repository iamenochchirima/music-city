import assert from "node:assert/strict";
import test from "node:test";
import { createOperationalRampCapabilities, type VerifiedRampRoute } from "./ramp-service.js";

test("advertised routes require configuration, direct ingress and a verified supported adapter", async () => {
  const buy: VerifiedRampRoute = { provider: "moonpay", direction: "buy", environment: "sandbox", network: "stellar:testnet", assetCode: "XLM", market: { country: "GB", currency: "GBP", method: "card" }, amountDecimals: 2, minUnits: "1000", maxUnits: "100000", verifiedAt: "2026-10-01T00:00:00Z", expiresAt: "2027-01-01T00:00:00Z" };
  const sellUsdc: VerifiedRampRoute = { ...buy, direction: "sell", assetCode: "USDC", assetIssuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5", amountDecimals: 7, minUnits: "1000000", maxUnits: "10000000000" };
  const source = { async routes() { return [buy, { ...buy, direction: "sell" as const }, sellUsdc, { ...buy, provider: "moneygram" as const }]; } };
  const config = { NODE_ENV: "test", RAMPS_SANDBOX_ENABLED: "true", RAMPS_SANDBOX_ASSET: "XLM", RAMPS_LAUNCH_IP_MODE: "direct", RAMPS_LAUNCH_ENCRYPTION_KEY: "a".repeat(64), MOONPAY_PK: "pk_test_fixture", MOONPAY_SK: "sk_test_fixture", MOONPAY_WEBHOOK: "wk_test_fixture" };
  assert.deepEqual(await createOperationalRampCapabilities(source, () => config, 0).routes(), [buy]);
  assert.deepEqual(await createOperationalRampCapabilities(source, () => ({ ...config, RAMPS_SANDBOX_SELL_ENABLED: "true", RAMPS_CASHOUT_ENCRYPTION_KEY: "b".repeat(64) }), 0).routes(), [buy, sellUsdc]);
  assert.deepEqual(await createOperationalRampCapabilities(source, () => ({ ...config, RAMPS_SANDBOX_SELL_ENABLED: "true" }), 0).routes(), [buy]);
  assert.deepEqual(await createOperationalRampCapabilities(source, () => ({ ...config, RAMPS_SANDBOX_SELL_ENABLED: "true", RAMPS_CASHOUT_ENCRYPTION_KEY: "b".repeat(64), RAMPS_SANDBOX_PROVIDERS: "moneygram" }), 0).routes(), []);
  assert.deepEqual(await createOperationalRampCapabilities(source, () => ({ ...config, RAMPS_LAUNCH_IP_MODE: "disabled" }), 0).routes(), []);
  assert.deepEqual(await createOperationalRampCapabilities(source, () => ({ ...config, RAMPS_LAUNCH_ENCRYPTION_KEY: "" }), 0).routes(), []);
  assert.deepEqual(await createOperationalRampCapabilities(source, () => config, 1).routes(), []);
  assert.deepEqual(await createOperationalRampCapabilities({ routes: async () => [] }, () => config, 0).routes(), []);
});
