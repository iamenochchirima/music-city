import { Keypair, StrKey, Transaction, TransactionBuilder } from "@stellar/stellar-sdk";
import type { AgreementFinalization } from "@music-city/shared";
import { HttpError } from "../../utils/http-error.js";

export type TreasuryAccount = { account_id: string; thresholds: { low_threshold: number; med_threshold: number; high_threshold: number }; signers: { key: string; type: string; weight: number }[] };
export function verifyTreasuryConfiguration(account: TreasuryAccount, expected: string): string[] {
  const signers = account.signers.filter(s => s.weight > 0);
  if (account.account_id !== expected || !StrKey.isValidEd25519PublicKey(expected) ||
    signers.length !== 3 || new Set(signers.map(s => s.key)).size !== 3 ||
    signers.some(s => s.type !== "ed25519_public_key" || s.weight !== 1 || !StrKey.isValidEd25519PublicKey(s.key)) ||
    account.thresholds.low_threshold !== 2 || account.thresholds.med_threshold !== 2 || account.thresholds.high_threshold !== 2) {
    throw new HttpError(409,"Agreement treasury must have exactly three independent Ed25519 signers of weight one and all thresholds set to two");
  }
  return signers.map(s => s.key).sort();
}
export function verifyTreasuryEnvelope(attempt: AgreementFinalization, signedXdr: string): Record<string, string> {
  const expected = TransactionBuilder.fromXDR(attempt.transaction,attempt.networkPassphrase);
  let signed;
  try { signed = TransactionBuilder.fromXDR(signedXdr,attempt.networkPassphrase); }
  catch { throw new HttpError(400,"Invalid signed transaction XDR"); }
  if (!(signed instanceof Transaction) || signed.source !== attempt.treasuryAddress || !signed.hash().equals(expected.hash()) || signed.hash().toString("hex") !== attempt.transactionHash) {
    throw new HttpError(400,"Treasury signatures must authorize the exact prepared transaction");
  }
  const signatures: Record<string, string> = {};
  if (!signed.signatures.length) throw new HttpError(400,"No treasury signature supplied");
  for (const signature of signed.signatures) {
    const signer = attempt.signers.find(key => Keypair.fromPublicKey(key).verify(signed.hash(),signature.signature()));
    if (!signer) throw new HttpError(403,"Transaction contains a signature outside the configured treasury signer set");
    signatures[signer] = signature.signature().toString("base64");
  }
  return signatures;
}
export function collectTreasurySignatures(attempt: AgreementFinalization, signedXdr: string, now = new Date()): AgreementFinalization {
  if (attempt.status !== "awaiting_signatures") throw new HttpError(409,"This attempt is no longer collecting signatures");
  if (new Date(attempt.expiresAt).getTime() <= now.getTime()) throw new HttpError(409,"Reconcile the expired finalization before preparing another transaction");
  const signatures = { ...attempt.signatures, ...verifyTreasuryEnvelope(attempt,signedXdr) };
  return { ...attempt, signatures,signedBy: Object.keys(signatures).sort(),updatedAt: now.toISOString() };
}
export function signedTreasuryTransaction(attempt: AgreementFinalization): Transaction {
  if (attempt.signedBy.length < 2 || new Set(attempt.signedBy).size !== attempt.signedBy.length) throw new HttpError(409,"Two independent treasury signatures are required");
  const tx = TransactionBuilder.fromXDR(attempt.transaction,attempt.networkPassphrase);
  if (!(tx instanceof Transaction) || tx.hash().toString("hex") !== attempt.transactionHash) throw new HttpError(409,"Finalization transaction integrity failed");
  for (const signer of attempt.signedBy) {
    const signature = attempt.signatures[signer];
    if (!attempt.signers.includes(signer) || !signature || !Keypair.fromPublicKey(signer).verify(tx.hash(),Buffer.from(signature,"base64"))) throw new HttpError(403,"Invalid treasury signature evidence");
    tx.addSignature(signer,signature);
  }
  return tx;
}
