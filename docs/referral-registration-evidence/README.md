# Registration referral verification

Verified locally on 8 October 2026 using an isolated PostgreSQL database and test accounts. The registration program awards referral credit only. It does not create cash commissions or change royalty balances.

## Repeating the automated checks

Run `pnpm test:referrals` from the repository root. The command builds the shared package, creates a temporary local PostgreSQL database, runs the focused server and client checks, runs admin tests, and checks types across the workspace. It removes its temporary database afterwards.

The automatic database setup requires PostgreSQL server tools, `pg_config`, Python 3, and a non-root local user. Alternatively, supply `REFERRALS_TEST_DATABASE_URL` for a dedicated local database whose name ends in `_test`. The integration suite refuses other hosts or database names. Do not point it at an application database.

Server checks exercise actual profile services, PostgreSQL constraints and transactions, authenticated HTTP routes, immutable attribution, signup retries, artist qualification, admin exclusions, reconciliation, and confirmed-payment retries. Wallet and external payment-network boundaries are tested separately; no real funds are transferred.

Client checks cover invitation retention, deliberate code correction, invalid links, wallet changes, failed registration retries, sharing, and dashboard refresh. Admin component checks cover read-only access and exclusion with a reason.

## Browser evidence

Chromium drove the real client, admin app, and API against an isolated database. Test wallets authenticated using actual signed challenges through `/auth/challenge` and `/auth/verify`. The resulting sessions were supplied to the browser. The Freighter extension popup itself was not driven; its existing adapter and authentication tests remain part of the client suite.

The browser completed these paths:

- Invitation opened and retained across refresh.
- New artist completed the actual onboarding form and credited the inviter once.
- New listener completed onboarding, then changed to the artist path from the account page.
- Inviter totals remained two registrations and two artists after reload.
- A reviewer bootstrapped an admin account through the real API and inspected both referrals.
- An invalid invitation kept ordinary signup available.
- Invitation and referral dashboard layouts fit a 390-pixel mobile viewport without horizontal overflow.

Screenshots use disposable test accounts:

- [Invitation](invitation.png)
- [Artist onboarding completed](artist-completed.png)
- [Inviter dashboard](inviter-dashboard.png)
- [Admin dashboard](admin-dashboard.png)
- [Invalid invitation on mobile](invalid-invitation-mobile.png)
- [Inviter dashboard on mobile](inviter-dashboard-mobile.png)

## Configuration and rollout

Set `REFERRALS_ENABLED=true` in the server environment and restart the server to enable new invitations. Normal server startup applies the referral migrations before accepting requests. Keep the same JWT signing secret across restarts so unexpired invitation receipts remain valid.

The inviter page is `/account/referrals`; invitations open `/join?ref=CODE`; admin inspection is `/console/referrals`. Super admins can exclude referrals and reconcile completed registrations and payments.

Setting `REFERRALS_ENABLED=false` pauses new invitation capture while preserving existing referrals and allowing already-issued receipts and bound registrations to finish.

Receipts expire after thirty days and are removed from browser storage on successful initial registration, logout, wallet change, or the next read after expiry. The application stores no click history, device fingerprints, or referral IP logs. Bound attribution and audit records remain for the lifetime of the program and associated accounts; deleting them requires an explicit retention migration because historical credit must remain auditable.

Paid activation is recorded separately only for a confirmed, positive, non-waived artist onboarding payment. Records preserve the payment's captured network; historical payments without a network snapshot are marked `unknown`. Neither unknown-network records nor Testnet evidence represent a real-money reward. Free campaign terms are never converted into commissions.

Production rollout and financial rewards have not been performed. Commission terms, identity requirements, funding, and payout execution remain outside this registration release.
