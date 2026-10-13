# Music City beta security hardening

Status: local implementation and verification complete. Staging and production checks remain.

Prepared on 11 October 2026 against the current local worktree based on `249c931`. The changes are not committed or deployed.

## Release goal

Support a controlled pilot of up to 20 artist activations. The `EARLYUSER` offer applies automatically during registration. The app shows the $20 standard price, $20 discount, and $0 due, and activates sponsored artists without a payment transaction.

The limit counts successful artist grants by Music City account. It does not prove that 20 accounts belong to 20 different people. Eligibility is not a reservation: if the last grant is claimed before an eligible account finishes onboarding, that account sees the normal $20 due. If every named tester must have a guaranteed free place, add an allowlist or reserved invitations before opening registration.

## Implemented locally

### Media access

- [x] Reject absolute paths, malformed encodings, NUL bytes, backslashes, and traversal segments. Resolve local media paths and verify that they remain inside the configured media root.
- [x] Keep the public media route on local media only. Return a generic 404 for invalid or missing media keys.
- [x] Exercise the real uploads route with literal, encoded, double-encoded, separator, absolute-path, and malformed traversal attempts. Confirm a sentinel outside the media directory is never returned.
- [x] Confirm a valid WebP cover and ranged audio request still work.

### Upload limits and content checks

- [x] Enforce server-owned limits of 500 MB for audio and 10 MB for images using received bytes, not the browser's declared size.
- [x] Stage uploads in private temporary files, validate supported media signatures, and stop reading chunked requests as soon as they exceed the session or platform limit.
- [x] Stream S3-bound content with measured `Content-Length`. Verify stored size and content type before completing an upload.
- [x] In production with S3 and Mux, keep Mux ingest behind the server. Do not expose the S3 staging URL to the browser.
- [x] Test declared and chunked size overruns, a mismatched media signature, and measured streaming to an HTTP storage endpoint.

### Sponsored activation

- [x] Cap `EARLYUSER` at 20 successful artist grants. Lock the campaign row while issuing grants so concurrent activations cannot exceed the cap.
- [x] Automatically apply the $20 discount during registration and display the price breakdown. Sponsored activation creates no payment intent or payment record.
- [x] Stop new grants when the campaign is paused or full. Preserve already issued grants and existing artist access.
- [x] Show the limit, remaining slots, eligible accounts, activations, and waived value in the admin report.
- [x] Race 21 account completions against PostgreSQL and confirm exactly 20 receive a grant. Test retries, pause and resume, listener-to-artist changes, and legacy paid or waived access.

### Artist access and public listings

- [x] Require a valid sponsored grant, confirmed payment, or preserved legacy access before an artist profile can complete.
- [x] Apply the access check in the database transaction that completes the profile.
- [x] Keep incomplete or inactive artists out of public artist, track, and release listings. Require access for artist write actions.
- [x] Test that an unpaid artist cannot publish or appear in public listings.

### Entitlements

- [x] Remove the user-accessible entitlement grant endpoint. Verified payment and subscription flows remain the sources of those records.
- [x] Confirm the removed route returns 404.

### Admin authentication

- [x] Require a one-time `ADMIN_BOOTSTRAP_TOKEN` to create the first administrator. Serialize bootstrap in PostgreSQL so concurrent requests cannot create two first admins.
- [x] Require at least 12 characters for new admin passwords.
- [x] Limit failed logins by both normalized email and source IP in PostgreSQL. Return the same 401 message for unknown emails and wrong passwords. Log hashed identifiers only.
- [x] Configure Express trusted proxy hops through `TRUST_PROXY_HOPS` so rate limiting can use the real client IP behind a known proxy.
- [x] Test bootstrap authorization and concurrency, indistinguishable login errors, throttling, and a second admin signing in from a different address.

### Mux playback configuration

- [x] Require Mux API credentials, webhook secret, signing key, and private key in production when Mux is enabled.
- [x] Create Mux assets with signed playback policy when signing is configured.
- [x] Test production startup validation for missing or valid Mux signing configuration.

## Local verification completed

- [x] `pnpm test:early-user-discount`: 49 server tests passed with an isolated temporary PostgreSQL database, 10 client tests passed, 10 admin tests passed, and all workspace packages type-checked.
- [x] Focused upload, entitlement, configuration, onboarding, registration discount, and admin UI test runs passed.
- [x] `git diff --check` passed after the final edits.

## Before inviting artists

- [ ] Review production request logs for traversal attempts against `/api/v1/uploads/content/`. If there is evidence of file exposure, rotate secrets stored in readable files and invalidate affected sessions.
- [ ] Configure a unique production `ADMIN_BOOTSTRAP_TOKEN` of at least 32 characters. Use it once to create the first admin, then remove or rotate the bootstrap value according to the deployment process.
- [ ] Set `TRUST_PROXY_HOPS` to the exact trusted proxy count for the production route. Keep it at `0` for direct connections.
- [ ] Configure and verify production S3 credentials and Mux API, webhook, and signing keys. Do not copy development or test credentials.
- [ ] Review existing Mux assets. Secure or recreate unpublished assets that were created with public playback policy.
- [ ] Decide whether a 20-account activation cap is enough or whether the pilot needs named invitees and guaranteed reserved places.
- [ ] Run a staging smoke test with production-equivalent Dynamic authentication, storage, and Mux settings: register, verify the displayed $20 / $20 / $0 quote, finish sponsored activation without payment, upload media, publish, and play it.
- [ ] Deploy the server and client changes. Confirm readiness, then run one controlled artist signup and upload against production before inviting the rest of the cohort.
- [ ] Watch admin authentication, rejected uploads, sponsorship capacity, and media access logs during the pilot.

## Outside this pass

This work does not add person-level identity checks, copyright review, takedown handling, listener support operations, or a backup and restore program. A 20-account limit is not a 20-person identity guarantee.
