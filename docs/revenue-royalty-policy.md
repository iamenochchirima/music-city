# Music City Revenue And Royalty Policy

## Purpose

Define how Music City should:

- receive revenue
- calculate royalty earnings
- hold payable balances
- pay recipients from treasury

This document defines the current MVP policy and the intended production direction.

## Core Principles

- All platform revenue is received into the Music City treasury wallet first.
- Royalties are calculated off-platform in the backend ledger.
- Track split ownership is versioned per track.
- Percentages are stored in basis points where `10000 = 100%`.
- Money amounts are stored and calculated in fixed precision, not floating point.
- Payouts are executed from treasury after earnings are recorded and approved.

## Revenue Sources

Current supported or planned royalty sources:

- `track_purchase`
- `platform_subscription`
- `ad_revenue`
- `manual_adjustment`

## Amount And Percentage Standard

### Percentages

Music City uses basis points (`bps`) for splits.

Examples:

- `10000 bps = 100.00%`
- `5000 bps = 50.00%`
- `2500 bps = 25.00%`

Rules:

- every active split must total exactly `10000 bps`
- one active split exists per track at a time
- splits are superseded, not edited in place

### Money Precision

Music City stores settlement amounts with `7` decimal places to align with Stellar-style asset precision.

Rules:

- do not use floating point arithmetic for royalty calculations
- convert amounts to base units before splitting
- allocate rounding remainder to the final item in a deterministic order

## Treasury Policy

- User payments go directly to the configured treasury wallet.
- Treasury is the holding account for platform revenue.
- Royalties are not paid instantly from the incoming payment itself.
- Treasury remains the funding source for payout execution.

## Royalty Calculation Policy

### 1. Track Purchases

Rule:

- a purchase maps to one track
- the full confirmed payment amount becomes the royalty base for that track
- the active split for that track is applied immediately

Formula:

- `recipient_amount = payment_amount * share_bps / 10000`

### 2. Platform Subscriptions

#### MVP Policy

Until play-based pooled allocation is implemented, each confirmed platform subscription payment is allocated across the current eligible subscriber-only catalog.

Eligible catalog means tracks that are:

- `published`
- `playbackReady`
- `access = subscribers`
- backed by an active royalty split

Allocation rule:

- split the subscription payment evenly across all eligible tracks
- for each allocated track amount, apply that track's active royalty split

Formula:

- `track_amount = subscription_payment / eligible_track_count`
- `recipient_amount = track_amount * share_bps / 10000`

This is an explicit MVP fallback policy, not the intended long-term pooled subscription model.

#### Production Direction

Move platform subscriptions to a pooled allocation model by accounting period.

Recommended production rule:

- collect subscription revenue into a daily or monthly pool
- allocate the pool by eligible subscriber-track consumption
- then apply each track's active split

### 3. Ad Revenue

#### MVP Policy

Ad revenue should be allocated as a periodic pool using monetized plays.

Recommended rule:

- use net ad revenue actually received by Music City
- build a daily ad revenue pool
- allocate pool share by each track's monetized plays
- apply the active split for each track

Formula:

- `track_pool_share = total_net_ad_revenue * (track_monetized_plays / total_monetized_plays)`
- `recipient_amount = track_pool_share * share_bps / 10000`

Monetized play recommendation:

- count ad-backed plays where ad delivery completed or otherwise satisfied the chosen monetization threshold

### 4. Manual Adjustments

Use manual adjustments for:

- corrections
- reconciliations
- bonuses
- reversals

These should always be audit-trailed in the royalty ledger.

## Ledger Status Model

Royalty ledger entries represent earnings state:

- `pending`: calculated but not approved for payout
- `approved`: approved for payout batching
- `paid`: settled from treasury
- `reversed`: removed due to refund, correction, or dispute

## Payout Policy

### Current Direction

- treasury holds funds
- backend ledger records what each recipient is owed
- payouts are batched later

### Recommended Production Payout Rules

- payout from treasury on a scheduled cadence
- use a minimum payout threshold per recipient
- batch multiple ledger entries into a single payout record when possible
- write tx hashes into `royalty_payouts`
- reconcile failed or partial payouts

Recommended first cadence:

- weekly or monthly

Recommended first threshold:

- configurable per asset and rail

## Platform Fee Policy

Current implementation does not yet separate platform fee from gross incoming revenue in the royalty engine.

Production recommendation:

- add explicit platform-fee configuration
- calculate:
  - `gross_amount`
  - `platform_fee_amount`
  - `net_distributable_amount`
- split only `net_distributable_amount`

## Smart Contract Boundary

Current contract direction:

- use Soroban as the canonical split registry
- keep accounting and payouts backend-driven first

The contract should define:

- track split recipients
- percentages
- split version history

The contract should not initially perform:

- ad allocation
- subscription pool accounting
- treasury payout execution

## Implementation Order

1. lock policy in docs
2. calculate royalty ledger entries for purchases
3. calculate royalty ledger entries for platform subscriptions using the MVP catalog allocation
4. calculate ad revenue allocations
5. add Stellar payout execution from treasury
6. move subscriptions and ads to pooled, period-based allocation
