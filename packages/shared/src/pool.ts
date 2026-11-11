import {z} from "zod";
import {financialAttemptSchema} from "./settlements.js";
const hash=z.string().regex(/^[a-f0-9]{64}$/);
const units=z.string().regex(/^(0|[1-9][0-9]*)$/);
export const poolOrderSchema=z.object({
 id:hash,contractId:z.string(),trackId:z.string(),version:z.number().int().positive(),proposalHash:hash,buyer:z.string(),grossUnits:units,
 transactionHash:hash,ledger:z.number().int(),
 claims:z.array(z.object({index:z.number().int(),beneficiary:z.string(),grossUnits:units,feeUnits:units,amountUnits:units,claimed:z.boolean(),ledger:z.number().int()})).min(1).max(20),
});
export type PoolOrder=z.infer<typeof poolOrderSchema>;
export const poolAttemptSchema=financialAttemptSchema.extend({poolContractId:z.string(),poolAction:z.enum(["top_up","return_surplus","claim"]),amountUnits:units,signatureApprovals:z.array(z.object({signerWallet:z.string(),actor:z.string(),actorName:z.string(),createdAt:z.string()})).optional()});
export type PoolAttempt=z.infer<typeof poolAttemptSchema>;
