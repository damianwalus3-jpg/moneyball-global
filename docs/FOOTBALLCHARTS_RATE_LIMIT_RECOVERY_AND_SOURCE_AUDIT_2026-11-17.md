# European fixture source and FootballCharts recovery audit — 2026-11-17

## Research findings

- FootyNomad remains the primary fixture index. Its public browse page exposes country-by-country competition coverage; use the daily fixture page as the actual source of today's matches and retain date/status/deduplication checks.
- OpenMatchday is a useful no-key supplemental feed: its public 2026/27 repository reports 75 competitions, daily CSV refresh, fixtures/results, and 8,500+ results / 9,100+ fixtures. Its own README explicitly says coverage is uneven and not all competitions have full-season fixture spines or detailed stats. Do not describe it as complete Europe-wide coverage.
- FootballCharts officially lists 98 leagues across 44 countries. The no-key REST allowance is 25 requests/day per IP. Its free-key allowance is higher but still restricted to personal/research use; use in an app for other people requires a commercial plan. Keep the integration no-key, owner-only, optional, attributed, and do not import its predictions or model outputs into MONEYBALL.
- FootyCheck's public country index advertises 149 countries and 776 leagues in a rolling 7-day fixture index. It is a useful independent coverage-reconciliation candidate, not yet a production adapter: no stable public API contract or clear automated-ingestion permission was verified. Do not scrape or enable it until the source terms and stable feed contract are checked.
- No new paid service or API key was introduced.

## FootballCharts reliability fix

- Previous production scan showed HTTP 429 responses when all eight league endpoints were requested concurrently.
- MAIN now limits FootballCharts fetch concurrency to 2. The owner-scoped durable cache still ensures one provider batch is shared by repeated scans.
- A complete response remains cached for 24 hours. A partial/error response is marked `partial`, remains usable as stale data, and expires after 12 hours so a later scan can recover instead of freezing the partial response for a full day.
- Removed Azerbaijan from the FootballCharts allowlist because the project's geographic-Europe policy excludes it; replaced it with Austria 2. Liga. This avoids spending a scarce provider request on an out-of-scope competition.
- The no-key provider is still supplemental only. It does not replace FootyNomad or OpenMatchday, and its 8-league allowlist is not represented as full 98-league coverage.

## GitHub and deployment state

- Fix commit `471e755f0f110664558839417736ee8b3cda155b`: concurrency limit 2 and partial cache TTL 12 hours.
- Moneyball CI run `44152983223`: SUCCESS; Deno Edge Function type-check, geographic-Europe and all-tier scope tests, bearer-token tests, Vitest, TypeScript check, and build passed.
- Cloudflare MAIN deploy run `44152983292`: SUCCESS.
- Follow-up commit `13e72a479299da3ce2324786912e556728514901`: replace Azerbaijan with Austria 2. Liga. Its CI and Cloudflare deployment are pending at the time of this note.
- Supabase production project: `gzgeklcukrclgwbsmbsp`. `footynomad-sync` version 104 is currently active; it does not yet include the new rate-limit/partial-cache fix.
- `moneyball_provider_cache` has RLS enabled with three owner-scoped policies. The production table currently has zero rows, expected because no authenticated owner scan has been performed since the cache function deployment.

## Still required before acceptance

1. Wait for CI and Cloudflare deployment for commit `13e72a479299da3ce2324786912e556728514901`.
2. Deploy the exact verified MAIN `footynomad-sync` source as the next Supabase Edge Function version, preserving `verify_jwt=true`.
3. The user must authenticate in the existing MONEYBALL MAIN browser session before the owner-scoped POST scan can be run. Then verify cache row creation, cache hit on a second invocation, and no extra FootballCharts provider requests on that second invocation.
4. Complete authenticated visual click-through of Matches and Predictions. Keep issue #77 OPEN until this passes.

No match, prediction, coupon, settlement, bankroll, or historical data was changed during this audit.


## Follow-up deployment and live-feed verification — 2026-11-17 19:05 Europe/Brussels

- Commit `13e72a479299da3ce2324786912e556728514901` (Azerbaijan replaced with Austria 2. Liga) passed Moneyball CI run `44153149957` and Cloudflare MAIN deployment run `44153150085`.
- Deployed exact MAIN `footynomad-sync` source to Supabase as version `105`, ACTIVE, `verify_jwt=true`. Retrieved deployed source and verified concurrency 2, 12-hour partial expiry, Austria 2. Liga, and no Azerbaijan entry.
- Supabase project remains ACTIVE_HEALTHY. No FootballCharts cache rows yet; an authenticated owner POST scan is still required to create and verify the row and subsequent cache hit.
- Production FootyNomad shared feed for 2026-11-17 currently contains 31 eligible fixtures across 4 countries and 9 domestic senior men's leagues: England 21 across 6 leagues; France National 2 1; Northern Ireland Championship 2; Scotland Lowland League 7. All 31 currently have scheduled status. The excluded eighth Scotland fixture is Celtic II (reserve team). This matches the independent FootyCheck public page after excluding cups, youth and reserves; FootyCheck remains a manual reconciliation source, not an automated adapter.
- The scheduled `moneyball-global-free-footynomad` cron is active every 15 minutes; the last ten recorded executions succeeded.
- Cloudflare deployment is complete, but the signed-in UI acceptance test remains blocked by the absence of a saved MONEYBALL MAIN browser login. Keep issue #77 open until the user signs in and the Matches/Predictions screens are checked.
