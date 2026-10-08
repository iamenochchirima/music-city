# Instawards SOW Update Notes

Historical working notes, superseded wherever they conflict with the [authoritative Music City Instawards SOW](https://docs.google.com/document/d/1Nk0WR6laCp2meQT_VANp3oYFr9YkuZyVKe5ziuPWFoc/edit). In particular, the exclusions of direct fan support below are superseded: direct support remains part of Deliverable 2. It is deferred from the current contributor-agreements milestone, not removed from the SOW. Use the [implementation plan](docs/contributor-agreements-implementation-plan.md) for this milestone's checklist and completion gates.

## Core replacement

Remove the NFT, collectible, and on-chain music-editions marketplace deliverable.

Replace it with:

> **Collaborative Royalty Agreements and Multi-Recipient Stellar Settlement — $1,000**

The implementation should be substantial enough to represent approximately $1,500 of technical work while remaining allocated as $1,000 in the SOW and keeping the total proposal at $5,000.

The replacement is one cohesive system:

- Contributor split proposals for artists, producers, featured artists, writers, and labels.
- Verified Stellar-wallet acceptance of the exact proposed split.
- Proposal, acceptance, dispute, finalization, and amendment states.
- Versioned split history; finalized historical versions are never edited.
- Soroban publication of finalized split versions.
- Deterministic multi-recipient Stellar settlement.
- Creator and administrator views for agreements, earnings, settlement status, failures, and reconciliation.
- Required database migrations, contract changes, APIs, authorization, idempotency protection, failure handling, tests, Testnet deployment, and evidence.

## Scope boundaries

### Existing functionality to use

- Payment confirmation for track purchases and subscriptions.
- Royalty ledger entries and percentage validation.
- Versioned royalty splits.
- Stellar wallet authentication.
- Soroban royalty split registry infrastructure.
- Stellar payout submission and transaction reconciliation.

### New functionality to add

- Contributor agreement and consent domain model.
- Wallet-signed acceptance records tied to a canonical split proposal hash.
- Dispute and finalization state machine.
- Controlled amendment flow that creates a new split version.
- Soroban contract support for the required finalization and settlement behavior.
- Multi-recipient Stellar USDC settlement with traceable recipient allocations.
- Creator-facing and admin-facing operational interfaces.
- End-to-end reconciliation and audit evidence.

### Stellar and provider dependency

This deliverable is fully self-contained on Stellar and does not require Yellow Card or MoneyGram.

It uses verified Music City Stellar wallets, Stellar USDC/Testnet USDC, the royalty ledger, and Soroban. Yellow Card and MoneyGram are only relevant to separate fiat conversion or external cash payout rails.

Provider approval, fiat settlement, and third-party payout availability must not be prerequisites for completing or demonstrating this deliverable.

If Yellow Card or MoneyGram remain in the SOW, they must be clearly separated as non-blocking, separately scoped payout/off-ramp work.

## Feature decisions

- Do not include NFTs, tokenized editions, collectibles, secondary trading, or a speculative marketplace.
- Superseded: the authoritative SOW includes direct fan-to-artist support in Deliverable 2. Its implementation follows the contributor-agreements milestone as a separate payment flow.
- Do not describe contributor approvals as on-chain transactions unless they are actually submitted on-chain. Use “wallet-signed acceptance records” for cryptographic approvals and reserve transaction hashes for actual Stellar/Soroban transactions.
- Do not make splits permanently immutable. Finalized versions remain auditable, while corrections create controlled amendments and new versions.
- Initially require each contributor to have a Music City account linked to a verified Stellar wallet. This keeps the first implementation complete and demonstrable.
- Keep the initial settlement rail Stellar-only rather than promising EVM, Solana, or cross-chain settlement.

## SOW sections to update

- **Main title and opening summary:** Present the proposal as a focused Stellar creator-royalty execution sprint.
- **Problem statement:** Replace the NFT/editions problem with the missing contributor-consent, split-governance, and multi-recipient settlement problem.
- **Technical objective:** Separate existing Music City capabilities from the new Instaward-funded work.
- **Deliverable 1:** Define the core Soroban settlement and claim engine.
- **Deliverable 2:** Replace the NFT marketplace with Collaborative Royalty Agreements and Multi-Recipient Stellar Settlement.
- **Fiat integrations:** State that Yellow Card and MoneyGram are not required for Deliverable 2 or its core demo.
- **Budget:** Replace the $1,000 NFT line with the new collaboration-settlement system, preserving the $5,000 total.
- **Out of scope (historical proposal):** NFTs, tokenized editions, secondary trading, cross-chain settlement, marketing, paid acquisition, incentives, and promotional campaigns. Direct support payments are included by the authoritative SOW and must not be treated as excluded.
- **Timeline:** Replace edition design, minting, and supply-limit work with proposal, wallet acceptance, dispute, finalization, settlement, reconciliation, and failure-recovery work.
- **Evidence:** Require acceptance signature artifacts, state transitions, Soroban finalization evidence, multi-recipient settlement hashes, and reconciliation reports.
- **Validation targets:** Treat the 50 artists and 200 listeners as validation targets, not funded acquisition activities.
- **Risks and dependencies:** Make clear that provider approval and fiat conversion do not block the core Stellar demonstration.
- **Success criteria:** Add measurable tests for consent, disputes, amendments, exact allocation, duplicate prevention, settlement failures, authorization, and reconciliation.

## Required acceptance tests

- A split cannot be finalized until every required contributor accepts.
- Every signature is verified against the exact proposal version and canonical payload.
- A rejected or disputed proposal cannot be finalized.
- Amendments create a new version without changing historical records.
- Recipient shares total exactly 10,000 basis points.
- Allocation rounding never creates or destroys funds.
- A settlement batch cannot execute twice.
- Failed settlements remain retryable and are not marked as paid.
- Every recipient allocation is linked to settlement evidence.
- Creators can only view their own agreements, earnings, and payouts.
- Administrative settlement and amendment actions are authorized and audited.
- The complete flow works on Stellar Testnet.

## Suggested dependency wording

> Deliverable 2 is fully self-contained on Stellar and does not depend on Yellow Card, MoneyGram, fiat conversion, or third-party payout-provider approval. It uses verified Stellar wallets, Stellar USDC/Testnet USDC, Music City’s existing royalty ledger, and the Soroban settlement infrastructure developed under Deliverable 1. External fiat payout providers are outside the acceptance criteria for this deliverable.

## Validation framing

The 50-artist and 200-listener figures should validate the completed product rather than describe what the grant is purchasing.

Validation should focus on whether:

- Contributors can understand a proposed split.
- Contributors can approve or dispute it with their wallets.
- Finalized splits are visible and trustworthy.
- Multi-recipient settlement produces the expected allocations.
- Creators can follow earnings and settlement evidence.
- Administrators can reconcile the application ledger with Stellar transactions.
