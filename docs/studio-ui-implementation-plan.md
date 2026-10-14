# Studio UI implementation plan

The release navigation and creation behavior in this milestone was subsequently replaced by the [five-step release-first workspace](release-flow-implementation.md). Use that document for the current release flow.

Status: Implemented and locally verified on 14 October 2026. All scoped checklist items passed. See the [completion audit](studio-ui-evidence/completion-audit.md) and [browser evidence](studio-ui-evidence/README.md). Created: 14 October 2026.

## Outcome and scope

Create a consistent client design system and rebuild the artist workflows around it. Make upload, track management, release management, and onboarding readable, aligned, and usable on mobile. Use the upload flow as the first complete reference screen.

This milestone covers the client Studio shell, its creation and library entry points, track editing, release editing, and onboarding in both page and modal forms. Keep the dark Music City identity and use emerald for primary actions, selection, and focus.

The admin application, landing page, listener pages, and a full analytics or revenue redesign are separate milestones. Check these client pages when changing shared controls or global styles. Deployment and broader security hardening remain separate work.

Preserve the behavior delivered in the [track credits implementation plan](track-credits-implementation-plan.md). The UI must retain Composer, Author, Producer, Engineer, Publisher, ISRC, and track Record label. Preserve existing roles, optional profile links, draft recovery, release association, activation, payment, and publication rules.

Replace superseded UI as each screen moves to the shared system. Remove unused components and copied styles. Do not keep alternate old screens, compatibility routes, or runtime switches between designs.

## Set up the shared system

Extend the existing components in `client/src/components/ui`. Keep domain behavior in the feature folders. Avoid a second set of buttons and fields for Studio.

| Layer | Files | Responsibility |
| --- | --- | --- |
| Design tokens | `client/src/app/globals.css`, `client/tailwind.config.ts` | Semantic colors, typography, spacing, borders, radii, and focus treatment. |
| Shared controls | `client/src/components/ui` | Buttons, fields, selects, tabs, badges, pickers, and accessible overlays. |
| Studio layouts | New `client/src/components/studio` folder | Page header, form section, step navigation, action bar, and empty or error states. |
| Studio navigation | `client/src/features/dashboard/components/studio-shell.tsx` | Responsive navigation, active route matching, and workspace width. |
| Track metadata | `client/src/features/dashboard/components/track-metadata-editor.tsx` | Compact contributor editing and track identifiers shared by upload and management. |
| Workflow screens | Dashboard and onboarding feature components | Data, validation, progress, save boundaries, and task-specific layouts. |

Use these starting rules for the reference screen. Adjust a token centrally if browser review exposes a problem.

| Rule | Initial specification |
| --- | --- |
| Background | Neutral dark background for Studio. Keep decorative marketing gradients outside the workspace. |
| Color | Semantic background, panel, text, muted text, border, primary, warning, and destructive tokens. Avoid hardcoded slate and emerald overrides in migrated screens. |
| Typography | One client font stack. Page title 28px with 32px line height, section title 18px with 24px line height, body and labels 14–16px. Reserve 12px text for short secondary hints. |
| Spacing | Use 4, 8, 12, 16, 24, 32, and 48px. Align labels, fields, section headings, and action bars to a common grid. |
| Controls | 40px standard field height, at least 44px for mobile action targets. Align buttons and selects with adjacent inputs. |
| Corners | 8px controls and 12px panels. Use pill shapes for badges, not every container. |
| Width | Studio workspace up to 1280px. Guided forms up to 720px. Keep the marketing container separate where its width differs. |
| Grouping | One visual container per section. Use rows and separators inside it instead of a bordered card around every field. |
| Actions | One primary action for the current task. Keep Back secondary and destructive actions separate. |
| Navigation | Desktop sidebar at 1024px and above. Below that, show one compact Studio navigation control. Never render both navigation layouts together. |

Use semantic component variants for size, intent, and state. Feature-level classes can arrange layouts, but must not redefine control colors, height, radius, or focus behavior. Avoid blanket CSS selectors that restyle every input inside Studio.

## Phase 1: Establish the reference and controls

- [x] Capture current upload, track editing, release editing, and onboarding at desktop and mobile widths.
- [x] Use the existing [track credits screenshots](track-credits-evidence/README.md) as additional before evidence, not approved designs.
- [x] Audit `Button`, `Input`, `Textarea`, `Label`, `Card`, `Badge`, `Tabs`, and `SearchablePicker` against the token rules.
- [x] Add a shared `FormField` for visible labels, optional hints, error text, and their accessible associations.
- [x] Add a shared select control for simple options. Keep searchable selection for long lists such as artists and countries.
- [x] Add shared page header, form section, step navigation, and action bar components when the reference screen requires them.
- [x] Define consistent loading, disabled, error, empty, selected, and success states.
- [x] Create a development preview using the actual controls with long labels, errors, and disabled states. Keep fixture content out of production workflows.
- [x] Build the upload reference with these components and review screenshots before extending the patterns to the remaining screens.

The development preview is available at `/dev/studio-components` during `pnpm dev:client`. The production build excludes this route and its fixture component.

Completion requires a working reference screen and usable shared controls. A token file alone does not complete this phase.

## Phase 2: Fix the workspace shell

- [x] Remove duplicate mobile navigation in `studio-shell.tsx`.
- [x] Match Overview only to `/dashboard`. Keep Tracks active on its detail routes and Releases active on its detail routes.
- [x] Add `aria-current` to the active navigation item.
- [x] Use a compact mobile Studio menu with a visible current destination and keyboard support.
- [x] Align page headers and content widths across creation, tracks, releases, analytics, and revenue entry points.
- [x] Coordinate the sidebar and action bars with the existing sticky site header.
- [x] Check long titles, mobile safe areas, and focus visibility after navigation.

## Phase 3: Finish the upload reference

Primary files are `track-create-form.tsx`, `track-metadata-editor.tsx`, and `dashboard-create-overview.tsx` in the dashboard components folder.

- [x] Keep the four steps: Track details, Audio, Credits & identifiers, and Review and save.
- [x] Replace oversized step cards with a compact progress navigation that identifies the current step.
- [x] Group track details into a readable form with consistent label and field alignment.
- [x] Give audio selection, upload progress, processing, and retry distinct states with a clear next action.
- [x] Render contributors as compact role and name rows on desktop, with an intentional stacked layout on mobile.
- [x] Make optional profile linking a secondary action within a contributor row. Hiding that control must preserve its selected value.
- [x] Keep Add contributor visible. Keep removal accessible and restore focus after removing a row.
- [x] Place ISRC and Record label in a separate identifiers section. Show errors beside their fields.
- [x] Use a compact review summary with Edit actions that return to the correct step.
- [x] Preserve metadata through Back, Continue, reload, activation, and failed upload retry.
- [x] Preserve the release context and return destination when uploading from a release.
- [x] Remove duplicated style overrides and superseded upload components.

## Phase 4: Apply the system to track management and libraries

Primary files are `track-manage-overview.tsx`, `dashboard-tracks-overview.tsx`, `dashboard-track-shelves.tsx`, and `dashboard-releases-overview.tsx`.

- [x] Use a clear track header with title, recording status, and release context.
- [x] Group editable details, credits and identifiers, and recording information into defined sections.
- [x] Reuse the upload metadata editor with the same labels, spacing, and validation behavior.
- [x] Make save boundaries explicit. Show whether changes are unsaved, saving, saved, or failed.
- [x] Keep Back to release tied to the track's actual release association.
- [x] Align library rows, status badges, filters, creation actions, and empty states with the shared system.
- [x] Use mobile list layouts that retain essential information without squeezing desktop tables into narrow cards.
- [x] Preserve playback, upload status, and existing edit permissions.

## Phase 5: Rebuild the release workspace

Primary files are `release-manage-overview.tsx` and `release-track-labels.tsx`.

- [x] Separate the workspace into Details, Artwork, Tracks, and Review sections with accessible navigation.
- [x] Keep one shared form state across sections. Switching sections must preserve unsaved edits.
- [x] Keep publication status and the primary action visible without duplicating publication controls throughout the page.
- [x] Give artwork selection, progress, success, and errors a consistent layout.
- [x] Rework the tracklist for the available width. Support track ordering, track editing, and Upload new track on mobile.
- [x] Preserve the existing save-before-upload behavior when navigating to create a track.
- [x] Route readiness errors to the relevant section, then focus the field or action that resolves them.
- [x] Present the track label-copy preview in a focused accessible dialog or panel with readable before and after values.
- [x] Preserve selected tracks, explicit overwrite consent, stale-value checks, and atomic updates in label copying.
- [x] Preserve draft, scheduled, and published state when moving between sections. Keep date and timezone meaning visible.
- [x] Place deletion in a separate destructive section and retain its confirmation.
- [x] Split the large release component along section boundaries. Keep publication and persistence rules in one owner rather than copying them into each section.

## Phase 6: Clean up onboarding

Primary files are `onboarding-form.tsx`, `onboarding-gate.tsx`, `artist-access-gate.tsx`, and `artist-payment-review-dialog.tsx`.

- [x] Apply the shared field, choice, progress, and action patterns to both page and modal onboarding.
- [x] Give each step one clear heading, concise guidance, and a consistent content width.
- [x] Align role choices, genres, countries, social links, and profile uploads.
- [x] Remove nested page panels inside the modal variant.
- [x] Preserve listener, artist, and combined-role branches, optional skips, and completion destinations.
- [x] Preserve referral context, activation offers, waivers, payment review, and persisted profile values.
- [x] Keep modal focus contained and restore focus when it closes. Follow the existing payment flow's dismissal rules.
- [x] Verify that mobile keyboards do not cover the active field or prevent reaching the next action.

## Phase 7: Verify and remove superseded code

- [x] Remove unused components, copied class sets, and redundant layout wrappers from migrated screens.
- [x] Check shared control changes on listener pages and the site header.
- [x] Capture after screenshots beside the before evidence in a new `docs/studio-ui-evidence` folder.
- [x] Record the route, viewport, state, and test result for each screenshot.
- [x] Update this checklist only when the implementation and its checks pass.

## Test the behavior

Add tests for user-visible behavior that changes during the redesign. Keep the existing metadata and payment tests. Do not add tests that merely assert copied class names.

| Area | Required checks |
| --- | --- |
| Navigation | Overview is active only on its route. Detail routes select the correct section. Mobile shows one Studio navigation. Keyboard selection moves to the requested page. |
| Fields | Labels identify controls. Hints and errors have accessible associations. Invalid fields retain input and receive focus when submission fails. |
| Contributors | Add, edit, remove, and optionally link contributors. Test incomplete rows, duplicate entries, long names, and the 32-credit limit. Hide and reopen profile linking without losing data. |
| Upload | Move through all steps with metadata empty and populated. Reload a draft, correct an error, retry a failed upload, and return to the associated release. |
| Track management | Save and reload all seven requested fields. Clear optional values explicitly. Keep unsaved changes visible after a failed request. |
| Release sections | Change sections without losing edits. Readiness links open the correct section. Save before upload navigation. Keep order, schedule, publication state, and label-copy protection intact. |
| Onboarding | Complete listener, artist, and combined-role branches. Verify optional skips, referral context, activation review, and modal keyboard behavior. |
| Server persistence | Re-run the track metadata integration checks to confirm that UI changes retain the existing request and persistence contracts. |

Run the existing commands after the relevant changes:

```bash
pnpm --filter client test
pnpm --filter client typecheck
pnpm --filter client build
pnpm test:track-credits
pnpm test:e2e:track-credits
pnpm test:e2e:studio-ui
pnpm test:e2e:studio-audit
```

Extend the existing browser verification for the new interaction structure. Keep its real local API and database checks. Use controlled authenticated test accounts for UI verification so external wallet interaction does not prevent reviewing layouts. Verify actual payment integration separately if payment behavior changes.

## Check the visual result

Review the real browser at widths of 360, 390, 768, 1024, and 1440px. Include keyboard-only use and 200% zoom. Capture normal, empty, loading, validation-error, failed-save, upload-processing, and fully populated states.

- [x] Keep pages free of horizontal overflow. If a data table requires scrolling, contain it within a clearly defined table region.
- [x] Align fields and actions consistently. Prevent long names, labels, and validation messages from breaking the grid.
- [x] Keep body text contrast at least 4.5:1. Keep large text and essential control boundaries at least 3:1.
- [x] Show a visible focus indicator and identify status with text as well as color.
- [x] Show one primary action for the current task and one Studio navigation at each breakpoint.
- [x] Keep the mobile contributor layout readable without separate oversized cards for every input.
- [x] Keep action bars clear of the site header, browser safe areas, and focused fields.
- [x] Keep errors beside the relevant control and provide a recoverable next action for failed requests.
- [x] Review upload with 32 contributors, release with many tracks, and onboarding with long names and selected genres.
- [x] Compare before and after screenshots for hierarchy, density, alignment, and readability. Passing functional tests alone does not complete visual verification.

## Completion criteria

Complete this milestone when all scoped workflows use the shared design rules, the browser checks pass, and the evidence records the result. Keep every existing metadata, activation, and publication contract working. Leave deployment and the broader hardening milestone for their own plans.

The upload reference established the shared patterns used by track management, release management, libraries, and onboarding. The completion audit maps each requirement to implementation and verification evidence.
