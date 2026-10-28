# Local Sandbox account verification, 29 October 2026

This note records browser checks against the local application. It separates current Sandbox and local results from the historical Testnet lifecycle in [E8](README.md).

## Environment

The client ran at `http://localhost:3000`. The API ran at `http://localhost:4339` against a disposable PostgreSQL clone. The readiness endpoint reported `ok: true`, a healthy database, and all required schema groups applied.

Dynamic used its Sandbox environment. The wallet service used Stellar Testnet. No production provider or payment credentials were used for this check.

## Test accounts

Ngoni and Kwame signed in through Dynamic Sandbox. Kwame's account showed the existing Core Journey purchase and prior payment history. The earlier accepted 70/30 agreement, purchase, settlement funding, and both claims are recorded in E8. After wallet loading completed, the account page and Stellar Testnet Horizon showed 9,999.9969 XLM and 0.0073 USDC, with the expected USDC trustline. This balance was not spent during this check; no new purchase or claim was created.

During loading, the wallet summary briefly displayed zeros and an enable-USDC prompt before the balance request completed. The client now displays neutral placeholders and withholds trustline status until the account response arrives. Computer-use checks observed both the loading and settled states.

A new Sandbox listener completed the onboarding flow. Its wallet had no Testnet funds or USDC trustline, so it could not buy a track or use wallet-funded features.

## Funding and cash-out

Kwame's account showed both MoonPay and MoneyGram as unavailable. The Add funds and Cash out buttons were disabled. Transaction history showed a cancelled local GBP fixture after reload. No provider session, quote, payment, or payout was created.

The local admin page redirected to its sign-in screen. The API reported `bootstrapRequired: false`, and no existing admin credentials were available for this test, so the authenticated admin browser remained inaccessible. Earlier automated authorization tests and the simulated admin browser check remain recorded in the implementation plan.

## Playback check

The cloned database did not include its local media files. The test used disposable synthetic audio tones in the isolated media directory. It did not copy or replace real recordings.

The browser loaded and played the test audio. Before the code fix, a one-second clip increased the stream count because the server accepted half of a short track. Commit `1e49dfd` removed that fallback. After the fix, playing the one-second clip left the count unchanged, while playing the six-second clip added one stream.

This playback check is separate from SOW 2 ramp acceptance.

## Verification and limits

`pnpm test` passed 215 server, 194 client, and 22 admin tests. Thirteen database-backed server tests were skipped by the default command. Workspace typechecks and builds passed. The focused wallet loading-state change passed the client tests and typecheck, and the client production build passed with its existing large-chunk warning.

The current browser state was inspected, but this run did not save a screenshot artifact. E8 contains the screenshots and chain records for the earlier full lifecycle. This run did not submit a new Testnet wallet transaction. It did not complete MoonPay or MoneyGram sandbox flows.

The local account check verifies that the app keeps unavailable provider actions disabled and shows existing wallet and transaction history. It does not complete the on-ramp or off-ramp lifecycle. C2, C3, U2, U4, R1 through R9, and V5 remain open.
