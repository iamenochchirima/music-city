# Onboarding feedback fixes

Scope: registration, artist profiles and release genre choices. Separate from SOW2 milestones.

- [x] Share one genre catalogue across profiles and releases. Add Traditional, Dance, Kwaito, Amapiano and Maskandi to the prominent onboarding choices. Merge R&B and Soul.
- [x] Ask for genres once. Artists and both-role accounts choose on Artist profile; listeners choose in their final personalization step.
- [x] Move artist recommendations after profile visuals for every account type. Preserve Back, Skip, resume and selected values.
- [x] Replace SoundCloud with Facebook in contracts, forms and stored profile data. Never reinterpret a SoundCloud URL as Facebook.
- [x] Migrate existing genre selections, release snapshots and in-progress onboarding records once. Preserve unrelated fields and completed accounts.
- [x] Test all three registration branches, back navigation, persistence, genre limits and migration idempotency.
- [x] Inspect the revised UI at desktop and mobile widths and save verification evidence.

Deployment is a separate step. Physical mobile browser behavior is outside desktop viewport verification.

## Implemented flow

Artists and both-role accounts: Welcome, Intent, Activation, Artist profile, Visuals, Discover artists, Ready.

Listeners: Welcome, Intent, Visuals, Discover artists, Ready. Favorite genres appear only in Discover artists. Artist genres appear only in Artist profile.

## Verification

- Client suite: 162 passed. Focused onboarding suite: 7 passed.
- Server suite: 160 passed, 12 skipped. The PostgreSQL migration test also passed separately against the local database.
- All workspace typechecks and the client production build passed.
- Browser verification completed all three branches through the real local API. Back navigation retained entries, and completed listener and both-role accounts survived reload.
- The browser used a temporary local session fixture rather than Dynamic sign-in. All temporary files and isolated services were removed or stopped afterward.
- Saved screenshots and results: [verification evidence](onboarding-feedback-evidence/verification.json).

The migration removes retired SoundCloud URLs rather than assigning them to Facebook. It merges R&B and Soul without losing the selection and updates nested published release metadata too. The migration runs once through the existing migration runner.
