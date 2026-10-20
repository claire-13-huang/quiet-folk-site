# Quiet Folk private analytics

Independent Cloudflare Worker and D1 service. Public invitation visuals stay in the existing Vite app. Collection is allowed from `https://october-with-you.vercel.app` and `https://claire-13-huang.github.io` (the `/quiet-folk-site` path is not part of a browser Origin).

## Run and release

```sh
npm ci
# Create .dev.vars locally with ADMIN_PASSWORD=<at least 32 random characters>.
npm run migrate:local
npm run dev
npm run migrate:remote
# Keep the JSON secrets file outside the repository, readable only by its owner.
npx wrangler deploy --secrets-file /absolute/private/path/analytics-secrets.json
```

`ADMIN_PASSWORD` is a Worker secret. The username is `admin`. All `/admin` pages, assets and APIs require HTTP Basic authentication over HTTPS. Missing or short secrets fail closed. Browser credentials stay out of dashboard scripts. Worker observability is disabled; neither the schema nor the code stores raw IP addresses or raw user-agent strings. Country/region come from Cloudflare request metadata, without geolocation API calls.

## Metrics

24H, 7D and 30D are rolling periods based on session start. Total visits counts sessions; visitors counts distinct anonymous identifiers within the period. Anonymous IDs persist in each site's localStorage; separate origins cannot share that storage. Average session is visible-page time, sent every 30 seconds and on hiding/exiting. Browser closing without a final beacon may lose up to a heartbeat interval. A session is complete only when all seven funnel events exist. Funnel counts require every preceding step; videos that fail to load are never recorded as completed. The dashboard shows Completed only for all seven steps; otherwise Partial. Session detail distinguishes a reported end from inferred inactivity.

The existing invitation has no replay button; browser reloads record `replay` and start a fresh session. Food choice values are validated against the invitation's existing choices. Recent sessions shows the latest 100 in the selected period. No demo visits are seeded in production.

Collection failures are isolated from invitation actions. Session IDs and event IDs are random UUIDs; duplicate event IDs do not create duplicate timeline entries. Active duration is cumulative and increases monotonically, capped to elapsed server time and 24 hours.

## Identity and test traffic

Visitor IDs are read before generating a new ID and only written when absent. If localStorage cannot persist identity, tracking stops rather than counting a different visitor every visit. New sessions reuse the same visitor ID within each frontend origin. Admin paths never initialize tracking.

The Chinese dashboard hides test visits by default across every metric, chart, funnel and table. The detail drawer can mark or unmark all visits for one exact visitor ID and origin. New sessions inherit that test marker. Migration 0002 labels only the two exact sessions from the first deployment QA; no production data is deleted.

## Invitation email notifications

Apply `0003_email_notifications.sql` before releasing the Worker. New accepted visits enqueue one acceptance email and one later summary, independently of visitor identity. Food choice or page exit brings the summary forward; otherwise it is due after ten minutes. Missing choices are reported as unconfirmed. A minute cron delivers the durable queue. Eight failed attempts leave an explicit `failed` record. Email payloads are frozen for retries and Resend idempotency keys prevent duplicate deliveries. Existing visits are not backfilled.

Set Worker secrets `RESEND_API_KEY` and `NOTIFICATION_TO` using a local private secrets file; `RESEND_FROM_EMAIL` must contain the verified Resend sending address. The Resend test sender can deliver only to the account owner's email; other recipients require a verified sending domain. No credentials or recipient address belong in frontend source. Without these secrets, notices remain queued, and email delivery is not enabled. An API email ID proves provider acceptance, not inbox delivery.

## Notification progress and transient IP

Email completion requires exactly come_in, scene01_complete, envelope_open, invitation_yes, meeting_confirm, food_choice, secret_letter_open. Each session has at most one completed notification, subject 她看到最后了 ♡. Device, browser, region and active duration come from stored session facts. CF-Connecting-IP is read only by the Worker and passed into detached delivery for that session; unavailable IP is explicitly labelled unavailable, never inferred identity. No raw IP column is stored in analytics. The existing outbox freezes encrypted email payloads for retries and erases them on success or terminal failure. Cron-only recovery cannot recover an unavailable IP. Pending payload encryption uses ADMIN_PASSWORD; drain pending notices before rotating that secret.

## Private room letters and feedback

Apply migration 0006 before deploying this Worker. POST /room/private-letter saves an immutable private letter. POST /room/feedback saves rating-only updates immediately, then seals the same feedback row with the optional message. UUIDs are stable per record and its retries; each record keeps its original visit identity across browser back/forward restoration. Only the two invitation origins are accepted. ROOM_DEV_ORIGIN is a local-development override and is not set in production.

Private prose is stored only in private_letters and is never sent to analytics or email. Feedback is stored separately in feedback. Sealing feedback queues one Resend notification to the existing configured recipient; save acknowledgement depends on database persistence, never email availability. Cron repairs missing outbox entries and retries failures with an idempotency key. Test feedback does not enqueue mail. Mark the test session before its first room write; the original invitation notification system has separate test-traffic behavior, so intercept /collect during browser QA.

The existing authenticated dashboard links to /admin/room-notes, which separately displays private letters and feedback. The corresponding /admin/api/room-notes endpoint is also protected. Ordinary statistics never contain either body. No private text is saved in localStorage or console logs. Local SQLite checks: node --test test/room-notes.test.mjs (Node 22 or newer).
