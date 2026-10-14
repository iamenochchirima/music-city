# Track credits and identifiers implementation plan

Status: Implemented and locally verified on 14 October 2026. Production rollout and retirement of temporary migration code remain separate follow-up tasks.

Created: 14 October 2026. Baseline: `69d0c76` on `main`.

## Outcome and scope

Let artists enter Composer, Author, Producer, Engineer, Publisher, ISRC, and Record label while uploading a track. Save these values on the track and allow later edits from track management. Singles, EPs, and albums use the metadata of their individual tracks.

The upload sequence becomes **Track details → Audio → Credits & identifiers → Review and save**. The metadata step is visible and optional. Empty metadata does not block saving a draft or publishing a release. Invalid entered values must be corrected or removed before saving.

This scope adds no composition entity, ISWC, IPI, society membership fields, profile metadata, identifier issuance, rights registration, or new royalty consent flow. Credits describe contributions. They do not grant ownership, set royalty percentages, or replace contributor agreements.

The previous [track and release workflow plan](../TRACK_RELEASE_WORKFLOW_PLAN.md) describes the completed upload flow. This plan changes its metadata placement and adds track-level record label capture.

## Define the fields

Use the existing `credits` array and `isrc` field. Add `recordLabel` to the track model. Do not add separate scalar fields for each contributor role.

| Display label | Stored field or role | Behavior |
| --- | --- | --- |
| Composer | `credits[].role = "composer"` | Allow multiple named contributors. |
| Author | `credits[].role = "lyricist"` | Explain that this is the person who wrote the lyrics. |
| Producer | `credits[].role = "producer"` | Allow multiple named contributors. |
| Engineer | `credits[].role = "engineer"` | Allow multiple named contributors. |
| Publisher | `credits[].role = "publisher"` | Accept a person or organization name. |
| Existing ISRC | `track.isrc` | Accept an existing recording identifier. Leave blank when unavailable. |
| Record label | `track.recordLabel` | Accept one optional label name, up to 120 characters. |

Retain the existing `songwriter` and `remixer` roles as additional choices. Preserve existing credit records and role values. The Author label uses `lyricist`; do not introduce a second `author` role for the same meaning.

Use these validation rules in both creation and metadata updates:

- Trim contributor names and record label names. Require a nonempty name for every submitted credit.
- Keep the existing limit of 32 total credits and 120 characters per contributor name.
- Permit the same contributor in different roles. Reject repeated identical credits after normalization.
- Make profile linking optional. Accept free-text contributors and publisher organizations without Music City accounts.
- Validate every supplied `artistId` against an eligible artist profile, including during track creation.
- Normalize ISRC to uppercase and remove display hyphens before validation and storage. Use the existing 12-character format check.
- Treat whitespace-only ISRC and record label inputs as empty. Do not issue identifiers or claim to verify registration.
- On updates, omitted fields retain their stored values. An empty string clears ISRC or record label. An empty array clears credits.
- Reject incomplete contributor rows with a field-level error. The user can complete or remove the row. Do not silently discard a partially entered name.

## Inspect the existing implementation

| Area | Current behavior | Required change |
| --- | --- | --- |
| `packages/shared/src/music.ts` | `TrackSummary`, `trackCreateSchema`, and `trackMetadataUpdateSchema` support credits and ISRC. Record label belongs only to the release. | Add track record label and shared normalization rules. |
| `client/src/features/dashboard/components/track-create-form.tsx` | Three steps capture essentials, audio, and review. Local drafts retain essential text for seven days. | Add metadata, review, draft persistence, and create-payload fields. |
| `client/src/features/dashboard/components/track-manage-overview.tsx` | A collapsed section edits credits and ISRC after upload. | Use the same editor as upload and include track record label. |
| `server/src/modules/tracks/tracks.service.ts` | Creation stores ISRC without the update path's full normalization. Updates validate linked credit profiles. | Normalize and validate metadata consistently in both paths. |
| `client/src/features/dashboard/components/release-manage-overview.tsx` | Release management owns a release label and tracklist. | Show each track's metadata and provide an explicit label-copy action. |
| `server/src/services/database.service.ts` | Tracks use JSON payload persistence. | Persist track label and support an atomic batch update for selected release tracks. |

Check the repository methods during implementation before choosing the transaction boundary. Do not assume an in-memory repository update provides atomic PostgreSQL persistence.

## Phase 1: Update the shared model and API

- [x] Add optional `recordLabel` to `TrackSummary`, `trackCreateSchema`, and `trackMetadataUpdateSchema`.
- [x] Centralize credit, label, and ISRC normalization so creation and updates use the same rules.
- [x] Validate linked contributor profiles during both creation and updates.
- [x] Persist credits, normalized ISRC, and record label in the canonical track payload.
- [x] Preserve unrelated track fields when metadata changes.
- [x] Return field-level validation errors for invalid metadata.
- [x] Verify that tracks returned after creation and after reload contain all entered metadata.

Keep the existing `POST /api/v1/tracks` and `PUT /api/v1/tracks/:trackId/metadata` routes. Extend their validated payloads rather than creating a separate metadata store.

## Phase 2: Add the upload metadata step

- [x] Add **Credits & identifiers** after Audio and before the final review.
- [x] Show Composer, Author, Producer, Engineer, and Publisher as named role choices.
- [x] Allow adding and removing contributor rows and optionally linking a profile.
- [x] Add Existing ISRC and Record label inputs with short guidance.
- [x] Allow continuing with all metadata empty. Label the action **Continue** so optional fields remain clear.
- [x] Validate completed and incomplete rows before advancing to review.
- [x] Include credits, ISRC, and record label in the review, with an action to return to their editor.
- [x] Include the metadata in the track creation request.
- [x] Preserve metadata across Back, Next, upload retry, and reload within the existing seven-day draft period.
- [x] Preserve text from existing local drafts through a one-time format migration. Use stable step IDs in the new stored format.
- [x] Write only the new draft format and document removal of the one-time reader after the rollout draft lifetime.
- [x] Continue requiring users to reselect local audio files after reload. Show that requirement without clearing their text metadata.
- [x] Verify that artist activation and payment behavior still runs at the existing point in the upload flow.

Use one credit-and-identifier editor in upload and track management. Keep upload progress and upload cleanup in the existing upload workflow.

## Phase 3: Update track management

- [x] Replace the existing metadata controls with the shared editor.
- [x] Load and display all existing credits and ISRC values without changing their meaning.
- [x] Add editable track record label.
- [x] Support adding, removing, and clearing metadata after upload or publication.
- [x] Show field errors beside their inputs and preserve entered values after a failed save.
- [x] Keep title editing, audio processing, release assignment, and monetization behavior intact.
- [x] Ensure that credit changes do not change contributor agreements, effective royalty splits, or financial history.

## Phase 4: Integrate singles, EPs, and albums

Each track keeps its own credits, ISRC, and record label. The release tracklist provides a metadata summary and a direct **Edit track details** action. Uploading a track from a release uses the same upload wizard and retains the release draft.

- [x] Show whether each track has credits, ISRC, and a record label in the release workspace.
- [x] Link directly to the selected track's metadata editor and preserve a return path to the release.
- [x] Add **Apply record label to tracks** beside the existing release label input.
- [x] Show a preview listing selected tracks, current track labels, and the proposed label before applying it.
- [x] Select tracks with empty labels by default. Require an explicit choice before replacing an existing label.
- [x] Persist copied labels on the selected tracks. Later release label changes do not silently change track labels.
- [x] Apply the batch in one database transaction after checking release ownership, track ownership, and release membership.
- [x] Lock selected track rows and compare their current labels with the preview values. Reject a stale preview before overwriting a changed label.
- [x] Reject the whole batch if any selected track is unavailable, unauthorized, or no longer belongs to the release.
- [x] Return the updated tracks and refresh the displayed metadata only after the transaction succeeds.
- [x] Keep ISRC entry individual. Never copy one ISRC to every track in an EP or album.

Proposed batch route: `POST /api/v1/releases/:releaseId/track-metadata`. Restrict this operation to `recordLabel`, explicit `trackIds`, their expected current labels, and an explicit overwrite choice. Add its shared request schema alongside the release schemas. Do not make this route a general-purpose track mutation endpoint.

The existing release label remains release-specific. Track labels are independent stored values. Credits remain individual edits in this scope; batch credit copying can follow a separate product decision.

## Phase 5: Preserve existing data and update documentation

- [x] Preserve every existing credit and ISRC value. Normalize valid existing ISRC formatting without changing identifier content. Report malformed stored identifiers for review rather than deleting them.
- [x] Leave existing release labels intact.
- [x] Provide a one-time, dry-run-capable migration to copy nonempty release labels into blank labels on their associated tracks.
- [x] Check associations and ownership before copying. Report skipped and ambiguous records. Never overwrite an existing track label.
- [x] Review migration counts against a disposable database before any deployed-data migration.
- [x] Provide an explicit migration tool and document its retirement after deployed-data migration. Keep track metadata reads independent of release labels.
- [x] Update the track workflow documentation to describe the four upload steps and both label fields.
- [x] Record actual test results and browser evidence after implementation. Keep incomplete items unchecked.

Deployment, production migration execution, and broad security hardening are separate work. Functional input validation, access checks, data preservation, and atomic batch updates are part of this implementation.

## Focused tests

Use the existing track contract and service suites for shared validation and persistence. Add client tests for observable editor and upload behavior. Exercise batch updates against an isolated local PostgreSQL database.

| ID | Scenario | Expected result |
| --- | --- | --- |
| C01 | Save a track with all new metadata empty | Draft saves and remains eligible for the existing publish rules. |
| C02 | Enter each requested role, including two composers | Every contributor and role survives save and reload. Author maps to `lyricist`. |
| C03 | Use one person in two roles; repeat an identical credit | Distinct roles save. The identical repeated credit fails validation. |
| C04 | Submit an incomplete row, overlong name, or more than 32 credits | Field-level errors appear. No partial track or metadata update persists. |
| C05 | Enter lowercase or hyphenated ISRC; enter malformed or blank ISRC | Valid input stores the canonical identifier. Malformed input fails. Blank input remains optional. |
| C06 | Create or update a credit with an invalid linked profile | Both routes reject the link. A free-text contributor without a link saves. |
| C07 | Update only credits; then clear ISRC, label, and credits | Omitted fields retain their values. Explicit clears remove the selected metadata. |
| C08 | Navigate Back and Next, reload a saved draft, or retry a failed audio upload | Entered metadata survives. The audio file must be reselected after reload. |
| C09 | Open an existing local draft after the wizard gains a step | Text survives the one-time migration and the saved step maps to the correct new step. |
| C10 | Enter metadata during upload, edit it later, and reopen the release | All views show the same persisted track values. |
| C11 | Upload or edit another artist's track metadata | Access is denied and the stored track remains unchanged. |
| C12 | Apply a release label to selected empty-label tracks | Only selected tracks change. Existing labels remain unless overwrite was explicitly chosen. |
| C13 | Batch contains an unauthorized or unassigned track; inject a database failure | The entire operation fails with no partial label updates. |
| C14 | Change a release label after applying it to tracks | Stored track labels retain their previous values until another explicit application. |
| C15 | Build an EP with distinct credits and ISRC values | Each track retains its own metadata. No identifier copying occurs. |
| C16 | Edit credits on a published track with a finalized agreement | Publication, agreement evidence, and effective royalty split remain unchanged. |
| C17 | Run the data migration twice with existing explicit track labels | Existing values remain intact and the second run makes no duplicate or conflicting changes. |

## Verify and complete the work

- [x] Run `pnpm --filter @music-city/shared build` before server and client checks.
- [x] Run `pnpm typecheck`.
- [x] Run the affected server and client test suites, including the explicit PostgreSQL batch tests.
- [x] Run `pnpm build` and `git diff --check`.
- [x] In a browser, upload one track with all requested metadata, reload it, and edit it.
- [x] In a browser, save a track with empty optional metadata.
- [x] In a browser, create an EP with distinct track metadata and demonstrate label preview, preservation, and explicit overwrite.
- [x] Check the editor on a mobile viewport and with a keyboard, including input labels, focus, row removal, and validation errors.
- [x] Capture the upload metadata step, review, saved track metadata, and release label-copy preview.
- [x] Link the evidence and exact command outcomes in this document before marking the implementation complete.

Completion requires persisted metadata across creation and editing, working release integration, passing focused tests, and the browser demonstrations above.


## Verification record

The [verification evidence](track-credits-evidence/README.md) maps the focused scenarios to source tests and actual browser checks. Screenshots and a browser run summary are retained in that directory.

- `pnpm test` passes with 103 server tests, 32 client tests, and 10 admin tests. Six opt-in database suites skip without their explicit database URLs.
- `pnpm test:e2e:track-credits` runs against fresh disposable PostgreSQL 18 and local media. It passes nine metadata database tests and 20 contributor agreement database tests, then the Chrome browser workflow. These explicit database runs have no failures or skips.
- `pnpm typecheck`, `pnpm build`, and `git diff --check` pass. The client build retains its large-bundle warning.
- The browser uses a generated Testnet wallet to sign the real local API authentication challenge. It completes actual artist activation, uploads real WAV data, and exercises the metadata controls. No metadata or upload API responses are mocked.
- The browser verifies desktop and 390-pixel mobile layouts, keyboard focus after row removal, draft reload, two distinct track identifiers, selective label copying, explicit overwrite, persisted credit removal, and release return navigation. It reports no page errors.

The browser found two existing prerequisites that this implementation repairs. Payment hooks now use a checkout provider mounted inside the configured Dynamic provider. Upload pages can render without that provider, while a payment attempt without configuration fails explicitly. The management API now reads release assignment from `release_tracks`, so the metadata editor displays its release and returns to the correct workspace.

Track metadata updates now merge only supplied fields in PostgreSQL. This preserves unrelated fields when a label batch or audio update runs concurrently. The agreement database tests also verify that editing descriptive metadata leaves finalized consent, effective splits, and persisted financial entries unchanged.

## Rollout follow-up

These operational tasks follow deployment and do not block the verified local implementation:

- [ ] Run the migration's dry-run against the intended deployment database and review copied-label counts, malformed ISRCs, and skipped records.
- [ ] Apply the reviewed data migration once and retain its report. Preserve explicit track labels and resolve reported records individually.
- [ ] Remove the one-time local-draft v1 conversion after seven days have elapsed following rollout. New drafts already use v2 and stable step IDs.
- [ ] Retire the explicit database migration script after the deployed-data migration completes. Keep the verification record as historical evidence.
