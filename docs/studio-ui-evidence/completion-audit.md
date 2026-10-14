# Studio UI completion audit

The release navigation and creation behavior in this milestone was subsequently replaced by the [five-step release-first workspace](../release-flow-implementation.md). Use that document for the current release flow.

Audit date: 14 October 2026. Scope: the client workflows listed in `docs/studio-ui-implementation-plan.md`.

## Verify the requirements

| Requirement | Implementation evidence | Verification evidence |
| --- | --- | --- |
| Shared styling and controls | Semantic Studio tokens in `client/src/app/globals.css`; shared buttons, fields, selects, checkboxes, choices, pickers, dialogs, progress, and cards in `client/src/components/ui`. | Component preview at five widths. `audit-verification.json` records computed contrast and focus checks. |
| Reusable page layouts | `client/src/components/studio` contains page and step headers, sections, navigation, action bars, library rows, statuses, and empty states. | Upload, track editing, release editing, libraries, and onboarding screenshots use these components. |
| One responsive Studio navigation | `studio-shell.tsx` hides the sidebar below 1024px and the compact selector above it. Overview uses an exact route match. | Shell tests and visible-navigation browser assertions at the planned breakpoints. |
| Readable upload steps | `track-create-form.tsx` keeps four steps, field errors, audio validation, progress, retry, and the release return context. | Upload tests and `browser-verification.json`. The audit covers a failed upload, cleanup, retry, and 32 credits. |
| Accurate recording status | `track-upload-result.tsx` uses the completion response to distinguish ready audio from processing. | Upload completion test and the passive processing example screenshot. The processing example sends no fixture values to the API. |
| Compact contributor editing | `track-metadata-editor.tsx` reuses fields, selects, and searchable profile selection. Optional profile controls preserve identifiers when hidden. | Metadata editor tests, profile identifier selection test, and the upload browser run. |
| Track editing and save boundaries | `track-manage-overview.tsx` owns one save action and visible unsaved, saving, saved, and failed states. | Edit, reload, clear, retry, focus, and release-return checks. |
| Consistent libraries | Track and release libraries use shared rows, headers, statuses, filters, and empty states. | Library tests plus desktop and mobile screenshots. Playback and processing refresh callbacks remain covered. |
| Release sections and state | The release owner keeps one state across Details, Artwork, Tracks, and Review. Artwork and track responses preserve unrelated unsaved fields. | Release tests cover section changes, artwork responses, and failed navigation saves. |
| Release order and publication | The release owner saves details and changed order before publication. Readiness opens and focuses the relevant section. | Real 12-track reorder, schedule, and publication checks in `audit-verification.json`. |
| Independent track labels | `release-track-labels.tsx` retains explicit selection, overwrite consent, stale-value checks, and refresh. | Browser label-copy checks and nine PostgreSQL metadata integration cases. |
| Page and modal onboarding | `onboarding-form.tsx` uses the shared fields, choices, progress, and actions. `onboarding-gate.tsx` retains the completion screen until a destination is chosen. | All six intent and presentation combinations in `onboarding-verification.json`. |
| Profile and referral persistence | Onboarding preserves country, preferences, biography, links, images, activation receipts, and invitation receipts. | Real API and database assertions after reload and completion. Referral attribution increments once. |
| Payment behavior | Payment review retains balance and asset checks, explicit confirmation, and dismissal protection while paying. | Payment review and checkout tests. Sponsored onboarding requests no payment intent or wallet balance. |
| Keyboard and modal behavior | Shared dialogs contain focus, restore it after closure, and block dismissal when busy. Pickers support both arrow directions and Escape. | Dialog, picker, gate, and browser focus checks. Reduced-height onboarding checks keep actions reachable. |
| Responsive and zoom layouts | Forms use bounded widths, rows wrap, and action bars include the bottom safe-area inset. | Widths 360, 390, 768, 1024, and 1440px. Desktop zoom layout uses 720 CSS pixels at 2x device scale for a 1440-pixel display. |
| Long content and visual states | Recording names and filenames wrap outside native fields. The libraries omit status placeholders from duration text. | 32 contributors, an unbroken contributor name, a long filename, 12 tracks, five selected genres, and loading, error, empty, progress, and success captures. |
| Shared-control regressions | Listener pages and the site header retain their existing flows. Analytics and revenue receive the shared header without a full internal redesign. | Mobile overflow and rendering checks on discovery, artists, playlists, a published release, analytics, and revenue. |
| Developer fixtures stay out of production | The component preview route and lazy import exist only when `import.meta.env.DEV` is true. Processing examples are inert. | Production JavaScript contains no preview-route or fixture markers. |
| Superseded UI is removed | The release's long form, desktop table, duplicate publication actions, duplicate mobile navigation, separate title save, and repeated contributor panels are replaced. | Source inspection and `git diff --check`. No old-screen route or design switch remains. |

## Review the visual evidence

The before evidence is in `docs/track-credits-evidence` and `docs/early-user-discount-evidence`. The current captures are in this folder. The reviewed differences include the following changes:

- Replace the simultaneous sidebar and mobile tabs with one navigation layout.
- Replace contributor cards with rows and secondary profile linking.
- Separate the release's large scroll form into four sections.
- Replace the narrow release table with responsive rows.
- Use consistent label spacing, control heights, focus rings, and action boundaries.
- Remove repeated title saves, repeated duration placeholders, and the Ready-screen action that reopened completed onboarding.

The JSON manifests record the route, viewport, state, and result for each capture. The test result refers to the completed verification run. The screenshots also received visual review for hierarchy, density, alignment, wrapping, and readable actions.

## Record the checks

The client suite passes 66 tests. The server suite passes 103 cases and the admin suite passes 10 cases. Six opt-in server checks are skipped by the default suite. The UI verification runners separately execute nine PostgreSQL metadata cases and 20 PostgreSQL agreement cases.

Workspace typechecks and the client production build pass. The existing large-bundle warning remains outside this UI milestone. The three browser manifests report no page errors.

Run the browser suites sequentially. Each suite owns a disposable PostgreSQL container and local services. Building shared package output during an active Vite verification run can reload the page and interrupt its interaction state.

```bash
pnpm test
pnpm typecheck
pnpm --filter client build
pnpm test:track-credits
TRACK_CREDITS_EVIDENCE_DIR="$PWD/docs/studio-ui-evidence" pnpm test:e2e:track-credits
pnpm test:e2e:studio-ui
pnpm test:e2e:studio-audit
```

Verification is local. Browser zoom and the mobile keyboard space are emulated through effective viewport and device scale. Payment review uses controlled wallet-balance responses in tests. These checks do not move live funds or certify physical-device behavior. Deployment and broader hardening remain separate milestones.
