# Music creation UX implementation plan

Status: Implemented, deployed, and functionally verified. Updated 14 October 2026. This is a separate product improvement, outside the SOW 2 milestone tracker.

The current implementation uses five steps, repeated song and release fields, manual save and refresh controls, and publication blocked by audio processing. This plan replaces those behaviors with a simpler creation journey and backend-owned publication. The new flow and backend publication workflow are running live. Local browser, database, and actual S3/Mux verification passed.

## Combined scope

- [x] Replace the creation journey with Add music, Song details, Release details, and Review and publish. Reuse one song editor throughout upload, editing, and error correction.
- [x] Remove repeated title, artist, and label entry. Reuse profile and song values while preserving deliberate overrides.
- [x] Collect all current song metadata once per recording. Keep shared metadata application explicit and ISRC individual.
- [x] Support multi-file uploads and existing library recordings. Keep standalone uploads in the recordings library.
- [x] Simplify Single controls. Keep release-format and publication choices visible. Suggest a format from track count without interrupting uploads.
- [x] Start audio and artwork uploads when selected. Save partial drafts and ordering automatically with truthful save status and retained inputs on failure.
- [x] Make review a compact summary with direct Edit links and one explicit publication action.
- [x] Accept publication requests while uploaded audio is processing. Persist the exact requested version and its outcome.
- [x] Move processing coordination, readiness reconciliation, schedules, and publication into a durable backend worker.
- [x] Remove manual audio refresh and browser-driven media synchronization. Display backend status automatically.
- [x] Handle processing failure, replacement audio, cancellation, edits to queued releases, missed schedules, and live revisions without publishing stale or broken versions.
- [x] Test Single, collection, and resumed-draft journeys, including real processing, failures, worker restart, and deployment.


## Implementation order

1. Specify partial drafts, publication requests, version pinning, cancellation, and metadata reuse rules. Add shared schemas and database migrations.
2. Implement and verify the worker, webhook handling, readiness reconciliation, and atomic publication.
3. Build the four-step UI, unified song editing, shared defaults, automatic uploads, and draft saving against those APIs.
4. Replace refresh controls with read-only status updates. Verify recovery, schedules, and live revisions.
5. Run end-to-end usability and failure checks, then deploy the API, worker, migrations, and frontend together.

## Intended user journey

1. Add music. Upload one or several files, or choose existing recordings. Transfers start when files are selected. Show a compact progress row for each file.
2. Song details. Edit each song's title, explicit flag, Composer, Author, Producer, Engineer, Publisher, ISRC, and label in one connected song workspace. Uploaded titles are already filled in. Existing recordings retain their metadata.
3. Release details. Add artwork, genre, optional description, and release format. Prefill artist identity from the profile. A Single uses its song title by default, with an explicit option for a different release title.
4. Review and publish. Show a compact summary with direct Edit links. Draft, Publish now, and Schedule remain visible choices. Accept publication while uploaded audio is processing.

Enter each value once. Apply shared credits or a label to selected songs with explicit selection and protection for existing values. Keep ISRC specific to each recording. Keep song overrides independent. Do not infer royalty shares or consent from credits.

Move standalone recording creation to the recordings library. Hide irrelevant disc and focus-track controls for Singles. Permit multi-file uploads for collections. Keep optional metadata available without forcing empty fields or unnecessary review steps.

Replace separate upload-cover, save-order, and save-and-continue actions with automatic file uploads, durable draft saves, and one Continue action. Show Saving, Saved, or Couldn't save truthfully. Retain inputs on failure. Partial drafts must be supported by the API rather than bypassing its validation in the browser. Publication remains explicit.

## Publication behavior

| Condition when the user publishes | Owner experience | Backend result |
| --- | --- | --- |
| Required information is missing | Inline errors and direct links to the missing fields | Reject the request. Preserve the draft. |
| File bytes are still uploading | Visible file-transfer progress | Finish the upload before accepting publication. Background processing does not make a browser file transfer survive closing the tab. |
| Uploads are complete and all audio is ready | Release published | Validate and atomically publish the requested version. |
| Uploads are complete and audio is still processing | Processing, with an accepted publication request. The user can leave. | Persist the exact requested version and finish publication automatically when every recording is ready. |
| Any recording fails processing | Needs attention with the affected song and Replace audio action | Block publication. Preserve saved inputs and successful uploads. Require a new explicit publish request after correction. |
| A live release revision is processing | Update processing | Keep the current public version until the requested revision is ready and commits successfully. |

Owner-facing status names are Draft, Processing, Scheduled, Published, and Needs attention. A queued request must not be reported as Published. Initial releases remain private until all required recordings are playable. Do not expose a partly published album. Revision failures leave the existing public release available.

Persist publication intent separately from actual release visibility. Store the owner, target version, metadata and tracklist snapshot, recording-generation identities, mode, schedule, request identity, and outcome. An accepted request returns a durable request identifier and pending status where appropriate.

Editing a queued release cancels its request before creating a new working version. A late worker or webhook cannot publish the cancelled or superseded version. Cancellation and publication must serialize: if publication already committed, further edits use a new revision. Saving a draft or deleting the release also cancels pending intent.

For scheduled publication, retain the chosen date while processing. Publish at that date only if all recordings are ready. If processing misses the date, show Needs attention and require the owner to choose Publish now or a new future date. Do not silently publish late. The worker must advance schedules without a visitor opening the release page.

## Backend ownership and status delivery

The current Mux handlers in `server/src/modules/media/media.service.ts` already receive asset-created, ready, and errored events. The endpoint is `/api/v1/media/webhooks/mux`. Its deployment configuration and actual delivery still need verification. Mux documents [ready and errored notifications](https://www.mux.com/docs/core/mux-fundamentals) and [webhook setup](https://www.mux.com/docs/core/listen-for-webhooks).

Mux owns transcoding. The application worker owns durable event handling, status reconciliation, scheduled transitions, and publication. Use the existing PostgreSQL deployment for durable jobs initially. A separate Railway worker process consumes leased jobs and resumes them after restart. Do not rely on browser polling, request-local promises, or an in-memory timer for completion.

- Verify webhook signatures and persist received events before acknowledging them. Deduplicate event IDs and enqueue work transactionally.
- Match events to the active upload or asset generation. Track ID alone must not let an old failed asset invalidate replacement audio.
- Preserve ordering rules for ready, failed, cancelled, and replaced recordings. Reconcile uncertain provider status before changing a terminal result.
- Recover pending uploads, assets, and publication requests through bounded provider checks when notifications are delayed or missing. This repairs the same workflow and does not create an alternate publication path.
- Use job leases, retry backoff, attempt limits, and persisted error outcomes. Avoid duplicate asset creation, lost work, and duplicate publication after restart or concurrent events.
- On readiness changes, evaluate pending requests. Revalidate ownership, target version, required metadata, track count, tracklist, and playback readiness immediately before an atomic public-version commit.
- Remove user-facing Refresh audio status actions and browser-triggered media synchronization. Route all completion through the backend-owned workflow.

Start with authenticated, read-only status polling while Studio is open. Poll only active processing requests, pause hidden tabs, and stop after completion. Reopening the page reads the persisted state. Polling must never create an asset or publish a release.

WebSockets are not required for this milestone. Server-sent events can replace status polling later if useful. Either transport displays the same backend state; neither determines completion. Show a spinner and ready-song count while processing. Show exact percentages only for measurable file transfers, not provider transcoding.

## Implementation checklist

- [x] UX-01. Implement the four-step flow and unified song editor without removing required metadata.
- [x] UX-02. Implement Single title reuse, profile defaults, shared metadata application, and individual overrides.
- [x] UX-03. Add multi-file uploads, immediate artwork upload, durable partial drafts, and truthful save status.
- [x] UX-04. Add publication-request and durable-job migrations, cancellation rules, version pinning, and API schemas.
- [x] UX-05. Persist and deduplicate verified webhook events with correct upload and asset identity matching.
- [x] UX-06. Deploy the worker with leases, recovery, bounded retries, status reconciliation, and schedule execution.
- [x] UX-07. Accept processing publication requests and atomically publish ready versions without duplicate outcomes.
- [x] UX-08. Implement failure, replacement, cancellation, missed-schedule, and live-revision behavior.
- [x] UX-09. Remove manual audio refresh and browser-side synchronization. Add read-only automatic status display.
- [x] UX-10. Verify the complete journey locally and on the deployed client, API, worker, database, and Mux environment.

## Acceptance and failure tests

| Test | Expected outcome |
| --- | --- |
| Single creation | No repeated title or label entry. Required metadata remains available. |
| Three-song collection with shared credits and one exception | Apply shared values once. Keep the exception and individual ISRCs. |
| Existing library recording | Preserve previously saved song metadata and deliberate overrides. |
| Processing publication followed by browser close | Persist the request, continue server work, and publish automatically after readiness. No refresh click is required. |
| Worker restart or lost webhook | Resume durable jobs and reconcile provider status without duplicate assets or publication. |
| Duplicate, reordered, or invalidly signed events | Reject invalid signatures and avoid duplicate or incorrect transitions. |
| Old asset reports failure after replacement | Ignore the obsolete generation. Do not invalidate new audio. |
| One song fails in a collection | Keep the initial release private, show the affected song, and retain successful uploads. |
| Queued release changes, is cancelled, or is deleted | The stale job cannot publish it. A corrected version requires explicit submission. |
| Live revision fails or completes | Preserve the public snapshot on failure. Apply the exact requested revision once on success. |
| Scheduled publication before or after readiness | Execute on time without page visits. Require owner action if readiness misses the date. |
| Save or status request fails | Preserve edits and show a recoverable state. Status-view failure does not stop backend processing. |
| User closes the tab during file transfer | Do not claim completed upload or accepted publication. Show resumable or failed transfer state on return. |

Measure the Single, three-song collection, and resume-and-edit tasks with real users. Record repeated-entry count, backtracking, time to submit, and whether users understand Processing and Needs attention without guidance. Record results in the verification log.


## Verification log

- 14 October 2026: the real local API, PostgreSQL publication requests, and worker completed publication after the browser closed.
- The Single flow entered song title and metadata once. Artwork uploaded automatically.
- Three-file upload selected EP without interruption. Shared label and an individual exception survived draft reopening at five viewport widths. Eleven browser captures recorded no page errors.
- PostgreSQL tests passed queued publication, cancellation, changed targets, failed collections, missed schedules, restart leases, duplicate events, replacement generations, revision preservation, and uncertain asset creation without a duplicate provider request.
- Current evidence: [browser verification](music-creation-ux-evidence/verification.json).
- UX-06 and UX-10 completed. The Railway worker, background-publication migration, and frontend are deployed. Actual S3 upload, worker-owned Mux asset creation, processing, and automatic publication passed.
- [Live verification](music-creation-ux-evidence/live-verification.json) records the provider-backed result. [Webhook verification](music-creation-ux-evidence/webhook-verification.json) records acceptance of a correctly signed event and rejection of an invalid signature. Actual Mux dashboard delivery configuration remains unverified; the deployed worker reconciles provider status independently.
- Real-user task timing remains a follow-up usability measurement. Functional completion does not claim that measurement.
