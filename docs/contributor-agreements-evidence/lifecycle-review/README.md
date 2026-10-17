# Current agreement lifecycle evidence

Verified on 17 October 2026. This is E7 in the [SOW 2 tracker](../../sow-2-tracker.md). It covers the current agreement interface and recovery work, not all SOW 2 acceptance.

The creator and admin lifecycle passed in an isolated local PostgreSQL environment using actual Dynamic Sandbox wallets and Stellar Testnet. The API, financial worker, media worker, and both frontends are deployed. Authenticated production admin verification remains open: the live service requires legitimate first-admin setup. No synthetic production agreements or financial transactions were created.

## Results

[Browser scenarios](browser-results.json) record CU-01 through CU-14 with the actual observations, roles, screenshots, commits, and limitations. [Independent chain checks](independent-chain-check.json) verify real contributor signatures, treasury signatures, and the exact registry publication. These are separate from the automated tests that mock network transport.

| Case | Result and evidence |
| --- | --- |
| Create and review | Recording preselected; registered contributor resolved; 70/30 draft survived reload and was sent through the UI. |
| Invalid input | Browser blocked 99% total, zero shares and excess precision. Unknown lookup returned no result; an already-selected account could not be added twice. Valid corrections saved. PostgreSQL and domain checks cover invalid payloads. |
| Independent consent | Ngoni and listener Kwame signed with separate real linked wallets. Listener participation required no artist activation. Cancelling the provider prompt recorded no consent. |
| Reject and revise | City Lights version 1 retains its signed rejection and reason. Owner sent version 2 with revised shares and no carried consent. |
| Dispute and resolve | River Road preserves acceptance followed by dispute. Admin resolution created an unsigned draft. Owner edited and sent it; both wallets signed again before finalization. |
| Two treasury signers | One signature left submission disabled; a second distinct authorized signature enabled it. Ordinary admin controls stayed read-only, with matching API 403 checks. |
| Automatic confirmation | Creator/admin views show pending until exact receipt and registry confirmation; no manual outcome button is required. |
| Restart | The local API stopped after committed submission intent while the worker was stopped. After restart, the same attempt and hash confirmed with one activation event and no replacement. Navigation away and reopening tested page recovery; a whole-browser crash was not injected. |
| Lost response | A local proxy closed the browser connection after the API completed a successful consent response. The browser recovered exactly one acceptance and event without a second signature. |
| Real expiry | An unsigned attempt expired on actual chain time. The worker restored readiness; no effective version or registry entry appeared. Pruned-history refusal is separately mocked transport evidence. |
| Amendment | A 60/40 version replaced active 70/30 only after fresh consent and treasury confirmation. Original funded allocations and ledger entries retain identical hashes. |
| Access | Unrelated artist denied; removed contributor sees permitted historical versions without future excluded terms. Owners and super admins retain authorized access. |
| Responsive and keyboard | Creator/admin inspected at desktop and 390 pixels. Long title, inline validation, mobile navigation, history, reload, Back and real wallet cancellation were checked. Cancellation restores focus to the agreement heading. |

## Testnet receipts

All terms used for mutable verification say “Demo agreement. No legal effect.” These signatures and transactions are verification evidence, not production agreements.

| Publication | Agreement and version | Receipt |
| --- | --- | --- |
| Open Sky, 70/30 | `2b72f194-f053-4a58-8ea6-abae3844b998`, v1 | [Testnet transaction](https://stellar.expert/explorer/testnet/tx/b199ee8b29fedf4c944a3ac4a88a78e97eb8b1dedd472006caccc5edea70857c) |
| Open Sky, 60/40 | Same agreement, v2 | [Testnet transaction](https://stellar.expert/explorer/testnet/tx/fd173be9f404729ee70efee6b6abc490ba7797bc3c9f62563a9e188617b3bb8c) |
| River Road after resolution | `ee478af9-094f-40fa-bc8a-8d1db07b7e6b`, v2 | [Recovered original transaction](https://stellar.expert/explorer/testnet/tx/6ccb2ee5b6c97f6a70cb84fd56d34ba4e451afe169af457008b87c53f3507b5b) |
| Original-version funded earnings | Batch `a89381f626280c14e809fd7a875d0327fdc5ec80c41d2d0ce9983241cb84c1e4` | [0.01 Testnet USDC funding](https://stellar.expert/explorer/testnet/tx/df0dc511239deff8b84ffb443f51a3e9437f82c02c6ceb9b23e8d540e9fd1925) |

The new 0.01 Testnet USDC batch was funded to establish historical-entitlement preservation. This chunk does not claim that batch was withdrawn or that the current review environment has zero outstanding claims. E5's previous totals retain their original date and scope.

## Evidence files

- [Browser scenarios and cancellation snapshot](browser-results.json).
- [Independent signature and registry checks](independent-chain-check.json).
- [Original funded entitlements](entitlements-before-amendment.json) and [comparison after amendment](entitlements-after-amendment.json).
- [Committed-intent interruption](restart-interruption.json) and [original-attempt recovery](restart-result.json).
- [Successful-response drop](lost-response-injection.json), [expiry, download and response-count checks](edge-results.json), and [ordinary-admin HTTP checks](ordinary-admin-api.json).
- [Automated results](automated-results.json), [deployments](deployments.json), and [live readiness, CORS and authorization checks](live-api.json).
- [Setup migration incident and preservation audit](setup-verification.json).
- [Decision log](decisions.tsv). Two independent read-only reviews found five actionable issues; all were fixed. This was independent review with the same model family, not cross-model review. The final log check was an evidence audit against commits, tests and screenshots, not an inaccessible full-transcript audit.

The download-capture tool timed out, but the actual browser file was later found in Downloads and byte-verified against the prepared transaction. External signing used the exact XDR shown in the verification disclosure; signed files were imported through the real admin controls. No treasury signing key was added to the server.

## Repeat the checks

Use a disposable local database whose name ends in `_test`, Dynamic Sandbox, and Stellar Testnet. Keep private credentials and treasury keys outside the repository. Initialize environment overrides before dynamically importing application services. Do not import application configuration in parallel with an asynchronous environment initializer.

Run `pnpm test`, `pnpm typecheck`, and `pnpm build` from the repository root. The default server suite skips opt-in PostgreSQL suites. To run the agreement database suites separately, set `AGREEMENTS_TEST_DATABASE_URL` to the isolated local database URL and execute these files through `pnpm --filter server exec tsx --test`:

- `src/modules/agreements/agreements.integration.test.ts`
- `src/modules/agreements/finalization.integration.test.ts`

The finalization database suite mocks the network boundary. It does not replace the real-wallet browser matrix. Fresh-database initialization was also checked independently.

For the product demonstration, create a proposal from a recording, sign in normally as each included contributor, review and sign, then prepare finalization as super admin. Download the exact transaction, obtain two external treasury signatures, import them and submit once. Leave the detail page open for automatic confirmation. Use separate recordings for rejection, dispute and unsigned expiry. Use [the canonical matrix](../../sow-2-tracker.md#required-computer-use-verification-matrix) for the complete sequence.

## Rollout limits

A setup helper loaded production configuration before its isolated override. It applied the additive recovery migration early, then stopped before creating fixtures. Application and financial records matched the earlier audit. The previous 15 October backup exists; a fresh backup preceded the later rollout but did not precede the early migration. AGR-27 records this exception openly.

The live creator accepted ordinary Google sign-in and displayed its listener inbox. The admin detail route correctly redirected to first-admin setup. Completing authenticated production admin verification requires the legitimate operator's email and password handoff. AGR-28 remains open; no administrator identity or password was invented. Reviewer acceptance of D2/D3 and the separately scoped provider work remain open.
