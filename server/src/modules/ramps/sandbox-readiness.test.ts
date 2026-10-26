import assert from "node:assert/strict";
import test from "node:test";
import { Keypair } from "@stellar/stellar-sdk";
import { checkRampSandboxReadiness } from "./sandbox-readiness.js";
import { rampSandboxConfigSchema } from "./sandbox-config.js";

const wallet = Keypair.random().publicKey();
const configuration = () =>
  rampSandboxConfigSchema.parse({
    NODE_ENV: "test",
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
    assert.deepEqual(JSON.parse(String(init?.body)), {
      walletAddress: wallet,
      chain: "stellar",
      walletType: "non-custodial",
    });
    if (options.custodial ?? true)
      return Response.json(
        {
          error: "Bad Request",
          message:
            "customerIdentifier is required for custodial partners. Secret must never be returned: ramps_sk_sbox_fixture",
        },
        { status: 400 },
      );
    return Response.json({
      walletType: "non-custodial",
      sessionId: "session",
      sessionToken: "private-provider-token",
      widgetUrl:
        options.widget ??
        "https://playground.xramps.moneygram.com/widget.html?mode=off-ramp",
    });
  }) as typeof fetch;
  return { fetcher, calls };
}

test("blocks both real readiness failures without promoting general country support", async () => {
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
      ["non_custodial_partner_required", "non_custodial_partner_required"],
    ],
  );
  assert.equal(
    report.providers[0].countries?.find((c) => c.code === "ZW")?.buyAllowed,
    false,
  );
  assert.equal(calls.length, 3);
  assert.ok(calls.every((c) => c.init?.redirect === "error"));
  const serialized = JSON.stringify(report);
  for (const secret of [
    "pk_test_fixture",
    "sk_test_fixture",
    "ramps_sk_sbox_fixture",
    "private-provider-token",
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
