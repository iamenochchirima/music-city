# Music City Instawards Evidence Index

Audit date: 21 July 2026  
Audited commit: [`53910ed4a533f9f10d6c81f8cf30bd212243606f`](https://github.com/music-city/music-city/tree/53910ed4a533f9f10d6c81f8cf30bd212243606f)

## Verified current baseline

| Capability | Status | Evidence |
| --- | --- | --- |
| Public code repository | Present locally; public visibility needs a logged-out check | <https://github.com/music-city/music-city> |
| Stellar wallet integration | Implemented | [`app-providers.tsx`](https://github.com/music-city/music-city/blob/53910ed4a533f9f10d6c81f8cf30bd212243606f/client/src/components/layout/app-providers.tsx), [`use-stellar-checkout.ts`](https://github.com/music-city/music-city/blob/53910ed4a533f9f10d6c81f8cf30bd212243606f/client/src/features/payments/hooks/use-stellar-checkout.ts) |
| Artist/track creation and upload flow | Implemented | [`track-create-form.tsx`](https://github.com/music-city/music-city/blob/53910ed4a533f9f10d6c81f8cf30bd212243606f/client/src/features/dashboard/components/track-create-form.tsx), [`uploads.service.ts`](https://github.com/music-city/music-city/blob/53910ed4a533f9f10d6c81f8cf30bd212243606f/server/src/modules/uploads/uploads.service.ts) |
| Streaming/playback sessions | Implemented | [`playback.service.ts`](https://github.com/music-city/music-city/blob/53910ed4a533f9f10d6c81f8cf30bd212243606f/server/src/modules/playback/playback.service.ts) |
| Qualified stream tracking | Implemented and tested | [`engagement.service.ts`](https://github.com/music-city/music-city/blob/53910ed4a533f9f10d6c81f8cf30bd212243606f/server/src/modules/engagement/engagement.service.ts), [`engagement.service.test.ts`](https://github.com/music-city/music-city/blob/53910ed4a533f9f10d6c81f8cf30bd212243606f/server/src/modules/engagement/engagement.service.test.ts) |
| Platform subscription payment flow | Implemented and tested | [`subscriptions.service.ts`](https://github.com/music-city/music-city/blob/53910ed4a533f9f10d6c81f8cf30bd212243606f/server/src/modules/subscriptions/subscriptions.service.ts), [`payments.service.test.ts`](https://github.com/music-city/music-city/blob/53910ed4a533f9f10d6c81f8cf30bd212243606f/server/src/modules/payments/payments.service.test.ts) |
| Versioned off-chain track splits and royalty ledger | Implemented and tested | [`royalties.service.ts`](https://github.com/music-city/music-city/blob/53910ed4a533f9f10d6c81f8cf30bd212243606f/server/src/modules/royalties/royalties.service.ts), [`royalties.service.test.ts`](https://github.com/music-city/music-city/blob/53910ed4a533f9f10d6c81f8cf30bd212243606f/server/src/modules/royalties/royalties.service.test.ts) |
| Stellar treasury payout execution and reconciliation | Implemented and tested | [`stellar-payout.service.ts`](https://github.com/music-city/music-city/blob/53910ed4a533f9f10d6c81f8cf30bd212243606f/server/src/modules/royalties/stellar-payout.service.ts) |
| Funded Stellar Testnet treasury with USDC trustline | Verified through Horizon on 21 July 2026 | [Treasury account](https://stellar.expert/explorer/testnet/account/GCW3HD5EBMVNBGOWCPTP3WNYXXT5OYB2UIMKDNSL3IZRGLVMU4OEKFWO) |
| Successful outbound testnet USDC payment | Verified: 3 USDC, 14 July 2026 | [Transaction `058bab…8e63`](https://stellar.expert/explorer/testnet/tx/058bab23795850e40565704ea07fc7641ce13947070a67437ee3f568de1c8e63) |
| Static verification | Passed on 21 July 2026 | `pnpm typecheck` completed for shared, admin, client, and server |
| Runtime tests | Passed on 21 July 2026 | `pnpm test`: 47 passed, 0 failed, 0 skipped |
| Soroban contract tests | Passed on 21 July 2026 | `pnpm contract:test`: 6 passed, 0 failed |
| Soroban royalty registry | Deployed and verified on Stellar Testnet | [Contract `CD2ONB…ACNF3`](https://stellar.expert/explorer/testnet/contract/CD2ONBXRTTPKFHNOI2BV3UYUZOOC75R5LPUPCLSRDZHUWM5OAQVACNF3) |
| Soroban split publish/read-back | Verified through the Music City backend integration | [Transaction `960ccef…9a98b`](https://stellar.expert/explorer/testnet/tx/960ccef9c9b5d2d7c9ed2b3721be3884ba464722278044fb32941a685059a98b) |
| Production build | Passed on 21 July 2026 | `pnpm build`: shared, admin, client, and server completed; the client emitted non-fatal bundle-size/dependency warnings |

## Material gaps

| Item | Current state | Submission treatment |
| --- | --- | --- |
| Soroban contract source | Complete | Contract source, six tests, and reproducible build are in `contracts/` |
| Soroban testnet contract ID | Complete | `CD2ONBXRTTPKFHNOI2BV3UYUZOOC75R5LPUPCLSRDZHUWM5OAQVACNF3` |
| Soroban publish/read-back integration | Complete | Backend APIs and admin controls publish, persist, compare, and link registry evidence |
| Arweave/Irys upload | Not implemented; documentation describes only a future optional encrypted Arweave archive | Exclude it from this sprint unless the Chapter Lead explicitly requires the original scope |
| Public application URLs | Not found in repository configuration | Founder must add client, API, and admin access before submission |
| Demo video and screenshots | Not yet collected in this pack | Capture using `demo-capture-checklist.md` |
| Founder biography and role history | Not supplied | Add a 80–120 word bio and relevant build experience |
| Chapter engagement | No meeting, workshop, office-hour, or progress-update evidence supplied | Add dates and links/screenshots showing sustained Southern Africa chapter participation |
| KYC readiness | Not confirmed | Confirm legal name, country/residency, ID/address-document readiness, and disbursement wallet privately through the official process |
| Award history | Not supplied | Confirm whether Music City or the builder has received any prior Instawards and their amounts/scopes |
| Sprint authorization | Proposed dates have not been confirmed | Chapter Lead and builder must agree on a current 30-day period before submission |

## Reviewer-safe wording

Use these claims:

- “Qualified streams are recorded and contribute to auditable royalty accounting.”
- “Music City executes batch royalty payouts over Stellar; a successful 3 USDC testnet payout is publicly verifiable.”
- “Music City uses a deployed Soroban contract as its canonical royalty-split registry and verifies the application record against it.”
- “Media currently uses Mux/S3-compatible delivery, with optional encrypted archive groundwork.”

Avoid these claims until the new deliverables are complete:

- “Every stream immediately triggers an on-chain payment.”
- “Audio is stored on Arweave through Irys.”
- “The application is production-ready or live on mainnet.”
- “Artists are guaranteed royalties merely by uploading.”

## Administrative evidence still to request from the founder

- Public product URLs and temporary reviewer access, if required.
- A short founder bio and current city/country.
- Links or screenshots for chapter participation and feedback from Yaliwe Mlambo.
- Confirmation of prior SCF/Instawards applications or awards.
- Confirmation that the legal/KYC name is exactly “Enoch N. Chirima,” or the correct legal form.
- The public Stellar address intended for award disbursement. Do not place a secret key or seed phrase in this repository or Airtable narrative.
- Consent to use the project name, screenshots, and demo for program review/publicity under the applicable rules.
