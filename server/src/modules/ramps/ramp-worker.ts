import type { RampOrder } from "@music-city/shared";
import { createRampRepository } from "./ramp.repository.js";
import { MoonpaySandbox, type MoonpayObservation } from "./moonpay-sandbox.js";
import { rampSandboxConfigSchema } from "./sandbox-config.js";
import { databaseService } from "../../services/database.service.js";
import { logger } from "../../utils/logger.js";

type Repository = {
  lease(): Promise<RampOrder | null>;
  observe(id: string, observation: MoonpayObservation): Promise<void>;
  release(id: string, failed: boolean): Promise<void>;
};
type Provider = { lookup(order: RampOrder): Promise<MoonpayObservation | null> };

// A missing provider record is not a failure or evidence that a payment never started.
export async function reconcileRampOrders(
  repository: Repository,
  provider: Provider,
  limit = 10,
): Promise<void> {
  for (let i = 0; i < limit; i++) {
    const order = await repository.lease();
    if (!order) return;
    let failed = false;
    try {
      const observation = await provider.lookup(order);
      if (observation) await repository.observe(order.id, observation);
    } catch {
      // Provider responses can contain private data; retain only a stable error code.
      failed = true;
    } finally {
      await repository.release(order.id, failed);
    }
  }
}

export async function rampCycle(): Promise<void> {
  const config = rampSandboxConfigSchema.parse(process.env);
  if (
    config.RAMPS_SANDBOX_ENABLED !== "true" ||
    !["moonpay", "both"].includes(config.RAMPS_SANDBOX_PROVIDERS)
  ) return;
  try {
    await reconcileRampOrders(
      createRampRepository(databaseService),
      new MoonpaySandbox(config),
      1,
    );
  } catch {
    logger.error("Ramp reconciliation needs attention", { code: "ramp_cycle_failed" });
  }
}
