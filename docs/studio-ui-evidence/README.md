# Studio UI verification evidence

The release navigation and creation behavior in this milestone was subsequently replaced by the [five-step release-first workspace](../release-flow-implementation.md). Use that document for the current release flow.

Status: Locally verified on 14 October 2026. See the [completion audit](completion-audit.md) for requirement coverage and verification limits.

The upload reference, track editor, release workspace, and catalog libraries use the shared controls. Browser checks use Chrome 154, an isolated PostgreSQL database, local media storage, and a real signed test account. No production data changes are required.

## Verified behavior

- Upload and reload all requested track metadata, including optional empty metadata.
- Preserve drafts and reselect audio after reload.
- Show optional profile controls and retain keyboard focus after contributor removal.
- Save and reload edited track metadata.
- Keep release label-copy protections and track identifiers independent.
- Retain unsaved details across release sections and preserve them after artwork responses.
- Open Artwork and focus its field from a publication requirement.
- Contain modal keyboard focus and restore focus on closure.
- Create a release through the browser and open its workspace.
- Save a release draft before navigating to upload a track with return context.
- Render exactly one visible Studio navigation at widths of 360, 768, 1024, and 1440px.
- Keep upload within the viewport at those widths and at 390px.

The browser run reports no page errors. All 66 client tests pass. Tests cover failed saves, profile-link persistence, active navigation, keyboard picker selection, section state, schedule selection, publication save order, status filtering, and playback or refresh actions. Every listener, artist, and combined-role branch passes in both page and modal onboarding. The audit also covers 32 contributors, a 12-track release, five selected genres, and 200% desktop zoom layout.

## Screenshots

| File | State |
| --- | --- |
| `upload-metadata.png` | Desktop upload with six contributor rows and identifiers. |
| `upload-metadata-mobile.png` | Upload at 390px. |
| `upload-metadata-360.png` | Upload at 360px. |
| `upload-metadata-768.png` | Upload at 768px. |
| `upload-metadata-1024.png` | Upload at the desktop navigation breakpoint. |
| `upload-metadata-1440.png` | Wide desktop upload. |
| `upload-review.png` | Review before saving the recording. |
| `saved-track-metadata.png` | Saved desktop track editor. |
| `saved-track-metadata-mobile.png` | Mobile track editor after contributor removal and save. |
| `release-label-preview.png` | Record-label copy in the shared dialog. |
| `release-label-preview-mobile.png` | Mobile copy dialog with keyboard wrapping checked. |
| `release-details.png` | Release details and independent label editing. |
| `release-artwork.png` | Empty artwork section reached through a readiness requirement. |
| `release-review.png` | Publication checklist before artwork is available. |
| `release-tracks-360.png` through `release-tracks-1440.png` | Tracklist checked at each planned breakpoint. |
| `release-tracks-empty-mobile.png` | A newly created release with no tracks. |
| `track-library.png`, `track-library-mobile.png` | Desktop and mobile recording libraries. |
| `release-library-mobile.png` | Mobile release catalog with status filter. |
| `release-create-mobile.png` | Compact draft creation. |

Read `browser-verification.json` for the browser version, timestamp, and route and viewport of each capture. Dialog screenshots capture the viewport because their background is inert. Compare the screenshots with `../track-credits-evidence` for the previous layout.

## Repeat the browser checks

```bash
TRACK_CREDITS_EVIDENCE_DIR="$PWD/docs/studio-ui-evidence" pnpm test:e2e:track-credits
TRACK_CREDITS_EVIDENCE_DIR="$PWD/docs/studio-ui-evidence" pnpm test:e2e:studio-ui
TRACK_CREDITS_EVIDENCE_DIR="$PWD/docs/studio-ui-evidence" pnpm test:e2e:studio-audit
```

## Onboarding and component preview

`onboarding-verification.json` records all six page and modal combinations. The browser uses real signed accounts, the local API, and PostgreSQL persistence. The checks cover the following behavior:

- Persist display names, country, preferences, biography, and social links through reload and completion.
- Prepare, upload, and persist profile and header images through the real media API.
- Keep the sponsored activation offer and receipt. Request no payment intent or wallet balance during sponsored registration.
- Preserve an artist invitation through identity submission and count the completed artist once.
- Keep the completion screen visible in a modal until the user chooses a destination.
- Contain keyboard focus and prevent dismissal on required steps.
- Reach the final action with keyboard focus in a viewport reduced to 360px height, which simulates the space available above a mobile keyboard.
- Show a profile-load retry after an injected network failure, and focus identity validation errors.

The screenshot names identify each intent, mode, and step. `components-360.png` through `components-1440.png` show the actual shared controls at the planned widths. The production build excludes the preview component and route. Payment review tests separately verify balance gating, explicit confirmation, and dismissal protection while payment is pending. No live funds were moved for these UI checks.

Repeat onboarding verification with `pnpm test:e2e:studio-ui`.

## Stress, contrast, and regression checks

`audit-verification.json` records the additional captures and assertions:

- Upload 32 contributors with long names and a long audio filename. Trigger validation, fail one request, clean up, and retry successfully.
- Create a 12-track album with artwork, reorder it on mobile, schedule it, and publish it through the real local API.
- Check track editing, release editing, and onboarding at a desktop zoom layout equivalent to 200%: 720 CSS pixels at 2x device scale for a 1440-pixel display.
- Check discovery, artist browsing, playlists, a published release, analytics, and revenue for rendering and mobile overflow.
- Inspect focus visibility and measured contrast from computed browser styles.

| Measured combination | Contrast ratio | Required minimum |
| --- | --- | --- |
| Input text | 17.16:1 | 4.5:1 |
| Muted text | 8.65:1 | 4.5:1 |
| Input boundary | 3.36:1 | 3:1 |
| Primary action | 8.35:1 | 4.5:1 |

These checks use Chrome emulation rather than a physical mobile keyboard or device. Payment review uses controlled balance tests; no live funds moved. Deployment and broader hardening remain separate milestones.

Each verification runner creates and removes its own database and services. Run them sequentially: rebuilding shared output while another browser run is active can trigger a development reload.
