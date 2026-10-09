# Early-user sponsorship verification

Status: local implementation and end-to-end acceptance verified on 9 October 2026. Production migration and rollout are separate future release steps.

## Automated checks

Run:

```bash
pnpm test:early-user-discount
```

The command creates and removes a disposable local PostgreSQL database unless `REFERRALS_TEST_DATABASE_URL` points to a separate local database ending in `_test`. It never reads the application's `DATABASE_URL`. The latest run completed with 40 server checks, including PostgreSQL and HTTP integration tests, 8 client checks, 10 admin checks, and passing workspace typechecks. The integration coverage verifies automatic eligibility for artist and both intents, the exact USD $20 / 100% / $0 quote, atomic activation, no payment intent or payment record, referral separation, concurrency and rollback, listener upgrade, pause ordering, legacy paid/free access, admin authorization, and idempotent reconciliation.

Production builds also completed with `pnpm build`. Vite reported its existing large-client-chunk advisory; both client and admin bundles were generated successfully.

## Read-only legacy inventory

On 9 October 2026, the connected PC's configured development database was queried in PostgreSQL `READ ONLY` transactions. Its environment identifies `NODE_ENV=development`, so these counts are useful for that development target only and do not substitute for a production inventory.

| Record type | Count |
| --- | ---: |
| Artist-onboarding payment records | 0 |
| Confirmed artist payments | 0 |
| Confirmed waived payments | 0 |
| Confirmed zero-value waivers | 0 |
| Confirmed zero-value non-waived payments | 0 |
| Confirmed positive non-waived payments | 0 |
| Artist-onboarding payment intents | 0 |

No legacy payment migration is needed for this development database. Production inventory remains pending.

## Optional production database access note

The production environment was inspected only to determine whether production inventory was necessary for local verification. Its database is private and the workspace has no usable SSH key; the connected PC has only development settings. No production SQL query or change was made. This is relevant only if a production rollout is requested later; it does not affect or block the local acceptance results.

## Browser acceptance

The maintained end-to-end command passed on 9 October 2026. It is:

```bash
pnpm exec playwright install chromium
pnpm test:e2e:early-user-discount
```

The runner creates an isolated temporary PostgreSQL database and starts disposable API, client, and admin servers. It passes that explicit test `DATABASE_URL` to the server, so the run never connects to the application's configured database. A generated Stellar test key signs a real server authentication challenge. The browser runs the actual post-auth onboarding and account flow, including a refresh during artist signup, a referral link, admin pause/resume, and account receipt checks at 390px. Screenshots are saved alongside this file:

- `artist-activation-complete.png` — $20 standard price, 100% discount, $0 due, and active artist receipt.
- `artist-activation-quote.png` — price breakdown before completing registration.
- `artist-account-receipt.png` — saved activation and discount receipt after reload.
- `artist-account-receipt-mobile.png` — account receipt at 390px without horizontal overflow.
- `artist-referral-invitation.png` — invitation link captured before registration.
- `referred-artist-activation-quote.png` — referred artist receives the same automatic offer.
- `referral-progress.png` — inviter dashboard records the new artist registration once.
- `admin-sponsorship-report.png` — campaign, eligibility, activation, and fees-waived face value.

The browser used the signed challenge result as a test session in local storage rather than driving the Freighter popup. This still exercised the application's real post-auth registration and activation path. Authentication signing is separate from artist-payment approval. The run verified a long display name and recovered an interrupted artist registration after reload. A second authenticated browser followed the actual referral URL; the inviter totals increased by one, the admin referral row retained the inviter, and no paid activation was recorded. During onboarding and activation, the browser observed zero artist-payment-intent requests and zero wallet-balance requests. Opening the existing account wallet overview separately made four wallet-balance requests; those calls are not part of the sponsored activation and did not create a payment. A third account registered during campaign pause saw the full $20 due and no automatic discount. The artist payment signer was not invoked. No payment intent, payment record, or blockchain transaction was created. The stale sponsored session was rejected with HTTP 409. The mobile check reported viewport width 390 and document width 390.

Real-database/API tests additionally cover listener-to-artist upgrade, rollback, concurrent registration, legacy history, and idempotent reconciliation. Use the checklist in [the implementation plan](../early-user-discount-implementation-plan.md) before production rollout.

## Production boundary

These results prove local and connected-PC development behavior. No production database inventory, migration, campaign activation, or deployment has been performed, and none was needed for the locally verified implementation. The paid fallback for accounts registered while the campaign is paused remains disabled until an operator verifies the USD $20 equivalent for the configured Stellar settlement asset. Keep the campaign active for the free early-user offer, or configure and verify that mapping before pausing new eligibility.
