# Audit of the 5 March 2026 Draft Statement of Work

Audit date: 21 July 2026

## Executive finding

The original draft is not submission-ready as written. It mixes an outreach objective with technical deliverables, leaves required sections blank, uses dates that are now past, and describes Soroban and Arweave/Irys work that is not in the current repository. Music City has nevertheless built a strong Stellar MVP, including a verifiable testnet USDC payout, which supports a sharper application for the remaining Soroban milestone.

## Line-by-line issues

| Draft item | Finding | Recommended correction |
| --- | --- | --- |
| Submission date: 5 March 2026 | Historical and should only be used if the form was actually submitted that day | Use the actual new Airtable submission date |
| Sprint: 16 March–16 April 2026 | Past and exceeds 30 calendar days when counted inclusively | Agree a fresh 30-day period; the revised form proposes 27 July–25 August 2026 |
| Builder/team name | A person's name is entered where the project/team identity is expected | Use “Music City — Enoch N. Chirima (solo founder and builder)” |
| Primary contact | Name and email are combined and punctuation is unclear | Separate name and email fields |
| Objective includes artist/label awareness | No outreach deliverable, target count, activity, or evidence supports it | Remove from this technical sprint or add a separately measurable outreach deliverable |
| Deliverable 1 claims two Soroban contracts | No Rust contract code, contract workspace, deployment record, or contract ID is present | Fund a focused royalty registry contract and integration as new work |
| Deliverable 2 claims Arweave/Irys storage | Not implemented; current delivery uses Mux/S3-compatible storage and optional encrypted archive groundwork | Remove Arweave/Irys from the claim or explicitly fund it as a separate future scope |
| Deliverable 3 is marked optional | The weekly plan and success claim depend on it | Make every funded deliverable unambiguously required or remove it from the plan/budget |
| “Royalty split triggers per stream” | The code records qualified streams and supports royalty ledgers/batch Stellar payouts; it does not make one on-chain payment per play | Describe auditable accrual/allocation and batch payout accurately |
| Out-of-scope section | Blank | Use the explicit exclusions in the revised form |
| Budget | One total with a broad rationale | Use the deliverable-aligned breakdown in the revised form |
| Evidence descriptions | Vague and use future placeholders such as “repo and demo” | State contract ID, exact transaction types, test command, screenshots, recording, and public links |
| Constraints | Several acknowledgements are unchecked | Review and affirm every applicable acknowledgement before submission |
| Next steps | Multiple boxes are selected without prioritization | Name the most likely next step and describe follow-on funding as conditional, not guaranteed |

## Status against the three original deliverables

### Original Deliverable 1: subscription and royalty Soroban contracts

**Status: not complete as written.**

Music City has subscription payments, a royalty ledger, and Stellar payout execution, but these are implemented through the application backend and Stellar payment operations. The Soroban registry remains explicitly listed as missing in `docs/royalty-payout-checklist.md`, and no contract ID is configured.

### Original Deliverable 2: artist portal and Arweave/Irys upload

**Status: partially complete with a different storage architecture.**

Artist onboarding, track creation, uploads, and production media delivery exist. The repository uses Mux and S3-compatible storage, not an Irys upload returning an Arweave URL. Documentation mentions an optional encrypted remote archive hook, which is not the same as the promised Irys/Arweave flow.

### Original Deliverable 3: user-facing streaming

**Status: substantially implemented, but the blockchain wording needs correction.**

Wallet connection, subscriptions, access gating, playback, qualified-stream tracking, royalty accounting, and Stellar payout tooling exist. The app does not make an immediate Soroban royalty-distribution call for each play. The strongest public evidence currently available is a successful 3 USDC testnet treasury payout.

## Decision rule

- If the March draft was never approved: use the revised `submission-form.md`.
- If the March draft was approved but the sprint never started: ask the Chapter Lead to replace the dates and approve the revised scope before execution.
- If funding was already disbursed against the March draft: do not present the revised proposal as completion evidence. Submit an honest partial-completion report and request written guidance on remediation or a formal scope amendment.
