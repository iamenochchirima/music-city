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
- `STELLAR_HOME_DOMAIN` and `STELLAR_WEB_AUTH_DOMAIN`: deployed Stellar auth domains
- `STELLAR_TREASURY_ADDRESS`: the public Stellar account receiving payments
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
