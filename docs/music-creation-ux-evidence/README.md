# Music creation UX verification

The [verification manifest](verification.json) records the browser version, states, routes, viewports, and results. Eleven captures cover music-first creation, song metadata, Single title reuse, automatic artwork upload, publication review, processing, and a reopened collection at five widths.

The browser uses a disposable PostgreSQL database, the real API, actual local file uploads, and a separate real worker process. Local recording readiness is controlled directly in PostgreSQL to reproduce processing. The browser closes after requesting publication. The worker then publishes the ready release without another browser request. This verifies durable publication, not Mux transcoding. [Live S3/Mux verification](live-verification.json) passed after deployment. The real worker created the asset, confirmed playback readiness, and published the release without a browser.

The collection uploads three files, receives the EP format suggestion, applies a shared label, changes one song's label, saves, and reopens with the exception preserved. No page errors or horizontal overflow were reported.

Run `pnpm test:e2e:release-flow` to recreate these captures. PostgreSQL tests additionally exercise failures, changed and cancelled targets, schedules, duplicate events, lease recovery, replacement generations, preserved revisions, and uncertain asset creation without duplicate provider requests.

The production database backup contained four users, three recordings, and two releases. Verification created two disposable accounts and removed their recordings and releases afterward. Audit-protected activation records remain intact. The verification accounts were changed to listener intent so they do not appear in artist discovery. Existing recordings and releases were preserved.

[Webhook verification](webhook-verification.json) covers signed endpoint handling. Actual Mux dashboard delivery configuration has not been independently verified. The worker's provider reconciliation completed the real publication regardless of notification delivery.
