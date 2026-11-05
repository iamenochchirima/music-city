import { rampProviderStateSchema } from "@music-city/shared";
import type { z } from "zod";

type RampProviderState = z.infer<typeof rampProviderStateSchema>;

const refundableStates = new Set<RampProviderState>([
  "refund_pending",
  "refunded",
  "refund_failed",
]);

const terminalStates = new Set<RampProviderState>([
  "failed",
  "cancelled",
  "refunded",
]);

const refundProgression: Partial<
  Record<RampProviderState, ReadonlySet<RampProviderState>>
> = {
  refund_pending: new Set(["refunded", "refund_failed"]),
  refund_failed: new Set(["refund_pending", "refunded", "completed"]),
};

export function canTransitionProviderState(
  previous: RampProviderState,
  next: RampProviderState,
): boolean {
  if (previous === next) return true;
  if (previous === "unknown" || next === "unknown") return true;
  if (previous === "completed") return refundableStates.has(next);
  if (previous === "refund_pending" || previous === "refund_failed")
    return refundProgression[previous]?.has(next) ?? false;
  if (terminalStates.has(previous)) return false;
  return true;
}
