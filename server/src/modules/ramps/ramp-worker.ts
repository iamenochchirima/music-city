import type { RampOrder } from "@music-city/shared";
import { createRampRepository } from "./ramp.repository.js";
import { MoonpaySandbox } from "./moonpay-sandbox.js";
import { rampSandboxConfigSchema } from "./sandbox-config.js";
import { databaseService } from "../../services/database.service.js";
import { logger } from "../../utils/logger.js";
import { verifyIncomingDelivery, type IncomingDelivery } from "./incoming-delivery.js";

type Observation = NonNullable<RampOrder["providerObservation"]>;
type ProviderName = RampOrder["terms"]["provider"];
type Repository = {
  lease(provider: ProviderName): Promise<{ order: RampOrder; token: string } | null>;
  observe(id: string, observation: Observation, token: string): Promise<void | "stale" | "conflict">;
  release(id: string, token: string, errorCode: "provider_check_failed" | "delivery_check_failed" | "provider_status_conflict" | null): Promise<void>;
  recordIncomingDelivery(id: string, observation: Observation, delivery: IncomingDelivery, token: string): Promise<void>;
};
type Provider = { lookup(order: RampOrder): Promise<Observation | null> };

// A missing provider record is not a failure or evidence that a payment never started.
export async function reconcileRampOrders(
  repository: Repository,
  provider: Provider,
  limit = 10,
  verifyDelivery = verifyIncomingDelivery,
  providerName: ProviderName = "moonpay",
): Promise<void> {
  for (let i = 0; i < limit; i++) {
    const lease = await repository.lease(providerName);
    if (!lease) return;
    const { order, token } = lease;
    let errorCode: "provider_check_failed" | "delivery_check_failed" | "provider_status_conflict" | null = null;
    try {
      const observation = await provider.lookup(order);
      if (observation) {
        const outcome = await repository.observe(order.id, observation, token);
        if (outcome === "conflict") errorCode = "provider_status_conflict";
        if (!outcome && observation.state === "completed" && observation.chainHash && observation.assetUnits && order.terms.direction === "buy") {
          try {
            const delivery = await verifyDelivery(order, observation);
            if (delivery) await repository.recordIncomingDelivery(order.id, observation, delivery, token);
          } catch {
            errorCode = "delivery_check_failed";
          }
        }
      }
    } catch {
      // Provider responses can contain private data; retain only a stable error code.
      errorCode = "provider_check_failed";
    } finally {
      await repository.release(order.id, token, errorCode);
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
