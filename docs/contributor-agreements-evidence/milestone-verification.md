# Contributor agreement milestone verification

Status: **In progress — real Freighter browser signing remains open.** This record covers the agreement/finalization milestone, not all of SOW Deliverable 2.

## Requirement evidence

The referenced tests are in `server/src/modules/agreements` unless another path is shown. PostgreSQL suites run against a disposable local database; signatures are real. Finalization integration tests mock RPC results, while the separate Testnet demonstration uses the actual network.

| Plan check | Inspected evidence | Result |
| --- | --- | --- |
| A01 Valid 70/30 proposal | Domain and PostgreSQL workflows; live version 1 in `stellar-testnet.json` | Pass |
| A02 Invalid shares, count and wallets | Domain invalid-input checks, contributor foreign-key rollback and contract validation | Pass |
| A03 Canonical equivalence/material changes | Domain hashing tests cover recipient ordering, shares, role, owner, track, release, agreement, version, previous hash, network and terms | Pass |
| A04 Independent contributor consent | Real Ed25519 tests and live Testnet demo challenge/response evidence for both wallets | Pass |
| A05 Missing contributor blocks finalization | Finalization preparation re-verifies every contributor; live demo records the blocked attempt | Pass |
| A06 Wrong wallet/non-member/signature | Domain and PostgreSQL verification, outsider and owner permission tests | Pass |
| A07 Replay and expiry | Domain action, challenge, version, agreement and network replay/expiration checks | Pass |
| A08 Retry/concurrency/conflict | PostgreSQL concurrent identical/independent responses; domain exact retry and conflicting response rejection | Pass |
| A09 Submitted/finalized immutability | PostgreSQL triggers reject mutation; contract immutable history/conflicting republication tests | Pass |
| A10 Reject/dispute blocks finalization | Domain, persistence and live disputed version 2; creator/admin history component tests | Pass |
| A11 Dispute/finalization race | PostgreSQL serialized race scenario | Pass |
| A12 Resolution requires fresh consent | Admin resolution tests, browser local fixtures, live v2→v3 evidence | Pass |
| A13 Amendment effective/history | PostgreSQL effective projection and actual ledger-reference checks; live contract v1/v3 read-back | Pass |
| A14 Access control | PostgreSQL outsiders/ownership tests and actual HTTP admin role checks | Pass |
| A15 Inadequate treasury signatures | Treasury signature tests, submission gate and live one-signature `txBadAuth` rejection | Pass |
| A16 Two-signature chain success | Actual treasury configuration and live confirmed transactions in ledgers 4987564/4987566 | Pass |
| A17 Retry/conflicting publication | Contract identical retry emits no second event; conflicting hash rejected; concurrent application reconciliation emits one finalized event | Pass |
| A18 Uncertainty/failure/mismatch | PostgreSQL lifecycle tests exercise pending intent, mismatch rollback, failed attempts, retained-history expiration and pruned-history uncertainty | Pass |
| A19 Database failure rollback | Real injected PostgreSQL audit-write failure rolls back the second response, ready state, challenge consumption and events; same signature succeeds after restoring audit writes | Pass |
| A20 Removed bypass/configuration | Old mutation/publication endpoints return 404 even for a super admin; obsolete bindings/configuration removed; missing dedicated treasury blocks preparation; wallet network mismatch/unsupported configuration tests | Pass |
| A21 Wallet provider does not answer | Client timeout and reload recovery are covered by auth-provider tests; a late access response cannot request a server challenge, covered by Freighter transport tests; unavailable-provider path observed in the browser | Pass for timeout handling; real wallet signing remains open |

## Interface and demonstration gates

- Proposal editor and explicit immutable-submission review: implemented and component-tested.
- Accept, reject and dispute signing: component tests verify exact challenge forwarding, reason binding, wallet/network checks and cancellation without recording consent.
- Actual consent signature verification: independently tested with real generated Ed25519 keys and exercised in the live demo.
- Admin resolution, permissions, signature collection, two-signature submission gate, errors and reconciliation: component-tested and covered by HTTP/service tests.
- Actual 2-of-3 contract authorization/publication: verified on Testnet, independently of component mocks.
- Admin browser reading of live confirmed evidence and preserved history: captured in [publication](admin-testnet-finalized.png) and [history](admin-testnet-history.png).
- Historical financial splits are read-only and excluded from new allocations; an effective agreement and its exact confirmed evidence are required. Existing ledger references remain unchanged after amendments.
- **Open:** verify creator sign-in with Freighter in a browser, review the full split, cancel one signing request, then sign successfully and verify the recorded response. Component mocks do not satisfy this gate.

On 2026-10-05, the Codex In-app Browser reported `window.freighter` and `window.stellar` as undefined. The first check left **Login** in `Opening...` because Freighter's `requestAccess()` did not respond. The client now times out after 30 seconds, displays a reload action, and does not continue to the server challenge if the wallet responds late. This verifies unavailable-provider handling only. Repeat the full sign-in and agreement response in Chrome or Edge with Freighter and a disposable Testnet wallet.

## Executed checks

- `pnpm test`: 89 server tests and 22 UI tests pass (16 client, 6 admin); 2 opt-in PostgreSQL suites skip without their explicit test-database URL.
- The Stellar auth challenge migration and database-backed consume-once/expiry behavior pass against a fresh disposable local PostgreSQL database.
- Both guarded PostgreSQL suites: 20 tests pass, no skips/failures.
- `pnpm contract:test`: 4 tests pass, including exact finalization event payloads and no event on an identical retry.
- `pnpm typecheck` and `pnpm --filter client build`: pass; the client build retains the existing large-chunk warning.
- `pnpm contract:build`: release WASM builds with `wasm32v1-none`.
- `pnpm --filter server agreements:demo:testnet`: live run and subsequent same-state resumption both pass. Resumption returns the original confirmed transaction, creates no new versions and does not republish.
- `git diff --check`: passes. Source/config search finds none of the replaced set/freeze bindings, old upsert/publish/verify methods or obsolete registry chain/network variables.

See [repeatable setup](README.md), [public network evidence](stellar-testnet.json) and the [implementation plan](../contributor-agreements-implementation-plan.md). Production deployment, broad hardening, settlement and direct fan support remain separate work. No milestone completion is claimed until the open creator browser-signing gate is verified.

## Dynamic SDK failure diagnosis, 2 October 2026

The isolated creator preview at `http://127.0.0.1:4352/account/agreements` used the local Testnet database/API on port 4350. At the time of this check the application registered Dynamic WaaS Stellar embedded-wallet connectors; it did not register a direct Freighter connector.

A real browser login attempt failed before authentication: Dynamic's SDK logs `Failed to prefetch nonces` and `Client initialization failed` while fetching environment settings. A separate read-only request to the installed SDK's official settings endpoint returned HTTP 403, `server: cloudflare`, body `error code: 1010`, without an allow-origin header. [Cloudflare documents error 1010](https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-1xxx-errors/error-1010/) as denial based on the request's browser signature. This separate probe supports an external access problem; it does not prove the exact browser response because the browser reports only a fetch failure. No API host, credentials or security settings were changed.

The browser showed the SDK initialization error and an actionable message; a screenshot is retained as historical evidence at [creator-provider-unavailable.png](creator-provider-unavailable.png). This is no longer the creator authentication flow.

## Creator wallet path

Creator login now requests a server-signed Stellar challenge and has Freighter sign it. The server verifies the exact challenge and wallet signature, then consumes its database record atomically so it cannot be replayed. Agreement responses, wallet transfers, and trustline transactions sign directly through Freighter after checking the configured network and expected wallet address. Dynamic SDK dependencies and login endpoints were removed from the client path.

The client bounds the wallet sign-in wait to 30 seconds. If Freighter does not respond, the page shows the recovery message and requires a reload before another attempt. The sign-in flow passes an abort signal through wallet calls and checks it before challenge verification, so a late wallet response cannot complete sign-in after the timeout.

Automated tests verify correct wallet/network binding, server and owner signatures, single-use challenge behavior, and component handling of signing cancellation and changed agreement proposals. The real Freighter extension is not available in the Codex browser session, so the complete creator review/cancel/success run remains open and must be performed in a normal browser with a disposable Testnet wallet.
