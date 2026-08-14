# Music City onboarding — implementation plan and completion checklist

This is the onboarding-only implementation source of truth. It covers the listener-first onboarding redesign requested for the demo: listeners, artists, and people who are both; optional profile completion; artist access separation; persistence; migration; media; routing; and verification.

Out of scope: demo accounts, seed data, catalog seeding, search, recommendations, distribution integrations, and unrelated product work.

## Product contract

### Intent

- `primaryIntent: "listener"` — “I’m here to listen”.
- `primaryIntent: "artist"` — “I release music”.
- `primaryIntent: "both"` — listener and artist capabilities.

### Independent state

- `primaryIntent` describes how the person uses Music City.
- `artistAccess` is derived from the existing artist onboarding payment/access source of truth.
- `profileCompletion` is computed from persisted fields; it is not a second boolean flag.
- `onboardingStatus` is `required`, `in_progress`, or `complete`.
- Required to complete: display name and primary intent.
- Everything else is optional and can be completed later.

## Phase 1 — Shared contracts

- [x] Add and export `primaryIntentSchema` and `PrimaryIntent` in `packages/shared/src/auth.ts`.
- [x] Support `listener`, `artist`, and `both` without mapping `both` to another value.
- [x] Keep royalty-recipient `role` separate from product user intent.
- [x] Add onboarding status, step, version, and completion timestamp schemas.
- [x] Add `profileCompletionSchema` with percentage, completed keys, missing keys, and `requiredComplete`.
- [x] Add stable profile-completion item keys.
- [x] Replace product-facing user/session `role` with `primaryIntent`.
- [x] Add `artistAccess`, listener preferences, artist identity fields, and media fields to the shared profile contract.
- [x] Add step-specific schemas for intent, listener personalization, artist identity, visuals, and completion.
- [x] Add canonical `MUSIC_GENRES` and reject unknown onboarding genres.
- [x] Add remove-image flags for replacement/removal flows.
- [x] Add contract tests in `server/src/modules/users/onboarding.contracts.test.ts` covering all intents, invalid values, optional artist fields, social URLs, and session state.

Pointers:

- `packages/shared/src/auth.ts`
- `packages/shared/src/user.ts`
- `packages/shared/src/admin.ts`
- `server/src/modules/users/onboarding.contracts.test.ts`

## Phase 2 — Database and migration

- [x] Add migration `2026-08-14-onboarding-intent-foundation` in `server/src/services/database.service.ts`.
- [x] Add migration `2026-08-14-onboarding-welcome-step` so incomplete users resume on the separate welcome screen.
- [x] Rename legacy `users.role` to `users.primary_intent` conditionally, after base-table setup.
- [x] Backfill `fan → listener` and preserve `artist → artist`.
- [x] Persist `payload.primaryIntent` and remove legacy payload role/payment/completion flags.
- [x] Add `onboarding_status`, `onboarding_step`, `onboarding_version`, and `onboarding_completed_at`.
- [x] Add primary-intent, onboarding-status, and onboarding-step constraints.
- [x] Add primary-intent and onboarding-status indexes.
- [x] Mark existing users complete so local existing users are not unexpectedly blocked.
- [x] Preserve wallet, email, location, media, verification, and payment records during backfill.
- [x] Keep `artistAccess` derived from confirmed payment/access records rather than duplicating it in user state.
- [x] Make the migration idempotent and safe for both legacy and clean schemas.
- [x] Extend schema health to check new columns, constraints, indexes, and migration application.
- [x] Verify the actual local database with `pnpm --filter server db:doctor`.

Pointers:

- `server/src/services/database.service.ts`
- `server/src/scripts/db-doctor.ts`

Verification result: local schema health returned `ok: true`; all relations, indexes, columns, constraints, and migrations were present.

## Phase 3 — Server repository and service

- [x] Read/write primary intent and onboarding columns through the users repository.
- [x] Preserve unrelated payload fields during updates.
- [x] Add `getOnboardingState(walletAddress)`.
- [x] Add `saveOnboardingStep(walletAddress, input)`.
- [x] Add `completeOnboarding(walletAddress, input)`.
- [x] Compute profile completion deterministically from real profile data.
- [x] Enforce display-name and primary-intent requirements server-side.
- [x] Validate email, canonical genres, favorite artist IDs, social URLs, image ownership, content type, and size.
- [x] Allow listener personalization for listener/both only.
- [x] Allow artist personalization for artist/both only.
- [x] Keep artist access independent from onboarding completion.
- [x] Prevent later step saves from regressing persisted progress, while allowing the initial intent to select the branch.
- [x] Make repeated step saves and repeated completion safe; completion timestamp is written once.
- [x] Allow post-onboarding profile edits, including changing listener/artist/both intent without deleting artist profile data.
- [x] Replace active product role checks in tracks, releases, engagement, analytics, dashboard access, public artist listing, admin summaries, and account UI.
- [x] Keep admin and royalty roles unchanged.
- [x] Add onboarding-write rate limiting.

Pointers:

- `server/src/modules/users/users.service.ts`
- `server/src/modules/users/users.repository.ts`
- `server/src/modules/users/users.router.ts`
- `server/src/middleware/onboarding-write-rate-limit.ts`
- `server/src/middleware/error-handler.ts`
- `server/src/modules/{tracks,releases,engagement,admin}/*`

## Phase 4 — API and sessions

- [x] Add authenticated `GET /api/v1/users/me/onboarding`.
- [x] Add authenticated, rate-limited `PUT /api/v1/users/me/onboarding`.
- [x] Add authenticated, rate-limited `POST /api/v1/users/me/onboarding/complete`.
- [x] Use the authenticated session wallet; no client wallet address is accepted for onboarding writes.
- [x] Keep hydrated `GET /api/v1/users/me` for profile reads.
- [x] Separate onboarding writes from the generic profile-edit endpoint.
- [x] Rename the client profile method from `saveMe` to `updateProfile`.
- [x] Return field-level Zod validation errors from the server.
- [x] Map field-level errors into the client API error type.
- [x] Return primary intent, artist access, onboarding state, and profile completion from Dynamic sessions.
- [x] Return the same fields from Stellar sessions.
- [x] Stop deriving completion from user-row existence.
- [x] Remove active product use of `profileComplete` and `artistOnboardingFeePaid`.

Pointers:

- `server/src/modules/users/users.router.ts`
- `server/src/services/dynamic-auth.service.ts`
- `server/src/services/stellar-auth.service.ts`
- `client/src/features/users/lib/users-api.ts`
- `client/src/lib/api/http-client.ts`

## Phase 5 — Client onboarding flow

### Welcome and intent

- [x] Replace “Finish setting up your account” with “Welcome to Music City”.
- [x] Add “This takes less than a minute. You can complete the optional parts later.”.
- [x] Keep welcome details on their own first screen: required display name, optional email, and optional location.
- [x] Use an accessible country picker for the optional country value while preserving the existing persisted location field.
- [x] Keep “How will you use Music City?” on its own separate required intent screen.
- [x] Explain email as being used for release updates and account recovery.
- [x] Explain location as helping surface local artists and music.
- [x] Use an accessible radio group for listener, artist, and both.
- [x] Provide visible selection/focus states and keyboard interaction.
- [x] Save welcome details before advancing, then save intent before entering optional personalization.
- [x] Never derive or prefill display name from email, wallet address, or login-provider identity.
- [x] Reject blank/whitespace-only display names in both client validation and the server contract.

### Listener personalization

- [x] Show favorite genres for listener/both.
- [x] Show public artists for favorite-artist selection.
- [x] Show local-music interest.
- [x] Show release, artist-update, and product notification preferences.
- [x] Keep this step out of the artist-only path.
- [x] Persist the step and provide “Skip for now”.

### Artist personalization

- [x] Show artist identity only for artist/both.
- [x] Use display name as the artist name rather than duplicating an unnecessary name field.
- [x] Add primary genres, biography, social links, and released-music history.
- [x] Explain that artist tools/access are separate from profile completion.
- [x] Persist the step and provide “Skip for now”.

### Visuals

- [x] Offer optional profile image for all intents.
- [x] Offer optional header image for artist/both.
- [x] Validate JPG/PNG/WebP and 10MB maximum before upload.
- [x] Provide previews and explicit size/type guidance.
- [x] Automatically center-crop to avatar or header aspect ratio before upload.
- [x] Provide replace/remove behavior.
- [x] Provide preparing/saving/upload failure states and retry by resubmitting the step.
- [x] Keep image failure optional; it never blocks required completion.
- [x] Protect storage ownership on the server and delete replaced media.

### Completion and routing

- [x] Show “Your listening space is ready” for listeners.
- [x] Route listener primary action to `/discover`.
- [x] Show “Your artist workspace is ready” for artist/both.
- [x] Provide “Complete artist profile”, “Upload your first track”, and “Preview public profile”.
- [x] Route artist studio actions to real destinations.
- [x] Route both users to listening first while retaining a real studio action.
- [x] Record completion only after server confirmation.
- [x] Keep optional profile completion available after onboarding.

Pointers:

- `client/src/features/onboarding/components/onboarding-form.tsx`
- `client/src/features/onboarding/components/onboarding-gate.tsx`
- `client/src/features/onboarding/components/artist-access-gate.tsx`
- `client/src/features/auth/providers/auth-provider.tsx`
- `client/src/features/auth/components/auth-panel.tsx`
- `client/src/app-routes.tsx`

## Phase 6 — Resume, account, and navigation

- [x] Refresh and hydrate the saved onboarding step and all saved optional values.
- [x] Preserve values when navigating Back.
- [x] Keep the gate lightweight after required identity is saved.
- [x] Add “Continue later” after the required first step.
- [x] Replace the modal’s large logout action with a small “Sign out” link.
- [x] Keep `/onboarding` accessible while incomplete.
- [x] Make the gate disappear only after server-confirmed completion.
- [x] Add compact wallet display instead of exposing the full address in the account UI.
- [x] Add an account profile-completion card showing percentage and missing optional items.
- [x] Add a post-onboarding profile review path.
- [x] Allow account users to change listener/artist/both intent later.
- [x] Keep Studio navigation listener-first while exposing Studio for artist/both intent.
- [x] Update account and dashboard copy to use intent/access terminology.
- [x] Remove the unused duplicate onboarding page file.

Pointers:

- `client/src/features/account/components/account-overview.tsx`
- `client/src/components/layout/site-header.tsx`
- `client/src/features/dashboard/components/*`
- `client/src/app/onboarding/page.tsx` (removed duplicate)

## Phase 7 — Automated verification checklist

- [x] `pnpm typecheck` passes for shared, admin, client, and server.
- [x] `pnpm test` passes: 55 tests, 55 passed.
- [x] `pnpm build` passes for shared, admin, client, and server.
- [x] Shared contract tests cover all three intents and invalid values.
- [x] User-service tests cover new listener creation, both-intent persistence, and idempotent completion.
- [x] User-service and contract tests cover welcome-before-intent persistence and blank display-name rejection.
- [x] Payment tests use the independent `artistAccess` result.
- [x] Existing track, engagement, playlist, admin, and playback fixtures use the new profile contract.
- [x] Search confirms no active product references to `profileComplete`, `artistOnboardingFeePaid`, `saveMe`, or user `session.role`/`profile.role` remain.
- [x] `git diff --check` passes.
- [x] `pnpm --filter server db:doctor` passes against the actual local database.
- [x] `GET /api/v1/health` returns `200`.
- [x] `GET /api/v1/health/ready` returns `ok: true` with schema health true.
- [x] Unauthenticated onboarding reads return `401`.
- [x] Client root returns `200` on the running local frontend.

## Phase 8 — Acceptance matrix and handoff

- [x] Listener path is implemented: required identity → optional listener personalization → optional visuals → `/discover`.
- [x] Artist path is implemented: required identity → artist identity → visuals → studio/profile actions.
- [x] Both path is implemented: listener personalization → artist identity → visuals → listening-first completion with Studio available.
- [x] Resume path is implemented from persisted server step and profile fields.
- [x] Failed optional media can be skipped or retried without false completion.
- [x] Existing local users are migrated to completed onboarding and retain their prior intent/payment/profile data.
- [x] No demo/seed-account work is included in this onboarding change.

### Browser-only verification

- [ ] Click through listener, artist, and both paths at 320px/375px/390px/768px/desktop widths.
- [ ] Verify keyboard-only radio selection, Back, Skip, Continue later, and completion actions.
- [ ] Verify screen-reader labels, focus movement, error announcements, and reduced-motion behavior.
- [ ] Verify real image selection, crop preview, replacement, removal, upload retry, and mobile keyboard behavior.

The browser-only items are the remaining environment-dependent checks. The in-app browser was unavailable during this run; the running frontend/server, API protection, database schema, automated tests, and production builds were verified directly.

## Definition of done

- [x] Primary intent is listener, artist, or both.
- [x] Artist access is separate and payment/access controlled.
- [x] Profile completion is computed from persisted fields.
- [x] Optional onboarding data can be skipped and completed later.
- [x] Existing local users are protected by an idempotent migration.
- [x] Shared contracts, database, server APIs, sessions, client state, routing, and account UI agree.
- [x] Automated verification and production builds pass.
- [ ] Browser-only visual/accessibility acceptance is pending an available browser session.
