# Music creation UX verification

The [verification manifest](verification.json) records the browser version, states, routes, viewports, and results. Eleven captures cover music-first creation, song metadata, Single title reuse, automatic artwork upload, publication review, processing, and a reopened collection at five widths.

The browser uses a disposable PostgreSQL database, the real API, actual local file uploads, and a separate real worker process. Local recording readiness is controlled directly in PostgreSQL to reproduce processing. The browser closes after requesting publication. The worker then publishes the ready release without another browser request. This verifies durable publication, not Mux transcoding. Live S3/Mux verification is recorded separately after deployment.

The collection uploads three files, receives the EP format suggestion, applies a shared label, changes one song's label, saves, and reopens with the exception preserved. No page errors or horizontal overflow were reported.

Run `pnpm test:e2e:release-flow` to recreate these captures. PostgreSQL tests additionally exercise failures, changed and cancelled targets, schedules, duplicate events, lease recovery, replacement generations, preserved revisions, and uncertain asset creation without duplicate provider requests.
