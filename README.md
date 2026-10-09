# music-city

Music City is now organized as a small workspace:

- `client`: Next.js frontend
- `server`: Node.js + TypeScript + Express backend
- `packages/shared`: shared types and schemas

The active stack is Stellar-oriented. Old ICP/canister runtime code has been removed from the app path.

## Getting started

```bash
pnpm install
cp .env.example .env
pnpm dev:server
pnpm dev:client
```

## What works now

- Stellar wallet auth flow scaffold with server-issued sessions
- persistent user profiles and artist listing
- track creation
- upload session creation
- local uploads for development or direct uploads to Mux
- upload completion that attaches media to the track
- playback session creation
- Mux webhook-driven asset processing
- Mux-signed HLS playback for audio or local fallback playback
- local entitlement records and optional Stellar asset-based subscriber gate
- encrypted archive generation with optional remote archive upload hook
- versioned contributor proposals, wallet-signed acceptance/rejection/disputes, and controlled amendments
- protected 2-of-3 treasury finalization with immutable Soroban records, transaction reconciliation, and creator/admin evidence views; live Testnet verification and repeatable demo evidence are recorded in `docs/contributor-agreements-evidence/stellar-testnet.json`
- Stellar treasury royalty payout execution and reconciliation

Initialize the Postgres schema and import any existing JSON-backed development
data with:

```bash
pnpm --filter server db:bootstrap
pnpm dev:server
```

## Service configuration

Use `STORAGE_PROVIDER=local` for local development.

The server requires Postgres-backed app metadata. Set:

- `DATABASE_URL`

The current Postgres schema stores:

- users
- tracks
- upload sessions
- playback sessions
- entitlements
- archives

Use `STORAGE_PROVIDER=s3` when you want R2, B2, S3, or another S3-compatible provider, and set:

- `STORAGE_ENDPOINT`
- `STORAGE_BUCKET`
- `STORAGE_REGION`
- `STORAGE_ACCESS_KEY_ID`
- `STORAGE_SECRET_ACCESS_KEY`
- `STORAGE_PUBLIC_BASE_URL` if you want a fixed public/CDN base

Use `MEDIA_PROVIDER=mux` when you want the production media path. Then set:

- `MUX_TOKEN_ID`
- `MUX_TOKEN_SECRET`
- `MUX_WEBHOOK_SECRET`
- `MUX_SIGNING_KEY`
- `MUX_PRIVATE_KEY`

Mux should send webhooks to:

- `POST /api/v1/media/webhooks/mux`

The app uses Mux direct uploads, waits for Mux asset webhooks, stores the resulting
Mux asset/playback IDs on the track, and issues short-lived playback URLs through the backend.

## Production runtime configuration

`NODE_ENV=production` enables startup checks that reject development secrets,
localhost origins, local storage, and missing Stellar treasury configuration.
Configure these values in the server hosting environment:

- `JWT_SECRET`, `ADMIN_JWT_SECRET`, and `PLAYBACK_TOKEN_SECRET`: separate random
  values of at least 24 characters
- `CLIENT_ORIGIN`, `ADMIN_CLIENT_ORIGIN`, and `APP_BASE_URL`: public `https://` URLs
- `STELLAR_HOME_DOMAIN`: deployed Stellar auth domain used in signed wallet challenges
- `STELLAR_SEP10_SECRET`: the server's Stellar auth challenge signer key; keep it private and separate from treasury signers
- `STELLAR_TREASURY_ADDRESS`: the public Stellar account receiving payments
- `AGREEMENT_TREASURY_ADDRESS`: a dedicated account with three independent weight-one signers and all thresholds set to two, used for contributor agreement finalization
- `STELLAR_SOROBAN_RPC_URL`: the Soroban RPC endpoint used for registry calls
- `ROYALTY_REGISTRY_CONTRACT_ID`: the replacement finalized-agreement registry contract, configured with that agreement treasury
- the `STORAGE_PROVIDER=s3` variables listed above

Generate each application secret independently, for example:

```bash
openssl rand -hex 32
```

Public beta deployments that intentionally use test tokens may keep the Testnet
Horizon and royalty registry settings by explicitly setting:

```dotenv
STELLAR_ALLOW_TESTNET_IN_PRODUCTION=true
```

Do not set that flag for a mainnet deployment.

## Registration referrals

Set `REFERRALS_ENABLED=true` in the server environment to enable artist invitation links. Restart the server to apply migrations and the flag. Users with completed onboarding can invite from `/account/referrals`; admins inspect registrations at `/console/referrals`. Disabling the flag pauses new invitations without removing existing attribution.

Run `pnpm test:referrals` for focused registration, payment qualification, UI, and type checks against an isolated database. Cash rewards are disabled. See [the implementation checklist](docs/referral-registration-implementation-plan.md) and [verification evidence](docs/referral-registration-evidence/README.md).

## Early-user artist activation

The active `EARLYUSER` campaign automatically covers the one-time USD $20 artist activation for eligible new accounts. Artist onboarding shows the $20 standard price, the 100% discount, and $0 due; completing registration activates artist tools without creating a payment. Eligibility and activation are separate from personal referral attribution. Admins can review the campaign at `/console/sponsorships`; super admins can pause or resume new eligibility with an audit reason. Pausing keeps existing eligibility, grants, and receipts intact.

`ARTIST_ONBOARDING_FEE_PRICE` is the Stellar settlement-asset amount, not a USD amount. Leave it at `0` unless the operator has verified the matching USD $20 equivalent and set `ARTIST_ONBOARDING_FEE_PRICE_USD_EQUIVALENT=20`; this avoids treating $20 as 20 XLM. Without that explicit mapping, paid activation remains disabled. Run `pnpm test:early-user-discount` for isolated PostgreSQL, API, client, admin, and type checks. Run `pnpm exec playwright install chromium` once, then `pnpm test:e2e:early-user-discount` for the end-to-end browser path. See the [implementation checklist](docs/early-user-discount-implementation-plan.md) and [verification evidence](docs/early-user-discount-evidence/README.md). For rollback, pause new eligibility, keep existing grants and receipts, reconcile interrupted completions, and never recreate synthetic waiver payments.
