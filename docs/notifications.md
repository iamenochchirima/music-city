# Notification reference

Music City writes inbox entries and email deliveries in the same PostgreSQL transaction as the source event. The shared header shows an unread badge and an inbox with links, timestamps, pagination, and read actions. Account settings expose the profile email and optional email preferences.

## Event catalog

| Event                                     | Recipients                                          | Destination       |
| ----------------------------------------- | --------------------------------------------------- | ----------------- |
| Agreement proposed or resubmitted         | Current contributors except the sender              | Agreement         |
| Agreement accepted, rejected, or disputed | Owner and current contributors except the actor     | Agreement         |
| Agreement revision started                | Owner and previous contributors except the actor    | Agreement history |
| Agreement finalized                       | Owner and current contributors, including the actor | Agreement         |
| Release published or publication failed   | Release owner                                       | Studio release    |
| Audio processing finished or failed       | Track owner                                         | Studio            |
| Earnings funded and available             | Beneficiary of each nonzero allocation              | Revenue           |
| Earnings claimed                          | Beneficiary                                         | Revenue           |
| Direct support confirmed                  | Sender and recipient, with separate receipts        | Support history   |
| Purchase or access payment recorded       | Paying account                                      | Account           |

Draft edits, signature preparation, uncertain chain submissions, and social activity do not generate emails. Revision notices describe preparation, and contributors receive an approval request only when the owner submits the new version. A removed contributor can open their previous submitted versions through agreement history.

Agreement, earnings, payment, and processing notifications are transactional. They do not depend on marketing opt-ins. Missing or invalid profile email addresses still receive inbox entries, but have no email delivery. Addresses come from stored profiles, never an agreement request.

The catalog reserves `release.update`, `artist.update`, and `product.update` for optional updates. These require an explicit `true` in the corresponding existing preference. No producer sends these high-volume updates yet. Email workers recheck optional consent and the profile address before sending. Changed addresses and withdrawn consent mark the queued delivery `skipped`; the worker does not redirect existing messages to a new address.

## Persistence and delivery

`notifications` has one row per event key and recipient. Agreement keys use the committed agreement event ID. Other keys use the publication request, recording generation, settlement allocation, support payment, or payment intent. A retry does not recreate an existing notification or enqueue its email again.

`notification_deliveries` stores the recipient address, message, attempts, lease, provider ID, and outcome. The existing media worker also processes email jobs through `notificationWorker.runOne`. PostgreSQL leases use `FOR UPDATE SKIP LOCKED`, and lease tokens prevent a late worker from changing a newer worker's result. Inbox visibility does not wait for the worker.

Delivery retries use exponential backoff capped at five minutes, with a maximum of twelve attempts. A crashed worker's job becomes eligible after its sixty-second lease expires. `sent` means that the provider accepted the request, or that the local sink captured it. It does not confirm mailbox delivery. Bounce tracking is not implemented.

Resend requests reuse the notification ID as the provider idempotency key. [Resend retains these keys for 24 hours](https://resend.com/docs/dashboard/emails/idempotency-keys). The worker stops automatic retries after 23 hours from the first attempt, so an uncertain old delivery cannot silently create a duplicate. These jobs require operator review.

Deleting a recipient profile also deletes that recipient's notifications, email jobs, and sink captures. Source agreement and financial evidence retain their existing lifecycle rules.

## Environment variables

| Variable                      | Default                | Meaning                                                   |
| ----------------------------- | ---------------------- | --------------------------------------------------------- |
| `NOTIFICATION_EMAIL_PROVIDER` | `disabled`             | `disabled`, `sink`, or `resend`                           |
| `NOTIFICATION_EMAIL_FROM`     | Unset                  | Resend sender, such as `Music City <updates@example.com>` |
| `RESEND_API_KEY`              | Unset                  | Resend API credential                                     |
| `CLIENT_ORIGIN`               | Existing client origin | Absolute origin for email links                           |

`disabled` leaves deliveries queued. Missing Resend credentials or sender also leave deliveries queued. The worker logs the configuration error at startup. The API and inbox continue to work.

`sink` writes rendered HTML and plain text to `notification_email_sink` without contacting an email provider. The sink is refused in production. Captures contain email addresses and message content; they are local test data.

`resend` uses the [Resend send-email API](https://resend.com/docs/api-reference/emails/send-email). A verified sender domain and valid provider credentials are required before live delivery can be enabled. The adapter function accepts an injectable implementation for tests and future providers.

## Inbox API

All routes require the existing bearer session token and derive the recipient from that session.

| Route                                           | Behavior                                                 |
| ----------------------------------------------- | -------------------------------------------------------- |
| `GET /api/v1/notifications`                     | Newest fifty items, total unread count, and `nextCursor` |
| `GET /api/v1/notifications?before=<nextCursor>` | Next page, ordered by creation timestamp and ID          |
| `POST /api/v1/notifications/:id/read`           | Mark the recipient's entry read                          |
| `POST /api/v1/notifications/read`               | Mark all of the recipient's entries read                 |

Read operations are idempotent. A foreign or missing notification ID produces no update and returns the same response. Pagination cursors are scoped to the authenticated recipient.

## Verification

`pnpm test:e2e:notifications` starts a disposable local PostgreSQL database, API, worker, and client. The worker uses the local email sink. Docker and a Playwright Chromium installation are required. `NOTIFICATIONS_EVIDENCE_DIR` overrides the screenshot directory, which defaults to `docs/notification-evidence`.

The browser check uses real local authentication, onboarding, agreement, inbox, and profile APIs. It replaces Dynamic wallet hooks at the browser module boundary because local fallback pages have no Dynamic client. It verifies desktop and mobile inbox layout, agreement navigation, read state, and preference persistence. It does not sign agreement responses or verify live provider delivery.

`NOTIFICATIONS_TEST_DATABASE_URL` enables `notifications.integration.test.ts` against an isolated local database whose name ends in `_test`. The suite covers atomic rollback, concurrent idempotency, recipient isolation, pagination, optional consent, missing configuration, sink capture, retry limits, expired leases, and late-worker fencing.
