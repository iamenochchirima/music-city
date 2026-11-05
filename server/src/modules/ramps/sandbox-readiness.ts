import { z } from "zod";
import { stellarWalletAddressSchema } from "@music-city/shared";
import {
  rampSandboxConfigSchema,
  rampSandboxHosts,
  type RampSandboxConfig,
} from "./sandbox-config.js";

type Direction = "buy" | "sell";
type Flow = {
  direction: Direction;
  status: "blocked" | "needs_verification";
  reason: string;
};
export type RampReadiness = {
  environment: "sandbox";
  network: "stellar:testnet";
  checkedAt: string;
  providers: Array<{
    provider: "moonpay" | "moneygram";
    connection: "verified" | "not_configured" | "rejected" | "unavailable";
    flows: Flow[];
    walletModel?: "custodial" | "non-custodial";
    supportedChains?: string[];
    supportedAssets?: string[];
    products?: { cashIn: boolean | null; cashOut: boolean | null };
    custodyWalletsConfigured?: { cashIn: boolean; cashOut: boolean };
    asset?: {
      code: string;
      testMode: boolean;
      sellSupported: boolean;
      suspended: boolean;
    };
    countries?: Array<{
      code: string;
      buyAllowed: boolean;
      sellAllowed: boolean;
    }>;
  }>;
};
type Fetcher = typeof fetch;
const currencySchema = z.object({
  code: z.string(),
  type: z.string(),
  supportsTestMode: z.boolean().optional(),
  isSellSupported: z.boolean().optional(),
  isSuspended: z.boolean().optional(),
  metadata: z
    .object({ networkCode: z.string().nullable().optional() })
    .optional(),
});
const countrySchema = z.object({
  alpha2: z.string().regex(/^[A-Z]{2}$/),
  isBuyAllowed: z.boolean(),
  isSellAllowed: z.boolean(),
});
const pending = (reason: string): Flow[] =>
  ["buy", "sell"].map((direction) => ({
    direction: direction as Direction,
    status: "blocked",
    reason,
  }));

// All hosts are fixed. Never put a secret in a query string or return provider session credentials.
async function providerRequest(
  fetcher: Fetcher,
  url: URL,
  init: RequestInit = {},
) {
  const response = await fetcher(url, {
    ...init,
    redirect: "error",
    signal: AbortSignal.timeout(20_000),
  });
  return {
    status: response.status,
    ok: response.ok,
    body: (await response.json()) as unknown,
  };
}
export async function checkRampSandboxReadiness(
  input: RampSandboxConfig,
  walletAddress: string,
  fetcher: Fetcher = fetch,
): Promise<RampReadiness> {
  const config = rampSandboxConfigSchema.parse(input);
  stellarWalletAddressSchema.parse(walletAddress);
  if (config.RAMPS_SANDBOX_ENABLED !== "true")
    throw new Error("Explicitly enable the isolated sandbox ramp check");
  const checks: Array<Promise<RampReadiness["providers"][number]>> = [];
  if (config.RAMPS_SANDBOX_PROVIDERS !== "moneygram")
    checks.push(checkMoonpay(config, fetcher));
  if (config.RAMPS_SANDBOX_PROVIDERS !== "moonpay")
    checks.push(checkMoneygram(config, walletAddress, fetcher));
  const providers = await Promise.all(checks);
  return {
    environment: "sandbox",
    network: "stellar:testnet",
    checkedAt: new Date().toISOString(),
    providers,
  };
}
async function checkMoonpay(
  config: RampSandboxConfig,
  fetcher: Fetcher,
): Promise<RampReadiness["providers"][number]> {
  const base = { provider: "moonpay" as const };
  if (!config.MOONPAY_PK || !config.MOONPAY_SK || !config.MOONPAY_WEBHOOK)
    return {
      ...base,
      connection: "not_configured",
      flows: pending("sandbox_credentials_missing"),
    };
  try {
    const currencies = new URL("/v3/currencies", rampSandboxHosts.moonpayApi);
    currencies.searchParams.set("apiKey", config.MOONPAY_PK);
    currencies.searchParams.set("show", "enabled");
    const countries = new URL("/v3/countries", rampSandboxHosts.moonpayApi);
    countries.searchParams.set("apiKey", config.MOONPAY_PK);
    const [assetResponse, countryResponse] = await Promise.all([
      providerRequest(fetcher, currencies),
      providerRequest(fetcher, countries),
    ]);
    if (!assetResponse.ok || !countryResponse.ok)
      return {
        ...base,
        connection: "rejected",
        flows: pending("capability_request_rejected"),
      };
    const catalog = z.array(currencySchema).parse(assetResponse.body);
    const markets = z.array(countrySchema).parse(countryResponse.body);
    const asset = catalog.find(
      (c) =>
        c.type === "crypto" &&
        c.code ===
          (config.RAMPS_SANDBOX_ASSET === "XLM" ? "xlm" : "usdc_xlm") &&
        c.metadata?.networkCode === "stellar",
    );
    const assetLabel =
      config.RAMPS_SANDBOX_ASSET === "XLM" ? "stellar_xlm" : "stellar_usdc";
    const countriesReport = markets.map((c) => ({
      code: c.alpha2,
      buyAllowed: c.isBuyAllowed,
      sellAllowed: c.isSellAllowed,
    }));
    if (!asset)
      return {
        ...base,
        connection: "verified",
        countries: countriesReport,
        flows: pending(`${assetLabel}_not_enabled`),
      };
    const assetReport = {
      code: asset.code,
      testMode: asset.supportsTestMode === true,
      sellSupported: asset.isSellSupported === true,
      suspended: asset.isSuspended !== false,
    };
    const reason = !assetReport.testMode
      ? `${assetLabel}_test_mode_unavailable`
      : assetReport.suspended
        ? `${assetLabel}_suspended`
        : undefined;
    const flows: Flow[] = (["buy", "sell"] as const).map((direction) => {
      if (reason) return { direction, status: "blocked", reason };
      if (direction === "sell" && !assetReport.sellSupported)
        return {
          direction,
          status: "blocked",
          reason: `${assetLabel}_sell_unavailable`,
        };
      return {
        direction,
        status: "needs_verification",
        reason: "verify_origin_market_network_and_provider_flow",
      };
    });
    return {
      ...base,
      connection: "verified",
      asset: assetReport,
      countries: countriesReport,
      flows,
    };
  } catch {
    return {
      ...base,
      connection: "unavailable",
      flows: pending("capability_check_unavailable"),
    };
  }
}
async function checkMoneygram(
  config: RampSandboxConfig,
  walletAddress: string,
  fetcher: Fetcher,
): Promise<RampReadiness["providers"][number]> {
  const base = { provider: "moneygram" as const };
  if (!config.MONEYGRAM_PUB_KEY || !config.MONEYGRAM_SEC_KEY)
    return {
      ...base,
      connection: "not_configured",
      flows: pending("sandbox_credentials_missing"),
    };
  try {
    const sessionUrl = new URL("/api/v1/sessions", rampSandboxHosts.moneygramApi);
    const requestSession = (body: Record<string, string>) =>
      providerRequest(fetcher, sessionUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": config.MONEYGRAM_SEC_KEY!,
        },
        body: JSON.stringify(body),
      });
    // The wallet model is fixed on the MoneyGram partner account, not per session.
    // Try the documented non-custodial request first, then identify a custodial
    // partner with a stable synthetic QA customer ID so we can read its config.
    let result = await requestSession({ walletAddress, chain: "stellar" });
    let requestedCustodial = false;
    if (!result.ok) {
      const error = z.object({ message: z.string().optional() }).safeParse(result.body);
      const custodial = result.status === 400 && error.success &&
        error.data.message?.includes("customerIdentifier is required for custodial partners");
      if (!custodial) {
        return { ...base, connection: "rejected", flows: pending("session_request_rejected") };
      }
      requestedCustodial = true;
      result = await requestSession({ customerIdentifier: "music-city-sandbox-readiness", chain: "stellar" });
      if (!result.ok)
        return { ...base, connection: "rejected", flows: pending("custodial_session_request_rejected") };
    }
    const session = z.object({
      walletType: z.enum(["custodial", "non-custodial"]),
      sessionToken: z.string().min(1),
      sessionId: z.string().min(1),
      widgetUrl: z.string().url(),
    }).parse(result.body);
    if ((requestedCustodial && session.walletType !== "custodial") ||
        (!requestedCustodial && session.walletType !== "non-custodial"))
      throw new Error("Unexpected MoneyGram wallet model");
    const widget = new URL(session.widgetUrl);
    if (widget.origin !== rampSandboxHosts.moneygramApi ||
        !["/widget.html", "/sdk/widget.html"].includes(widget.pathname))
      throw new Error("Unexpected widget destination");

    const partnerResponse = await providerRequest(
      fetcher,
      new URL("/api/v1/partners/config", rampSandboxHosts.moneygramApi),
      { headers: { Authorization: `Bearer ${session.sessionToken}` } },
    );
    if (!partnerResponse.ok)
      return { ...base, connection: "verified", flows: pending("partner_configuration_unavailable") };
    const partner = z.object({
      walletType: z.enum(["custodial", "non-custodial"]),
      supportedChains: z.array(z.string()).optional(),
      supportedAssets: z.array(z.string()).optional(),
      custodianCashInWallet: z.unknown().optional(),
      custodianCashOutWallet: z.unknown().optional(),
      productAvailability: z.object({
        products: z.object({
          cash_in: z.object({ enabled: z.boolean().optional() }).passthrough().optional(),
          cash_out: z.object({ enabled: z.boolean().optional() }).passthrough().optional(),
        }).passthrough().optional(),
      }).passthrough().optional(),
    }).passthrough().parse(partnerResponse.body);
    if (partner.walletType !== session.walletType)
      throw new Error("MoneyGram session and partner wallet models differ");
    const supportedChains = partner.supportedChains ?? [];
    const supportedAssets = partner.supportedAssets ?? [];
    const products = partner.productAvailability?.products;
    const cashIn = products?.cash_in?.enabled ?? null;
    const cashOut = products?.cash_out?.enabled ?? null;
    const hasWallet = (value: unknown) => value !== null && value !== undefined &&
      (typeof value !== "object" || Object.keys(value).length > 0);
    const custodyWalletsConfigured = {
      cashIn: hasWallet(partner.custodianCashInWallet),
      cashOut: hasWallet(partner.custodianCashOutWallet),
    };
    const reason = !supportedChains.includes("stellar")
      ? "stellar_not_enabled_for_partner"
      : !supportedAssets.includes("USDC")
        ? "stellar_usdc_not_enabled_for_partner"
        : session.walletType === "custodial"
          ? "custodial_stellar_mode_requires_approved_wallet_model"
          : undefined;
    return {
      ...base,
      connection: "verified",
      walletModel: session.walletType,
      supportedChains,
      supportedAssets,
      products: { cashIn, cashOut },
      ...(session.walletType === "custodial" ? { custodyWalletsConfigured } : {}),
      flows: (["buy", "sell"] as const).map((direction) => {
        const productEnabled = direction === "buy" ? cashIn : cashOut;
        return reason
          ? { direction, status: "blocked" as const, reason }
          : productEnabled === false
            ? { direction, status: "blocked" as const, reason: direction === "buy" ? "cash_in_product_disabled" : "cash_out_product_disabled" }
            : { direction, status: "needs_verification" as const, reason: "verify_origin_market_network_and_provider_flow" };
      }),
    };
  } catch {
    return {
      ...base,
      connection: "unavailable",
      flows: pending("session_check_unavailable"),
    };
  }
}
