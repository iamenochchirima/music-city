# Music City automatic early user discount implementation plan

Status: Implemented and locally verified on 9 October 2026. The owner authorized production release on 9 October 2026; deployment and live smoke checks are in progress.

Prepared on 9 October 2026 against the current working tree, including the registration referral implementation.

Implement one reusable admin-sponsored code, `EARLYUSER`, automatically assigned during new registration. The artist activation price is $20 USD, the early-user discount is 100 percent, and the amount due is $0. Completing eligible artist onboarding grants access without creating, signing, or submitting a payment transaction.

Personal referral attribution remains independent. An artist can receive this discount and credit the user who invited them. Sponsored activation never counts as revenue or a paid referral activation.

## Release requirements

- [x] New registrations automatically receive eligibility while the campaign is active, without entering a code or following a referral link.
- [x] Artist onboarding displays the original $20 price, the named $20 discount, and $0 due before completion.
- [x] Completing onboarding creates one sponsored activation and unlocks artist tools atomically.
- [x] Sponsored activation requires no payment intent, synthetic payment record, transaction hash, trustline request, payment signature, or blockchain submission. A wallet-balance request is not required for activation; the separate account wallet overview may still load balances when opened.
- [x] The account retains a receipt showing the discount, activation date, and amount paid of $0.
- [x] Existing free and paid artists retain access and accurate history.
- [x] Admins can inspect the campaign, pause or resume new eligibility, and reconcile totals.
- [x] Automated checks and the browser acceptance checklist pass with saved evidence in `docs/early-user-discount-evidence/README.md`.

Wallet sign-in continues through the existing authentication flow. Authentication signatures must be distinguished from payment approval in both copy and test evidence.

## Campaign rules

| Rule | Required behavior |
| --- | --- |
| Code | One platform-owned `EARLYUSER` code, reusable across accounts |
| Sponsorship | Music City sponsors the discount; no individual admin becomes a referrer |
| Standard price | One-time artist activation, USD 2000 cents |
| Discount | 100 percent, USD 2000 cents |
| Amount due | USD 0 cents |
| Capture point | First committed profile creation while the campaign is active |
| Listener registration | Receives eligibility and can redeem later on completing the artist path |
| Artist or both registration | Redeems on completed onboarding |
| Pausing | Stops new eligibility; existing eligibility and activated access remain valid |
| Expiry and usage cap | None in the initial campaign; admin pause controls new eligibility |
| Repeated requests | One eligibility record and one sponsored grant per account |
| Personal referrals | Preserve the inviter and qualify completed artist registrations normally |
| Existing accounts | Do not retroactively assign the new promotion; preserve existing access separately |
| Future changes | Keep the same public code but create an internal terms revision; existing grants retain their original terms |

Eligibility belongs to the authenticated account. A browser value or code supplied by a client cannot grant a discount. Separate wallets remain separate accounts under the current identity model; do not claim that wallet ownership verifies a unique person.

## Implementation map

| Area | Issue found | Implemented behavior |
| --- | --- | --- |
| Pricing | The settlement amount is an asset amount and defaults to zero; displaying `20` could mean 20 XLM | Quote USD 20 in integer cents. Keep payment disabled unless a verified USD 20 asset equivalent is configured. |
| Free access | Read-time profile hydration created zero-value confirmed payments with fabricated transaction references | Grant sponsorship explicitly and make access reads side-effect-free. |
| Access | Access only understood configured free mode or confirmed payments | Resolve actual paid access, sponsored grants, and preserved legacy free access. |
| First registration | Referral capture already ran in the profile transaction | Capture referral attribution and early-user eligibility atomically. |
| Completion | Onboarding completion saved the profile and qualified referrals | Redeem eligible sponsorship, grant artist access, and qualify referral attribution in one transaction. |
| Payment status | A `paid` boolean blurred free and paid access | Return explicit activation status, quote, receipt, and access information. |
| Client onboarding | The artist path could launch wallet checkout | Show the price breakdown and sponsor explanation; complete sponsored activation without checkout. |
| Paid referrals | Confirmed positive payments qualify paid referral activation | Keep sponsorship outside payments, so a sponsored artist is not counted as a paid activation. |

Relevant files include `server/src/modules/users/users.service.ts`, `users.repository.ts`, `server/src/modules/payments/payments.service.ts`, `server/src/modules/referrals/referrals.service.ts`, and `server/src/services/database.service.ts`. Shared schemas live in `packages/shared/src`; user and admin interfaces live under their existing feature directories.

## Phase 1 Price policy and shared contracts

- [x] Add a shared activation quote schema with `currency`, `originalAmountMinor`, `discountAmountMinor`, `amountDueMinor`, campaign code, terms revision, eligibility, activation status, and access status.
- [x] Represent USD amounts as integer cents. Validate `2000 - 2000 = 0` on the server.
- [x] Add activation statuses such as `eligible`, `sponsored`, `paid`, `legacy_free`, and `payment_required`. Keep eligibility separate from granted access.
- [x] Add a server quote service that supplies the same terms to onboarding, the account receipt, and access-related screens.
- [x] Do not set the existing asset-priced fee to `20` while its asset is XLM. The $20 display must not become a 20 XLM charge.
- [x] When no discount applies, return a truthful $20 amount due and locked artist access. Preserve the paid path only with an explicit USD-to-payment-asset equivalent set to $20; reject unsupported configuration before creating an intent. Paid activation remains disabled by default.
- [x] Keep the original price and campaign terms attached to each eligibility record. Later configuration changes cannot rewrite an existing receipt.

The sponsored path needs no exchange-rate lookup or network availability. This release does not require a new payment provider or fiat checkout.

## Phase 2 Persistence and migration

- [x] Add a sponsorship campaign record with stable code, immutable terms revision, USD price, discount percentage, active state, and creation metadata.
- [x] Seed exactly one `EARLYUSER` campaign. Migration retries do not create additional codes or reactivate a campaign an admin paused.
- [x] Add sponsorship eligibility with a unique account constraint, captured campaign revision, price snapshot, and capture time.
- [x] Add sponsored artist access grants with a unique account constraint, eligibility reference, redemption time, and receipt snapshot.
- [x] Add audit events for eligibility, redemption, campaign pause, and campaign resume.
- [x] Protect captured terms, attribution, and redemption history from normal edits. Pausing affects only new eligibility.
- [x] Add the tables, constraints, and indexes to schema migrations and database health checks.
- [x] Read-only inventory of the connected PC's configured development database found zero artist payment records, confirmed payments, zero-value waivers, positive paid records, or artist payment intents. No migration data exists in that database.
- Production inventory remains a rollout task in Phase 8. The inspected remote `.env` identifies a development environment, so its zero counts do not establish production state. Never use profile hydration for that inventory.
- [x] Preserve legacy free access by reading historic confirmed zero-value waived payments as `legacy_free`; no data migration is needed, and historical rows remain unchanged and excluded from revenue.
- [x] Keep schema initialization idempotent. Do not create historic `EARLYUSER` grants or receipts for existing users.
- [x] Remove the behavior that generated new synthetic free-payment records during profile reads.

Keep migration and rollout safe for existing data. Do not label historical free activations as `EARLYUSER` redemptions or manufacture a discount receipt for artists who paid.

## Phase 3 Transactional registration and access

- [x] During first profile creation, serialize the account and read the active campaign under a lock shared with campaign administration.
- [x] Persist profile creation, existing personal referral attribution, sponsorship eligibility, and eligibility audit evidence in one transaction.
- [x] Define pause ordering by committed transactions: eligibility captured before a pause remains valid; registrations after the pause do not receive it.
- [x] Return the existing eligibility on retries. Existing profiles cannot create or replace eligibility through normal profile edits.
- [x] On completed artist or both onboarding, redeem eligibility and grant access together with completion and referral qualification.
- [x] Support a referred listener later completing the artist path through onboarding or account-intent changes. Redemption remains subject to completed onboarding and happens once.
- [x] Preserve granted access after campaign pause, restart, and later intent changes. Listener mode can hide artist tools without deleting historical entitlement.
- [x] Make access resolution read-only. Reading a profile or status must not create an eligibility, redemption, or payment record.
- [x] Verify draft track creation and release management use the resolved sponsorship access status.
- [x] Reject payment intent preparation for sponsored or sponsorship-eligible artist onboarding. Direct API calls cannot bypass the discount and charge the user.
- [x] Add a protected reconciliation operation for eligible, completed artists. It uses the same redemption transaction and creates no attribution for ineligible historical accounts.

If eligibility capture or redemption fails, return a retryable error and roll back the associated write. Do not quietly fall back to paid checkout or grant access without its receipt.

## Phase 4 User experience

- [x] Show the server quote after artist or both intent is selected, before the completion action.
- [x] Display the one-time $20.00 artist activation, 100% early-user discount (−$20.00), and $0.00 due.
- [x] Explain that Music City covers the artist activation fee as an early user.
- [x] Use “Complete registration” or “Activate artist access” for the free action. Avoid payment and transaction approval language.
- [x] Show loading and retry states while fetching the quote. An unavailable quote does not launch checkout.
- [x] On success, show active artist access and the saved receipt on the account page.
- [x] Label previously paid accounts as paid and legacy waived accounts as legacy free access.
- [x] Show invitation credit separately from sponsorship. The automatic offer does not overwrite a personal referral.
- [x] Sponsored onboarding does not call artist payment preparation or payment signing/submission. Browser verification also observed no balance request during onboarding/activation; the account's separate wallet overview may load balances.
- [x] Check the account receipt at desktop and 390-pixel mobile widths without horizontal overflow.
- [x] Exercise a long display name and interrupted registration recovery in the browser; the persisted artist step and quote survive refresh.

The discount receipt describes artist activation. It must not imply that every future subscription, purchase, or provider fee is also free.

## Phase 5 Admin controls and reporting

- [x] Add an admin sponsorship view showing `EARLYUSER`, the standard $20 price, discount, active state, and recorded terms revision.
- [x] Let admins inspect eligibility and redemptions; restrict campaign pause and resume to super admins under existing role controls.
- [x] Require and audit a reason for pause or resume. Granted terms cannot be edited and activated access cannot be revoked through campaign controls.
- [x] Show eligibility count, redeemed artist count, pending eligibility, and total face value of fees waived.
- [x] Keep “Fees waived” separate from revenue, treasury outflows, and referral commissions.
- [x] Show linked personal referral attribution without treating the sponsoring admin as an inviter.
- [x] Add protected reconciliation with counts of inspected and repaired records.
- [x] Verify role restrictions and campaign/report access with HTTP integration tests.

## Phase 6 Minimal automated checks

Use focused UI tests and an integration test file with actual PostgreSQL. The quote and access rules are covered through the same database-backed service and HTTP path rather than a separate mocked service test. Mock external wallet and payment boundaries; do not mock the database for uniqueness, rollback, or campaign-pause ordering.

| Test group | Required proof |
| --- | --- |
| Price and eligibility | Server returns USD 2000 original, USD 2000 discount, and zero due; active campaign applies automatically; inactive campaign does not grant new eligibility |
| Registration integrity | Concurrent signup creates one account and eligibility; an injected write failure rolls everything back; retries recover without duplicate records |
| Redemption and access | Artist and both completion grant once; listener can redeem later; paused campaign preserves captured eligibility; all artist access gates accept the grant |
| Zero transaction path | Sponsored registration and direct payment-preparation requests create no payment intent or payment record; onboarding/activation makes no wallet-balance request, and the client payment hook does not invoke a signer |
| Referral accounting | Personal inviter survives; artist registration qualifies once; sponsored redemption creates no paid activation or commission and changes no royalty balance |
| Legacy compatibility | Existing real payments and free waivers retain access and honest labels; migration rerun changes nothing; profile reads do not create records |
| Administration | Read and write roles are enforced; pause or resume records an audit reason; paused and active registration requests follow transactional ordering |
| User interface | Browser quote, completion, receipt, refresh, interrupted recovery, and mobile display agree; client hook tests block payment signing; admin waived totals reconcile with redemptions |

- [x] Add the repeatable command `pnpm test:early-user-discount`.
- [x] Add the disposable browser journey `pnpm test:e2e:early-user-discount` with real signed authentication challenges.
- [x] Reuse the isolated database approach in `scripts/verify-referrals.sh`; integration checks run against PostgreSQL and cannot silently skip in the command.
- [x] Run the shared build, focused registration/onboarding/payment/referral checks, workspace typechecks, and production builds.
- [x] Assert database row counts before and after the free flow, including zero new payment records and zero paid referral activations.
- [x] Test checkout preparation with a stale session after sponsorship redemption; the server refuses a charge.
- [x] Record commands, outcomes, browser boundaries, and limitations in `docs/early-user-discount-evidence/README.md`.

Implementation and verification files:

- `server/src/modules/sponsorships/sponsorship-schema.ts`
- `server/src/modules/sponsorships/sponsorships.service.ts`
- `server/src/modules/sponsorships/sponsorships.integration.test.ts`
- `server/src/modules/sponsorships/sponsorships.router.ts`
- `client/src/features/onboarding/early-user-discount.test.tsx`
- `admin/src/features/sponsorships/sponsorships-page.test.tsx`
- `docs/early-user-discount-evidence/README.md`

## Phase 7 Browser acceptance checklist

Use disposable test accounts and an isolated database. Capture user and admin screenshots with no credentials or authentication tokens visible. Browser evidence is in `docs/early-user-discount-evidence/README.md`.

- [x] Start with the campaign active and register a fresh artist without an invitation link or manually entered code.
- [x] Verify the $20 original fee, named 100 percent discount, and $0 due before completion.
- [x] Complete registration without a payment popup, artist payment intent, or wallet-balance request during onboarding and activation.
- [x] Create a draft track and release to prove artist tools accept the sponsored access grant.
- [x] Reload and confirm access and the saved receipt remain unchanged.
- [x] Verify the admin campaign report, pause/resume controls, and 390-pixel mobile receipt.
- [x] Save the price breakdown, activated account receipt, mobile receipt, and admin campaign screenshots.
- [x] Use a real signed Stellar authentication challenge with a disposable key. The browser harness injected the resulting session instead of driving the Freighter popup; the app's actual post-auth registration and activation flow ran in the browser.
- [x] Database/API coverage verifies personal referral attribution remains separate, listener upgrade redeems captured terms, campaign pause ordering is enforced, post-pause users receive no eligibility, historical paid/free access remains valid, and reconciliation is idempotent.
- [x] Visually exercise interrupted registration recovery and a referral-link journey. The referred artist retains personal inviter attribution and receives the independent `EARLYUSER` discount.

Payment signing and blockchain submission are absent from the sponsored path. Authentication signing is only the existing wallet login flow and does not approve an artist activation payment.

## Production rollout checklist

The local implementation and end-to-end acceptance are complete. Production uses Railway's `Music City` project and deploys the server from `main`.

- [x] Check available production access. The Railway database is private and cannot be reached from this workstation; the workspace has no registered SSH key and the connected PC has development settings. No production SQL query has run. The additive migration does not alter user/payment rows, and the resolver preserves legacy access from confirmed payment records or the historical profile grant. See the access note in the evidence README.
- [x] Keep the seeded `EARLYUSER` campaign active as the initial new-user activation path, matching the requested offer. Do not pause new eligibility until a verified USD $20 Stellar settlement amount is configured; never treat `20` as 20 XLM by default.
- [x] Receive the owner's authorization to commit and deploy for live testing.
- [ ] Apply the migration through the production deployment and verify all sponsorship relations and indexes are healthy.
- [ ] Publish the controlled production registration steps and verify the live journey with an owner-controlled test wallet: automatic quote, saved receipt, artist tool access, referral attribution, no payment intent, and matching admin totals.
- [ ] Record the deployed commit, production health, campaign state, and rollback path. Production database before/after counts are unavailable without a read-only connection.
- [x] Verify locally that the displayed price is USD $20 and the default configuration cannot turn it into a 20 XLM intent. A payment amount remains disabled unless the operator supplies an explicit $20-equivalent Stellar asset amount.
- [x] Enable the seeded campaign in an isolated local pilot and complete automated checks and the browser acceptance path.
- [x] Update configuration examples, onboarding/operator documentation, and this implementation checklist. Personal referral accounting remains separately documented.
- [x] Document rollback: pause new sponsorship eligibility; retain existing grants, eligibility, and receipts; reconcile interrupted completion; never reactivate synthetic waiver creation.
- [x] Audit the release requirements against local code, database constraints, automated tests, and captured browser evidence.
- [x] Keep production deployment status explicit. Local verification does not establish a production rollout or a live payment test.

Local implementation is complete: the saved price breakdown, access grant, referral attribution, and admin report agree, and the sponsored activation creates no payment transaction or revenue. The initial campaign decision is to keep `EARLYUSER` active. Production rollout is authorized and underway; the checks above distinguish deployment from owner-run account acceptance.
