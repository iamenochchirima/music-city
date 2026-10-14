# Track credits verification evidence

Verified locally on 14 October 2026. The [implementation plan](../track-credits-implementation-plan.md) covers optional track credits, ISRC, track record label, and explicit release label copying.

## Repeat the checks

Run the workspace checks from the repository root:

```sh
pnpm --filter @music-city/shared build
pnpm test
pnpm typecheck
pnpm build
git diff --check
```

Run the real database scenarios with Docker available:

```sh
pnpm test:track-credits
```

Run the browser demonstration with installed Chrome or Playwright Chromium:

```sh
pnpm test:e2e:track-credits
```

The runner creates a fresh PostgreSQL 18 container with temporary storage, a generated password, and a port bound to `127.0.0.1`. Database test guards require a local database name ending in `_test`. The runner removes its container and temporary API, client, keys, and media after completion.

The browser runner prefers installed `google-chrome`. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to choose another compatible executable. Set `TRACK_CREDITS_EVIDENCE_DIR` to save new evidence outside this directory.

The isolated API starts from a temporary working directory with explicit test settings. It does not load the project's deployment `.env` files. The client uses the local API and disables the external Dynamic environment for this metadata demonstration. Authentication verifies a real generated-wallet signature against the actual API. Wallet payment transport is covered separately by component tests. This demonstration does not make a paid wallet transaction.

## Recorded results

| Check | Result |
| --- | --- |
| Default server tests | 103 passed, six opt-in database suites skipped |
| Client tests | 32 passed |
| Admin tests | 10 passed |
| Explicit metadata PostgreSQL suite | Nine passed, no failures or skips |
| Explicit contributor agreement PostgreSQL suites | 20 passed, no failures or skips |
| Type checks and workspace builds | Passed |
| Browser workflow | Passed in Chrome, no page errors |
| Whitespace check | Passed |

The client build retains its large-bundle warning. The browser run's version and checks are in [browser-verification.json](browser-verification.json).

## Requirement evidence

| Plan scenarios | Evidence |
| --- | --- |
| C01, C02, C05 | Track contract and service tests, shared editor tests, and actual browser uploads with all requested fields and with empty optional fields |
| C03, C04 | Contract tests reject duplicate, incomplete, overlong, and excessive credits. Editor and wizard tests show actionable field errors. |
| C06, C11 | Service tests reject invalid linked profiles and another artist's edits. PostgreSQL batch tests reject incorrect ownership or membership. Actual HTTP rejects an unauthenticated batch request. |
| C07 | Service tests and real PostgreSQL partial updates distinguish omitted fields from explicit clears and preserve publication fields. |
| C08, C09 | Wizard tests exercise upload failure, cleanup, retry, and the existing activation-payment trigger. Draft tests verify v1 conversion and expiry. Chrome verifies reload, retained text, and audio reselection. |
| C10, C15 | Chrome uploads, edits, and reloads metadata, then builds an EP with different per-track credits and ISRCs. |
| C12, C13, C14 | Component and PostgreSQL tests cover preview, overwrite, stale values, concurrency, authorization, and injected database-failure rollback. Chrome exercises selective copying and overwrite. |
| C16 | The finalization PostgreSQL test edits a published track through the metadata service and compares finalized agreement evidence, effective split, and financial entries before and after. |
| C17 | The migration PostgreSQL test verifies dry-run, preservation of explicit labels and malformed identifiers, ownership skips, and an idempotent second application. |

Source suites are `server/src/modules/tracks/music.contracts.test.ts`, `tracks.service.test.ts`, and `track-metadata.integration.test.ts`; `server/src/modules/agreements/finalization.integration.test.ts`; the client dashboard metadata, wizard, batch-preview, and draft suites; and `client/src/features/payments/hooks/use-stellar-checkout.test.tsx`.

## Browser captures

- [Upload metadata](upload-metadata.png)
- [Upload metadata on mobile](upload-metadata-mobile.png)
- [Upload review](upload-review.png)
- [Release label-copy preview](release-label-preview.png)
- [Persisted track metadata](saved-track-metadata.png)
- [Persisted metadata after contributor removal on mobile](saved-track-metadata-mobile.png)

These images show generated local fixtures. Desktop checks use a 1360-pixel viewport. Mobile checks use a 390-pixel viewport and verify that the metadata pages do not overflow horizontally. Keyboard checks verify navigation between credit fields and focus returning to Add contributor after removing a row.

## Migrate existing metadata explicitly

The migration reads `TRACK_METADATA_DATABASE_URL` explicitly. It does not run at application startup. First inspect its dry-run report:

```sh
TRACK_METADATA_DATABASE_URL=postgres://USER:PASSWORD@HOST/DATABASE pnpm --filter server exec tsx src/scripts/migrate-track-metadata.ts
```

After reviewing the report, apply it to the intended database:

```sh
TRACK_METADATA_DATABASE_URL=postgres://USER:PASSWORD@HOST/DATABASE pnpm --filter server exec tsx src/scripts/migrate-track-metadata.ts --apply
```

Use the environment securely for actual credentials. The commands above contain placeholders. The migration copies valid release labels only to blank labels on associated tracks with matching ownership. It normalizes valid ISRC formatting, preserves malformed identifiers for review, and leaves credits and explicit track labels intact.

Production deployment, execution of the deployed-data migration, and retirement of the temporary migration code remain rollout tasks. This record claims local implementation and verification only.
