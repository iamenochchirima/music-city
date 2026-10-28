import { z } from "zod";

export const rampSandboxConfigSchema = z
  .object({
    RAMPS_SANDBOX_ENABLED: z.enum(["true", "false"]).default("false"),
    RAMPS_SANDBOX_ASSET: z.enum(["USDC", "XLM"]).default("USDC"),
    RAMPS_SANDBOX_PROVIDERS: z
      .enum(["moonpay", "moneygram", "both"])
      .default("moonpay"),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    STELLAR_NETWORK_PASSPHRASE: z
      .string()
      .default("Test SDF Network ; September 2015"),
    MONEYGRAM_PUB_KEY: z.string().optional(),
    MONEYGRAM_SEC_KEY: z.string().optional(),
    MOONPAY_PK: z.string().optional(),
    MOONPAY_SK: z.string().optional(),
    MOONPAY_WEBHOOK: z.string().optional(),
    RAMPS_CASHOUT_ENCRYPTION_KEY: z.preprocess((value) => value === "" ? undefined : value, z.string().regex(/^[a-fA-F0-9]{64}$/).optional()),
    RAMPS_LAUNCH_ENCRYPTION_KEY: z.preprocess((value) => value === "" ? undefined : value, z.string().regex(/^[a-fA-F0-9]{64}$/).optional()),
    RAMPS_LAUNCH_IP_MODE: z.enum(["disabled", "direct"]).default("disabled"),
  })
  .superRefine((config, context) => {
    if (config.RAMPS_SANDBOX_ENABLED !== "true") return;
    if (config.NODE_ENV === "production") {
      context.addIssue({
        code: "custom",
        path: ["RAMPS_SANDBOX_ENABLED"],
        message:
          "Sandbox ramps must run in a local development or test environment",
      });
    }
    if (
      config.STELLAR_NETWORK_PASSPHRASE !== "Test SDF Network ; September 2015"
    ) {
      context.addIssue({
        code: "custom",
        path: ["STELLAR_NETWORK_PASSPHRASE"],
        message: "Sandbox ramps require Stellar Testnet",
      });
    }
    for (const [key, prefix] of [
      ["MONEYGRAM_PUB_KEY", "ramps_pk_sbox_"],
      ["MONEYGRAM_SEC_KEY", "ramps_sk_sbox_"],
      ["MOONPAY_PK", "pk_test_"],
      ["MOONPAY_SK", "sk_test_"],
      ["MOONPAY_WEBHOOK", "wk_test_"],
    ] as const) {
      if (config[key] !== undefined && !config[key]!.startsWith(prefix)) {
        context.addIssue({
          code: "custom",
          path: [key],
          message: "Use a sandbox credential for this provider",
        });
      }
    }
  });
export type RampSandboxConfig = z.infer<typeof rampSandboxConfigSchema>;
export const rampSandboxHosts = {
  moonpayApi: "https://api.moonpay.com",
  moneygramApi: "https://playground.xramps.moneygram.com",
} as const;
