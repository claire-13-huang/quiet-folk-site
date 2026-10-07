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
