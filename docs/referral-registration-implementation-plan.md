# Music City registration referral implementation plan

Status: Implemented, locally verified, and deployed to production on 9 October 2026 as commit `b9b4fba`. Production API and database readiness are healthy, and referral links are enabled. Owner-controlled signup acceptance and ongoing monitoring remain.

Prepared on 8 October 2026 against commit `2ac781a`; implementation and verification completed in the current working tree.

Automatic early-user sponsorship is implemented in the [separate sponsorship checklist](early-user-discount-implementation-plan.md). It preserves personal referral attribution while showing a $20 artist activation price and automatically applying a 100 percent discount. The plan below records the zero-fee baseline as it was when this referral work was scoped.

Build a referral flow that connects an invitation to a new account, credits the inviter when artist onboarding is complete, and shows progress to users and admins. Launch with registration credit only. Cash rewards remain disabled because the current local artist onboarding fee is zero and commission terms have not been agreed.

## Scope and completion criteria

The registration release is complete when a user can share a personal invitation, a new artist can finish wallet signup and onboarding through that invitation, and both the inviter and admin can see exactly one completed referral. Refreshes, retries, concurrent requests, and interrupted onboarding must preserve that result.

Registration credit is a count of completed referrals. It is not a wallet balance, a redeemable point, or a promise of future payment.

- [x] Deliver invitation links and optional code entry during initial registration.
- [x] Preserve attribution through Freighter authentication and onboarding.
- [x] Qualify completed artist registrations and report listener registrations separately.
- [x] Deliver inviter progress and admin inspection.
- [x] Pass the minimal automated checks and browser acceptance path below.

Paid activation tracking is implemented as a separate milestone with no cash reward. Commission calculation, reward approval, cash transfers, email invitations, leaderboards, subscription referrals, and music purchase referrals are outside the registration release.

## Existing implementation to extend

| Component | Current implementation | Referral integration |
| --- | --- | --- |
| Authentication | `server/src/modules/auth/auth.router.ts`, `server/src/services/stellar-auth.service.ts` | Use the authenticated wallet to validate claims; never accept an invitee wallet supplied by the browser |
| Browser sign-in | `client/src/features/auth/providers/auth-provider.tsx` | Retain the pending invitation while the user connects Freighter |
| First profile creation | `server/src/modules/users/users.service.ts` through `saveOnboardingStep` | Create the profile and referral attribution in one database transaction |
| Onboarding completion | `completeOnboarding` in the same service | Record registration completion and qualify artist referrals atomically |
| Profile updates | `upsertProfile` and onboarding intent updates | Handle a new referred listener later completing the artist path without duplicating credit |
| Payment confirmation | `server/src/modules/payments/payments.service.ts` | Later record a separate paid activation after verified payment persistence |
| Database | `server/src/services/database.service.ts` | Add migrations, constraints, and repository methods using the existing transaction helper |
| Shared contracts | `packages/shared/src` | Add referral request and response schemas |
| App routes | `client/src/app-routes.tsx`, `admin/src/app-routes.tsx` | Add invitation, account referral, and admin routes |

The current email field is optional. Do not describe registrations as email-verified or assume that separate wallets prove separate people. The existing `verified` profile flag must not be repurposed as referral identity verification without checking its meaning.

## Registration rules

Use these defaults for the first release. Any later changes need a new campaign version.

| Rule | Implementation behavior |
| --- | --- |
| Inviter eligibility | Existing profile with completed onboarding; use an existing account restriction mechanism if available |
| Invitee eligibility | No existing Music City profile at the time attribution is bound |
| Invitation duration | Thirty days from the first valid invitation capture, measured by the server |
| Multiple invitations | Keep the first valid invitation; allow deliberate code correction before profile creation |
| Attribution lock | Bind at first profile creation; reject later attempts to add or replace it |
| No invitation | Registration works normally; do not add attribution later |
| Qualification | Onboarding complete with intent `artist` or `both` |
| Listener path | Record completed listener signup separately; qualify once if this new referred account later completes the artist path under the same campaign |
| Repeated actions | One attribution and one artist qualification per invitee |
| Self-referral | Reject equal inviter and invitee account or wallet |
| Invalid or expired invitation | Explain that it cannot be applied and allow signup to continue |
| Historical accounts | Existing profiles are ineligible even if their onboarding is incomplete |
| Campaign terms | Save the campaign version with attribution; never rewrite old terms through a configuration change |

“New” means a new profile under the current account model. Wallet sign-in can occur before a profile exists. The system cannot claim to identify a unique human or every historical sign-in from profile existence alone.

## Phase 1 Shared contracts and persistence

- [x] Add `packages/shared/src/referrals.ts` and export it from the shared package.
- [x] Define campaign, invitation receipt, referral summary, referral status, and admin response schemas.
- [x] Add a campaign record with version, active flag, thirty-day window, artist qualification rule, and `rewardsEnabled=false`.
- [x] Add `referral_codes` with a unique random code and one code per inviter. Generate enough random entropy to discourage enumeration and retry collisions.
- [x] Add `referrals` with inviter, invitee, campaign version, capture time, binding time, onboarding completion time, artist qualification time, and exclusion reason. Rejected invitations do not create referral records.
- [x] Enforce a unique invitee constraint and prevent inviter and invitee equality in the database.
- [x] Add an audit record for attribution, qualification, and admin exclusion decisions. Admins may exclude abuse but must not silently reassign referrals.
- [x] Implement transaction-aware repository methods in `server/src/modules/referrals/`.
- [x] Refactor the first-profile write and qualification writes to use a single transaction connection. A profile must not commit without its accepted attribution, and a referral must not point to an uncommitted profile.
- [x] Derive dashboard totals from referral records. Avoid a second mutable counter system in this release.

Keep milestones distinct: `registration_started`, `registration_completed`, and `artist_registration_completed`. Exclusion is a separate decision with a recorded reason. A later intent change must not erase historical qualification.

## Phase 2 Invitation capture and authenticated binding

- [x] Add an invitation route such as `/join?ref=MC8K4P` to the client.
- [x] Add a rate-limited backend endpoint to validate a code and issue a signed, expiring invitation receipt. Include inviter, campaign version, and server capture time.
- [x] Store only that receipt and limited display data in browser storage. Do not trust browser timestamps, inviter IDs, or a claimed reward amount.
- [x] Preserve the receipt through wallet sign-in, refresh, and failed connection attempts. Use the first valid receipt unless the user explicitly corrects the code.
- [x] Add optional referral code entry to the first onboarding screen. Resolve it into a receipt through the same backend endpoint.
- [x] Extend the initial onboarding request to carry the receipt; validate signature, expiry, campaign, and inviter eligibility on the server.
- [x] Derive the invitee wallet from the verified session and bind attribution during first profile creation.
- [x] On retry, return the existing profile and attribution. Under concurrent requests, keep the attribution from the first committed creation.
- [x] Prevent the normal profile-edit API from assigning or modifying referral fields.
- [x] Clear the pending browser receipt after binding or ordinary profile creation. Clear it on logout or wallet switch to prevent accidental attribution to another account.
- [x] Ensure referral endpoints and receipts do not expose private account data or permit arbitrary redirects.

Code validation failure must not break signup. An infrastructure failure during an accepted attribution write must return a retryable error rather than quietly losing referral credit.

## Phase 3 Registration qualification

- [x] In the onboarding completion transaction, record registration completion once.
- [x] For `artist` and `both`, record artist qualification once when onboarding is complete.
- [x] Keep listeners in the completed-registration count without adding them to the completed-artist count.
- [x] Run the same qualification rule when a referred listener later completes or updates their artist path. Do not count merely opening a page or changing a browser field.
- [x] Ignore retries after qualification and retain the original qualification timestamp.
- [x] Prevent returning to listener intent and back to artist from earning another referral.
- [x] Make existing referred rows repairable by a reconciliation operation that applies the same qualification rule to completed profiles. Restrict it to existing attribution; do not invent referrals for historical accounts.

The thirty-day window controls when attribution may bind. Once bound, interrupted onboarding can finish later under its recorded campaign without losing attribution.

## Phase 4 User and admin interfaces

- [x] Add “Invite artists” to the account area with copy link and native share support where available.
- [x] Show the current rules and the explicit message “Registration referrals do not currently earn cash rewards.”
- [x] Show registrations started, registrations completed, and artist registrations completed.
- [x] Show each referral's progress using limited display information and a stable masked label where needed. Hide email addresses, wallet addresses, and payment details from inviters.
- [x] Show empty, loading, unavailable, and retry states. Confirm link copying without losing the user's place.
- [x] Add a protected admin referrals page with campaign and status filters, inviter and invitee identifiers, timestamps, and audit history.
- [x] Authorize user reads against the session account and admin reads through existing admin authentication.
- [x] Add admin exclusion with a required reason and an audit trail. Excluded referrals must not inflate qualified totals.
- [x] Define storage retention for invitation receipts and referral records before launch; avoid collecting device fingerprints for this release.

## Phase 5 Minimal verification

Use the existing server test runner and client Vitest setup. Keep the suite focused on behavior. Mock wallet and external network boundaries; exercise actual services and database constraints where correctness depends on persistence.

| Check | Minimal assertions |
| --- | --- |
| Invitation rules | Valid code resolves; invalid, expired, inactive, and forged receipts cannot bind; first invitation survives unless deliberately corrected |
| Registration integration | Authenticated new account binds once; existing profile, self-referral, and another user's claim are rejected; signup without a code still works |
| Transaction integrity | Concurrent first-profile requests create one profile and one attribution; injected failure rolls back both; retry succeeds once |
| Qualification integration | Artist and both qualify; listener completes without artist credit; later artist completion qualifies once; repeated completion and intent changes do not duplicate credit |
| Access and totals | Inviter sees only their referrals; outsiders cannot read them; admin routes require admin auth; exclusions affect totals and preserve evidence |
| Client journey | Invitation survives mocked Freighter sign-in and refresh; first onboarding request includes it; receipt clears after binding or wallet change; invalid code does not block signup |
| Free onboarding regression | Existing zero-fee behavior still grants artist access; no registration path creates a financial reward or changes royalty balances |

- [x] Implement these checks in a small referral domain test file, a database integration test file, and a client journey test file. Use table-driven cases instead of separate files for every rule.
- [x] Run database checks against a dedicated disposable test database with an explicit guard against development or production data. Do not let mocked repositories stand in for uniqueness or rollback verification.
- [x] Add a focused referral verification command using the existing tooling. It must build the shared package before tests and return a nonzero exit code on failure.
- [x] Run existing users and payments tests, plus shared, server, client, and admin typechecks after integration. Broaden testing only when changes or failures justify it.

Implemented test locations:

- `server/src/modules/referrals/referrals.service.test.ts`
- `server/src/modules/referrals/referrals.integration.test.ts`
- `client/src/features/referrals/referral-registration.test.tsx`

### Browser acceptance path

- [x] Use one existing test inviter and a fresh test artist wallet in a separate browser profile.
- [x] Open the invitation link, refresh, authenticate with a signed test wallet challenge, and complete artist onboarding. Freighter extension handoff is covered by adapter tests; its popup was not driven in the browser check.
- [x] Confirm exactly one completed artist referral on both user and admin screens.
- [x] Repeat completion and refresh both screens; totals must stay unchanged.
- [x] Repeat with a listener, then complete the artist path; confirm separate listener and artist milestones without duplicate attribution.
- [x] Open an invalid code and confirm ordinary registration still works.
- [x] Capture screenshots of the invitation, completed registration, and matching dashboards using disposable test accounts.

Automated tests plus this browser path establish the registration release. They do not prove cash reward settlement, which is outside its scope.

## Phase 6 Production release and follow-on paid activation

- [x] Put referral capture behind a feature flag. Disabling new capture must preserve existing records and permit already-bound onboarding to finish.
- [x] Deploy commit `b9b4fba` and verify production database readiness and the sponsorship migration.
- [x] Enable referral links for live testing at `https://music-city.vercel.app`; the admin dashboards are at `https://music-city-admin.vercel.app`.
- [ ] Complete an owner-controlled production registration and confirm attribution and admin totals.
- [ ] Monitor binding failures, signup-to-completion conversion, duplicate claims, and exclusions. Log record IDs and error reasons without wallet secrets or authentication tokens.

### Paid activation milestone

The recording path is implemented and tested with persisted payment fixtures. It becomes relevant when paid artist onboarding is enabled; no commission is created.

The separate early-user sponsorship program is documented in [its implementation checklist](early-user-discount-implementation-plan.md). A sponsored activation preserves personal referral attribution, but it is not a paid activation and must not create a referral commission.

- [x] Record one paid activation only after a confirmed `artist_onboarding_fee` payment with amount greater than zero and `waived` absent or false.
- [x] Store payment ID, asset, network, amount, and referral campaign version. Do not use `artistAccess=true` or the frontend success message as proof of payment.
- [x] Make payment milestone recording retryable from confirmed payment records, with a unique qualifying payment link per referred account.
- [x] Add one table-driven test covering genuine paid confirmation, zero amount, waiver, unrelated product, and repeated confirmation. Distinguish testnet evidence from real-money eligibility.
- [x] Resolve the inconsistent fee checks in release management before advertising paid activation as a requirement across artist tools.
- [ ] Agree commission rate, funding cap, review period, identity checks, refund handling, and payout rules before adding financial rewards. The earlier 10 percent and seven-day figures were proposals, not approved configuration.
- [x] Preserve the registration campaign's no-cash terms. Do not retroactively convert free registrations into payable commissions.

## Baseline evidence

At planning time, `.env` sets `ARTIST_ONBOARDING_FEE_PRICE=0`; the environment schema and example also default to zero. This describes this checkout, not an independently verified production environment.

The existing users and payments tests passed 11 checks after rebuilding the shared package. Referral implementation, focused checks, and browser evidence are recorded in [verification evidence](referral-registration-evidence/README.md). Production deployment is complete; owner acceptance and cash reward decisions remain open.

Practice references: [Dropbox referral progress and qualification](https://help.dropbox.com/storage-space/earn-space-referring-friends) and [Wise qualifying actions and registration campaign terms](https://wise.com/help/articles/2487043/how-does-the-free-transfer-invite-program-work). Music City's thirty-day attribution window and registration rules are proposed project defaults.
