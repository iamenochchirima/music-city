# Settlement contract and accounting specification

Implementation reference for SET-01 and SET-02 in the [SOW 2 tracker](sow-2-tracker.md). This document records the implemented interface. It does not record reviewer acceptance.

## Claim mechanism

`earnings-settlement` holds the configured USDC Stellar Asset Contract token. A claim identifier consists of the settlement contract ID, the batch SHA-256 hash, and the zero-based recipient index. These are contract-managed claimable balances. They are not native Stellar claimable-balance IDs. Soroban cannot create or consume native claimable balances directly.

The constructor fixes the treasury, registry, asset contract, and actual network ID. It checks the registry's treasury and seven-decimal asset precision. There is no upgrade, configuration setter, arbitrary recipient, or administrator withdrawal bypass. Deployment configuration also verifies the asset contract derived from the explicit USDC issuer and network.

## Allocation and source identity

One batch consumes one complete revenue source for one track and asset. It supports at most 20 recipients. A preview derives the gross source amount by summing recorded recipient gross allocations. The contract independently calculates allocations from that gross amount and the exact captured finalized registry version. The backend verifies those results against existing ledger amounts. It does not split each already allocated ledger amount again.

All amounts use integers in units of 0.0000001 USDC. Decimal inputs with more than seven places fail. The gross source cannot exceed signed 64-bit Stellar asset units. Each recipient except the last receives `floor(gross * shareBps / 10000)`. The last receives the remaining gross units, in the registry's immutable proposal order. Each recipient's fee is `floor(recipientGross * feeBps / 10000)`. Net amounts, including zero allocations, determine claims. Fees remain in treasury and are distinct from transaction fees.

New ledger entries capture `feeBps`. Historical entries without captured fee terms or verified finalized agreement evidence require explicit resolution. They are not silently reinterpreted using current settings.

The source key hashes the schema marker, network passphrase, asset contract, track ID, source type, and source ID. It excludes agreement version so amendments cannot pay the same source again. The batch ID hashes the source key, agreement evidence, amounts, fee terms, expiry, complete configuration, and ordered allocations with ledger IDs. The backend preserves exact configuration and checks it before every transaction.

## Claims, expiry, and authorization

Expiry is an absolute Unix timestamp in whole seconds. The contract permits funding only before expiry and at most seven days before it. The backend requires at least ten minutes at preview. Claims succeed strictly before expiry. Recovery succeeds at or after expiry. Both change one available claim to a terminal state atomically with its token transfer.

Funding and recovery require the treasury account's authorization. The backend verifies exactly three positive-weight Ed25519 signers, weight one each, and low, medium, and high thresholds all two. Claims require the fixed beneficiary account's own authorization. No operation accepts a destination override. Cancellation before submission does not consume a claim.

Protected administrator actions are agreement finalization, settlement funding, and expiry recovery. Financial configuration is immutable on chain. An application administrator cannot bypass chain authorization. Replaced payout and mutable financial configuration controls must be retired before rollout completes.

## Persistence and recovery

`settlement_batches` records fixed terms and current verified state. `settlement_reservations` permanently binds each ledger entry to one batch and allocation. `financial_attempts` preserves the exact prepared transaction XDR, hash, source, signer set, expiry, signatures, result, ledger, and network fee. `settlement_events` is an append-only audit log.

Batch states are `reserved`, `funded`, and `closed`. Allocation states are `pending`, `available`, `claimed`, and `reclaimed`. Attempt states are `awaiting_signatures`, `submitting`, `submitted`, `confirmed`, `failed`, and `expired`. Funding does not mark earnings paid. A verified beneficiary claim marks its linked ledger entries paid. Recovered earnings remain reserved and cannot enter a second batch.

The backend commits submission intent before calling RPC. Repeated submissions reuse the same transaction hash. The worker reconciles the original transaction and verifies contract state. An RPC timeout remains unresolved. Expiry without inclusion is terminal only if RPC history covers the entire prepared transaction window and no conflicting contract effect exists. Pruned history or missing funded state becomes a visible discrepancy. It cannot authorize another payment.

Financial attempts and agreement finalizations share a treasury preparation lock and check outstanding transactions across both tables. This prevents conflicting sequence-number preparation within the application. Other treasury clients can still invalidate a sequence. Such transactions fail explicitly and require reconciliation before retry.

## State lifetime and conservation

Batch and source records use persistent storage. Every batch read or mutation extends both records to 500,000 ledgers when below 100,000. Instance reads extend configuration storage. These records remain recoverable through Stellar archival. Archived-state access must restore the same records before execution. An unavailable simulation is an error, not evidence that a funded obligation disappeared. Source tombstones are retained after all claims finish.

Worker simulations inspect funded batches but do not commit TTL extensions. Treasury-signed maintenance invokes `get_batch` as a transaction to extend batch, source, and instance records. If simulation reports an archival restore preamble, maintenance prepares an exact `restoreFootprint` transaction for two treasury signatures before retrying the original action. It also checks registry and escrow token balance footprints for restoration. Independent reconciliation verifies `funded = available + claimed + reclaimed` in integer units. Treasury fees, ledger fees, and unrelated deposits are separate. Contract balances must also be checked against total open obligations in deployment evidence. The claim deadline does not delete records or release funds automatically. Treasury recovery requires its own exact threshold-signed transaction.

## Worker configuration and event evidence

The API and financial worker share `AGREEMENT_TREASURY_ADDRESS`, `ROYALTY_REGISTRY_CONTRACT_ID`, `SETTLEMENT_CONTRACT_ID`, `SETTLEMENT_DEPLOYMENT_LEDGER`, `STELLAR_NETWORK_PASSPHRASE`, `STELLAR_SOROBAN_RPC_URL`, `STELLAR_HORIZON_URL`, `STELLAR_SETTLEMENT_ASSET_CODE`, and `STELLAR_SETTLEMENT_ASSET_ISSUER`. Live Testnet also requires the explicit production Testnet opt-in. No treasury signing secret is required by either process.

`SETTLEMENT_DEPLOYMENT_LEDGER` is the confirmed escrow deployment ledger. Startup verifies it against the immutable contract instance. Event indexing starts there and persists its cursor. Changing that starting ledger for an existing index fails. A missing or pruned history window requires operator recovery of the evidence, rather than silently starting at the current ledger.

The financial worker runs one replica with a database advisory lock. Every cycle indexes successful contract events, verifies their exact transaction receipts and ledgers, reconciles pending attempts and batches, and updates a cached global report. Read-only API polling reads this cache instead of making every browser repeat all chain queries. Reports older than two minutes or containing a worker error are visibly unverified.

Reconciliation compares all known batches and indexed on-chain batch identities, each consumed claim receipt, escrow token balance, and unique transaction fees. Unknown batches, missing event receipts, amount discrepancies, stale indexing, and token deficits or surpluses require attention. An externally created and fully claimed batch remains detectable even when escrow holds zero tokens.
