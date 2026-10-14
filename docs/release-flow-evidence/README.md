# Release flow evidence

The `verification.json` manifest records the Chrome version, verification time, route, viewport, state, and result for each screenshot. The browser uses a disposable PostgreSQL database and real local API uploads.

| Capture | Verified state |
| --- | --- |
| `01-basics.png` | Release basics before creating a saved draft. |
| `02-music.png` | Audio uploaded and attached automatically. |
| `03-information.png` | Song title, credits, ISRC, and label. |
| `04-artwork.png` | Saved cover and release description. |
| `05-review.png` | Ready Single before publication. |
| `06-type-change.png` | Prompt to change a Single before adding another song. |
| `07-upload-retry.png` | Completed audio retained after an attachment failure. |
| `08-music-360.png` through `08-music-1440.png` | Reopened two-song revision at all planned widths. |
| `09-revision-review.png` | Explicit application while the old public Single remains available. |

The runner asserts that the public release retains its original title, one-song tracklist, and song metadata during revision work. The public tracks API retains one recording. After application, the public release is an EP with two recordings and the revised metadata. The runner reports no browser page errors.

Run `pnpm test:e2e:release-flow` to recreate this evidence. This local run uses no production data or live wallet payments.

The current checks pass 70 client tests, 106 server tests, and 10 admin tests. Six opt-in server tests remain skipped in the default suite. Browser runners separately pass 10 PostgreSQL metadata and revision cases and 20 PostgreSQL agreement cases. Workspace typechecks and the client production build pass. The existing large-bundle warning remains.

The metadata, album stress, and onboarding browser suites also pass against the updated navigation. Screenshots use Chrome emulation; physical-device certification and deployment remain separate work.
