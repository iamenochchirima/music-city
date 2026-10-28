import assert from "node:assert/strict";
import test from "node:test";
import { createHmac, randomUUID } from "node:crypto";
import { Keypair } from "@stellar/stellar-sdk";
import { type RampOrder } from "@music-city/shared";
import { MoonpaySandbox, type MoonpayCatalog } from "./moonpay-sandbox.js";
import { rampSandboxConfigSchema } from "./sandbox-config.js";

const customerIps = ["203.0.113.42"];
const config = () =>
  rampSandboxConfigSchema.parse({
    NODE_ENV: "test",
    RAMPS_SANDBOX_ENABLED: "true",
    RAMPS_SANDBOX_ASSET: "XLM",
    MOONPAY_PK: "pk_test_fixture",
    MOONPAY_SK: "sk_test_fixture",
    MOONPAY_WEBHOOK: "wk_test_fixture",
  });
const catalog: MoonpayCatalog = {
  currencies: [
    {
      code: "xlm",
      type: "crypto",
      precision: 7,
      supportsTestMode: true,
      isSellSupported: true,
      isSuspended: false,
      minSellAmount: 100,
      maxSellAmount: 1000,
      metadata: { networkCode: "stellar" },
    },
    {
      code: "usd",
      type: "fiat",
      precision: 2,
      minBuyAmount: 20,
      maxBuyAmount: 1000,
    },
  ],
  countries: [
    { alpha2: "US", isBuyAllowed: true, isSellAllowed: true },
    { alpha2: "ZW", isBuyAllowed: false, isSellAllowed: false },
  ],
};
const order = (direction: "buy" | "sell" = "buy"): RampOrder => ({
  id: randomUUID(),
  terms: {
    userId: "artist",
    requestId: randomUUID(),
    walletAddress: Keypair.random().publicKey(),
    provider: "moonpay",
    direction,
    environment: "sandbox",
    network: "stellar:testnet",
    assetCode: "XLM",
    market: { country: "US", currency: "USD", method: "card" },
    amount: {
      currency: direction === "buy" ? "USD" : "XLM",
      units: direction === "buy" ? "10000" : "2500000000",
      decimals: direction === "buy" ? 2 : 7,
    },
  },
  providerState: "created",
  chainState: "unobserved",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});
function providerRow(o: RampOrder) {
  return {
    id: "provider-id",
    externalTransactionId: o.id,
    externalCustomerId: o.terms.userId,
    walletAddress: o.terms.walletAddress,
    refundWalletAddress: o.terms.walletAddress,
    currency: { code: "xlm" },
    baseCurrency: { code: o.terms.direction === "buy" ? "usd" : "xlm" },
    quoteCurrency: { code: "usd" },
    baseCurrencyAmount: o.terms.direction === "buy" ? 100 : 250,
    feeAmount: 0,
    extraFeeAmount: 0,
    networkFeeAmount: 0,
    status: "completed",
    updatedAt: new Date().toISOString(),
    cryptoTransactionId: "a".repeat(64),
    depositHash: "b".repeat(64),
  };
}

test("buy and sell URLs lock the approved amount, wallet, asset and correlation identifiers", () => {
  const client = new MoonpaySandbox(config());
  for (const direction of ["buy", "sell"] as const) {
    const o = order(direction);
    const url = new URL(client.widgetUrl(o, catalog, customerIps));
    assert.equal(
      url.origin,
      direction === "buy"
        ? "https://buy-sandbox.moonpay.com"
        : "https://sell-sandbox.moonpay.com",
    );
    assert.equal(
      url.searchParams.get("allowedIpAddress"),
      createHmac("sha256", "sk_test_fixture")
        .update(customerIps[0])
        .digest("base64"),
    );
    assert.ok(!url.href.includes(customerIps[0]));
    const signature = url.searchParams.get("signature");
    url.searchParams.delete("signature");
    assert.equal(
      signature,
      createHmac("sha256", "sk_test_fixture")
        .update(url.search)
        .digest("base64"),
    );
    assert.equal(
      url.searchParams.get(
        direction === "buy" ? "walletAddress" : "refundWalletAddress",
      ),
      o.terms.walletAddress,
    );
    assert.equal(
      url.searchParams.get(
        direction === "buy" ? "currencyCode" : "baseCurrencyCode",
      ),
      "xlm",
    );
    assert.equal(
      url.searchParams.get("baseCurrencyAmount"),
      direction === "buy" ? "100.00" : "250.0000000",
    );
    assert.equal(url.searchParams.get("externalTransactionId"), o.id);
    assert.equal(url.searchParams.get("externalCustomerId"), "artist");
    assert.equal(url.searchParams.get("lockAmount"), "true");
    assert.ok(!url.href.includes("sk_test_fixture"));
    assert.throws(
      () =>
        client.widgetUrl(
          { ...o, providerTransactionId: "already-created" },
          catalog,
          customerIps,
        ),
      /existing transaction/,
    );
  }
});

test("buy lookup verifies the total charge including provider fees in exact fiat units", async () => {
  const o = order();
  const row = {
    ...providerRow(o),
    status: "failed",
    baseCurrencyAmount: 95.81,
    feeAmount: 3.99,
    extraFeeAmount: 0,
    networkFeeAmount: 0.2,
  };
  const lookup = (data: Record<string, unknown>) =>
    new MoonpaySandbox(config(), (async () =>
      Response.json([data])) as typeof fetch).lookup(o);
  assert.equal((await lookup(row))?.state, "failed");
  assert.equal(
    (await lookup({ ...row, status: "waitingAuthorization" }))?.state,
    "processing",
  );
  for (const patch of [
    { baseCurrencyAmount: 95.82 },
    { feeAmount: 4 },
    { extraFeeAmount: null },
    { networkFeeAmount: -0.2 },
    { networkFeeAmount: 0.201 },
  ])
    await assert.rejects(lookup({ ...row, ...patch }));
});

test("widget creation refuses unsupported test assets, countries, precision and limits", () => {
  const client = new MoonpaySandbox(config());
  const o = order();
  assert.throws(
    () =>
      client.widgetUrl(
        o,
        {
          ...catalog,
          currencies: catalog.currencies.map((c) => ({
            ...c,
            supportsTestMode: false,
          })),
        },
        customerIps,
      ),
    /unavailable/,
  );
  assert.throws(
    () =>
      client.widgetUrl(
        {
          ...o,
          terms: { ...o.terms, market: { ...o.terms.market, country: "ZW" } },
        },
        catalog,
        customerIps,
      ),
    /country/,
  );
  assert.throws(
    () =>
      client.widgetUrl(
        {
          ...o,
          terms: { ...o.terms, amount: { ...o.terms.amount, units: "100" } },
        },
        catalog,
        customerIps,
      ),
    /limits/,
  );
  assert.throws(
    () =>
      client.widgetUrl(
        {
          ...o,
          terms: { ...o.terms, amount: { ...o.terms.amount, decimals: 3 } },
        },
        catalog,
        customerIps,
      ),
    /precision/,
  );
  const usdc = new MoonpaySandbox({ ...config(), RAMPS_SANDBOX_ASSET: "USDC" });
  assert.throws(
    () => usdc.widgetUrl(o, catalog, customerIps),
    /different sandbox configuration/,
  );
});

test("provider lookups use publishable API authentication and verify owned terms before returning a status", async () => {
  for (const direction of ["buy", "sell"] as const) {
    const o = order(direction);
    const fetcher = (async (url: URL, init: RequestInit) => {
      assert.equal(url.searchParams.get("apiKey"), "pk_test_fixture");
      assert.ok(!url.href.includes("sk_test_fixture"));
      assert.equal(init.redirect, "error");
      return Response.json([providerRow(o)]);
    }) as typeof fetch;
    const result = await new MoonpaySandbox(config(), fetcher).lookup(o);
    assert.equal(result?.state, "completed");
    assert.equal(
      result?.chainHash,
      (direction === "buy" ? "a" : "b").repeat(64),
    );
    assert.equal(o.chainState, "unobserved");
  }
});

test("ambiguous results and mismatched provider fields never become a successful app outcome", async () => {
  const o = order();
  const original = providerRow(o);
  for (const patch of [
    { externalTransactionId: randomUUID() },
    { externalCustomerId: "someone-else" },
    { walletAddress: Keypair.random().publicKey() },
    { currency: { code: "usdc" } },
    { baseCurrency: { code: "eur" } },
    { baseCurrencyAmount: 101 },
    { baseCurrencyAmount: 1e-7 },
  ]) {
    const fetcher = (async () =>
      Response.json([{ ...original, ...patch }])) as typeof fetch;
    await assert.rejects(new MoonpaySandbox(config(), fetcher).lookup(o));
  }
  const ambiguous = (async () =>
    Response.json([original, original])) as typeof fetch;
  await assert.rejects(
    new MoonpaySandbox(config(), ambiguous).lookup(o),
    /Multiple provider records/,
  );
});

test("missing orders and unknown statuses stay distinct from paid", async () => {
  const o = order();
  const missing = (async () =>
    Response.json({ message: "not found" }, { status: 404 })) as typeof fetch;
  assert.equal(await new MoonpaySandbox(config(), missing).lookup(o), null);
  const unknown = (async () =>
    Response.json([
      { ...providerRow(o), status: "new-provider-state" },
    ])) as typeof fetch;
  assert.equal(
    (await new MoonpaySandbox(config(), unknown).lookup(o))?.state,
    "unknown",
  );
});

test("webhooks require the exact raw payload, valid HMAC and a fresh timestamp", () => {
  const client = new MoonpaySandbox(config());
  const now = Date.now();
  const timestamp = String(Math.floor(now / 1000));
  const body = '{"type":"transaction_updated","data":{"id":"p"}}';
  const signature = createHmac("sha256", "wk_test_fixture")
    .update(`${timestamp}.${body}`)
    .digest("hex");
  const header = `t=${timestamp},s=${signature}`;
  assert.equal(client.verifyWebhook(body, header, now), true);
  for (const [raw, h, time] of [
    [body + " ", header, now],
    [body, header, now + 301000],
    [body, header, now - 301000],
    [body, header + ",s=" + signature, now],
    [body, `t=${timestamp},s=bad`, now],
  ] as const)
    assert.equal(client.verifyWebhook(raw, h, time), false);
});

test("widget signing requires an IP binding and signs it with the rest of the terms", () => {
  const client = new MoonpaySandbox(config());
  const o = order();
  for (const ips of [[], undefined])
    assert.throws(
      () => client.widgetUrl(o, catalog, ips as unknown as string[]),
      /verify your connection/,
    );
  const first = new URL(client.widgetUrl(o, catalog, ["203.0.113.42"]));
  const second = new URL(client.widgetUrl(o, catalog, ["203.0.113.43"]));
  assert.notEqual(
    first.searchParams.get("allowedIpAddress"),
    second.searchParams.get("allowedIpAddress"),
  );
  assert.notEqual(
    first.searchParams.get("signature"),
    second.searchParams.get("signature"),
  );
});


test("payment method discovery uses secret authentication on a fixed host and does not enable a route", async () => {
  const fetcher = (async (input: URL, init: RequestInit) => {
    assert.equal(input.origin, "https://api.moonpay.com");
    assert.equal(input.pathname, "/payments/v1/payment-method-config");
    assert.equal(input.searchParams.get("countryCode"), "GBR");
    assert.equal(input.searchParams.get("currencyCode"), "GBP");
    assert.equal(input.searchParams.get("transactionType"), "sell");
    assert.ok(!input.href.includes("sk_test_fixture"));
    assert.equal((init.headers as Record<string, string>).Authorization, "Api-Key sk_test_fixture");
    assert.equal(init.redirect, "error");
    return Response.json([{ type: "credit_debit_card", availability: { active: true }, limits: { arbitrary: "not trusted" } }, { type: "bank_transfer", availability: { active: false } }]);
  }) as typeof fetch;
  const client = new MoonpaySandbox(config(), fetcher);
  assert.deepEqual(await client.paymentMethods({ countryCode: "GBR", currencyCode: "GBP", direction: "sell" }), [
    { type: "credit_debit_card", active: true }, { type: "bank_transfer", active: false },
  ]);
  await assert.rejects(client.paymentMethods({ countryCode: "USA", currencyCode: "USD", direction: "buy" }), /state/);
  await assert.rejects(client.paymentMethods({ countryCode: "GB", currencyCode: "GBP", direction: "buy" }));
  const unavailable = new MoonpaySandbox(config(), (async () => new Response(null, { status: 401 })) as typeof fetch);
  await assert.rejects(unavailable.paymentMethods({ countryCode: "GBR", currencyCode: "GBP", direction: "buy" }), /unavailable/);
});
