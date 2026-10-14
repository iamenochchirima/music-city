# Release-first workspace

Implemented locally on 14 October 2026. This update replaces the release workspace's four sections with one five-step creation and editing flow.

## Use the flow

1. Release basics: enter the title, artist, format, and genre.
2. Add music: upload a recording directly into the release or select one from the recordings library. Arrange its tracklist.
3. Track information: edit each song's title, explicit flag, Composer, Author, Producer, Engineer, Publisher, ISRC, and Record label. Credits and identifiers remain optional.
4. Artwork & release details: upload artwork, add a description, and set the release label. Copying that label to tracks still requires an explicit preview and overwrite choice.
5. Review & publish: resolve readiness issues, keep a draft, publish, or schedule.

Continue saves the workspace. Back and step selection retain unsaved values in memory. Save & exit saves before returning to the library. Reopening a release restores its saved values and its last selected step on this browser.

Create and New release enter this flow. Standalone recording upload remains a secondary action, labeled Upload to recordings library.

## Edit a live release

A scheduled or published release opens with Start revision. Starting a revision stores a snapshot of the current release and its recordings in the release's JSON payload. Management operations edit the saved working version. Public release lists, release pages, track browsing, and playback continue to use the snapshot until the owner applies the revision.

The artist can add and remove songs, change their order, and edit their metadata. Adding a second song to a Single prompts for EP or Album. Adding a seventh song to an EP prompts for Album. A completed audio upload survives an attachment failure, so retry adds the recording without uploading it again.

Apply release update validates the working release and switches the public version in one PostgreSQL transaction. The transaction checks ownership, the revision timestamp, the tracklist, and audio readiness. Failed application preserves the old public version. Current listening counters and sales settings remain effective while recording metadata is frozen.

Scheduled releases retain the original schedule during revision work. If that time arrives, the original version becomes public. The unfinished working version remains private. Audio referenced by the live snapshot cannot be deleted until it is removed through an applied revision.

## Implementation checklist

- [x] Make release creation the primary entry point.
- [x] Use five shared steps for creation and editing.
- [x] Add audio uploads inside the release and attach them automatically.
- [x] Edit per-song metadata without leaving the workspace.
- [x] Preserve edits across step selection and save before continuing or exiting.
- [x] Support existing recordings, additions, removal, and ordering.
- [x] Prompt for a larger format before exceeding Single or EP capacity.
- [x] Retain label-copy safeguards and publication readiness rules.
- [x] Protect the current public version with explicit saved revisions.
- [x] Apply revisions atomically and preserve the old version on failure.
- [x] Keep standalone recording uploads as a secondary library action.

## Verify the update

Run the behavioral checks and build:

```bash
pnpm test
pnpm typecheck
pnpm --filter client build
pnpm test:e2e:release-flow
```

The browser runner uses signed test accounts, a disposable local PostgreSQL database, and real local audio and artwork uploads. It covers the five steps, publication, revision creation, Single-to-EP conversion, attachment retry, save and exit, reopening, and public content before and after application. It also captures widths of 360, 390, 768, 1024, and 1440px.

The database tests inject a revision-application failure and verify rollback, stale-version rejection, ownership checks, live track membership, and deletion protection. Server tests also cover scheduled revision isolation and direct-edit rejection. Client tests cover failed creation, retained track edits, save order, and explicit revision entry.

See [browser evidence](release-flow-evidence/README.md). Deployment and production rollout are separate from this local implementation.
