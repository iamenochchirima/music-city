# Release Checklist

Use this checklist as the working implementation tracker for release management, discography, and the next music-library layer.

## Phase 1: Data Model
- [x] Define `ReleaseType` in [packages/shared/src/music.ts](/home/enoch/aworkspace/clients/music-city/packages/shared/src/music.ts): `single | ep | album`
- [x] Define `ReleaseStatus`: `draft | scheduled | published | archived`
- [x] Add `ReleaseSummary` shared type
- [x] Add `ReleaseDetail` shared type
- [x] Add `ReleaseTrack` shared type for ordered track membership
- [ ] Extend `TrackSummary` with optional release fields:
  - [x] `releaseId`
  - [x] `releaseTitle`
  - [x] `trackNumber`
  - [x] `discNumber`
  - [x] `isFocusTrack`
- [x] Add `releaseCreateSchema`
- [x] Add `releaseUpdateSchema`
- [x] Add `releaseTrackAssignSchema`
- [x] Add `releaseTrackReorderSchema`

## Phase 2: Database / Persistence
- [x] Add storage for `releases`
- [x] Add storage for `release_tracks`
- [x] Decide release cover storage approach
- [x] Add repository/service method: create release
- [x] Add repository/service method: update release
- [x] Add repository/service method: get release by id
- [x] Add repository/service method: list releases
- [x] Add repository/service method: list releases by artist
- [x] Add repository/service method: attach track to release
- [x] Add repository/service method: reorder release tracks
- [x] Add repository/service method: remove track from release
- [x] Add validation: only track owner can attach/remove tracks
- [x] Add validation: prevent conflicting release assignment rules
- [x] Add validation: `single` defaults to one track in v1

## Phase 3: Server API
- [x] Create `releases` module in the server
- [x] Add route: `GET /releases`
- [x] Add route: `GET /releases/:releaseId`
- [x] Add route: `GET /releases/mine`
- [x] Add route: `POST /releases`
- [x] Add route: `PUT /releases/:releaseId`
- [x] Add route: `POST /releases/:releaseId/tracks`
- [x] Add route: `PUT /releases/:releaseId/tracks/order`
- [x] Add route: `DELETE /releases/:releaseId/tracks/:trackId`
- [x] Add auth protection for creator release routes
- [x] Add publish/unpublish release flow
- [x] Return release detail with ordered tracks included

## Phase 4: Client API Layer
- [x] Create `releasesApi` in `client/src/features/music/lib/`
- [x] Implement `listReleases`
- [x] Implement `listMyReleases`
- [x] Implement `getRelease`
- [x] Implement `createRelease`
- [x] Implement `updateRelease`
- [x] Implement `addTrackToRelease`
- [x] Implement `reorderReleaseTracks`
- [x] Implement `removeTrackFromRelease`

## Phase 5: Creator Dashboard
- [x] Add `Releases` area in the creator dashboard
- [x] Add "Create release" action
- [x] Add release type selection:
  - [x] `single`
  - [x] `ep`
  - [x] `album`
- [x] Add release form fields:
  - [x] title
  - [x] release type
  - [x] artist name
  - [x] genre
  - [x] description
  - [x] release date
  - [x] cover art
- [x] Add release management screen
- [x] Add attach existing tracks flow
- [x] Add reorder tracklist flow
- [x] Add focus track selection
- [x] Add save draft flow
- [x] Add publish release flow

## Phase 6: Track Flow Integration
- [x] Update [client/src/features/dashboard/components/track-create-form.tsx](/home/enoch/aworkspace/clients/music-city/client/src/features/dashboard/components/track-create-form.tsx) to support release placement
- [x] Add option: standalone track
- [x] Add option: create new release
- [x] Add option: add to existing release
- [x] Keep current single-track creation flow working
- [x] Ensure track management still works when no release is attached

## Phase 7: Public Listening Experience
- [x] Add releases listing page
- [x] Add release detail page: `/releases/:releaseId`
- [x] Show release cover
- [x] Show release title and artist
- [x] Show release type
- [x] Show release date
- [x] Show ordered tracklist
- [x] Show play actions
- [x] Show purchase/access state
- [x] Update browsing surfaces to include releases, not only tracks

## Phase 8: Artist Discography
- [x] Add artist discography section
- [x] Add albums group
- [x] Add EPs group
- [x] Add singles group
- [x] Add latest release section
- [x] Add release cards on artist pages
- [x] Link tracks back to parent release where applicable

## Phase 9: Rules / QA
- [x] Confirm whether a release can publish while tracks are still processing
- [x] Confirm whether unpublished tracks can exist inside a published release
- [x] Confirm single-track release behavior
- [x] Confirm release cover vs track cover precedence
- [x] Test create album flow
- [x] Test attach tracks flow
- [x] Test reorder tracklist flow
- [x] Test publish release flow
- [x] Test public release page
- [x] Test artist discography rendering

QA note: Verified on July 2, 2026 against a local-media QA stack (`MEDIA_PROVIDER=local`) with headless browser coverage for create, cover upload, attach, reorder, publish, public release, and artist discography flows.

## Phase 10: Playlists After Releases
- [x] Add playlist model after releases are stable
- [x] Add create playlist flow
- [x] Add add/remove track from playlist flow
- [x] Add public/private playlist visibility
- [x] Add playlist detail page

## Recommended First Sprint
- [x] Shared release schemas
- [x] Server release persistence
- [x] Server release routes
- [x] `releasesApi`
- [x] Dashboard release creation page
- [x] Dashboard release management page
- [x] Attach tracks to release
- [x] Reorder release tracks
- [x] Public release detail page

## Sprint Done When
- [x] Creator can create a `single`
- [x] Creator can create an `ep`
- [x] Creator can create an `album`
- [x] Creator can assign tracks to a release
- [x] Creator can order the tracklist
- [x] Creator can publish a release
- [x] Users can open and browse a release page
- [x] Artist pages show releases by type
