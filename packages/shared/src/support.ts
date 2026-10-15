import { z } from "zod";

export const supportTargetSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("artist"),
      profileId: z.string().min(1).max(160),
    })
    .strict(),
  z
    .object({
      kind: z.literal("contributor"),
      profileId: z.string().min(1).max(160),
      trackId: z.string().min(1).max(160),
    })
    .strict(),
]);
export type SupportTarget = z.infer<typeof supportTargetSchema>;
export const prepareSupportSchema = z
  .object({
    target: supportTargetSchema,
    amount: z
      .string()
      .regex(
        /^(0|[1-9]\d{0,11})(\.\d{1,7})?$/,
        "Enter an amount with up to 7 decimal places",
      )
      .refine((v) => /[1-9]/.test(v), "Enter an amount greater than zero"),
    requestKey: z.string().uuid(),
  })
  .strict();
export type PrepareSupportInput = z.infer<typeof prepareSupportSchema>;
export type SupportRecipient = {
  target: SupportTarget;
  name: string;
  walletAddress: string;
  role: string;
};
export type SupportPayment = {
  id: string;
  requestKey: string;
  sender: string;
  senderName: string;
  recipient: SupportRecipient;
  amount: string;
  assetCode: "USDC";
  assetIssuer: string;
  networkPassphrase: string;
  transactionHash: string;
  preparedLedger: number;
  transaction: string;
  status:
    | "prepared"
    | "submitting"
    | "confirmed"
    | "failed"
    | "expired"
    | "cancelled";
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  submissionCount: number;
  lastSubmittedAt?: string;
  ledger?: number;
  feeCharged?: string;
  error?: string;
};
