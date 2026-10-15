import { createHash } from "node:crypto";
import {
  Account,
  Asset,
  BASE_FEE,
  Contract,
  Networks,
  TransactionBuilder,
  Operation,
  nativeToScVal,
  scValToNative,
  xdr,
  type Transaction,
} from "@stellar/stellar-sdk";
import { Api, Server } from "@stellar/stellar-sdk/rpc";
import {
  settlementConfigSchema,
  type SettlementBatch,
  type SettlementConfig,
} from "@music-city/shared";
import { env } from "../../config/env.js";
import { HttpError } from "../../utils/http-error.js";
import { agreementsChain } from "../agreements/agreements-chain.js";
import {
  verifyTreasuryConfiguration,
  type TreasuryAccount,
} from "../agreements/treasury-signatures.js";
import { amountUnits } from "./settlement-domain.js";

const rpc = () => new Server(env.STELLAR_SOROBAN_RPC_URL, { timeout: 15000 });
export function settlementConfig(): SettlementConfig {
  const agreement = agreementsChain.config();
  if (
    !env.SETTLEMENT_CONTRACT_ID ||
    env.STELLAR_SETTLEMENT_ASSET_CODE !== "USDC" ||
    !env.STELLAR_SETTLEMENT_ASSET_ISSUER ||
    !([Networks.TESTNET, Networks.PUBLIC] as string[]).includes(
      agreement.networkPassphrase,
    )
  )
    throw new HttpError(
      503,
      "Settlement requires an explicit contract, Stellar network, and USDC issuer",
    );
  const issuer =
    agreement.networkPassphrase === Networks.TESTNET
      ? "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"
      : "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";
  if (env.STELLAR_SETTLEMENT_ASSET_ISSUER !== issuer)
    throw new HttpError(
      503,
      "Configured asset is not Circle USDC on the selected Stellar network",
    );
  return settlementConfigSchema.parse({
    contractId: env.SETTLEMENT_CONTRACT_ID,
    registryId: agreement.contractId,
    assetContractId: new Asset(
      "USDC",
      env.STELLAR_SETTLEMENT_ASSET_ISSUER,
    ).contractId(agreement.networkPassphrase),
    treasuryAddress: agreement.treasuryAddress,
    networkPassphrase: agreement.networkPassphrase,
    assetCode: "USDC",
    assetIssuer: env.STELLAR_SETTLEMENT_ASSET_ISSUER,
  });
}
export function requireSettlementConfig(config: SettlementConfig) {
  if (JSON.stringify(config) !== JSON.stringify(settlementConfig()))
    throw new HttpError(
      409,
      "Restore this settlement's exact network, treasury, registry, contract and asset before continuing",
    );
}
function bytes(hash: string) {
  return nativeToScVal(Buffer.from(hash, "hex"));
}
export function settlementRequest(batch: SettlementBatch) {
  return nativeToScVal(
    {
      batch_id: Buffer.from(batch.id, "hex"),
      source_id: Buffer.from(batch.sourceKey, "hex"),
      track_id: batch.trackId,
      agreement_id: batch.agreementId,
      version: batch.version,
      proposal_hash: Buffer.from(batch.proposalHash, "hex"),
      gross_amount: BigInt(batch.grossUnits),
      fee_bps: batch.feeBps,
      expires_at: BigInt(Date.parse(batch.expiresAt) / 1000),
    },
    {
      type: {
        batch_id: ["symbol", "bytes"],
        source_id: ["symbol", "bytes"],
        track_id: ["symbol", "string"],
        agreement_id: ["symbol", "string"],
        version: ["symbol", "u32"],
        proposal_hash: ["symbol", "bytes"],
        gross_amount: ["symbol", "i128"],
        fee_bps: ["symbol", "u32"],
        expires_at: ["symbol", "u64"],
      },
    },
  );
}
export type ChainBatch = {
  request: {
    batch_id: Buffer;
    source_id: Buffer;
    track_id: string;
    agreement_id: string;
    version: number;
    proposal_hash: Buffer;
    gross_amount: bigint;
    fee_bps: number;
    expires_at: bigint;
  };
  claims: {
    beneficiary: string;
    amount: bigint;
    status: string[];
    updated_ledger: number;
  }[];
  funded: bigint;
  claimed: bigint;
  reclaimed: bigint;
  funded_ledger: number;
};
export function verifyChainBatch(batch: SettlementBatch, actual: ChainBatch) {
  const r = actual.request;
  if (
    Buffer.from(r.batch_id).toString("hex") !== batch.id ||
    Buffer.from(r.source_id).toString("hex") !== batch.sourceKey ||
    r.track_id !== batch.trackId ||
    r.agreement_id !== batch.agreementId ||
    r.version !== batch.version ||
    Buffer.from(r.proposal_hash).toString("hex") !== batch.proposalHash ||
    r.gross_amount !== BigInt(batch.grossUnits) ||
    r.fee_bps !== batch.feeBps ||
    r.expires_at !== BigInt(Date.parse(batch.expiresAt) / 1000) ||
    actual.funded !== BigInt(batch.fundedUnits) ||
    actual.claims.length !== batch.allocations.length
  )
    throw new HttpError(
      409,
      "On-chain settlement terms differ from reserved earnings",
    );
  let claimed = 0n,
    reclaimed = 0n,
    open = 0n;
  for (const a of batch.allocations) {
    const c = actual.claims[a.index]!;
    if (
      c.beneficiary !== a.beneficiary ||
      c.amount !== BigInt(a.amountUnits) ||
      c.status.length !== 1 ||
      !["Available", "Claimed", "Reclaimed"].includes(c.status[0]!)
    )
      throw new HttpError(
        409,
        "On-chain claim differs from its reserved allocation",
      );
    if (c.status[0] === "Claimed") claimed += c.amount;
    else if (c.status[0] === "Reclaimed") reclaimed += c.amount;
    else open += c.amount;
    if (
      (a.status === "claimed" && c.status[0] !== "Claimed") ||
      (a.status === "reclaimed" && c.status[0] !== "Reclaimed")
    )
      throw new HttpError(409, "A consumed on-chain claim regressed");
  }
  if (
    claimed !== actual.claimed ||
    reclaimed !== actual.reclaimed ||
    claimed + reclaimed + open !== actual.funded
  )
    throw new HttpError(409, "On-chain settlement conservation failed");
}
async function read(
  config: SettlementConfig,
  method: string,
  args: xdr.ScVal[],
) {
  const tx = new TransactionBuilder(new Account(config.treasuryAddress, "0"), {
    fee: BASE_FEE,
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(new Contract(config.contractId).call(method, ...args))
    .setTimeout(30)
    .build();
  const result = await rpc().simulateTransaction(tx);
  if (!Api.isSimulationSuccess(result) || !result.result)
    throw new HttpError(
      502,
      "Cannot verify settlement contract state. Archived state must be restored before proceeding",
    );
  return scValToNative(result.result.retval);
}
export const settlementChain = {
  config: settlementConfig,
  eventStartLedger() {
    if(!env.SETTLEMENT_DEPLOYMENT_LEDGER) throw new HttpError(503,"Configure the settlement contract deployment ledger before indexing financial events");
    return env.SETTLEMENT_DEPLOYMENT_LEDGER;
  },
  async events(cursor?:string) {
    const config=settlementConfig();
    const result=await rpc().getEvents({...(cursor?{cursor}:{startLedger:this.eventStartLedger()}),filters:[{type:"contract",contractIds:[config.contractId]}],limit:1000});
    const receipts=new Map<string,{ledger:number;feeCharged:string;envelope:string}>();
    const hashes=[...new Set(result.events.map(event=>event.txHash))];
    for(let offset=0;offset<hashes.length;offset+=5) {
      const chunk=await Promise.all(hashes.slice(offset,offset+5).map(async hash=>{
        const receipt=await rpc().getTransaction(hash);
        if(receipt.status!==Api.GetTransactionStatus.SUCCESS || receipt.txHash!==hash || TransactionBuilder.fromXDR(receipt.envelopeXdr,config.networkPassphrase).hash().toString("hex")!==hash) throw new HttpError(409,"A contract event has no verifiable successful transaction receipt");
        return [hash,{ledger:receipt.ledger,feeCharged:receipt.resultXdr.feeCharged().toString(),envelope:receipt.envelopeXdr.toXDR("base64")}] as const;
      }));
      for(const [hash,receipt] of chunk)receipts.set(hash,receipt);
    }
    return {
      cursor:result.cursor,latestLedger:result.latestLedger,caughtUp:result.events.length<1000,
      events:result.events.map(event=>{
        if(event.contractId?.contractId()!==config.contractId || !event.inSuccessfulContractCall) throw new HttpError(409,"Unexpected contract event identity");
        if(receipts.get(event.txHash)?.ledger!==event.ledger) throw new HttpError(409,"Contract event and transaction receipt ledgers differ");
        const topics=event.topic.map(scValToNative);
        if(topics[0]!=="music_city" || !["settlement_funded","claim_consumed"].includes(topics[1]) || !(topics[2] instanceof Uint8Array) || topics[2].length!==32) throw new HttpError(409,"Unsupported settlement event format");
        return {id:event.id,transactionHash:event.txHash,ledger:event.ledger,batchId:Buffer.from(topics[2]).toString("hex"),type:String(topics[1]),payload:{topics:event.topic.map(v=>v.toXDR("base64")),value:event.value.toXDR("base64"),ledgerClosedAt:new Date(event.ledgerClosedAt).toISOString(),receipt:receipts.get(event.txHash)!}};
      }),
    };
  },
  async treasurySigners(config = settlementConfig()) {
    requireSettlementConfig(config);
    const response = await fetch(
      `${env.STELLAR_HORIZON_URL}/accounts/${config.treasuryAddress}`,
    );
    if (!response.ok)
      throw new HttpError(502, "Cannot verify treasury signers");
    return verifyTreasuryConfiguration(
      (await response.json()) as TreasuryAccount,
      config.treasuryAddress,
    );
  },
  async verifyConfiguration(config = settlementConfig()) {
    requireSettlementConfig(config);
    const evidence = await agreementsChain.treasuryEvidence();
    const actual = await read(config, "configuration", []);
    if (
      actual.treasury !== config.treasuryAddress ||
      actual.registry !== config.registryId ||
      actual.asset !== config.assetContractId ||
      Buffer.from(actual.network).toString("hex") !==
        createHash("sha256").update(config.networkPassphrase).digest("hex")
    )
      throw new HttpError(
        409,
        "Settlement contract configuration does not match the intended treasury, registry, asset and network",
      );
    const instance=await rpc().getLedgerEntries(new Contract(config.contractId).getFootprint());
    if(instance.entries[0]?.lastModifiedLedgerSeq!==this.eventStartLedger()) throw new HttpError(409,"Settlement deployment ledger does not match the immutable contract instance. Restore archived instance data before retrying");
    return evidence;
  },
  async getBatch(batch: SettlementBatch): Promise<ChainBatch | null> {
    requireSettlementConfig(batch.config);
    const result = await read(batch.config, "get_batch", [bytes(batch.id)]);
    if (result !== null && result !== undefined) {
      verifyChainBatch(batch, result as ChainBatch);
      return result as ChainBatch;
    }
    return null;
  },
  async escrowBalance(config = settlementConfig()): Promise<bigint> {
    requireSettlementConfig(config);
    return BigInt(
      await read({ ...config, contractId: config.assetContractId }, "balance", [
        nativeToScVal(config.contractId, { type: "address" }),
      ]),
    );
  },
  async readiness(
    wallet: string,
    config: SettlementConfig,
    amount: string,
    incoming: boolean,
  ) {
    const response = await fetch(
      `${env.STELLAR_HORIZON_URL}/accounts/${encodeURIComponent(wallet)}`,
      { signal: AbortSignal.timeout(15000) },
    );
    if (response.status === 404)
      throw new HttpError(
        409,
        "Fund this Stellar account with XLM before continuing",
      );
    if (!response.ok)
      throw new HttpError(502, "Unable to verify wallet readiness");
    const account = (await response.json()) as {
      subentry_count: number;
      num_sponsoring?: number;
      num_sponsored?: number;
      balances: {
        asset_type: string;
        asset_code?: string;
        asset_issuer?: string;
        balance: string;
        limit?: string;
        buying_liabilities?: string;
        selling_liabilities?: string;
        is_authorized?: boolean;
      }[];
    };
    const line = account.balances.find(
      (b) =>
        b.asset_code === config.assetCode &&
        b.asset_issuer === config.assetIssuer,
    );
    if (!line)
      throw new HttpError(
        409,
        "Add the configured USDC trustline in your wallet before continuing",
      );
    if (line.is_authorized === false)
      throw new HttpError(
        409,
        "The USDC issuer has not authorized this trustline",
      );
    const available = incoming
      ? amountUnits(line.limit ?? "0") -
        amountUnits(line.balance) -
        amountUnits(line.buying_liabilities ?? "0")
      : amountUnits(line.balance) -
        amountUnits(line.selling_liabilities ?? "0");
    if (available < BigInt(amount))
      throw new HttpError(
        409,
        incoming
          ? "Increase your USDC trustline limit before claiming"
          : "The settlement treasury has insufficient USDC",
      );
    const native = account.balances.find((b) => b.asset_type === "native");
    if (!native)
      throw new HttpError(
        409,
        "Fund this wallet with XLM for transaction fees",
      );
    const ledgerResponse = await fetch(
      `${env.STELLAR_HORIZON_URL}/ledgers?order=desc&limit=1`,
      { signal: AbortSignal.timeout(15000) },
    );
    if (!ledgerResponse.ok)
      throw new HttpError(
        502,
        "Cannot verify the Stellar reserve required for transaction fees",
      );
    const ledger = (await ledgerResponse.json()) as {
      _embedded: { records: { base_reserve_in_stroops: number }[] };
    };
    const baseReserve = ledger._embedded?.records[0]?.base_reserve_in_stroops;
    if (
      !Number.isSafeInteger(baseReserve) ||
      baseReserve! <= 0 ||
      !Number.isSafeInteger(account.subentry_count)
    )
      throw new HttpError(502, "Invalid Stellar account reserve evidence");
    const reserveUnits =
      BigInt(
        2 +
          account.subentry_count +
          (account.num_sponsoring ?? 0) -
          (account.num_sponsored ?? 0),
      ) * BigInt(baseReserve!);
    const nativeAvailableUnits =
      amountUnits(native.balance) -
      amountUnits(native.selling_liabilities ?? "0") -
      reserveUnits;
    if (nativeAvailableUnits <= 0n)
      throw new HttpError(
        409,
        "Add XLM above your account reserve to pay transaction fees",
      );
    return { nativeAvailableUnits };
  },
  async prepare(
    batch: SettlementBatch,
    kind: "settle" | "claim" | "reclaim" | "maintain",
    index?: number,
  ) {
    requireSettlementConfig(batch.config);
    const signers = await this.treasurySigners(batch.config);
    if (kind !== "maintain") await this.verifyConfiguration(batch.config);
    const source =
      kind === "claim"
        ? batch.allocations[index!]!.beneficiary
        : batch.config.treasuryAddress;
    const readiness =
      kind === "maintain"
        ? null
        : await this.readiness(
            source,
            batch.config,
            kind === "settle"
              ? batch.fundedUnits
              : batch.allocations[index!]!.amountUnits,
            kind !== "settle",
          );
    const args =
      kind === "settle"
        ? [settlementRequest(batch)]
        : kind === "maintain"
          ? [bytes(batch.id)]
          : [bytes(batch.id), nativeToScVal(index!, { type: "u32" })];
    const tx = new TransactionBuilder(await rpc().getAccount(source), {
      fee: BASE_FEE,
      networkPassphrase: batch.config.networkPassphrase,
    })
      .addOperation(
        new Contract(batch.config.contractId).call(
          kind === "maintain" ? "get_batch" : kind,
          ...args,
        ),
      )
      .setTimeout(600)
      .build();
    let simulation = await rpc().simulateTransaction(tx);
    if (kind === "maintain" && !Api.isSimulationRestore(simulation)) {
      for (const [contract, method, args] of [
        [
          batch.config.assetContractId,
          "balance",
          [nativeToScVal(batch.config.contractId, { type: "address" })],
        ],
        [
          batch.config.registryId,
          "get_finalized_version",
          [
            nativeToScVal(batch.trackId),
            nativeToScVal(batch.version, { type: "u32" }),
          ],
        ],
      ] as const) {
        const probe = new TransactionBuilder(await rpc().getAccount(source), {
          fee: BASE_FEE,
          networkPassphrase: batch.config.networkPassphrase,
        })
          .addOperation(new Contract(contract).call(method, ...args))
          .setTimeout(600)
          .build();
        const result = await rpc().simulateTransaction(probe);
        if (Api.isSimulationRestore(result)) {
          simulation = result;
          break;
        }
      }
    }
    const restoring = Api.isSimulationRestore(simulation);
    if (restoring && kind !== "maintain")
      throw new HttpError(
        409,
        "Archived financial records need treasury-authorized restoration. Ask an administrator to maintain this settlement",
      );
    const prepared = Api.isSimulationRestore(simulation)
      ? new TransactionBuilder(await rpc().getAccount(source), {
          fee: (
            BigInt(BASE_FEE) + BigInt(simulation.restorePreamble.minResourceFee)
          ).toString(),
          networkPassphrase: batch.config.networkPassphrase,
        })
          .setSorobanData(simulation.restorePreamble.transactionData.build())
          .addOperation(Operation.restoreFootprint({}))
          .setTimeout(600)
          .build()
      : await rpc().prepareTransaction(tx);
    if (readiness && readiness.nativeAvailableUnits < BigInt(prepared.fee))
      throw new HttpError(
        409,
        "Add XLM to cover this withdrawal's network fee above your account reserve",
      );
    return {
      kind: restoring ? ("restore" as const) : undefined,
      treasuryAddress: source,
      networkPassphrase: batch.config.networkPassphrase,
      signers: kind === "claim" ? [source] : signers,
      transaction: prepared.toXDR(),
      transactionHash: prepared.hash().toString("hex"),
      expiresAt: new Date(
        Number(prepared.timeBounds!.maxTime) * 1000,
      ).toISOString(),
    };
  },
  send(tx: Transaction) {
    return rpc().sendTransaction(tx);
  },
  status(hash: string) {
    return rpc().getTransaction(hash);
  },
};
