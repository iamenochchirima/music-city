# Live deployment verification

Published and verified on 14 October 2026.

| Service | Live site | Result |
| --- | --- | --- |
| Client | https://music-city.vercel.app | Ready. Five-step release workspace included. |
| Admin | https://music-city-admin.vercel.app | Ready. Correct admin API address and first-account setup screen. |
| API | https://server-production-d758.up.railway.app/api/v1/health/ready | HTTP 200. All schema checks pass. |

`deployments.json` records deployment IDs, source commits, and checks. `database-verification.json` confirms that the three existing users, one recording, and zero releases were preserved. A private backup was taken before migration execution. The one-time metadata migration is recorded in `schema_migrations`, and Railway's pre-deployment command skips it on subsequent deployments.

`live-api-verification.json` covers readiness, CORS for both frontend origins, public catalog responses, authentication requirements, and a real signed authentication challenge from a generated test wallet. It also verifies the deployed asset URLs, release-flow code, and exclusion of internal build and backend credentials. This test creates no user profile and moves no funds.

`live-browser-verification.json` records five live Chrome captures. The landing page, release sign-in boundary, client authentication page, admin setup screen, and mobile landing page render without browser exceptions or API server errors. The complete authenticated upload and revision flow was verified against the disposable database documented in `../release-flow-evidence`, rather than creating test releases in the production catalog.

Local checks pass 72 client tests, 106 server tests, and 10 admin tests. Six opt-in server checks skip in the default suite. Explicit database runs pass 10 metadata and revision cases and 20 contributor agreement cases. Typechecks and the server, client, and admin builds pass.

The first administrator account has not been created. Use the setup screen and the `ADMIN_BOOTSTRAP_TOKEN` stored in the Railway server's variables. No administrator password was generated or changed during deployment.
