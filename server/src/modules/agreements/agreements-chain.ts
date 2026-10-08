import { Account, BASE_FEE, Contract, nativeToScVal, scValToNative, TransactionBuilder, type Transaction, xdr } from "@stellar/stellar-sdk";
import { Server, Api } from "@stellar/stellar-sdk/rpc";
import { finalizedAgreementSplitSchema, type AgreementVersion, type FinalizedAgreementSplit } from "@music-city/shared";
import { env } from "../../config/env.js";
import { HttpError } from "../../utils/http-error.js";
import { verifyTreasuryConfiguration, type TreasuryAccount } from "./treasury-signatures.js";

const rpc = () => new Server(env.STELLAR_SOROBAN_RPC_URL);
export function agreementChainConfig() {
  if (!env.AGREEMENT_TREASURY_ADDRESS || !env.ROYALTY_REGISTRY_CONTRACT_ID) throw new HttpError(503,"Agreement treasury and finalized-split registry must be configured explicitly");
  return { treasuryAddress: env.AGREEMENT_TREASURY_ADDRESS, contractId: env.ROYALTY_REGISTRY_CONTRACT_ID,networkPassphrase: env.STELLAR_NETWORK_PASSPHRASE };
}
export function decodeFinalizedSplit(value: xdr.ScVal): FinalizedAgreementSplit | null {
  const result = scValToNative(value);
  if (result == null) return null;
  return finalizedAgreementSplitSchema.parse({ agreementId: result.agreement_id,version: result.version,proposalHash: Buffer.from(result.proposal_hash).toString("hex"),previousFinalizedHash: Buffer.from(result.previous_finalized_hash).toString("hex"),finalizedLedger: result.finalized_ledger,recipients: result.recipients.map((r: { wallet: string; role: string; share_bps: number }) => ({ walletAddress: r.wallet,role: r.role,shareBps: r.share_bps })) });
}
async function read(method: string, args: xdr.ScVal[], config = agreementChainConfig()) {
  const server = rpc();
  const tx = new TransactionBuilder(new Account(config.treasuryAddress,"0"),{ fee: BASE_FEE,networkPassphrase: config.networkPassphrase }).addOperation(new Contract(config.contractId).call(method,...args)).setTimeout(30).build();
  const result = await server.simulateTransaction(tx);
  if (!Api.isSimulationSuccess(result) || !result.result) throw new HttpError(502,"Unable to read the finalized-split registry");
  return result.result.retval;
}
export function assertPublicationMatches(version: AgreementVersion, actual: FinalizedAgreementSplit, previousHash: string) {
  if (actual.agreementId !== version.proposal.agreementId || actual.version !== version.proposal.version || actual.proposalHash !== version.proposalHash || actual.previousFinalizedHash !== previousHash || JSON.stringify(actual.recipients) !== JSON.stringify(version.proposal.recipients)) {
    throw new HttpError(409,"Confirmed Soroban publication does not match the contributor-approved agreement");
  }
}
export const agreementsChain = {
  config: agreementChainConfig,
  async treasuryEvidence() {
    const config = agreementChainConfig();
    const response = await fetch(`${env.STELLAR_HORIZON_URL}/accounts/${config.treasuryAddress}`);
    if (!response.ok) throw new HttpError(502,"Unable to verify the agreement treasury account");
    const account = await response.json() as TreasuryAccount;
    const signers = verifyTreasuryConfiguration(account,config.treasuryAddress);
    const treasury = scValToNative(await read("treasury",[],config));
    if (treasury !== config.treasuryAddress) throw new HttpError(409,"Configured registry treasury does not match the agreement treasury");
    return { ...config,signers,threshold: 2,account };
  },
  async getVersion(trackId: string,version: number) { return decodeFinalizedSplit(await read("get_finalized_version",[nativeToScVal(trackId),nativeToScVal(version,{ type: "u32" })])); },
  async getLatest(trackId: string) { return decodeFinalizedSplit(await read("get_finalized_split",[nativeToScVal(trackId)])); },
  async prepare(version: AgreementVersion,previousHash: string) {
    const evidence = await this.treasuryEvidence();
    if (evidence.networkPassphrase !== version.proposal.networkPassphrase) throw new HttpError(409,"Agreement and configured network do not match");
    const account = await rpc().getAccount(evidence.treasuryAddress);
    const recipients = xdr.ScVal.scvVec(version.proposal.recipients.map(r => nativeToScVal({ wallet: r.walletAddress,role: r.role,share_bps: r.shareBps },{ type: { wallet: ["symbol","address"],role: ["symbol","string"],share_bps: ["symbol","u32"] } })));
    const tx = new TransactionBuilder(account,{ fee: BASE_FEE,networkPassphrase: evidence.networkPassphrase }).addOperation(new Contract(evidence.contractId).call("finalize_split",nativeToScVal(version.proposal.trackId),nativeToScVal(version.proposal.agreementId),nativeToScVal(version.proposal.version,{ type: "u32" }),recipients,nativeToScVal(Buffer.from(version.proposalHash,"hex")),nativeToScVal(Buffer.from(previousHash,"hex")))).setTimeout(600).build();
    const prepared = await rpc().prepareTransaction(tx);
    return { ...evidence,transaction: prepared.toXDR(),transactionHash: prepared.hash().toString("hex"),expiresAt: new Date(Number(prepared.timeBounds!.maxTime) * 1000).toISOString() };
  },
  async send(transaction: Transaction) { return rpc().sendTransaction(transaction); },
  async status(hash: string) { return rpc().getTransaction(hash); },
};
