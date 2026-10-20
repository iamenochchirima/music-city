# Core music-to-earnings verification

Verified locally on 17 October 2026. Original verification base `9cd39f0`, branch `main`. The completed implementation is recorded in Git history. No production deployment or push was performed. This is E8 in the [SOW 2 tracker](../sow-2-tracker.md#core-d3-lifecycle-closure), not acceptance of the whole SOW.

## Demonstrated result

The actual creator UI published **Core Journey**, a four-second synthetic tone, as release `rel_f8f84266f7314b02`, recording `trk_810ef0432acc4b44`. Ngoni and Kwame independently accepted a nonbinding 70/30 verification agreement through real Dynamic Sandbox wallets. Two independent treasury signatures finalized it on Stellar Testnet. The owner enabled sales at exactly 0.001 USDC.

Kwame then bought the song through the actual browser checkout. Kwame is also the producer beneficiary, so this demonstration overlaps listener and contributor roles. It does not claim three distinct identities. No user private keys were exported or substituted by generated signing keys.

The checkout retained the signature before submission. A local proxy dropped the successful authorization response and killed the API while the financial worker was stopped. The buyer saw Checking payment without another signing action. The buyer tab was closed. After worker restart, the original transaction confirmed with one submission and produced one payment, one listening entitlement and two royalty entries. Reopening the song showed Purchased. The source entries retain the agreement captured when the order was created.

The administrator approved those actual purchase earnings, reviewed their exact allocations, reserved the source and prepared funding. One treasury signature left submission disabled. Two enabled submission and funded the escrow. Both beneficiaries claimed through their actual Dynamic wallets. Their earnings pages show Received and the corresponding receipt. The batch is Closed with both entries paid and no remaining obligation for this purchase.

## Confirmed transactions

| Action | Amount | Ledger | Receipt |
| --- | --- | --- | --- |
| Agreement publication | 70/30 | 5248435 | [8a5a6860…](https://stellar.expert/explorer/testnet/tx/8a5a6860e54c615cb8ac5973a97ff8b0953c1fd473626d219ab576bd61ddfa21) |
| Listener purchase | 0.0010000 USDC | 5248624 | [a28b10da…](https://stellar.expert/explorer/testnet/tx/a28b10da421be9242492416cf8eadc2345807fb7cf647ee7291d67190fbbfc71) |
| Two-signer funding | 0.0010000 USDC | 5248659 | [9793fe60…](https://stellar.expert/explorer/testnet/tx/9793fe60dc2730aafa0d2d52ce19060bbaea75aee6b1f9df137ee83979b3d82e) |
| Artist claim | 0.0007000 USDC | 5248692 | [98ce4e5d…](https://stellar.expert/explorer/testnet/tx/98ce4e5dc1045520812b550355f342d9bd6c1b61b92651598c73dfcaaa08d1eb) |
| Producer claim | 0.0003000 USDC | 5248675 | [6ba87a43…](https://stellar.expert/explorer/testnet/tx/6ba87a43d9408b8627ecff5d570f3545d30ebcd6e2533549a884365705eb17cd) |

Settlement batch: `1a2a5316398b2339fe568ebc1a618103177e6712bd6e58c10f7910acf2ce44b6`.

[Independent chain checks](independent-chain-check.json) compare actual Horizon transaction envelopes, source accounts, the exact payment memo, asset, destination, fees, funding signatures, direct contract simulation and before/after wallet balances. Values use integer units. The artist gained 7,000 USDC units. The producer spent 10,000 and received 3,000. Treasury USDC returned to its starting balance. XLM changes equal the observed network fees. The separate, pre-existing 0.01 USDC escrow obligation remains intact. These are contract-managed claims, not native Stellar claimable-balance IDs.

## Failures and recovery

| Check | Observation |
| --- | --- |
| Cancel payment review | No signature or submission. Keyboard focus returned to Buy. |
| Abandon provider authentication | Reloading before verification left zero signatures, submissions or purchases. The unsigned checkout later expired after closed-ledger and retained-history verification. |
| Lost authorization response and API restart | [Injection record](authorization-interruption.json). The committed signature survived. The worker completed the original hash with the browser closed. |
| Retry and duplicate prevention | One payment, entitlement, recognition and confirmation event. PostgreSQL tests cover concurrent preparation and worker retries. |
| Unknown or pruned history | Automated checks retain the original attempt and refuse a replacement. |
| Unauthorized or altered authorization | Automated checks reject another wallet, changed transaction, wrong signer and wrong network. |
| Agreement amendment during checkout | Regression test verifies allocation uses the captured superseded agreement rather than the newer active version. |
| One treasury signer | Submission disabled in the actual admin browser. Two distinct signatures confirmed funding. |
| Sales reporting | Owner sees the incoming sale. Buyer is not attributed the sale. Artist response excludes the buyer wallet and intent. Claims remain visible if sales loading fails. |

Dynamic SDK 4.88.3's email step-up OTP screen did not dismiss through its backdrop or Escape. This record claims review cancellation and navigation interruption, not successful cancellation inside that provider OTP screen. E5 and E7 retain their separately dated Google-provider cancellation evidence. Authentication was not weakened.

The browser's download-event listener timed out, but the exported funding file existed in Downloads. The signing helper checked its exact hash, source, network and expiry before producing two independent external signatures. Both signatures were added through the actual admin UI. No funding transaction was submitted by that helper.

## Screenshots

- [Published release](release-published.png), [sales settings](track-sales.png), [read-only ordinary admin](ordinary-admin-readonly.png).
- [One agreement signer](agreement-one-signature.png), [confirmed agreement](agreement-confirmed.png).
- [Payment review](checkout-review.png), [wallet prompt](checkout-wallet-prompt.png), [390-pixel review](checkout-mobile.png), [interrupted checkout](checkout-interrupted.png), [reopened purchase](purchase-recovered.png).
- [One funding signer](funding-one-signature.png), [confirmed funding](treasury-funded.png), [producer receipt](producer-claim.png), [artist receipt and sale](artist-claim-and-sale.png), [390-pixel earnings](earnings-mobile.png), [closed settlement](settlement-closed.png).
- [Contributor support history](contributor-support-history.png), [admin support history](admin-support-history.png). These retain E6's actual separate artist and contributor transfers. No new support transfer is claimed. Unrelated generated-key transport fixtures in this local review database are not chain receipts.

## Verification commands and rollout requirements

Before the local commit on 20 October 2026, the focused checkout, royalties, sales and claims checks passed again: 17 client and 15 server tests. These checks ran against the current checkout, including intervening committed project changes. The real Testnet and browser evidence below retains its original 17 October date.

`pnpm test` passed 139 server, 116 client and 18 admin tests. Ten default server checks require explicit database or chain environments and were skipped there. Separate real PostgreSQL runs passed all 8 checkout checks and all 36 agreement-finalization, support and settlement checks, with zero skips. Transport mocks in these database suites are not real-chain evidence. The transactions above provide that evidence. A focused amended-agreement run passed 3 tests. Final claim UI verification passed 5 tests. Workspace typecheck and all production builds passed. Existing large-bundle warnings remain.

The checkout PostgreSQL command is `CHECKOUT_TEST_DATABASE_URL=<isolated-test-database> pnpm --filter server exec tsx --test src/modules/payments/checkout.integration.test.ts`. The other suites require `AGREEMENTS_TEST_DATABASE_URL`, `SUPPORT_TEST_DATABASE_URL` and `SETTLEMENTS_TEST_DATABASE_URL`, each pointing to an isolated test database. The checkout tests reject a database name that does not end in `_test`.

The additive migration is `2026-10-17-durable-checkout`. API initialization registers and verifies it. The new tables retain the prepared transaction, private signed envelope and append-only checkout events. An eventual rollout requires a fresh backup, migration verification, API and financial-worker updates, and the client update. The worker runs with `pnpm dev:financial-worker`; production uses the existing financial-worker start command. Historical payment, consent and settlement evidence must remain intact. Production rollout is outside this local goal.

The temporary fault proxy and client environment override were removed. Client requests again use the local API on port 4339. The client, admin, API and financial worker remain running locally. E7's first-admin production setup and early-migration rollout exception remain open, as do provider readiness and external reviewer acceptance. Linear had no matching Music City project in the connected workspace, so progress is recorded only in the user-designated canonical tracker and this evidence package.
