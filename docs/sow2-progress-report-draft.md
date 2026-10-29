# Music City SOW 2 progress report

**Draft for project-owner and reviewer review — 29 October 2026**

This report follows the submitted [Music City Instawards SOW - 2](https://docs.google.com/document/d/1Nk0WR6laCp2meQT_VANp3oYFr9YkuZyVKe5ziuPWFoc/edit) and the current [milestone tracker](sow-2-tracker.md). It separates implementation and Testnet evidence from production behavior and reviewer acceptance.

## Executive summary

The core SOW 2 scope has substantial implementation and Stellar Testnet evidence across D1, D2, and D3. The strongest end-to-end result is a locally rehearsed music purchase through royalty allocation, two-signer treasury funding, both beneficiary claims, and final reconciliation. Agreement consent, disputes, amendments, direct fan support, expiry recovery, and protected treasury actions also have separate real-wallet Testnet evidence.

The hosted application is deployed and its public music experience, listener sign-in, admin access, and empty-state reconciliation have been checked. No production purchase, support payment, agreement, settlement, or claim was present at the latest recorded inspection. Hosted artist setup currently stops at an activation page showing **$20 due today** and saying the early-user offer is unavailable. No activation or payment was made.

Reviewer acceptance has not been recorded. The SOW treats the 50-artist and 200-listener figures as validation targets, not technical completion gates. MoonPay and MoneyGram are part of the separately budgeted $1,300 provider-readiness scope, not a dependency for core D1–D3 acceptance. Neither provider has a verified end-to-end Stellar USDC buy or sell result.

## Progress against submitted deliverables

| Deliverable | Reported position | Evidence and boundary |
| --- | --- | --- |
| **D1 — Soroban Earnings Settlement Engine** | Implemented and verified on Stellar Testnet. | Split validation, deterministic allocation, duplicate protection, funding, beneficiary claims, expiry recovery, events, and reconciliation are documented in [E5 settlement evidence](settlement-evidence/README.md). Reviewer acceptance remains open. |
| **D2 — Contributor Agreements & Treasury Controls** | Implemented and verified with real wallet signatures on Stellar Testnet. | Proposal, acceptance, rejection, disputes, amendments, 2-of-3 treasury authorization, direct artist support, and contributor support are covered by [E7 agreement evidence](contributor-agreements-evidence/lifecycle-review/README.md), the [treasury audit](sow2-treasury-authorization-audit.md), and [E6 support evidence](support-evidence/README.md). Reviewer acceptance remains open. |
| **D3 — Product Integration, Operations, Reconciliation & Verification** | Core music-to-earnings journey passed locally on Testnet; hosted product and admin surfaces are deployed and partially rehearsed. | The current [E8 cycle](core-lifecycle-evidence/README.md#current-local-financial-cycle-closed-29-october-2026) records a 0.001 USDC purchase, 70/30 allocations, two-signer funding, 0.0007/0.0003 USDC claims, and successful reconciliation. Production readiness and current limits are in the [demo plan](sow2-production-demo-plan.md). Reviewer acceptance remains open. |

The current code and Testnet evidence do not mean a production financial transaction has occurred. The production account had no financial records to demonstrate at the latest check, and the hosted artist role is not active.

## Recommended evidence package

The submitted SOW asks for contract IDs, repository and test results, Testnet transaction hashes, explorer links, claim identifiers, screenshots, deployment documentation, reconciliation records, and an end-to-end demonstration. Use the following existing evidence as the report index:

- [E5: settlement and claims](settlement-evidence/README.md) — contract and treasury configuration, receipts, claims, expiry/recovery, event indexing, and reconciliation.
- [E6: direct fan support](support-evidence/README.md) — confirmed artist and contributor support payments, recipient histories, screenshots, and Testnet reconciliation.
- [E7: contributor agreement lifecycle](contributor-agreements-evidence/lifecycle-review/README.md) — independent consent, disputes, amendments, treasury authorization, and registry verification.
- [E8: current purchase-to-claim cycle](core-lifecycle-evidence/README.md#current-local-financial-cycle-closed-29-october-2026) — current purchase, settlement, claims, chain checks, and closed-batch screenshots.
- [Deployment and live product evidence](production-deployment-evidence/README.md) — deployments, migrations, production readiness, and current hosted checks.
- [Creator upload and release evidence](sow2-hosted-demo-handoff.md#local-creator-upload-smoke-test) — locally verified release creation, artwork, audio upload, processing, publication, and playback.
- [Provider readiness evidence](ramp-sandbox-evidence/README.md) — separately scoped account capability and exact reasons the provider journeys remain unverified.

Keep the original receipts and hashes in these evidence files; the final report should link to them instead of copying long transaction data into its main text. The submitted $5,000 is a budget request; this evidence does not establish disbursement or expenditure.

## Suggested demo videos

Record short clips with an opening label naming the environment. Do not splice Testnet results into a production screen without calling out the switch.

| Clip | Target | What to show | Say clearly |
| --- | --- | --- | --- |
| 1. Public product walkthrough | 1–2 minutes | Production Discover, unique release cards, Artists directory, a release and track page, then the admin's Settlements empty state. | These pages are live production; the admin ledger is healthy and currently empty. Keep track playback under five seconds to avoid adding a public stream. |
| 2. Creator upload and release | 2–3 minutes | Local isolated Sandbox: create a release, upload a supported audio format and artwork, wait for **Audio ready**, review, publish, and play the resulting track. | This is a local app and isolated database. The audio and release flow is verified locally; production artist activation is still gated by the $20 screen. |
| 3. Agreements and treasury | 2–3 minutes | Use the dated E7 Testnet/browser evidence to show contributor responses, the finalized agreement, and the two-signature threshold. | Wallet signatures and registry finalization are real Stellar Testnet actions; they are not production transactions. |
| 4. Purchase through claims | 3–5 minutes | Use the current E8 local Testnet screenshots and receipts: purchase and entitlement, reserved/funded batch, both claim receipts, and final reconciliation. Open the corresponding explorer receipts where useful. | This is a completed local Testnet lifecycle, not a production purchase. The two beneficiaries received 0.0007 and 0.0003 USDC from the 0.001 USDC source. |

Do not make a provider success video. For the report, give provider status as a concise limitation: MoonPay's account has native XLM Test Mode but no Stellar USDC Test Mode and its recorded XLM attempts failed; MoneyGram authenticates but its partner account is custodial and its configured chains exclude Stellar. No provider transaction or payout is claimed. See the [sanitized MoneyGram configuration evidence](ramp-sandbox-evidence/moneygram-config-2026-10-29.json) and the [provider evidence index](ramp-sandbox-evidence/README.md).

The existing [recording run sheet](sow2-recording-run-sheet.md) has the ready links and click order. Before recording, confirm the selected evidence files open, remove unrelated browser tabs and notifications, and keep credentials, OTPs, signer material, private account details, and unsupported checkout claims out of frame.

## Remaining before submission

1. Confirm the reviewer and required report format, then review this draft against the source SOW section 6.1 evidence list.
2. Confirm the current release commit, deployment IDs, contract IDs, transaction hashes, test results, and screenshot links from the evidence index. Do not replace dated evidence with a newer-looking but weaker check.
3. Decide whether the report is for core D1–D3 only or also includes the separately budgeted provider-readiness work. Keep that distinction explicit either way.
4. Record the four clips above with clear environment labels. Use the hosted clip for current product behavior and the local/Testnet clips for completed technical flows.
5. Submit the report and evidence package to the reviewer and record acceptance separately. Do not call SOW 2 accepted before the reviewer responds.

## Current limitations to disclose

- Hosted artist activation displays $20 due today and says the early-user offer is unavailable for the current account. The setup was not activated or paid.
- Production has not been used for a purchase, support transfer, settlement, or beneficiary claim; the financial Testnet journey was performed in an isolated local environment.
- MoonPay and MoneyGram have no verified end-to-end Stellar USDC on-ramp or off-ramp. Provider readiness is separate from the submitted core acceptance criteria and remains open in its own plan.
- D1, D2, and D3 reviewer acceptance remains outstanding.
