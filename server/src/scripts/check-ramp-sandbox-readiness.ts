import { writeFile } from "node:fs/promises";
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { checkRampSandboxReadiness } from "../modules/ramps/sandbox-readiness.js";
import { rampSandboxConfigSchema } from "../modules/ramps/sandbox-config.js";
import { MoonpaySandbox } from "../modules/ramps/moonpay-sandbox.js";

loadEnv({ path: resolve(process.cwd(), "..", ".env"), quiet: true });
const args = process.argv.slice(2);
function option(name: string) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}
const wallet = option("--wallet");
const output = option("--output");
if (!wallet || !output || !args.includes("--sandbox"))
  throw new Error(
    "Usage: pnpm --filter server ramps:check --sandbox --wallet GADDRESS --output /path/to/report.json",
  );
const config = rampSandboxConfigSchema.parse({
  ...process.env,
  RAMPS_SANDBOX_ENABLED: "true",
  RAMPS_SANDBOX_ASSET: option("--asset") ?? "USDC",
  RAMPS_SANDBOX_PROVIDERS: option("--provider") ?? "moonpay",
});
const report = await checkRampSandboxReadiness(config, wallet);
const countryCode = option("--country-iso3");
const currencyCode = option("--currency");
const state = option("--state");
if (Boolean(countryCode) !== Boolean(currencyCode))
  throw new Error("Provide both --country-iso3 and --currency to check MoonPay payment methods");
const paymentMethods = countryCode && currencyCode && config.RAMPS_SANDBOX_PROVIDERS !== "moneygram"
  ? await Promise.all((["buy", "sell"] as const).map(async (direction) => {
      try {
        const client = new MoonpaySandbox(config);
        const methods = await client.paymentMethods({ countryCode, currencyCode, direction, state });
        return { direction, status: "reported" as const, methods };
      } catch {
        return { direction, status: "unavailable" as const, methods: [] };
      }
    }))
  : undefined;
const evidence = { ...report, ...(paymentMethods ? { moonpayPaymentMethods: { countryCode, currencyCode, ...(state ? { state } : {}), paymentMethods } } : {}) };
await writeFile(output, JSON.stringify(evidence, null, 2) + "\n");
console.log(
  JSON.stringify(
    {
      checkedAt: report.checkedAt,
      ...(paymentMethods ? { moonpayPaymentMethods: { countryCode, currencyCode, ...(state ? { state } : {}), paymentMethods } } : {}),
      providers: report.providers.map((p) => ({
        provider: p.provider,
        connection: p.connection,
        ...(p.walletModel ? { walletModel: p.walletModel } : {}),
        ...(p.supportedChains ? { supportedChains: p.supportedChains } : {}),
        ...(p.supportedAssets ? { supportedAssets: p.supportedAssets } : {}),
        ...(p.products ? { products: p.products } : {}),
        ...(p.custodyWalletsConfigured ? { custodyWalletsConfigured: p.custodyWalletsConfigured } : {}),
        flows: p.flows,
      })),
    },
    null,
    2,
  ),
);
process.exitCode = report.providers.every((p) =>
  p.flows.every((f) => f.status === "needs_verification"),
)
  ? 0
  : 2;
