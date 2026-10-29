import assert from "node:assert/strict";
import test from "node:test";
import { Keypair } from "@stellar/stellar-sdk";
import { checkRampSandboxReadiness } from "./sandbox-readiness.js";
import { rampSandboxConfigSchema } from "./sandbox-config.js";

const wallet = Keypair.random().publicKey();
const configuration = () =>
  rampSandboxConfigSchema.parse({
    NODE_ENV: "test",
    RAMPS_SANDBOX_PROVIDERS: "both",
    RAMPS_SANDBOX_ENABLED: "true",
    MOONPAY_PK: "pk_test_fixture",
    MOONPAY_SK: "sk_test_fixture",
    MOONPAY_WEBHOOK: "wk_test_fixture",
    MONEYGRAM_PUB_KEY: "ramps_pk_sbox_fixture",
    MONEYGRAM_SEC_KEY: "ramps_sk_sbox_fixture",
  });
function transport(
  options: {
    testMode?: boolean;
    sell?: boolean;
    custodial?: boolean;
    widget?: string;
    missingAsset?: boolean;
    supportedChains?: string[];
  } = {},
) {
  const calls: Array<{ url: URL; init?: RequestInit }> = [];
  const fetcher = (async (url: URL, init?: RequestInit) => {
    calls.push({ url, init });
    if (url.hostname === "api.moonpay.com") {
      if (url.pathname === "/v3/countries")
        return Response.json([
          { alpha2: "ZA", isBuyAllowed: true, isSellAllowed: true },
          { alpha2: "ZW", isBuyAllowed: false, isSellAllowed: false },
        ]);
      assert.equal(url.searchParams.get("show"), "enabled");
      return Response.json(
        options.missingAsset
          ? []
          : [
              {
                code: "usdc_xlm",
                type: "crypto",
                supportsTestMode: options.testMode ?? false,
                isSellSupported: options.sell ?? true,
                isSuspended: false,
                metadata: { networkCode: "stellar" },
              },
            ],
      );
    }
    assert.equal(url.origin, "https://playground.xramps.moneygram.com");
    if (url.pathname === "/api/v1/partners/config") {
      assert.equal(init?.headers && new Headers(init.headers).get("authorization"), "Bearer private-provider-token");
      const custodial = options.custodial ?? true;
      return Response.json({
        walletType: custodial ? "custodial" : "non-custodial",
        supportedChains: options.supportedChains ?? (custodial ? ["ethereum", "polygon", "solana"] : ["stellar"]),
        supportedAssets: ["USDC", "USDT"],
        custodianCashInWallet: null,
        custodianCashOutWallet: null,
        productAvailability: { products: { cash_in: { enabled: true }, cash_out: { enabled: true } } },
      });
    }
    const body = JSON.parse(String(init?.body));
    if (body.walletAddress) {
      assert.deepEqual(body, { walletAddress: wallet, chain: "stellar" });
      if (options.custodial ?? true)
        return Response.json(
          { error: "Bad Request", message: "customerIdentifier is required for custodial partners. Secret must never be returned: ramps_sk_sbox_fixture" },
          { status: 400 },
        );
    } else {
      assert.deepEqual(body, { customerIdentifier: "music-city-sandbox-readiness", chain: "stellar" });
    }
    const custodial = options.custodial ?? true;
    return Response.json({
      walletType: custodial ? "custodial" : "non-custodial",
      sessionId: "session",
      sessionToken: "private-provider-token",
      widgetUrl: options.widget ?? "https://playground.xramps.moneygram.com/sdk/widget.html?mode=off-ramp",
    });
  }) as typeof fetch;
  return { fetcher, calls };
}

test("reports the custodial account's missing Stellar capability without exposing session data", async () => {
  const { fetcher, calls } = transport();
  const report = await checkRampSandboxReadiness(
    configuration(),
    wallet,
    fetcher,
  );
  assert.deepEqual(
    report.providers.map((p) => p.flows.map((f) => f.reason)),
    [
      [
        "stellar_usdc_test_mode_unavailable",
        "stellar_usdc_test_mode_unavailable",
      ],
      ["stellar_not_enabled_for_partner", "stellar_not_enabled_for_partner"],
    ],
  );
  const moneygram = report.providers[1];
  assert.equal(moneygram.connection, "verified");
  assert.equal(moneygram.walletModel, "custodial");
  assert.deepEqual(moneygram.supportedChains, ["ethereum", "polygon", "solana"]);
  assert.deepEqual(moneygram.supportedAssets, ["USDC", "USDT"]);
  assert.deepEqual(moneygram.products, { cashIn: true, cashOut: true });
  assert.deepEqual(moneygram.custodyWalletsConfigured, { cashIn: false, cashOut: false });
  assert.equal(
    report.providers[0].countries?.find((c) => c.code === "ZW")?.buyAllowed,
    false,
  );
  assert.equal(calls.length, 5);
  assert.ok(calls.every((c) => c.init?.redirect === "error"));
  const serialized = JSON.stringify(report);
  for (const secret of [
    "pk_test_fixture",
    "sk_test_fixture",
    "ramps_sk_sbox_fixture",
    "private-provider-token",
    "music-city-sandbox-readiness",
    wallet,
  ])
    assert.ok(!serialized.includes(secret));
});

test("a valid provider connection still requires origin, market and transfer proof", async () => {
  const { fetcher } = transport({ testMode: true, custodial: false });
  const report = await checkRampSandboxReadiness(
    configuration(),
    wallet,
    fetcher,
  );
  assert.ok(report.providers.every((p) => p.connection === "verified"));
  assert.ok(
    report.providers.every((p) =>
      p.flows.every((f) => f.status === "needs_verification"),
    ),
  );
  assert.ok(!JSON.stringify(report).includes("private-provider-token"));
  assert.equal(report.providers[1].walletModel, "non-custodial");
});

test("custodial Stellar support remains blocked until the wallet model is approved", async () => {
  const { fetcher } = transport({ custodial: true, supportedChains: ["stellar"] });
  const { providers } = await checkRampSandboxReadiness(configuration(), wallet, fetcher);
  assert.equal(providers[1].flows[0].reason, "custodial_stellar_mode_requires_approved_wallet_model");
  assert.equal(providers[1].flows[1].reason, "custodial_stellar_mode_requires_approved_wallet_model");
});

test("buy availability does not imply sell availability", async () => {
  const { fetcher } = transport({ testMode: true, sell: false });
  const { providers } = await checkRampSandboxReadiness(
    configuration(),
    wallet,
    fetcher,
  );
  assert.equal(providers[0].flows[0].status, "needs_verification");
  assert.equal(providers[0].flows[1].reason, "stellar_usdc_sell_unavailable");
});

test("missing assets and unexpected widget hosts fail closed", async () => {
  const { fetcher } = transport({
    missingAsset: true,
    custodial: false,
    widget: "https://unexpected.example/widget.html",
  });
  const { providers } = await checkRampSandboxReadiness(
    configuration(),
    wallet,
    fetcher,
  );
  assert.equal(providers[0].flows[0].reason, "stellar_usdc_not_enabled");
  assert.equal(providers[1].connection, "unavailable");
});

test("provider transport errors do not leak credential-bearing URLs or errors", async () => {
  const fail = (async () => {
    throw new Error(
      "request failed apiKey=pk_test_fixture secret=sk_test_fixture",
    );
  }) as typeof fetch;
  const { providers } = await checkRampSandboxReadiness(
    configuration(),
    wallet,
    fail,
  );
  assert.ok(providers.every((p) => p.connection === "unavailable"));
  assert.ok(!JSON.stringify(providers).includes("fixture"));
});

test("unconfigured providers do not make HTTP calls", async () => {
  const config = rampSandboxConfigSchema.parse({
    NODE_ENV: "test",
    RAMPS_SANDBOX_PROVIDERS: "both",
    RAMPS_SANDBOX_ENABLED: "true",
  });
  const fail = (async () => {
    throw new Error("must not fetch");
  }) as typeof fetch;
  const { providers } = await checkRampSandboxReadiness(config, wallet, fail);
  assert.ok(providers.every((p) => p.connection === "not_configured"));
});

test("sandbox checks require opt-in, Testnet, test credentials, and a valid wallet", async () => {
  for (const patch of [
    { NODE_ENV: "production" },
    {
      STELLAR_NETWORK_PASSPHRASE:
        "Public Global Stellar Network ; September 2015",
    },
    { MOONPAY_SK: "sk_live_forbidden" },
    { MONEYGRAM_SEC_KEY: "ramps_sk_prod_forbidden" },
  ])
    assert.equal(
      rampSandboxConfigSchema.safeParse({ ...configuration(), ...patch })
        .success,
      false,
    );
  await assert.rejects(
    checkRampSandboxReadiness(
      { ...configuration(), RAMPS_SANDBOX_ENABLED: "false" },
      wallet,
    ),
    /Explicitly enable/,
  );
  await assert.rejects(
    checkRampSandboxReadiness(configuration(), "not-a-stellar-wallet"),
  );
});
