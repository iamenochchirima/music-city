# Production deployment

Music City runs its API on Railway and its client and admin applications on Vercel.

| Service | Production URL |
| --- | --- |
| Client | https://music-city.vercel.app |
| Admin | https://music-city-admin.vercel.app |
| API | https://server-production-d758.up.railway.app/api/v1 |
| Admin API | https://server-production-d758.up.railway.app/api/v1/admin |

## Database migrations

Railway builds the server and runs `pnpm --filter server db:migrate` before starting it. The migration command applies registered schema migrations, repairs required schema objects, checks schema health, and records the one-time track metadata migration as `2026-10-14-track-credits-and-identifiers`.

The metadata migration copies eligible release labels into blank track labels and normalizes valid ISRC formatting. It preserves explicit labels and reports malformed identifiers. A migration receipt prevents later deployments from filling labels that an artist intentionally cleared after rollout. PostgreSQL advisory locks prevent concurrent deployments from applying the same schema migration twice.

Track credits and release revisions use the existing JSON payload columns. The revision feature needs no new table or destructive schema conversion.

Railway uses `/api/v1/health/ready` as its readiness check. A healthy HTTP response confirms the database's required tables, columns, indexes, constraints, and migration markers. The configuration is recorded in `.railway/railway.ts`. Variables are unmanaged by that file, so configuration changes preserve existing secrets.

## Deploy

1. Run `pnpm test`, `pnpm typecheck`, and `pnpm --filter server build`.
2. Run `pnpm test:track-credits` against its disposable database to verify metadata migration receipts and revision rollback.
3. Take a private production database backup before data migration changes.
4. Deploy the API using the linked Railway server service, or push the checked code to the connected `main` branch.
5. Confirm that the migration command succeeds and the live readiness endpoint returns HTTP 200.
6. Deploy `v0-music-city` and `music-city-admin` on Vercel with production variables. Both projects use subdirectories of this monorepo.
7. Verify the public pages, frontend API targets, CORS, authentication, and release creation and editing.

`.vercelignore` and `.railwayignore` exclude local environment files, imported credentials, and runtime data from CLI uploads. Production frontend builds obtain their variables from Vercel. API signing keys and database credentials stay in Railway. Client and admin builds expose only public frontend variables and the build mode. Internal Vercel build credentials are excluded. The admin build also compiles the shared workspace package before Vite, so a clean deployment does not depend on cached output.

## Rollout on 14 October 2026

A private PostgreSQL backup was taken before migration execution. The existing database contained three users, one recording, and no releases. The metadata dry run found no values that needed modification. The migration was applied and recorded without changing those counts, and all schema health groups passed.

The API's missing admin bootstrap secret was replaced with a generated secret. Existing signing secrets, treasury settings, storage credentials, and the linked Postgres connection were preserved. Production client and admin API URLs point to the Railway service.

Deployment IDs and live verification results are recorded in [deployment evidence](production-deployment-evidence/README.md). The admin authentication endpoint reports that the first administrator account still needs to be created. Its bootstrap token is configured in Railway as `ADMIN_BOOTSTRAP_TOKEN`.

## Music creation worker rollout

The `media-worker` Railway service runs `pnpm --filter server worker` from the same repository. Both API and worker run `db:migrate` before starting. The migration `2026-10-14-background-publication` adds durable publication requests and leased media jobs. Existing releases, recordings, and financial records are preserved.

Worker variables reference the corresponding `server` variables through Railway. Infrastructure definitions leave variables unmanaged, so CLI-managed references and secrets remain intact. The worker has no public domain. It handles asset creation, signed-event jobs, provider status reconciliation, schedules, and atomic publication.

Local development starts it with `pnpm dev:worker`; `scripts/run_local_stack.sh` now includes its terminal tab. Restarting the worker resumes leased jobs. Failure outcomes remain visible in Studio, and uncertain asset creation is reconciled without a second blind creation request.

See [creation verification](music-creation-ux-evidence/README.md) for local and actual S3/Mux evidence.
