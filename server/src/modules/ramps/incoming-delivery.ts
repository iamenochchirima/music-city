import { z } from "zod";
import { rampOrderSchema, rampProviderObservationSchema, type RampOrder } from "@music-city/shared";
import { HttpError } from "../../utils/http-error.js";

const horizon = "https://horizon-testnet.stellar.org";
const paymentSchema = z.object({
  id: z.string().regex(/^[0-9]+$/), transaction_hash: z.string(), transaction_successful: z.boolean(),
  type: z.string(), to: z.string().optional(), asset_type: z.string().optional(),
  asset_code: z.string().optional(), asset_issuer: z.string().optional(), amount: z.string().optional(),
});
function paymentUnits(value: string): string | null {
  const match = /^(0|[1-9][0-9]*)(?:\.([0-9]{1,7}))?$/.exec(value);
  if (!match) return null;
  return BigInt(`${match[1]}${(match[2] ?? "").padEnd(7, "0")}`).toString();
}
export type IncomingDelivery = { transactionHash: string; operationId: string; ledger: number; assetUnits: string };

// A provider response selects the transaction and amount; Horizon proves delivery to the pinned wallet.
export async function verifyIncomingDelivery(rawOrder: RampOrder, rawObservation: z.infer<typeof rampProviderObservationSchema>, fetcher: typeof fetch = fetch): Promise<IncomingDelivery | null> {
  const order = rampOrderSchema.parse(rawOrder);
  const observation = rampProviderObservationSchema.parse(rawObservation);
  if (order.terms.direction !== "buy" || order.terms.network !== "stellar:testnet" ||
      observation.externalId !== order.id || (order.providerTransactionId && observation.id !== order.providerTransactionId) || observation.state !== "completed" ||
      !observation.chainHash || !observation.assetUnits || observation.assetUnits === "0") return null;
  const get = async (path: string) => {
    let response: Response;
    try { response = await fetcher(new URL(path, horizon), { redirect: "error", signal: AbortSignal.timeout(10000) }); }
    catch { throw new HttpError(502, "Unable to check the Stellar transfer"); }
    if (response.status === 404) return null;
    if (!response.ok) throw new HttpError(502, "Unable to check the Stellar transfer");
    try { return await response.json() as unknown; }
    catch { throw new HttpError(502, "Stellar returned an unreadable transfer"); }
  };
  const [transactionBody, operationBody] = await Promise.all([
    get(`/transactions/${observation.chainHash}`),
    get(`/transactions/${observation.chainHash}/operations?limit=200`),
  ]);
  if (!transactionBody || !operationBody) return null;
  const transaction = z.object({ hash: z.string(), successful: z.boolean(), ledger: z.number().int().positive(), operation_count: z.number().int().nonnegative().max(200) }).parse(transactionBody);
  if (transaction.hash !== observation.chainHash || !transaction.successful) throw new HttpError(409, "The Stellar transfer could not be verified");
  const operations = z.object({ _embedded: z.object({ records: z.array(paymentSchema).max(200) }) }).parse(operationBody)._embedded.records;
  if (operations.length !== transaction.operation_count) throw new HttpError(409, "The Stellar transfer is incomplete");
  const matches = operations.filter((operation) => operation.transaction_hash === observation.chainHash && operation.transaction_successful &&
    operation.type === "payment" && operation.to === order.terms.walletAddress &&
    (order.terms.assetCode === "XLM" ? operation.asset_type === "native" :
      operation.asset_type === "credit_alphanum4" && operation.asset_code === "USDC" && operation.asset_issuer === order.terms.assetIssuer) &&
    operation.amount !== undefined && paymentUnits(operation.amount) === observation.assetUnits);
  if (matches.length !== 1) throw new HttpError(409, "The Stellar transfer does not match the payment");
  return { transactionHash: observation.chainHash, operationId: matches[0].id, ledger: transaction.ledger, assetUnits: observation.assetUnits };
}
