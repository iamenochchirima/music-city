# Royalty And Payout Checklist

Use this checklist as the working implementation tracker for finishing Music City's royalty accounting and treasury payout system.

## Current State

Already in place:

- [x] Shared royalty schemas
- [x] Track split management in admin
- [x] Track purchase royalty ledger generation
- [x] Platform subscription MVP royalty ledger generation
- [x] Treasury-first payment flow
- [x] Production royalty policy doc
- [x] Production hardening groundwork for env, uploads, and schema migrations
- [x] Admin royalty ledger listing API
- [x] Admin payout listing API
- [x] Admin ledger approval API
- [x] Manual admin-triggered payout run API
- [x] Initial Stellar payout executor
- [x] Payout persistence with tx hash capture on successful submission
- [x] Submitted/confirmed payout state separation with reconciliation support
- [x] Typecheck-clean shared/server/admin/client pass

Still missing:

- [ ] Ad revenue allocation
- [ ] Pooled subscription allocation by consumption
- [x] Soroban split registry contract
- [x] Full admin payout operations UI
- [ ] Scheduled payout runner
- [x] Runtime test execution in this environment

## Phase 1: Payout Policy Lock

- [x] Decide whether payouts are automatic or admin-approved
- [x] Decide payout cadence:
  - [x] manual
  - [x] daily
  - [x] weekly
  - [x] monthly
- [x] Decide minimum payout threshold per asset
- [x] Decide whether failed payouts retry automatically
- [x] Decide whether partial treasury balances block all payouts or allow partial batches
- [x] Decide whether `pending` ledger entries move to `approved` automatically
- [x] Define payout reversal policy for failed or cancelled transfers
- [x] Confirm final policy for splitting `gross` vs `net distributable`

## Phase 2: Ledger And Approval Workflow

- [x] Add service method to list payable royalty ledger entries
- [x] Add service method to approve ledger entries for payout
- [ ] Add service method to reverse ledger entries
- [x] Add service method to mark entries paid after settlement confirmation
- [x] Add admin route to list pending ledger entries by recipient
- [x] Add admin route to approve ledger entries or payout batches
- [x] Add admin route to inspect payout history
- [ ] Add filtering by:
  - [ ] source type
  - [x] recipient
  - [ ] asset
  - [x] status
  - [ ] date range

## Phase 3: Platform Fee And Net Amount Logic

- [x] Add explicit platform fee configuration
- [x] Define whether fee is:
  - [ ] flat percentage
  - [x] source-specific
  - [ ] asset-specific
- [x] Add fee calculation helper
- [x] Store for each royalty ledger entry:
  - [x] `grossAmount`
  - [x] `feeAmount`
  - [x] `netAmount`
- [x] Update track purchase ledger generation to use net distributable amount
- [x] Update platform subscription ledger generation to use net distributable amount
- [x] Keep fee logic deterministic and auditable

## Phase 4: Stellar Payout Service

- [x] Create payout service module for treasury settlement
- [x] Load treasury wallet configuration safely
- [ ] Decide treasury signing strategy:
  - [x] server-held secret
  - [ ] external signer
  - [ ] custodial service
- [x] Add Stellar payout builder
- [x] Support batching multiple ledger entries into one payout record
- [x] Support one recipient per payout in MVP
- [x] Submit Stellar payment transaction from treasury
- [ ] Capture and persist:
  - [x] tx hash
  - [x] submitted at
  - [x] payout amount
  - [x] asset code
  - [x] asset issuer
  - [x] ledger entry ids
- [ ] Mark payout status:
  - [x] `submitted`
  - [x] `confirmed`
  - [x] `failed`
- [ ] Mark linked ledger entries:
  - [x] `paid`
  - [x] or back to `approved` / `pending` on failure
- [x] Verify treasury has enough balance before submit
- [x] Handle insufficient balance errors cleanly
- [x] Handle invalid recipient wallet errors cleanly
- [x] Handle duplicate payout prevention

## Phase 5: Payout Scheduling

- [ ] Add payout batch selection job
- [ ] Add scheduled payout runner
- [x] Add idempotency guard for batch runs
- [x] Add dry-run mode for payout preview
- [ ] Add payout summary output:
  - [ ] recipient count
  - [ ] asset totals
  - [ ] treasury requirement
  - [ ] skipped recipients under threshold
- [x] Add ability to run payouts manually from admin for MVP

## Phase 5.5: Reconciliation

- [x] Keep submitted payouts separate from confirmed payouts
- [x] Add manual payout reconciliation against Horizon transaction status
- [x] Mark linked ledger entries `paid` after reconciliation when confirmation mode is enabled
- [x] Return failed reconciliations to `approved` for retry

## Phase 6: Platform Subscription Allocation Upgrade

- [ ] Keep current even-catalog allocation as MVP fallback
- [ ] Define subscriber consumption event model
- [ ] Record eligible subscriber-track consumption
- [ ] Build allocation period model:
  - [ ] daily
  - [ ] weekly
  - [ ] monthly
- [ ] Create pooled platform subscription allocator
- [ ] Allocate subscription revenue by subscriber-track consumption share
- [ ] Replace per-payment even allocation when pooled model is ready
- [ ] Preserve audit trail for how each allocation was calculated

## Phase 7: Ad Revenue Allocation

- [ ] Add ad revenue event model
- [ ] Define monetized play qualification rule
- [ ] Store ad revenue received by period
- [ ] Build ad revenue allocation job
- [ ] Allocate ad pool by monetized track plays
- [ ] Apply active track split to each allocated amount
- [ ] Write `ad_revenue` ledger entries
- [ ] Exclude subscribers and non-eligible tracks from ad allocation
- [ ] Add audit trail for ad pool math

## Phase 8: Admin And Reporting

- [ ] Add admin royalties dashboard for:
  - [x] total pending earnings
  - [x] total approved earnings
  - [x] total paid earnings
  - [x] failed payouts
- [ ] Add recipient earnings view
- [ ] Add payout batch view
- [ ] Add treasury payout readiness view
- [ ] Add CSV/export support for payout reconciliation
- [ ] Add track-level royalty earning history
- [ ] Add source-level breakdown:
  - [ ] purchases
  - [ ] subscriptions
  - [ ] ads
  - [ ] manual adjustments

## Phase 9: Soroban Split Registry

- [x] Design Soroban `RoyaltySplitRegistry` contract interface
- [x] Implement track split version storage on Soroban
- [x] Mirror active backend splits to Soroban
- [x] Store contract metadata on split records
- [x] Add verification step that off-chain and on-chain split match
- [x] Decide when on-chain registry becomes canonical source of split rights
- [ ] Keep payouts backend-driven until registry is stable

## Phase 10: QA And Operational Readiness

- [ ] Test deterministic amount splitting and rounding
- [ ] Test duplicate payout protection
- [ ] Test failed payout recovery
- [ ] Test insufficient treasury balance behavior
- [ ] Test ledger approval flow
- [ ] Test payout idempotency
- [ ] Test platform subscription allocation math
- [ ] Test ad allocation math
- [ ] Test admin royalty screens
- [ ] Test migration safety in staging
- [ ] Add runbook for treasury payout failures
- [ ] Add production preflight checklist for payout runs

## Recommended Next Sprint

- [x] Add admin royalties payout UI for approval and run controls
- [x] Lock payout cadence, threshold, retry, and balance-shortfall policy
- [x] Add duplicate-payout and idempotency guards around run execution
- [x] Add post-submission reconciliation / confirmation polling
- [x] Add platform fee and net-distributable calculation
- [x] Unblock runtime tests or add an equivalent execution path

## Sprint Done When

- [x] Admin can see payable royalty balances in the UI
- [x] Admin can approve a payout batch in the UI
- [ ] Treasury can send Stellar payouts to recipients
- [x] Payout records store tx hashes and statuses
- [x] Linked ledger entries move to `paid` after successful submission or reconciliation, depending on policy
- [ ] Failed payouts are recoverable without duplicate payments
