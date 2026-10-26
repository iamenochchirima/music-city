import { writeFile } from "node:fs/promises";
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { checkRampSandboxReadiness } from "../modules/ramps/sandbox-readiness.js";
import { rampSandboxConfigSchema } from "../modules/ramps/sandbox-config.js";

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
});
const report = await checkRampSandboxReadiness(config, wallet);
await writeFile(output, JSON.stringify(report, null, 2) + "\n");
console.log(
  JSON.stringify(
    {
      checkedAt: report.checkedAt,
      providers: report.providers.map((p) => ({
        provider: p.provider,
        connection: p.connection,
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
