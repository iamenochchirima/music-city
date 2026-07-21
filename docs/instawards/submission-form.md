# Music City — Proposed Instawards Submission Form

> Status: ready for founder and Chapter Lead review. Replace every `[REQUIRED]` field before submitting. This is a proposal for a new sprint, not an end-of-sprint completion report.

## 1. Project and team information

**Project name:** Music City

**Builder / team name:** Music City — Enoch N. Chirima (solo founder and builder)

**Primary contact:** Enoch N. Chirima

**Email:** delightproductions102@gmail.com

**Ambassador chapter:** Southern Africa

**Ambassador Chapter Lead:** Yaliwe Mlambo

**Submission date:** [REQUIRED: enter the date the Chapter Lead submits the Airtable form]

**Proposed sprint period:** 27 July 2026 – 25 August 2026 (30 calendar days, inclusive)

**GitHub repository:** <https://github.com/music-city/music-city>

**Working product:** [REQUIRED: public client URL]

**Admin application:** [REQUIRED: public admin URL, or reviewer credentials and private access instructions]

**API / health endpoint:** [REQUIRED: public API or health-check URL]

## 2. Project summary and Instaward intent

Music City is a Stellar-native music platform that helps creators document ownership splits, track qualified listening activity, and receive transparent royalty payouts. The existing MVP includes Stellar wallet authentication, artist onboarding, music upload and streaming, subscriber access, a royalty ledger, admin payout controls, and testnet USDC treasury payments.

This Instaward will move Music City's royalty rights layer from an off-chain registry to a verifiable Soroban registry and connect that registry to the existing product. The sprint is deliberately limited to a testnet contract, application integration, and reviewer-friendly evidence.

## 3. Problem statement and objective

### Problem being addressed

Independent music creators often lack a transparent, durable record of who owns each track and how revenue should be divided. Music City can already calculate splits and execute Stellar payouts, but its split registry is currently stored off-chain. Reviewers and collaborators therefore cannot independently verify the active split version on Stellar.

### Objective

By the end of the 30-day sprint, Music City will have a tested Soroban royalty-split registry deployed on Stellar Testnet, an application integration that publishes and verifies track split versions, and a recorded end-to-end demonstration linking an artist, a track, a qualified stream or subscription allocation, a split record, and a successful testnet USDC payout.

## 4. Scope of work

### Deliverable 1 — Soroban royalty-split registry

**What will be built:** A Rust/Soroban contract that stores versioned royalty splits for a Music City track, validates that recipient shares total 10,000 basis points, exposes the active split version, and restricts updates to an authorized administrator. It will include automated contract tests and be deployed to Stellar Testnet.

**Success criteria:**

- Contract source and tests are committed to the public repository.
- Contract tests pass from documented commands.
- A Stellar Testnet contract ID is published.
- At least one successful contract invocation is linked in a Stellar explorer.
- The README documents deployment and verification steps without exposing secret keys.

**Why it matters:** It creates an independently verifiable source of truth for ownership and payout shares, which is the central trust claim of Music City.

### Deliverable 2 — Music City contract integration

**What will be built:** Backend and admin integration that publishes an approved track split to the Soroban registry, stores the contract ID, network, transaction hash, and split version, reads the active split back from the contract, and displays whether the off-chain and on-chain records match.

**Success criteria:**

- An administrator can publish an approved split from the existing workflow.
- The application persists the resulting testnet transaction reference and split version.
- A verification action detects both a matching record and a deliberately introduced mismatch in automated tests.
- The admin interface exposes reviewer-readable contract and transaction links.

**Why it matters:** A deployed contract has little product value unless creators and administrators can use and verify it through the existing platform.

### Deliverable 3 — End-to-end testnet demo and evidence pack

**What will be produced:** A reproducible demonstration using the existing artist portal, listener experience, royalty ledger, and Stellar payout rail together with the new Soroban registry. The evidence pack will include a short screen recording, repository commit, test output, contract ID, transaction hashes, screenshots, and a concise reviewer guide.

**Success criteria:**

- The demo shows wallet connection, a track and its recipients, publication of the split to Soroban, read-back verification, royalty ledger creation, and a testnet USDC payout.
- All contract invocations and payment transactions have public explorer links.
- The evidence index maps each promised outcome to one or more links.
- Typechecking, automated tests, and production builds pass at the submitted commit.

**Why it matters:** It lets a non-specialist reviewer verify the complete product claim without reconstructing the development environment.

### Explicitly out of scope

- Stellar Mainnet deployment or use of real customer funds.
- Legal registration of copyrights, collective-management-organization integration, or a claim to replace statutory royalty systems.
- A mobile application.
- Arweave/Irys storage migration; the current media path uses Mux/S3-compatible storage and is independent of this Soroban sprint.
- One blockchain payment for every individual play. Qualified usage is recorded and royalties are settled in auditable batches to keep fees and treasury operations practical.
- Automated scheduled payouts, ad-revenue allocation, and production-scale pooled subscription accounting.
- Public launch, record-label contracts, or a guaranteed number of artist sign-ups.

## 5. Budget request

**Requested amount:** USD 5,000 equivalent, paid in XLM according to the Instawards rules.

**Budget rationale:**

| Workstream | Amount | Intended use |
| --- | ---: | --- |
| Soroban contract engineering and tests | $2,000 | Contract design, implementation, authorization, versioning, testnet deployment, and documentation |
| Backend and admin integration | $1,500 | Publish/read/verify flows, persistence, API work, and reviewer links |
| End-to-end QA and testnet demonstration | $1,000 | Integration testing, wallet scenarios, transaction verification, recording, and bug fixes |
| Technical documentation and evidence packaging | $500 | Reproduction guide, evidence map, final screenshots, and handoff |
| **Total** | **$5,000** | |

The request does not charge for the existing artist portal, streaming interface, wallet authentication, or baseline payout implementation. Those components are evidence that the project is ready to execute this new scope.

## 6. 30-day execution plan

| Period | Planned work | Expected output |
| --- | --- | --- |
| Week 1 — 27 July–2 August | Lock the contract interface, implement storage/versioning/authorization, and write contract tests | Tested Soroban contract in the repository |
| Week 2 — 3–9 August | Deploy to Stellar Testnet; implement backend publish, read-back, persistence, and mismatch verification | Contract ID plus working integration APIs and testnet invocation |
| Week 3 — 10–16 August | Add admin publish/verify controls and explorer links; extend integration tests | Reviewer-readable on-chain status in the admin workflow |
| Week 4 — 17–25 August | Run the full testnet flow, fix defects, capture evidence, record the demo, and finalize documentation | Passing build/tests and complete evidence pack |

## 7. Planned evidence of completion

| Deliverable | Evidence | What the reviewer will verify |
| --- | --- | --- |
| Soroban registry | Public source, contract test output, deployment command, testnet contract ID, explorer invocation | Contract exists, enforces split rules, and is callable on testnet |
| Application integration | Repository commit, API tests, admin screenshots, publish transaction, read-back result | Music City can publish and independently compare the active split |
| End-to-end demo | 3–5 minute recording, live demo URL, payout transaction, contract transaction, final evidence index | The complete testnet story works and each claim has a public reference |

## 8. Existing readiness evidence

- Repository commit audited for this form: [`53910ed`](https://github.com/music-city/music-city/tree/53910ed4a533f9f10d6c81f8cf30bd212243606f)
- On 21 July 2026, all workspace typechecks passed, all 45 server tests passed, and all production builds completed successfully.
- Configured testnet treasury: [`GCW3H…EKFWO`](https://stellar.expert/explorer/testnet/account/GCW3HD5EBMVNBGOWCPTP3WNYXXT5OYB2UIMKDNSL3IZRGLVMU4OEKFWO)
- Verified outbound payment: [3 USDC on Stellar Testnet](https://stellar.expert/explorer/testnet/tx/058bab23795850e40565704ea07fc7641ce13947070a67437ee3f568de1c8e63)
- Detailed readiness and gap mapping: [`evidence-index.md`](evidence-index.md)

## 9. Next-step alignment

After successful completion, Music City expects to validate the workflow with a small group of Southern African artists, harden the product for mainnet, and assess fit for an SCF Build Award. A follow-on Instaward would only be requested for a distinct scope and if eligible under the program rules.

## 10. Constraints acknowledgement

The builder confirms that:

- [ ] This scope can be completed within 30 calendar days.
- [ ] Instawards support defined execution rather than open-ended exploration.
- [ ] This request does not seek reimbursement for already completed work.
- [ ] Each Instaward is subject to the current per-sprint range/cap and is paid in XLM if approved.
- [ ] Any follow-on request will be a distinct sprint and is not automatic.
- [ ] Aggregate Instawards funding will not exceed the current program limit.
- [ ] Progress will be measured against the agreed deliverables and evidence.
- [ ] The builder has reviewed the current Instawards Rules and applicable SCF submission rules.
- [ ] The builder is prepared to complete SDF KYC before disbursement.

## 11. Submission confirmation

This Statement of Work will be reviewed with Yaliwe Mlambo. Once the dates, access links, engagement evidence, acknowledgements, and KYC readiness are confirmed, the Ambassador Chapter Lead may submit it through the designated Instawards process for independent SDF review. Submission does not guarantee approval or funding.
