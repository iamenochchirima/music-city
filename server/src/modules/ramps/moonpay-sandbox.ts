import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { rampOrderSchema, type RampOrder } from "@music-city/shared";
import { HttpError } from "../../utils/http-error.js";
import {
  rampSandboxConfigSchema,
  type RampSandboxConfig,
} from "./sandbox-config.js";

export function decimalAmount(units: string, decimals: number): string {
  const digits = units.padStart(decimals + 1, "0");
  return decimals
    ? `${digits.slice(0, -decimals)}.${digits.slice(-decimals)}`
    : digits;
}
const currency = z.object({
  code: z.string(),
  type: z.string(),
  precision: z.number().int().nonnegative().max(18),
  minBuyAmount: z.number().nullable().optional(),
  maxBuyAmount: z.number().nullable().optional(),
  minSellAmount: z.number().nullable().optional(),
  maxSellAmount: z.number().nullable().optional(),
  supportsTestMode: z.boolean().optional(),
  isSellSupported: z.boolean().optional(),
  isSuspended: z.boolean().optional(),
  metadata: z
    .object({ networkCode: z.string().nullable().optional() })
    .optional(),
});
const country = z.object({
  alpha2: z.string(),
  isBuyAllowed: z.boolean(),
  isSellAllowed: z.boolean(),
});
export type MoonpayCatalog = {
  currencies: z.infer<typeof currency>[];
  countries: z.infer<typeof country>[];
};
export type MoonpayObservation = {
  id: string;
  externalId: string;
  state: "awaiting_user" | "processing" | "completed" | "failed" | "unknown";
  originalStatus: string;
  updatedAt: string;
  chainHash?: string;
};
const codeFor = (asset: "USDC" | "XLM") =>
  asset === "XLM" ? "xlm" : "usdc_xlm";
export class MoonpaySandbox {
  private config: RampSandboxConfig;
  constructor(
    input: RampSandboxConfig,
    private fetcher: typeof fetch = fetch,
  ) {
    this.config = rampSandboxConfigSchema.parse(input);
    if (
      this.config.RAMPS_SANDBOX_ENABLED !== "true" ||
      !this.config.MOONPAY_PK ||
      !this.config.MOONPAY_SK ||
      !this.config.MOONPAY_WEBHOOK
    )
      throw new HttpError(503, "MoonPay sandbox is not configured");
  }
  private async get(
    path: string,
    allowMissing = false,
    query: Record<string, string> = {},
  ) {
    const url = new URL(path, "https://api.moonpay.com");
    url.searchParams.set("apiKey", this.config.MOONPAY_PK!);
    for (const [key, value] of Object.entries(query))
      url.searchParams.set(key, value);
    let response: Response;
    try {
      response = await this.fetcher(url, {
        redirect: "error",
        signal: AbortSignal.timeout(20000),
      });
    } catch {
      throw new HttpError(
        502,
        "MoonPay is unavailable. Your existing transaction is unchanged.",
      );
    }
    if (response.status === 404 && allowMissing) return [];
    if (!response.ok)
      throw new HttpError(
        502,
        "MoonPay could not verify this request. No replacement payment was started.",
      );
    try {
      return (await response.json()) as unknown;
    } catch {
      throw new HttpError(502, "MoonPay returned an unreadable response");
    }
  }
  async catalog(): Promise<MoonpayCatalog> {
    const [currencies, countries] = await Promise.all([
      this.get("/v3/currencies", false, { show: "enabled" }),
      this.get("/v3/countries"),
    ]);
    return {
      currencies: z.array(currency).parse(currencies),
      countries: z.array(country).parse(countries),
    };
  }
  validateTerms(order: RampOrder, catalog: MoonpayCatalog) {
    rampOrderSchema.parse(order);
    const terms = order.terms;
    if (
      terms.provider !== "moonpay" ||
      terms.assetCode !== this.config.RAMPS_SANDBOX_ASSET
    )
      throw new HttpError(
        409,
        "This transaction belongs to a different sandbox configuration",
      );
    const asset = catalog.currencies.find(
      (c) =>
        c.code === codeFor(terms.assetCode) &&
        c.metadata?.networkCode === "stellar",
    );
    if (!asset?.supportsTestMode || asset.isSuspended !== false)
      throw new HttpError(
        409,
        `${terms.assetCode} is unavailable in the MoonPay sandbox`,
      );
    if (terms.direction === "sell" && !asset.isSellSupported)
      throw new HttpError(
        409,
        "This asset cannot be sold in the MoonPay sandbox",
      );
    const market = catalog.countries.find(
      (c) => c.alpha2 === terms.market.country,
    );
    if (
      !market ||
      !(terms.direction === "buy" ? market.isBuyAllowed : market.isSellAllowed)
    )
      throw new HttpError(
        409,
        "This country is unavailable for the selected flow",
      );
    const fiat = catalog.currencies.find(
      (c) =>
        c.type === "fiat" && c.code === terms.market.currency.toLowerCase(),
    );
    if (!fiat) throw new HttpError(409, "This currency is unavailable");
    if (terms.direction === "buy" && terms.amount.decimals !== fiat.precision)
      throw new HttpError(400, "Use the supported currency precision");
    const reference = terms.direction === "buy" ? fiat : asset;
    const min =
      terms.direction === "buy"
        ? reference.minBuyAmount
        : reference.minSellAmount;
    const max =
      terms.direction === "buy"
        ? reference.maxBuyAmount
        : reference.maxSellAmount;
    // Provider catalogue limits are numeric; the persisted and signed amount stays an exact decimal string.
    const amount = Number(
      decimalAmount(terms.amount.units, terms.amount.decimals),
    );
    if (
      !Number.isFinite(amount) ||
      (min != null && amount < min) ||
      (max != null && amount > max)
    )
      throw new HttpError(400, "Enter an amount within MoonPay's limits");
  }
  widgetUrl(rawOrder: RampOrder, catalog: MoonpayCatalog): string {
    this.validateTerms(rawOrder, catalog);
    const order = rampOrderSchema.parse(rawOrder);
    const terms = order.terms;
    if (
      terms.provider !== "moonpay" ||
      terms.assetCode !== this.config.RAMPS_SANDBOX_ASSET
    )
      throw new HttpError(
        409,
        "The sandbox configuration changed. Review the transaction again.",
      );
    if (order.providerTransactionId)
      throw new HttpError(
        409,
        "Track the existing transaction instead of creating another payment",
      );
    const url = new URL(
      terms.direction === "buy"
        ? "https://buy-sandbox.moonpay.com"
        : "https://sell-sandbox.moonpay.com",
    );
    const q = url.searchParams;
    q.set("apiKey", this.config.MOONPAY_PK!);
    q.set("externalTransactionId", order.id);
    q.set("externalCustomerId", terms.userId);
    q.set("theme", "dark");
    q.set("lockAmount", "true");
    if (terms.direction === "buy") {
      q.set("currencyCode", codeFor(terms.assetCode));
      q.set("walletAddress", terms.walletAddress);
      q.set("baseCurrencyCode", terms.market.currency.toLowerCase());
      q.set(
        "baseCurrencyAmount",
        decimalAmount(terms.amount.units, terms.amount.decimals),
      );
    } else {
      q.set("baseCurrencyCode", codeFor(terms.assetCode));
      q.set("refundWalletAddress", terms.walletAddress);
      q.set("quoteCurrencyCode", terms.market.currency.toLowerCase());
      q.set(
        "baseCurrencyAmount",
        decimalAmount(terms.amount.units, terms.amount.decimals),
      );
    }
    const signature = createHmac("sha256", this.config.MOONPAY_SK!)
      .update(url.search)
      .digest("base64");
    q.set("signature", signature);
    return url.href;
  }
  async lookup(order: RampOrder): Promise<MoonpayObservation | null> {
    const { terms } = rampOrderSchema.parse(order);
    if (
      terms.provider !== "moonpay" ||
      terms.assetCode !== this.config.RAMPS_SANDBOX_ASSET
    )
      throw new HttpError(
        409,
        "This order belongs to a different sandbox configuration",
      );
    const path =
      terms.direction === "buy"
        ? "/v1/transactions/ext/"
        : "/v3/sell_transactions/ext/";
    const rows = z
      .array(z.record(z.unknown()))
      .parse(await this.get(path + encodeURIComponent(order.id), true));
    if (rows.length > 1)
      throw new HttpError(
        409,
        "Multiple provider records need reconciliation. Do not start another payment.",
      );
    if (!rows.length) return null;
    const row = rows[0];
    const field = (key: string) => z.string().min(1).parse(row[key]);
    const id = field("id");
    if (
      field("externalTransactionId") !== order.id ||
      field("externalCustomerId") !== terms.userId ||
      (order.providerTransactionId && order.providerTransactionId !== id)
    )
      throw new HttpError(
        409,
        "The provider transaction does not match this order",
      );
    const wallet = field(
      terms.direction === "buy" ? "walletAddress" : "refundWalletAddress",
    );
    const asset = z
      .object({ code: z.string() })
      .parse(row[terms.direction === "buy" ? "currency" : "baseCurrency"]);
    const fiat = z
      .object({ code: z.string() })
      .parse(row[terms.direction === "buy" ? "baseCurrency" : "quoteCurrency"]);
    if (
      wallet !== terms.walletAddress ||
      asset.code !== codeFor(terms.assetCode) ||
      fiat.code !== terms.market.currency.toLowerCase()
    )
      throw new HttpError(
        409,
        "The provider wallet or currency changed. Payment is on hold.",
      );
    const actual = row.baseCurrencyAmount;
    if (
      (typeof actual !== "string" && typeof actual !== "number") ||
      !/^\d+(\.\d+)?$/.test(String(actual))
    )
      throw new HttpError(502, "The provider returned an invalid amount");
    const [whole, fraction = ""] = String(actual).split(".");
    if (
      fraction.length > terms.amount.decimals ||
      BigInt(whole + fraction.padEnd(terms.amount.decimals, "0")) !==
        BigInt(terms.amount.units)
    )
      throw new HttpError(
        409,
        "The provider amount changed. Review is required.",
      );
    const originalStatus = field("status");
    const state =
      (
        {
          waitingForDeposit: "awaiting_user",
          waitingPayment: "awaiting_user",
          pending: "processing",
          completed: "completed",
          failed: "failed",
        } as Record<string, MoonpayObservation["state"]>
      )[originalStatus] ?? "unknown";
    const chain =
      row[terms.direction === "buy" ? "cryptoTransactionId" : "depositHash"];
    const chainHash =
      typeof chain === "string" && /^[a-f0-9]{64}$/.test(chain)
        ? chain
        : undefined;
    return {
      id,
      externalId: order.id,
      state,
      originalStatus,
      updatedAt: z.string().datetime().parse(row.updatedAt),
      chainHash,
    };
  }
  verifyWebhook(raw: string, header: string, now = Date.now()): boolean {
    const match = /^t=(\d{1,12}),s=([a-f0-9]{64})$/.exec(header);
    if (!match || Math.abs(now / 1000 - Number(match[1])) > 300) return false;
    const actual = Buffer.from(match[2], "hex");
    const expected = createHmac("sha256", this.config.MOONPAY_WEBHOOK!)
      .update(`${match[1]}.${raw}`)
      .digest();
    return timingSafeEqual(actual, expected);
  }
}
