# MoonPay widget signing failure

Investigated and corrected locally on 26 October 2026. This resolves widget loading for the authorized XLM sandbox demonstration. It does not complete payment or payout acceptance.

## Root cause

The signed URLs omitted `allowedIpAddress`. This sandbox integration enforces IP matching. MoonPay returned HTTP 400 with `5_PARTNERS_IP_MISSING` and the message `Missing allowedIpAddress on signed URL`. The widget displayed its generic signature failure screen instead of that specific cause.

The configured keys matched the dashboard. HMAC generation matched the official Node SDK. Neither fact tested the additional IP requirement. Temporarily allowing localhost also did not address the missing signed parameter; that temporary domain was removed.

The audit inspected MoonPay's public widget bundle and located its signature-verification request. Reproducing that request exposed the actual rejection. The observed endpoint, `/v3/verify_widget_signature`, was used for diagnosis, not added as a dependency of the application's runtime launch path.

## Correction

`MoonpaySandbox.widgetUrl` now requires customer IP context. The backend canonicalizes addresses, computes the IP HMAC, inserts `allowedIpAddress`, and then signs the complete query. It supports a single address or one address per family for dual-stack devices. Missing and malformed IP context is rejected.

[MoonPay's IP matching guide](https://dev.moonpay.com/widget/on-ramp/customization/ip-matching) describes this binding and address normalization. Its general guidance and omission exceptions do not override the explicit missing-IP rejection observed on this account.

The future authenticated launch route must capture the intended device's address through trusted ingress. Do not accept an arbitrary IP from a request body or blindly trust forwarded headers. Do not use the API server's outbound address for a remote customer. The local diagnostic used MoonPay's own IP observation on the same workstation network and confirmed that it matched the browser's connection. Raw addresses and signed URLs are excluded from repository evidence.

## Verification

Real requests produced these results:

| Request | Result |
| --- | --- |
| Valid signature, missing IP binding | HTTP 400, `5_PARTNERS_IP_MISSING` |
| Correct IP binding and signature, buy | HTTP 200, success |
| Correct IP binding and signature, sell | HTTP 200, success |
| Different IP with a valid signature | HTTP 400, `5_PARTNERS_IP_MISMATCH` |
| IP binding changed without re-signing | HTTP 400, invalid signature |

The real browser opened both adapter-generated sandbox URLs to MoonPay's normal sign-in screen. The buy flow subsequently reached verification. No completed provider payment or payout is claimed. The [sell widget screenshot](moonpay-sell-widget-fixed.jpg) records the successful launch without credentials or customer details.

Ten focused adapter and IP tests passed. Server typechecking passed. The full server suite passed 178 tests with 13 database-dependent skips. This change does not modify persistence or migrations.

## Work still open

Connect protected launch routes with trusted customer IP capture, complete the client and worker integration, and verify the full sandbox buy and sell lifecycle. Stellar USDC remains unavailable in this account's test-mode catalogue. The XLM demonstration remains separate from USDC acceptance. No credentials, live settings, or deployed services changed during this fix.
