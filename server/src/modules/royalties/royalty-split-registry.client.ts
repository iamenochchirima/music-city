// Generated from contracts/royalty-split-registry with Stellar CLI 27.0.0.
// Regenerate after changing the public contract interface.
import {
  Client as ContractClient,
  Spec as ContractSpec,
  type AssembledTransaction,
  type ClientOptions as ContractClientOptions,
  type MethodOptions,
  type Option,
  type Result,
  type u32,
} from "@stellar/stellar-sdk/contract";

export interface ContractTrackSplit {
  frozen: boolean;
  metadata_hash: Buffer;
  recipients: ContractSplitRecipient[];
  updated_ledger: u32;
  version: u32;
}

export interface ContractSplitRecipient {
  chain: string;
  role: string;
  share_bps: u32;
  wallet_address: string;
}

export const RegistryError = {
  1: { message: "AlreadyInitialized" },
  2: { message: "InvalidRecipientCount" },
  3: { message: "InvalidRecipient" },
  4: { message: "InvalidTotalBps" },
  5: { message: "DuplicateRecipient" },
  6: { message: "InvalidVersion" },
  7: { message: "SplitNotFound" },
  8: { message: "TrackFrozen" },
  9: { message: "VersionMismatch" },
};

export interface RoyaltySplitRegistryClient {
  admin: (options?: MethodOptions) => Promise<AssembledTransaction<string>>;
  get_track_split: (
    { track_id }: { track_id: string },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<Option<ContractTrackSplit>>>;
  get_track_split_version: (
    { track_id, version }: { track_id: string; version: u32 },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<Option<ContractTrackSplit>>>;
  set_track_split: (
    {
      track_id,
      version,
      recipients,
      metadata_hash,
    }: {
      track_id: string;
      version: u32;
      recipients: ContractSplitRecipient[];
      metadata_hash: Buffer;
    },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<Result<ContractTrackSplit>>>;
  freeze_track_split: (
    { track_id, version }: { track_id: string; version: u32 },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<Result<ContractTrackSplit>>>;
}

export class RoyaltySplitRegistryClient extends ContractClient {
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([
        "AAAABQAAAAAAAAAAAAAACFNwbGl0U2V0AAAAAgAAAAptdXNpY19jaXR5AAAAAAAJc3BsaXRfc2V0AAAAAAAAAwAAAAAAAAAHdmVyc2lvbgAAAAAEAAAAAQAAAAAAAAAIdHJhY2tfaWQAAAAQAAAAAAAAAAAAAAANbWV0YWRhdGFfaGFzaAAAAAAAA+4AAAAgAAAAAAAAAAI=",
        "AAAAAQAAAAAAAAAAAAAAClRyYWNrU3BsaXQAAAAAAAUAAAAAAAAABmZyb3plbgAAAAAAAQAAAAAAAAANbWV0YWRhdGFfaGFzaAAAAAAAA+4AAAAgAAAAAAAAAApyZWNpcGllbnRzAAAAAAPqAAAH0AAAAA5TcGxpdFJlY2lwaWVudAAAAAAAAAAAAA51cGRhdGVkX2xlZGdlcgAAAAAABAAAAAAAAAAHdmVyc2lvbgAAAAAE",
        "AAAABQAAAAAAAAAAAAAAC1NwbGl0RnJvemVuAAAAAAIAAAAKbXVzaWNfY2l0eQAAAAAADHNwbGl0X2Zyb3plbgAAAAIAAAAAAAAAB3ZlcnNpb24AAAAABAAAAAEAAAAAAAAACHRyYWNrX2lkAAAAEAAAAAAAAAAC",
        "AAAABAAAAAAAAAAAAAAADVJlZ2lzdHJ5RXJyb3IAAAAAAAAJAAAAAAAAABJBbHJlYWR5SW5pdGlhbGl6ZWQAAAAAAAEAAAAAAAAAFUludmFsaWRSZWNpcGllbnRDb3VudAAAAAAAAAIAAAAAAAAAEEludmFsaWRSZWNpcGllbnQAAAADAAAAAAAAAA9JbnZhbGlkVG90YWxCcHMAAAAABAAAAAAAAAASRHVwbGljYXRlUmVjaXBpZW50AAAAAAAFAAAAAAAAAA5JbnZhbGlkVmVyc2lvbgAAAAAABgAAAAAAAAANU3BsaXROb3RGb3VuZAAAAAAAAAcAAAAAAAAAC1RyYWNrRnJvemVuAAAAAAgAAAAAAAAAD1ZlcnNpb25NaXNtYXRjaAAAAAAJ",
        "AAAAAQAAAAAAAAAAAAAADlNwbGl0UmVjaXBpZW50AAAAAAAEAAAAAAAAAAVjaGFpbgAAAAAAABAAAAAAAAAABHJvbGUAAAAQAAAAAAAAAAlzaGFyZV9icHMAAAAAAAAEAAAAAAAAAA53YWxsZXRfYWRkcmVzcwAAAAAAEA==",
        "AAAAAAAAAAAAAAAFYWRtaW4AAAAAAAAAAAAAAQAAABM=",
        "AAAAAAAAAAAAAAANX19jb25zdHJ1Y3RvcgAAAAAAAAEAAAAAAAAABWFkbWluAAAAAAAAEwAAAAEAAAPpAAAAAgAAB9AAAAANUmVnaXN0cnlFcnJvcgAAAA==",
        "AAAAAAAAAAAAAAAPZ2V0X3RyYWNrX3NwbGl0AAAAAAEAAAAAAAAACHRyYWNrX2lkAAAAEAAAAAEAAAPoAAAH0AAAAApUcmFja1NwbGl0AAA=",
        "AAAAAAAAAAAAAAAPc2V0X3RyYWNrX3NwbGl0AAAAAAQAAAAAAAAACHRyYWNrX2lkAAAAEAAAAAAAAAAHdmVyc2lvbgAAAAAEAAAAAAAAAApyZWNpcGllbnRzAAAAAAPqAAAH0AAAAA5TcGxpdFJlY2lwaWVudAAAAAAAAAAAAA1tZXRhZGF0YV9oYXNoAAAAAAAD7gAAACAAAAABAAAD6QAAB9AAAAAKVHJhY2tTcGxpdAAAAAAH0AAAAA1SZWdpc3RyeUVycm9yAAAA",
        "AAAAAAAAAAAAAAASZnJlZXplX3RyYWNrX3NwbGl0AAAAAAACAAAAAAAAAAh0cmFja19pZAAAABAAAAAAAAAAB3ZlcnNpb24AAAAABAAAAAEAAAPpAAAH0AAAAApUcmFja1NwbGl0AAAAAAfQAAAADVJlZ2lzdHJ5RXJyb3IAAAA=",
        "AAAAAAAAAAAAAAAXZ2V0X3RyYWNrX3NwbGl0X3ZlcnNpb24AAAAAAgAAAAAAAAAIdHJhY2tfaWQAAAAQAAAAAAAAAAd2ZXJzaW9uAAAAAAQAAAABAAAD6AAAB9AAAAAKVHJhY2tTcGxpdAAA",
      ]),
      {
        ...options,
        errorTypes: RegistryError,
      },
    );
  }
}
