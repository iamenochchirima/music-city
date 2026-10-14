# Release creation and publication

The implementation checklist lives in the [music creation UX plan](music-creation-ux-plan.md). This document describes the product workflow. SOW 2 requirements remain in their separate tracker.

## Create music

1. Add music. Select one or several audio files, or choose recordings from your library. Uploads start on selection.
2. Song details. Edit song titles, explicit flags, credits, ISRCs, and labels. Apply shared credits or labels to selected songs while preserving exceptions.
3. Release details. Add artwork, genre, format, and optional description. Singles reuse their song title unless you choose a different release title.
4. Review and publish. Review the summary, edit a specific section, and choose Draft, Publish now, or Schedule.

Draft changes save automatically. Continue and Save & exit flush valid pending changes. File transfers must finish before publication can be accepted. Audio processing continues in the backend after the browser closes.

## Background publication

Publication requests pin the release metadata, track order, song metadata, and recording generation. The request is durable in PostgreSQL. The worker handles Mux asset creation, verified event delivery, provider reconciliation, scheduled publication, and an atomic switch to the public version. The UI polls read-only status and has no manual audio refresh.

A release requested during processing shows Processing in Studio. It stays private until every song is playable. Failed audio shows Needs attention and allows replacement. Corrected audio requires another explicit publication request. Cancelling a queued request permits editing. Save & exit preserves an accepted request.

Scheduled requests publish at the selected time if ready. Missing the time because processing remains incomplete requires a new schedule or Publish now. Worker execution does not depend on page visits.

## Edit a live release

Start revision creates a working version while preserving the current public snapshot. Add, remove, reorder, or edit songs there. Request publication to apply the exact revised version when ready. Failure preserves the previous live version.

## Verify

Run `pnpm test:track-credits` for metadata, background publication, and agreement PostgreSQL tests. Run `pnpm test:e2e:release-flow` for the four-step Single and collection browser journeys, including publication after browser close. Evidence is in [music creation UX evidence](music-creation-ux-evidence/README.md).
