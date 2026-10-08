# Contributor Royalty Agreements Implementation Plan

Status: In progress. The agreement workflow, transaction-backed persistence, protected finalization, replacement contract, creator and admin interfaces, and effective-agreement consumers are implemented and locally tested. Legacy activation and publication paths are removed. Live Testnet publication and admin browser checks pass. Creator authentication and agreement signing use direct Freighter signatures with one-time server challenges. Real browser signing remains unverified. The 2026-10-05 Codex In-app Browser check found no Freighter provider; sign-in now times out with a reload action and does not proceed to the server challenge. Checked items indicate implemented work; the completion checklist is the milestone gate.

This milestone delivers contributor proposals, wallet-signed consent, rejection and disputes, controlled amendments, and protected finalization. An artist must be able to propose a 70/30 royalty split, obtain approval from both contributors, and produce a finalized version with an auditable history. Settlement will consume that exact finalized version in the next milestone.

The authoritative scope is the [Music City Instawards SOW](https://docs.google.com/document/d/1Nk0WR6laCp2meQT_VANp3oYFr9YkuZyVKe5ziuPWFoc/edit). This plan covers the agreement and finalization portion of Deliverable 2 and the creator/admin integration needed to operate it. It does not claim completion of all three SOW deliverables.

## Implementation principles

- Build the required flow even when existing code must be refactored or replaced.
- Remove replaced endpoints, schemas, UI controls, configuration and tests in the same implementation change. Do not retain alternate legacy activation or publication paths.
- Do not silently fall back to off-chain finalization, an unsigned approval, another settlement rail, or single-key treasury authorization when the required flow fails.
- Preserve historical financial and consent evidence. Removing obsolete code does not mean deleting valid ledger records or treating old splits as contributor-approved.
- Implement correctness, ownership checks, signature verification and required authorization now. Broader hardening and production deployment work are separate later milestones.
- A milestone is complete only when its functional tests and demonstration pass. Documentation, an API response, or a mocked transaction alone is insufficient evidence of on-chain finalization.

## Scope boundaries

### Included

- Track-bound contributor agreements with explicit release context where applicable.
- A canonical, versioned split proposal and wallet-signed responses tied to it.
- Proposal, acceptance, rejection, dispute, finalization and amendment workflows.
- Creator views for proposing and responding; admin views for reviewing and finalizing.
- Functional 2-of-3 Stellar treasury authorization for protected finalization, as required by the SOW.
- Publication and verification of the finalized version in Soroban.
- Transactional persistence, audit events, and focused automated tests.
- A repeatable local demonstration and a Testnet verification record.

### Deferred

- Earnings settlement batches, recipient allocation, claimable USDC, withdrawal and expiry handling: the settlement milestone.
- Direct fan support payments: a separate Deliverable 2 payment flow, still required by the SOW.
- General treasury administration beyond the configuration and authorization needed for this milestone's finalization.
- Fiat adapters, Yellow Card and MoneyGram integrations.
- Production deployment, broad security review, load testing, monitoring, alerting, key custody and rotation procedures, extensive chaos testing and independent contract audit.

Deferral does not permit fabricated consent, bypassed treasury thresholds or a finalized status without verified evidence. Local tests may exercise intermediate stages; Testnet publication is a completion check rather than a full production deployment project.

## Starting code and required replacement

This table records the starting implementation and the replacement direction. Current evidence appears below; the table is not a description of deployed services.

| Area | Starting implementation | Replacement direction |
| --- | --- | --- |
| Shared royalty schemas | `packages/shared/src/royalties.ts` defines draft/active/superseded/archived splits | Introduce agreement versions, contributor responses and finalization records; remove direct activation inputs once replaced |
| Royalty service | `server/src/modules/royalties/royalties.service.ts` creates active versions and publishes them | Make finalized agreements the source of publishable splits; remove admin-only consent bypasses |
| Persistence | Royalty records and migrations live in `server/src/services/database.service.ts` and the royalty repository | Add transactional agreement persistence and explicit integrity constraints |
| Wallet authentication | Stellar authentication and wallet services exist | Verify suitability for signing exact proposal actions; login authentication alone does not constitute agreement approval |
| Soroban registry | `contracts/royalty-split-registry/src/lib.rs` allows admin set/freeze; freezing prevents later versions | Replace the publication/finalization model so historical finalized versions remain immutable while amendments can create new versions |
| Payout submission | `stellar-payout.service.ts` signs payments with one treasury secret | Do not reuse this signer as a substitute for threshold-protected finalization; settlement/payout replacement belongs to its own milestone |
| Older scope notes | `INSTAWARDS_SOW_UPDATE_NOTES.md` differs from the Google Doc on direct support payments | Mark conflicting guidance as superseded; use the Google Doc for scope decisions |

## Functional model

The implementation uses the following decisions. Local finalization tests mock the RPC boundary; they do not prove Testnet authorization or publication.

- Version-one canonical serialization uses a fixed JSON field order, the application domain `music-city:royalty-agreement`, and recipients sorted by exact Stellar wallet address. Wallet, role, share, terms, track/release context, network, version and previous hash are bound into the proposal hash.
- Amounts are integer basis points. Wallet checks validate Stellar address checksums in the backend, not only address shape.
- Responses use an off-chain Stellar transaction signing challenge with sequence zero, a five-minute expiration and a manage-data operation containing the hash of the complete response context. These challenges are never sent to Horizon and are not presented as on-chain approval transactions.
- The database stores the exact expected envelope. Verification requires an identical transaction hash under the proposal network and a valid signature from the bound contributor wallet. Exact verified retries return the original response; unused expired challenges fail.
- Accepted contributors may open a blocking dispute before finalization. Rejection/dispute closes the version to new approvals. Revisions include an explanation, create a new version and retain earlier response evidence; they never count as contributor acceptance.
- Only the verified track owner creates or edits proposals. Draft editing is allowed; submission fixes the payload. Owner revisions do not finalize anything. Participants can view agreement history; outsiders cannot.
- Creation snapshots the track's associated release, where one exists, and verifies that the release has the same owner. This release context is included in the canonical proposal and signed responses.
- All writes lock the agreement root on a dedicated PostgreSQL transaction connection. Consent, readiness, challenge consumption and audit events commit together. Database triggers protect submitted payloads and append-only response/event evidence.
- A ready version is not finalized. Only confirmed protected finalization can advance the effective version.
- Finalization re-verifies every consumed contributor signing challenge, the canonical hash, treasury signer configuration and latest registry record. Preparation fixes a ten-minute treasury-source Soroban transaction and stores its exact XDR/hash before accepting signatures. Duplicate preparation returns the existing attempt; only one active attempt per treasury is permitted.
- Signature collection verifies the exact envelope and each independent signer. Submission requires two distinct configured signers and rechecks the account thresholds. The service commits submission intent before calling RPC. Network uncertainty leaves the same transaction pending for reconciliation.
- Confirmation verifies the original envelope/hash, two independent treasury signatures, the contract return value and a read-back of the same immutable version. It then atomically confirms the attempt, finalizes the version, advances the effective pointer and records the audit event. A conflicting publication does not advance local state.
- Failure permits a fresh attempt with fresh signatures. An expired transaction only releases its attempt after RPC ledger history spans preparation through expiration and proves no inclusion. Pruned or uncertain history remains pending; an unexplained existing publication requires original transaction evidence.

### Agreement states

| State | Meaning | Permitted next action |
| --- | --- | --- |
| Draft | Editable proposal with no binding responses | Edit, submit or cancel |
| Proposed | Payload is fixed; contributors can respond | Accept, reject, dispute or cancel under explicit ownership rules |
| Ready for finalization | Every required contributor accepted the same payload; no unresolved rejection or dispute | Request protected finalization or dispute before finalization |
| Rejected | At least one required contributor rejected | Create a revised proposal version |
| Disputed | A contributor raised a blocking dispute | Record resolution and create a new version requiring fresh consent |
| Finalizing | A durable finalization attempt is being submitted or reconciled | Confirm, reconcile or retry the same attempt safely |
| Finalized | Required treasury authorization and Soroban publication are verified | Read or propose an amendment |
| Cancelled | Proposal was withdrawn before finalization | Read history; create another version if permitted |

Acceptance is a per-contributor response, not an agreement-wide state. Rejection or dispute blocks finalization. Do not edit a submitted payload in place. Dispute resolution must not manufacture acceptance or reuse signatures from an older version.

A finalized version remains finalized historical evidence. A separate effective-version reference determines which finalized version future earnings use. An amendment becomes effective only after fresh contributor consent and protected finalization; it does not rewrite earlier earnings or ledger entries.

### Records and invariants

- Agreement: owner, track/release identifiers, current proposal version and effective finalized version.
- Version: ordered canonical recipients, shares in integer basis points, terms, schema version, proposal hash, previous version reference, state and timestamps.
- Contributor response: account, verified wallet, action, version/hash, signature evidence, signed payload and verification time.
- Dispute: contributor, reason, version, resolution record and timestamps.
- Finalization attempt: version/hash, expected network and contract, exact transaction identity, signer evidence, status, transaction hash and verified publication result.
- Audit event: actor, action, affected version, prior/new state and timestamp; events are append-only.

Required contributors are all royalty recipients in this first implementation. Each must have a Music City account with a verified Stellar wallet. Shares must be positive integers totaling exactly 10,000 basis points; wallets must be valid and unique. Reject unsupported recipient/network combinations explicitly.

Signed actions must bind the application, action, agreement, track, version, network, canonical proposal hash and challenge identity. Define deterministic serialization and ordering before implementing signatures. Challenges have explicit validity and consumption rules. Changing wallets or terms requires a new version and new consent; a stale signature cannot authorize a replacement payload.

## Phased implementation checklist

### Phase 1 Specify the complete flow

- [x] Define canonical fields, ordering, serialization, hashing, maximum contributor count and signed action payloads.
- [x] Define proposer ownership, contributor eligibility, cancellation rules and dispute resolution permissions.
- [x] Specify the full state-transition table, including disputes racing with finalization and transaction timeout outcomes.
- [x] Define when finalization is locked and how the exact authorized proposal is pinned during an in-flight transaction.
- [x] Specify amendment eligibility and when a new version becomes effective for future earnings.
- [x] Confirm how the actual Stellar treasury threshold protects the Soroban authorization path; do not substitute two application approvals for two valid chain signatures.
- [x] Decide final contract interface and publication evidence, including agreement hash and immutable version lookup.
- [x] Record decisions and expected API requests/responses in this document before implementation.

### Phase 2 Shared model and database

- [x] Add shared schemas/types for versions, responses, disputes, finalization and audit events. Version, response, finalization and audit data are implemented.
- [x] Add database migrations, foreign keys and uniqueness rules for versions, contributor responses and finalization identities. Finalization attempts and integrity migrations are implemented.
- [x] Implement transaction-backed repository methods for state transitions and version creation.
- [x] Make the agreement payload immutable after submission; enforce this in persistence, not only in UI.
- [x] Make repeated identical responses idempotent; reject conflicting repeated responses. Finalization request idempotency remains in Phase 4.
- [x] Keep effective finalized versions separate from current drafts/proposals.
- [x] Document disposition of existing splits: retain financial history, require fresh consent for future agreement-based use, and never backfill fictional approvals.

### Phase 3 Backend consent workflow

- [x] Implement create/edit draft, submit proposal, list own agreements and read version/history endpoints.
- [x] Implement action challenge issuance, signature verification, acceptance, rejection and dispute endpoints.
- [x] Verify contributor ownership using the account and wallet snapshot bound to the proposal.
- [x] Recompute readiness from verified responses to the exact version; clients cannot set ready/finalized states.
- [x] Implement dispute resolution and amendment creation with new hashes and fresh responses. Admin resolution creates an owner-controlled draft and preserves the blocked version; it never manufactures contributor acceptance.
- [x] Record state changes and responses atomically with audit events.
- [x] Remove replaced direct split activation APIs and prohibit publication from an unapproved proposal.

### Phase 4 Protected finalization and contract integration

- [x] Refactor or replace the registry to publish consent-bound finalized versions and permit controlled future amendments. Replacement source, local contract tests and fresh Testnet deployment are verified.
- [x] Reject duplicate version publication and conflicting hashes; retain immutable historical lookup.
- [x] Configure a Testnet treasury with three independent signers and a threshold requiring two.
- [x] Implement exact transaction preparation, collection of valid signatures and submission; no backend single-key shortcut.
- [x] Persist finalization attempts before submission and reconcile unknown outcomes before retrying.
- [x] Verify the confirmed contract version and hash before marking an agreement finalized and making it effective. Local lifecycle tests and two live Testnet confirmations cover this transition.
- [x] Retain ready/finalizing state with an explicit actionable error when finalization fails; never report success through a fallback.
- [x] Remove the old admin-only set/freeze publication path and obsolete contract/client bindings.
- [x] Confirm that settlement consumers can obtain only the explicit effective finalized version and its evidence.

### Phase 5 Creator and administrator interfaces

- [x] Add a proposal editor with contributor selection, shares, total validation and a readable review step.
- [x] Show the complete split and version before requesting a wallet response.
- [x] Add pending invitation, accept, reject, dispute and response-history views.
- [x] Explain wallet mismatch, missing verified wallet and failed signing with clear corrective actions.
- [x] Display contributor progress, blocking disputes, finalization status and transaction evidence.
- [x] Add controlled amendment creation that retains the prior finalized version while new consent is collected.
- [x] Add admin review, dispute resolution and treasury signature/finalization views.
- [x] Remove replaced royalty editors/actions that bypass the agreement flow.

### Phase 6 Verify and document

- [x] Complete the focused automated tests below. UI transport tests mock the wallet/HTTP boundary; real cryptographic and chain evidence is separate.
- [x] Demonstrate a 70/30 agreement from proposal through verified Testnet finalization.
- [x] Demonstrate a rejection/dispute blocking finalization and an amendment collecting fresh consent.
- [x] Capture contract ID, network, agreement hash, transaction hash, explorer link and admin UI screenshots.
- [ ] Verify authenticated creator signing with Freighter in Chrome or Edge; capture its review, cancellation and successful response.
  The 2026-10-05 Codex In-app Browser check found no `window.freighter` provider. The login now times out after 30 seconds and requires a reload. This verifies the unavailable-provider path, not wallet signing.
- [x] Document local setup and the Testnet verification steps without committing private keys.
- [x] Update affected royalty documentation and mark conflicting old scope notes as superseded. Conflicting `INSTAWARDS_SOW_UPDATE_NOTES.md` guidance is now explicitly superseded; royalty documentation now describes the replacement flow and links current Testnet evidence.
- [x] Search for obsolete schemas, routes, imports, environment variables and UI actions; remove all replaced paths.

## Focused automated tests

Use actual signature verification in consent tests. Mocking the verifier to always return true does not test consent. Use transaction-backed repository tests for concurrency and persistence; reserve live Testnet checks for final evidence.

| ID | Scenario | Expected result |
| --- | --- | --- |
| A01 | Valid 70/30 proposal | Canonical version is created; shares total 10,000 |
| A02 | Wrong total, zero/negative/fractional shares, duplicate or invalid wallets | Submission fails without partial state or audit changes |
| A03 | Canonically equivalent input and any material payload change | Equivalent input produces the same hash; a material change produces a different hash |
| A04 | Both required contributors sign the same proposal | Responses verify; agreement becomes ready exactly once |
| A05 | Only one contributor accepts | Finalization is blocked |
| A06 | Non-contributor, wrong wallet or invalid signature responds | Response is rejected; no consent is recorded |
| A07 | Signature reused for another action, version, agreement or network; expired challenge | Verification fails |
| A08 | Same valid response is retried or submitted concurrently | One response/event exists; conflicting responses fail explicitly |
| A09 | Submitted/finalized payload is edited | Mutation is rejected |
| A10 | Contributor rejects or disputes | Finalization is blocked; reason and history remain visible |
| A11 | Dispute races with finalization | Serialized transition rules produce one valid outcome; blocked versions cannot finalize |
| A12 | Dispute is resolved and proposal revised | New version requires fresh signatures; old evidence remains unchanged |
| A13 | Amendment is finalized | New version becomes effective for future use; prior finalized version and historical ledger links remain unchanged |
| A14 | User reads or changes another user's agreement without membership/role | Access is rejected |
| A15 | Finalization has zero, one, duplicate or invalid treasury signatures | Protected transaction fails; application does not mark finalized |
| A16 | Two distinct valid treasury signatures authorize the exact transaction | Threshold authorization succeeds and publication evidence matches |
| A17 | Duplicate or conflicting contract publication | Identical retry is reconciled without a second effective transition; conflicting hash is rejected |
| A18 | Submission times out after chain success, fails before submission, or returns mismatched evidence | Reconcile before retry; no duplicate publication or false finalized state |
| A19 | Database failure during response or state transition | Transaction rolls back; no partial consent, readiness or audit event |
| A20 | Old activation/publication routes or unsupported configuration are used | No legacy bypass or silent fallback exists |
| A21 | Freighter does not answer an access or signing request | Sign-in times out with a clear recovery action; a late response cannot continue into challenge verification |

Add contract tests for historical immutability, amendment versions, unauthorized publication and expected events. Add UI integration tests for the proposal review, signing cancellation, rejection/dispute and finalization status. Avoid tests that only repeat implementation internals without checking observable behavior.

Existing verification commands to use as applicable:

```sh
pnpm --filter @music-city/shared build
pnpm --filter server test
pnpm contract:test
pnpm typecheck
pnpm build
```

Add a dedicated agreement test command if useful during implementation. Record exact passing commands and outcomes in the evidence notes; this plan is not a claim that they have already passed.

## Demonstration and completion checklist

- [x] Artist A creates a track-bound proposal: A receives 70%, contributor B receives 30%.
- [ ] Both verified wallets independently review and sign that exact version.
- [x] An attempt before B accepts is blocked.
- [x] Two distinct treasury signers authorize finalization; one signer cannot complete it.
- [x] Soroban publication confirms the same version/hash and the UI shows verifiable evidence.
- [x] A proposed amendment keeps the old effective agreement intact until fresh consent and finalization succeed.
- [x] A dispute/rejection blocks the amended version; its history is visible to the participants and authorized admin.
- [x] Repeating responses or finalization requests creates no duplicate outcome.
- [x] Obsolete bypasses have been removed and documentation describes only the implemented flow.
- [x] Automated checks and Testnet evidence are linked in a milestone completion record.

The milestone is ready for the settlement engine when the application and contract agree on the effective finalized version, participant consent and treasury authorization are verifiable, and settlement cannot consume a draft, disputed or unconfirmed version. Production hardening and deployment remain later work.

## Implementation evidence so far

- `server/src/modules/agreements/agreement-domain.test.ts`: 11 passing domain tests with real generated wallet signatures, covering canonical hashes, invalid splits, authorization, payload/action/network replay, expiration, exact retries, disputes and amendment history.
- `server/src/modules/agreements/agreements.integration.test.ts`: 10 passing PostgreSQL scenarios plus the parent test, covering atomic draft creation, invalid contributor rollback, draft permissions, concurrent identical and independent responses, invalid-signature rollback, an injected audit-write failure rolling back consent/readiness/challenge consumption, immutable database evidence, rejection/revision history, outsider access and release-context binding.
- `server/src/modules/agreements/treasury-signatures.test.ts`: 5 passing tests with real Ed25519 signatures verify exact threshold configuration, independent signature collection, duplicate signer rejection, altered transactions/networks, malformed XDR, expiry and invalid stored evidence.
- `server/src/modules/agreements/admin-agreements.router.test.ts`: a real HTTP server verifies unauthenticated rejection, admin read access, super-admin operation access, and use of the authenticated actor rather than a caller-supplied identity.
- `server/src/modules/agreements/finalization.integration.test.ts`: 8 passing PostgreSQL scenarios plus the parent test verify idempotent/concurrent preparation, treasury sequencing, the one-signer gate, durable uncertain submission, confirmation/read-back mismatch rollback, immutable confirmation, fresh consent and effective-version advancement for amendments, retry after failure, expiration versus pruned ledger history, forged readiness rejection, a dispute racing preparation and admin resolution into an owner-controlled draft. Only the network boundary is mocked; contributor and treasury signatures and database transactions are real. Both PostgreSQL suites together report 20 passing tests with no skips or failures.
- `pnpm typecheck`, `pnpm test` and `pnpm build` pass across the workspace. The latest default server suite reports 89 pass, no failures, and 2 skipped opt-in PostgreSQL suites; both database suites were run separately against isolated local PostgreSQL. The client suite now has 16 passing tests, including observable timeout recovery and proof a late Freighter access response cannot continue to challenge verification. The client build retains its large-chunk warning.
- Creator route: `/account/agreements`, linked from account activity and studio navigation. Its unauthenticated gate and persistent timeout/reload message were verified in the local browser. Authenticated UI interaction and real wallet-provider signing still require end-to-end verification.
- Admin route: `/console/agreements`, with contributor/version review, dispute resolution into fresh owner-controlled drafts, protected transaction preparation, XDR download and signed-envelope collection, threshold progress, submission/reconciliation, publication evidence and historical views. Using a disposable local admin account and database, browser checks verified a 70/30 disputed proposal, its signed response history, the blocked state, admin resolution producing a version-two draft with no reused consent, preservation of version-one history, and an explicit configuration error when preparation lacks the dedicated agreement treasury. See [dispute review](contributor-agreements-evidence/admin-dispute.png) and [resolution result](contributor-agreements-evidence/admin-resolution.png). These screenshots show local test fixtures. Component tests cover signature collection, the two-signature gate, failed verification and reconciliation. The browser also displays the real Testnet-confirmed version and historical dispute; see [confirmed publication](contributor-agreements-evidence/admin-testnet-finalized.png) and [history](contributor-agreements-evidence/admin-testnet-history.png).
- `PATH=/home/enock/.cargo/bin:$PATH pnpm contract:build` passes with the SDK-required `wasm32v1-none` target. The release artifact is `contracts/target/wasm32v1-none/release/royalty_split_registry.wasm`. Four local contract tests pass, covering immutable history and skipped proposal versions, conflicting identity/hash, invalid recipients, and required authorization. The tests do not claim live account-threshold verification.
- No production database migration or production deployment is claimed by these results.
- The old split upsert/activate, publish and verify routes, admin split editor, generated set/freeze binding, single-key Soroban publisher and old read-back script have been removed. Obsolete registry chain/network configuration has been removed; agreement publication uses the configured Stellar network passphrase. HTTP checks verify that all removed write/publication routes return 404 even for a super admin.
- `server/src/modules/agreements/effective-split.ts` derives versioned royalty records from finalized agreement versions and confirmed transaction evidence. It checks canonical proposal integrity, the bound network/hash/version and two independent stored treasury signatures. New purchase/subscription allocations use only the root's effective version. Existing `royalty_splits` rows are returned with `historical: true` for financial review, retain their original data/status, and never provide a fallback for new allocations. No contributor consent is backfilled.
- PostgreSQL tests place a conflicting historical active split on a track, verify that unconfirmed agreements block new purchase allocation, confirm a 70/30 agreement and verify the actual ledger rows bind its exact version, then finalize an amendment and verify the prior ledger entries retain their original split references. An outstanding amendment leaves the earlier effective version available for future allocation until the amendment confirms.
- `pnpm --filter server agreements:demo:testnet` completed on actual Testnet protocol 29 using fresh generated wallets and an isolated PostgreSQL database. The network rejected one treasury signer with `txBadAuth`, then confirmed exact 70/30 versions 1 and 3 with two signatures, after version 2 was disputed and fresh consent collected. Contract, hashes, ledgers, signatures and read-back records are in [public evidence](contributor-agreements-evidence/stellar-testnet.json); repeatable instructions are in its [README](contributor-agreements-evidence/README.md).

To run the database suite against an isolated local PostgreSQL database whose name ends with `_test`:

```sh
AGREEMENTS_TEST_DATABASE_URL=postgres://postgres:LOCAL_TEST_PASSWORD@127.0.0.1:5447/agreements_test pnpm --filter server exec tsx --test src/modules/agreements/agreements.integration.test.ts
```

The test refuses non-local database URLs or names without the `_test` suffix. Use a disposable test database; the suite creates schema and sample records without using the project's deployment database.

Run both persistence suites with:

```sh
AGREEMENTS_TEST_DATABASE_URL=postgres://postgres:LOCAL_TEST_PASSWORD@127.0.0.1:5447/agreements_test pnpm --filter server exec tsx --test --test-concurrency=1 src/modules/agreements/agreements.integration.test.ts src/modules/agreements/finalization.integration.test.ts
```

Admin agreement endpoints are under `/api/v1/admin/agreements`. Authenticated admins can list and read agreements. Super admins can record a resolution and create a fresh owner-controlled draft with `POST /:id/resolutions`, prepare with `POST /:id/finalizations`, collect exact signed envelopes with `POST /:id/finalizations/:attemptId/signatures`, submit with `POST /:id/finalizations/:attemptId/submit`, and reconcile with `POST /:id/finalizations/:attemptId/reconcile`. Resolution does not submit or finalize a proposal; the owner must review and submit the new draft, and admins cannot supply acceptance for contributors.

### UI test evidence

`pnpm test` reports 89 passing server tests, two opt-in PostgreSQL suites skipped, and 22 passing UI tests (16 client, 6 admin). Creator/admin component tests render the actual components with mocked HTTP and wallet transports. They cover draft review, exact challenge forwarding, signing cancellation, challenge/network/account mismatch, reason-bound reject/dispute actions, historical evidence, admin permissions, the two-signature submission gate, failed signature verification, uncertain outcome reconciliation, resolution into an unsigned owner-controlled draft, and wallet sign-in timeout recovery. A wallet transport test confirms a late provider response cannot advance to challenge verification. These tests do not prove real browser-extension signing.

### Creator API requests and transition rules

All routes are under `/api/v1/agreements` and require the authenticated wallet session. The actor is never accepted from the request body. There are 1–20 recipients with valid unique Stellar G-addresses, positive integer basis points totaling 10,000, and roles from the shared recipient-role enum.

| Request | Body / response | Permissions and transition |
| --- | --- | --- |
| `GET /` | `{ items }` | Owner or historical contributor membership |
| `POST /` | `{ trackId, recipients, terms }` → `{ version }` | Track owner; creates draft with verified release context |
| `GET /:id` | Detail with versions, effective version, finalizations and events | Owner or historical contributor |
| `PUT /:id/draft` | `{ recipients, terms }` → `{ version }` | Owner; draft only |
| `POST /:id/submit` | `{}` → `{ version }` | Owner; draft → proposed; immutable payload |
| `POST /:id/cancel` | `{}` → `{ version }` | Owner; draft/proposed/ready → cancelled; unavailable once finalizing |
| `POST /:id/revisions` | `{ recipients, terms, resolution }` → `{ version }` | Owner; finalized/rejected/disputed/cancelled → next draft, fresh responses |
| `POST /:id/challenges` | `{ action, reason }` → challenge identity, transaction, hash, network and expiry | Current contributor; proposed/ready only; reason required for reject/dispute |
| `POST /:id/responses` | `{ challengeId, signedTransaction }` → `{ version }` | Bound wallet verifies exact unexpired challenge; accepted contributors can subsequently dispute |

The first transaction to acquire the root lock determines a dispute/finalization race. A dispute that commits first blocks preparation. A preparation that commits first fixes the proposal in finalizing; new contributor actions are then rejected. Finalization never changes a contributor response. Failed/authoritatively expired attempts return to ready; unknown or pruned chain history stays pending on the same transaction. An effective pointer advances only after confirmed envelope authorization and matching contract read-back.

The requirement-by-requirement [milestone verification record](contributor-agreements-evidence/milestone-verification.md) maps A01–A21 to tests and network evidence and identifies the remaining real Freighter browser-signing gate.

The app no longer uses Dynamic for creator login or wallet signing. The client requests a five-minute Stellar challenge, checks the wallet network, requires the same wallet to sign, and asks the API to consume the challenge once. Agreement responses, transfers and trustline operations use the same explicit Freighter wallet and network checks. [The verification record](contributor-agreements-evidence/milestone-verification.md#creator-wallet-path) records the Dynamic failure diagnosis and the replacement flow; the real extension/browser demonstration remains open.
