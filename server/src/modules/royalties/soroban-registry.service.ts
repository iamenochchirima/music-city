import { createHash } from "node:crypto";

import {
  sorobanTrackSplitSchema,
  type SorobanTrackSplit,
  type TrackRoyaltySplitRecord,
} from "@music-city/shared";
import { Keypair, TransactionBuilder } from "@stellar/stellar-sdk";

import { env } from "../../config/env.js";
import { treasuryConfigService } from "../../services/treasury-config.service.js";
import { HttpError } from "../../utils/http-error.js";
import {
  RoyaltySplitRegistryClient,
  type ContractSplitRecipient,
  type ContractTrackSplit,
} from "./royalty-split-registry.client.js";

const registryConfig = () => {
  const contractId = env.ROYALTY_REGISTRY_CONTRACT_ID?.trim();

  if (!contractId) {
    throw new HttpError(503, "Soroban royalty registry contract is not configured");
  }

  return {
    contractId,
    network: env.ROYALTY_REGISTRY_NETWORK,
    networkPassphrase: env.STELLAR_NETWORK_PASSPHRASE,
    rpcUrl: env.STELLAR_SOROBAN_RPC_URL,
  };
};

const canonicalSplitPayload = (split: TrackRoyaltySplitRecord) => ({
  trackId: split.trackId,
  version: split.version,
  recipients: split.recipients.map((recipient) => ({
    walletAddress: recipient.walletAddress,
    chain: recipient.chain,
    role: recipient.role,
    shareBps: recipient.shareBps,
  })),
});

const metadataHashForSplit = (split: TrackRoyaltySplitRecord) =>
  createHash("sha256")
    .update(JSON.stringify(canonicalSplitPayload(split)))
    .digest("hex");

const toContractRecipients = (
  split: TrackRoyaltySplitRecord,
): ContractSplitRecipient[] =>
  split.recipients.map((recipient) => ({
    wallet_address: recipient.walletAddress,
    chain: recipient.chain,
    role: recipient.role,
    share_bps: recipient.shareBps,
  }));

const fromContractSplit = (split: ContractTrackSplit): SorobanTrackSplit =>
  sorobanTrackSplitSchema.parse({
    version: split.version,
    recipients: split.recipients.map((recipient) => ({
      walletAddress: recipient.wallet_address,
      chain: recipient.chain,
      role: recipient.role,
      shareBps: recipient.share_bps,
    })),
    metadataHash: Buffer.from(split.metadata_hash).toString("hex"),
    frozen: split.frozen,
    updatedLedger: split.updated_ledger,
  });

const explorerBaseUrl = () =>
  env.ROYALTY_REGISTRY_NETWORK.toLowerCase().includes("testnet")
    ? "https://stellar.expert/explorer/testnet"
    : "https://stellar.expert/explorer/public";

const createReadClient = () => {
  const config = registryConfig();

  return new RoyaltySplitRegistryClient({
    contractId: config.contractId,
    networkPassphrase: config.networkPassphrase,
    rpcUrl: config.rpcUrl,
  });
};

const createWriteClient = async () => {
  const config = registryConfig();
  const configuredAddress = await treasuryConfigService.getConfiguredWalletAddress();

  if (!env.STELLAR_TREASURY_SECRET) {
    throw new HttpError(
      501,
      "STELLAR_TREASURY_SECRET is required to publish royalty splits to Soroban",
    );
  }

  const keypair = Keypair.fromSecret(env.STELLAR_TREASURY_SECRET);

  if (!configuredAddress || keypair.publicKey() !== configuredAddress) {
    throw new HttpError(
      500,
      "The configured Stellar treasury signer does not match the royalty registry administrator",
    );
  }

  const client = new RoyaltySplitRegistryClient({
    contractId: config.contractId,
    networkPassphrase: config.networkPassphrase,
    rpcUrl: config.rpcUrl,
    publicKey: keypair.publicKey(),
    signTransaction: async (transactionXdr, options) => {
      const transaction = TransactionBuilder.fromXDR(
        transactionXdr,
        options?.networkPassphrase ?? config.networkPassphrase,
      );
      transaction.sign(keypair);

      return {
        signedTxXdr: transaction.toXDR(),
        signerAddress: keypair.publicKey(),
      };
    },
  });

  const admin = (await client.admin()).result;
  if (admin !== keypair.publicKey()) {
    throw new HttpError(
      500,
      "The Stellar treasury signer is not the administrator of the configured royalty registry contract",
    );
  }

  return client;
};

export const sorobanRegistryService = {
  getConfig() {
    return registryConfig();
  },

  metadataHashForSplit,

  contractExplorerUrl() {
    return `${explorerBaseUrl()}/contract/${registryConfig().contractId}`;
  },

  transactionExplorerUrl(txHash: string) {
    return `${explorerBaseUrl()}/tx/${txHash}`;
  },

  async getTrackSplit(trackId: string): Promise<SorobanTrackSplit | undefined> {
    try {
      const assembled = await createReadClient().get_track_split({ track_id: trackId });
      return assembled.result ? fromContractSplit(assembled.result) : undefined;
    } catch (error) {
      throw new HttpError(
        502,
        `Unable to read the Soroban royalty registry: ${error instanceof Error ? error.message : "unknown RPC error"}`,
      );
    }
  },

  async getTrackSplitVersion(
    trackId: string,
    version: number,
  ): Promise<SorobanTrackSplit | undefined> {
    try {
      const assembled = await createReadClient().get_track_split_version({
        track_id: trackId,
        version,
      });
      return assembled.result ? fromContractSplit(assembled.result) : undefined;
    } catch (error) {
      throw new HttpError(
        502,
        `Unable to read Soroban royalty split version ${version}: ${error instanceof Error ? error.message : "unknown RPC error"}`,
      );
    }
  },

  async publishTrackSplit(split: TrackRoyaltySplitRecord) {
    const config = registryConfig();
    const metadataHash = metadataHashForSplit(split);

    try {
      const client = await createWriteClient();
      const assembled = await client.set_track_split(
        {
          track_id: split.trackId,
          version: split.version,
          recipients: toContractRecipients(split),
          metadata_hash: Buffer.from(metadataHash, "hex"),
        },
        { timeoutInSeconds: 45 },
      );

      if (assembled.result.isErr()) {
        throw new Error(assembled.result.unwrapErr().message);
      }

      const sent = await assembled.signAndSend();
      const published = fromContractSplit(sent.result.unwrap());
      const txHash =
        sent.sendTransactionResponse?.hash ?? sent.getTransactionResponse?.txHash;

      if (!txHash) {
        throw new Error("Soroban submission completed without a transaction hash");
      }

      return {
        onChainSplit: published,
        metadataHash,
        txHash,
        ledger:
          sent.getTransactionResponse?.status === "SUCCESS"
            ? sent.getTransactionResponse.ledger
            : undefined,
        contractId: config.contractId,
        network: config.network,
        explorerUrl: this.transactionExplorerUrl(txHash),
      };
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }

      throw new HttpError(
        502,
        `Unable to publish the royalty split to Soroban: ${error instanceof Error ? error.message : "unknown RPC error"}`,
      );
    }
  },
};
