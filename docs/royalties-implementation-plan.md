# Royalties Implementation Plan

## Goal

Add a multichain royalty system that:

- keeps Music City flexible across chains
- uses Stellar first for settlement and contract anchoring
- introduces one meaningful smart contract without forcing the whole product on-chain

See also:

- `docs/revenue-royalty-policy.md` for the current Music City business rules around purchases, subscriptions, ad revenue, treasury, and payout timing.

## Core Decision

Use a `backend royalty ledger + on-chain split registry` model.

That means:

- the backend remains the source of truth for revenue events and earnings calculations
- a smart contract becomes the canonical source of track split ownership
- payout execution can start on Stellar and expand to other chains later

## Why This Boundary

This project already confirms commerce in the backend:

- purchases are validated and recorded in `server/src/modules/payments`
- subscriptions are recorded in `server/src/modules/subscriptions`
- ads will also be app-level events at first

That makes backend accounting the right short-term source of truth for:

- purchases
- subscriptions
- ad revenue
- manual adjustments

The part that benefits most from a contract now is:

- who owns what split for a track
- what the canonical percentages are
- what payout rail is preferred per recipient

## Recommended Smart Contract Now

Build a Soroban `RoyaltySplitRegistry` contract first.

Responsibilities:

- store `trackId -> split version -> recipients + bps`
- support versioning
- optionally support freeze/finalize
- expose read methods for the backend
- optionally support future payout/distribution methods

Do not put these in the first contract:

- playback logic
- ad decisioning
- subscription accounting
- reporting
- stream-based payout calculations

## Multichain Architecture

### 1. Rights Layer

Canonical split ownership lives in:

- Soroban first
- other chains later only if needed

This gives Music City one important contract immediately without making the rest of the app chain-specific.

### 2. Accounting Layer

Revenue stays chain-agnostic in the backend.

Sources:

- `track_purchase`
- `platform_subscription`
- `ad_revenue`
- `manual_adjustment`

Backend computes:

- gross revenue event
- platform fee
- net distributable amount
- recipient-level royalty entries

### 3. Settlement Layer

Settlement is adapter-based.

Initial rails:

- `stellar`
- `manual`

Future rails:

- `evm`
- `solana`

The backend chooses a payout adapter based on recipient preference and supported rails.

## Data Model

### Track Royalty Splits

Use `royalty_splits` as versioned split history.

Each split stores:

- `trackId`
- `version`
- `status`
- `recipients`
- `registryKind`
- `registryChain`
- `registryNetwork`
- `registryContractId`

Rules:

- recipient shares must total `10000` bps
- only one split should be `active` per track at a time
- active splits are superseded, not overwritten

### Royalty Ledger

Use `royalty_ledger` for calculated earnings.

Each entry stores:

- track
- source type and source id
- recipient
- recipient chain
- gross amount
- fee amount
- net amount
- status

### Payouts

Use `royalty_payouts` for settlement attempts and reconciliation.

Each payout stores:

- recipient
- payout rail
- amount
- asset
- tx hash if on-chain
- payout status

## Current Foundation Added

This repo now has:

- shared royalty schemas in `packages/shared/src/royalties.ts`
- a server royalties module scaffold in `server/src/modules/royalties`
- admin-protected endpoints for:
  - `GET /api/v1/royalties/config`
  - `GET /api/v1/royalties/tracks/:trackId/splits`
  - `PUT /api/v1/royalties/tracks/:trackId/splits`
- database tables for:
  - `royalty_splits`
  - `royalty_ledger`
  - `royalty_payouts`

## Rollout Phases

### Phase 1: Off-Chain Splits With Stellar-First Metadata

- manage splits through admin APIs
- store registry config in env
- keep split history in Postgres
- use Stellar as the default registry and settlement chain

This is the current setup.

### Phase 2: Backend Royalty Calculation

Add services that convert:

- purchase payments
- platform subscription allocations
- ad revenue events

into `royalty_ledger` entries using the active split version for each track.

### Phase 3: Soroban Split Registry

Deploy a Soroban contract that stores canonical track split versions.

Backend flow:

1. admin updates split in Music City
2. backend validates and writes draft/off-chain record
3. backend publishes or mirrors the active split to Soroban
4. backend stores Soroban contract metadata on the split record
5. future payout services trust Soroban as the canonical rights layer

### Phase 4: Stellar Payout Adapter

Add a payout service that:

- batches approved royalty ledger entries
- submits Stellar payments from treasury
- records tx hashes in `royalty_payouts`

### Phase 5: Multichain Payout Adapters

Add chain-specific payout adapters:

- EVM adapter
- Solana adapter

The royalty ledger should not need to change for this.

## Smart Contract Interface Recommendation

Suggested Soroban methods:

- `set_track_split(track_id, version, recipients, metadata_hash)`
- `get_track_split(track_id)`
- `get_track_split_version(track_id, version)`
- `freeze_track_split(track_id, version)`

Later:

- `deposit_revenue(track_id, amount, asset)`
- `distribute(track_id, version)`

## Environment Strategy

Use env for the first chain anchor:

- `ROYALTY_REGISTRY_CHAIN=stellar`
- `ROYALTY_REGISTRY_NETWORK=stellar:testnet`
- `ROYALTY_REGISTRY_CONTRACT_ID=`

This keeps the current build Soroban-ready without requiring a contract deployment on day one.

## Non-Goals Right Now

- full on-chain royalty accounting
- per-play smart contract writes
- fully trustless cross-chain bridges
- solving all payout chains in the first milestone

## Recommendation

The best near-term path for Music City is:

1. keep accounting and reporting in the backend
2. use Soroban as the first canonical split registry
3. ship Stellar payouts before expanding payout rails
4. keep the royalty ledger chain-agnostic from the start

That gives the project one important smart contract while still supporting a real multichain future.
