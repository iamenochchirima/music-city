# Track and Release Workflow Implementation Plan

Status: implementation complete for the scoped release-first workflow. Source, typechecks, tests, production builds, and local HTTP smoke checks are verified. Manual visual/browser verification remains environment-dependent because no browser instance is available in this session.

Baseline checkpoint: `bc182a0` — `Checkpoint onboarding and Studio UI work`

## Product decision

Music City will separate the recording from the release that publishes it.

- A **track** is an audio recording.
- A **release** is the publishing container: single, EP, or album.
- A single is a release containing exactly one track.
- An EP or album owns the ordered tracklist, artwork, release date, and release-level metadata.
- A track can be uploaded as a draft recording before it is assigned to a release.
- Country/territory availability is a future release-level feature, not track creation metadata.

This keeps the first upload focused while retaining a proper place for professional metadata.

## Metadata placement

| Metadata | Owner | Where it is entered | Required to upload | Required to publish |
| --- | --- | --- | --- | --- |
| Track title | Track | Track essentials | Yes | Yes |
| Primary artist | Track/release profile | Pre-filled from artist profile | Yes | Yes |
| Featured artists | Track | Track essentials or contributor editor | No | No |
| Genre | Release, optionally inherited by tracks | Release details | Yes | Yes |
| Explicit flag | Track | Track metadata | Yes, default `false` | Yes |
| Audio file | Track | Track media | Yes | Yes |
| Release title | Release | Release details | No | Yes |
| Release type | Release | Release details | No | Yes |
| Release artwork | Release | Release artwork | No | Yes |
| Release date | Release | Release schedule | No | Yes |
| Release description | Release | Optional release details | No | No |
| Record label | Release | Advanced release metadata | No | No |
| ISRC | Track | Advanced track metadata | No | No |
| Composer/songwriter | Track credit | Credits and identifiers | No | No |
| Producer | Track credit | Credits and identifiers | No | No |
| Publisher | Track credit | Credits and identifiers | No | No |
| UPC/EAN/catalog identifier | Release | Advanced release metadata, future-ready | No | No |
| Territory availability | Release | Advanced availability, future | No | No |

## Phase 1 — Product and interaction design

- [x] Confirm release-first model: a single is a one-track release.
- [x] Confirm country is not part of track creation.
- [x] Confirm professional metadata remains available as optional advanced metadata.
- [x] Define and document release track-count rules:
  - [x] Single must contain exactly one track before publishing.
  - [x] Supported EP range is 2–6 tracks.
  - [x] Supported album minimum is 7 tracks.
  - [x] Show the rule in the release review error, not as unexplained form friction.
- [x] Define the publish states shown to artists: Draft, Needs attention, Ready to publish, Scheduled, Live.
- [x] Allow incomplete drafts without artwork, audio, or a release assignment; publishing remains blocked until requirements pass.

## Phase 2 — Create entry points

- [x] Replace the current single upload-first landing with two clear actions:
  - [x] `Upload a track` — create or continue a recording draft.
  - [x] `Create a release` — start a single, EP, or album and build its tracklist.
- [x] Explain the relationship in one short sentence: `Tracks are recordings. Releases are what listeners see.`
- [x] Remove the current `Release placement` selector from the track creation wizard.
- [x] Remove `New release title` and `New release type` from the track creation wizard.
- [x] Keep the existing Releases area as the canonical place to create and manage releases.
- [x] Use responsive, keyboard-operable buttons and links for both entry points; visual browser verification is pending environment access.

## Phase 3 — Track upload workflow

### Step 1: Track essentials

- [x] Required: track title.
- [x] Required: artist identity, pre-filled from the authenticated artist profile.
- [x] Optional: featured artists with a repeatable contributor control.
- [x] Required: one primary genre.
- [x] Required: explicit-content choice with a safe default of `Not explicit`.
- [x] Remove the country picker from this screen.
- [x] Remove the long track description from the first screen.
- [x] Remove composer, producer, publisher, label, and ISRC from the first screen.
- [x] Preserve entered text values when moving backward or returning to the wizard with a seven-day local draft; the local file picker is intentionally reselected by the user.

### Step 2: Audio

- [x] Require an audio file before the track can be created as upload-ready.
- [x] Show accepted file types, 500 MB maximum size, upload progress, and processing state.
- [x] Show the selected file name and allow replacing it before submission.
- [x] Provide a real error state for failed uploads, clean up the upload session, and allow retry without losing metadata.
- [x] Do not call a track publish-ready until playback processing succeeds.

### Step 3: Save and next action

- [x] Save the track as a draft recording.
- [x] Show a completion state with two actions:
  - [x] `Add to a release`.
  - [x] `Keep as draft`.
- [x] Link directly to the track metadata page after saving.
- [x] Make clear that uploading a track does not publish it automatically.

## Phase 4 — Release creation workflow

### Step 1: Release details

- [x] Choose Single, EP, or Album using concise cards.
- [x] Require release title before continuing.
- [x] Pre-fill the artist from the artist profile.
- [x] Capture the primary release genre.
- [x] Keep release description optional.
- [x] Capture record label as optional advanced release metadata.

### Step 2: Artwork and schedule

- [x] Upload release artwork with preview, file guidance, replacement, and retry states.
- [x] Treat artwork as release artwork; do not require duplicate artwork for every track.
- [x] Support draft, scheduled, and publish-now states.
- [x] Require a future date for scheduled releases.
- [x] Explain that a scheduled release should be prepared only after audio processing is ready.

### Step 3: Tracklist

- [x] Add an existing uploaded track.
- [x] Upload a new track without losing the release draft; the draft is persisted before leaving the workspace.
- [x] Show track title, artist, duration, explicit status, and processing status.
- [x] Support reorder by keyboard and pointer.
- [x] Support disc number where albums need multiple discs.
- [x] Support one focus track where applicable.
- [x] Enforce the selected Single/EP/Album track-count rule at review and publish time.
- [x] Prevent the same track from being assigned twice to the same release or another release.

### Step 4: Review and publish

- [x] Show a compact release review with artwork, title, artist, type, date, and track count.
- [x] Show a blocking checklist of missing requirements.
- [x] Link each missing item directly to the field or tracklist that needs attention.
- [x] Require at least one track before publishing.
- [x] Require every release track to be playable before publishing.
- [x] Auto-publish assigned tracks when the release is published; this is the chosen visibility policy.
- [x] Publish, schedule, or save draft through clearly named actions.
- [x] Show the resulting status and next action after save.

## Phase 5 — Advanced metadata surfaces

### Track: Credits and identifiers

- [x] Add a collapsed `Credits & identifiers` section to track management.
- [x] Keep ISRC optional and label it `Existing ISRC`.
- [x] Validate and normalize an entered ISRC without generating an official identifier.
- [x] Replace the flat composer/producer/publisher fields with repeatable credits:
  - [x] Credit name.
  - [x] Role: songwriter/composer, producer, publisher, lyricist, remixer, engineer.
  - [x] Optional linked Music City artist profile, validated server-side.
- [x] Preserve featured artists as explicit artist contributors, not free-form title text.
- [x] Keep advanced metadata editable after upload and publication; changes update the track metadata in place.
- [x] Credit changes do not require a release revision in this local product version; the release remains live while its track metadata updates.

### Release: Business and delivery metadata

- [x] Add an optional `Release metadata` section for record label.
- [x] Reserve a documented place for UPC/EAN/catalog identifiers without requiring them now.
- [x] Reserve a documented place for future territory availability.
- [x] Keep distribution-only fields out of the essential upload path.
- [x] Display advanced metadata in the artist workspace only; do not expose identifiers unnecessarily on listener pages.

## Phase 6 — Shared schema and API refactor

- [x] Remove `country` from `TrackSummary`, `trackCreateSchema`, and track creation writes.
- [x] Remove `releasePlacement`, `selectedReleaseId`, `newReleaseTitle`, and `newReleaseType` from the track form state and payload flow.
- [x] Add the explicit-content field to shared track types and validation.
- [x] Move `recordLabel` to the release model.
- [x] Replace flat track credit fields with a validated repeatable credits structure.
- [x] Keep `isrc` as an optional track field.
- [x] Keep description on the release model; retain only a short optional track note in advanced track metadata.
- [x] Update `POST /tracks` to accept recording essentials only.
- [x] Add `PUT /tracks/:trackId/metadata` for credits and identifiers.
- [x] Keep release creation responsible only for release metadata.
- [x] Keep release-track assignment responsible for tracklist membership and order.
- [x] Make publish validation run on the server, not only in the client.
- [x] Return field-level Zod validation errors through the API response contract.

## Phase 7 — Database and data handling

- [x] Confirm the current JSON payload storage does not require new relational columns for these fields.
- [x] Add the new fields to the canonical payload schemas and repository types.
- [x] Legacy `recordLabel`, flat credits, and `country` migration is intentionally not required: local existing users/data may be reset as approved.
- [x] Use the approved local reset path instead of adding a permanent dual-read/dual-write fallback.
- [x] Verify release-track foreign-key behavior remains correct when tracks or releases are deleted; the existing foreign keys and `ON DELETE CASCADE` remain intact.
- [x] Prevent orphaned upload resources on failed track or release uploads by cancelling the upload session and deleting its storage/Mux resource.

## Phase 8 — Server validation and business rules

- [x] Reject release fields sent to the track creation endpoint.
- [x] Reject country on track creation after the schema change.
- [x] Reject publish for a release with no tracks.
- [x] Reject publish for a Single with anything other than one track.
- [x] Reject publish when any track is missing playable audio.
- [x] Reject publish when required artwork, title, artist, or genre is missing; require a future date for scheduled releases.
- [x] Reject scheduled releases with an invalid or past release date.
- [x] Accept drafts with incomplete optional metadata.
- [x] Validate and normalize ISRC format when provided.
- [x] Ensure ownership checks remain enforced for track metadata, upload cancellation, and release edits.

## Phase 9 — Tests

### Shared validation tests

- [x] Track essentials accept the minimum valid payload.
- [x] Track essentials reject invalid required fields; audio completion is enforced by the upload/publish workflow.
- [x] Explicit content defaults safely and accepts both states.
- [x] Country is rejected according to the final schema decision, with no persistence.
- [x] Release type and release metadata validate correctly.
- [x] Release and track credit structures validate role and name requirements.
- [x] ISRC accepts valid normalized values and rejects malformed values.

### Server tests

- [x] Track creation persists only track-owned fields.
- [x] Release creation persists only release-owned fields through the release repository payload.
- [x] Track assignment updates release membership and ordering.
- [x] Single/EP/album publish rules are enforced server-side.
- [x] Drafts can be saved before all optional metadata is complete.
- [x] Publish and schedule transitions enforce all required media and metadata checks.
- [x] Unauthorized users cannot edit another artist’s tracks, credits, uploads, or releases.
- [x] Legacy payload normalization is intentionally replaced by the approved local reset path; no compatibility fallback is retained.

### Client and workflow tests

- [x] Create landing presents the two correct starting points.
- [x] Track upload does not display country or release-placement controls.
- [x] Track upload preserves state across Back and forward navigation.
- [x] Upload failure keeps metadata and supports retry.
- [x] Saved track offers `Add to a release` and `Keep as draft`.
- [x] Release workflow can create a Single from an existing track.
- [x] Release workflow can create an EP/album and reorder tracks.
- [x] Review identifies missing fields and focuses the correct control.
- [x] Publish, schedule, and draft actions show correct status feedback.
- [x] Keyboard-operable step controls, upload controls, and tracklist ordering are implemented; live browser verification is pending.
- [x] Responsive grid layouts avoid fixed-width form overflow; live mobile visual verification is pending.

## Phase 10 — Cleanup and verification

- [x] Remove dead form state, imports, labels, and API payload fields.
- [x] Remove duplicate release creation/management surfaces.
- [x] Update artist-facing copy to consistently distinguish tracks from releases.
- [x] Update empty states and error messages to use the new terminology.
- [x] Update the Studio navigation labels if needed after the two-entry-point design.
- [x] Run client typecheck.
- [x] Run server/shared typecheck and tests.
- [x] Run production client and server builds.
- [x] Run `git diff --check`.
- [ ] Manually verify the complete flow: upload track → add to Single → review → publish → listen as a fan. Blocked only by the unavailable browser instance; local client/server HTTP smoke checks returned 200.
- [ ] Manually verify the complete flow: upload multiple tracks → create EP/album → reorder → schedule. Blocked only by the unavailable browser instance; server contract tests cover the publish rules.
- [ ] Review the final UI at mobile and desktop widths. Source/build verification is complete; visual browser review remains pending browser availability.

## Sources used for the planning direction

- [Spotify music metadata guidelines](https://support.spotify.com/ws/artists/article/metadata-formatting-guidelines/)
- [Spotify getting music onto the platform](https://support.spotify.com/st-en/artists/article/getting-music-on-spotify/)
- [Apple Music for Artists metadata guidance](https://artists.apple.com/support/1119-music-metadata)
- [Apple Music for Artists release preparation](https://artists.apple.com/release)
