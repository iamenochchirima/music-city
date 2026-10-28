import { createHash } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { databaseService } from "../../services/database.service.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { HttpError } from "../../utils/http-error.js";
import { MoonpaySandbox } from "./moonpay-sandbox.js";
import { createRampRepository } from "./ramp.repository.js";
import { rampSandboxConfigSchema } from "./sandbox-config.js";

const events = {
  transaction_created: "buy", transaction_updated: "buy", transaction_failed: "buy",
  sell_transaction_created: "sell", sell_transaction_updated: "sell", sell_transaction_failed: "sell",
  sell_transaction_requote_required: "sell",
} as const;
const payload = z.object({
  type: z.enum(["transaction_created", "transaction_updated", "transaction_failed", "sell_transaction_created", "sell_transaction_updated", "sell_transaction_failed", "sell_transaction_requote_required"]),
  data: z.object({ id: z.string().min(1).max(200), externalTransactionId: z.string().min(1).max(200), externalCustomerId: z.string().min(1).max(200) }),
});
type Repository = Pick<ReturnType<typeof createRampRepository>, "recordMoonpayNotification">;
type Verifier = { verifyWebhook(raw: string, header: string): boolean };
export function createMoonpayWebhookRouter(repository: Repository, verifier: () => Verifier | null) {
  const router = Router();
  router.post("/", asyncHandler(async (req, res) => {
    const client = verifier();
    if (!client) throw new HttpError(404, "Not found");
    const raw = req.rawBody;
    const signature = req.get("Moonpay-Signature-V2") ?? "";
    if (!raw || !client.verifyWebhook(raw, signature)) throw new HttpError(401, "Invalid notification");
    const parsed = payload.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, "Unsupported notification");
    const event = parsed.data;
    const accepted = await repository.recordMoonpayNotification({
      orderId: event.data.externalTransactionId, providerId: event.data.id, userId: event.data.externalCustomerId,
      direction: events[event.type], kind: event.type, key: createHash("sha256").update(raw).digest("hex"),
    });
    if (!accepted) throw new HttpError(404, "Transaction not found");
    // The authenticated provider lookup, not the notification, determines status.
    res.status(204).end();
  }));
  return router;
}
export const moonpayWebhookRouter = createMoonpayWebhookRouter(createRampRepository(databaseService), () => {
  const config = rampSandboxConfigSchema.safeParse(process.env);
  if (!config.success || config.data.RAMPS_SANDBOX_ENABLED !== "true" ||
      !["moonpay", "both"].includes(config.data.RAMPS_SANDBOX_PROVIDERS)) return null;
  try { return new MoonpaySandbox(config.data); } catch { return null; }
});
