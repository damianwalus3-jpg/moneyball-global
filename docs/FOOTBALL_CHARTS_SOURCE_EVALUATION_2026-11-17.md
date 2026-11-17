# Football Charts source evaluation — 2026-11-17

## Decision

Use Football Charts only as a private, owner-only fallback for a small set of European national domestic tier-1/tier-2 fixtures. Do not use its probabilities as MONEYBALL predictions. Do not expose the source through the public aggregator or to other app accounts.

## Verified source details

- API base: https://footballcharts-backend.onrender.com/api/v1
- Official docs: https://www.football-charts.com/developers
- Terms: https://www.football-charts.com/terms
- Catalogue: 98 leagues, 44 countries; 31 UEFA associations in the European subset.
- No-key limit: 25 requests/day per IP, 20/min. Free key: 200/day after email confirmation, but no key is used.
- API data refresh: once daily after overnight run, about 06:00 UTC.
- Fixture endpoint: GET /leagues/{league}/fixtures/; upcoming fixtures for the next few days, no date parameter. MONEYBALL filters by requested Europe/Brussels date.
- API timestamps are UTC. The importer converts them to Europe/Brussels day and stores UTC ISO timestamp.
- Free tier is for personal/private use with attribution. Commercial plan required if other people use the app/site/bot. Raw API responses may not be redistributed.
- No free-tier odds and no free-tier per-match xG/shots/passes. Provider model predictions are included in responses but intentionally discarded.

## Exact allowlist

| API code | Country | Competition | Tier |
|---|---|---|---:|
| azer | Azerbaijan | Premier League | 1 |
| bulgaria1 | Bulgaria | efbet League | 1 |
| estonia | Estonia | Meistriliiga | 1 |
| hungary1 | Hungary | NB I. | 1 |
| hungary2 | Hungary | NB II. | 2 |
| latvia | Latvia | Virsliga | 1 |
| lithuania | Lithuania | TOPLYGA | 1 |
| serbia1 | Serbia | Mozzart Bet Super Liga | 1 |

All other Football Charts catalogue entries are excluded until independently verified as national senior-men tier 1/2. This prevents accidental inclusion of women's leagues, youth, third tiers, regional divisions and exhibition competitions.

## Live endpoint probes

All eight endpoints returned valid JSON without an API key.
- 17 Nov 2026: zero same-day fixtures among these eight competitions.
- Upcoming fixtures were present for 20–23 Nov in Bulgaria, Azerbaijan, Hungary and Serbia.
- Hungary NB II returned fixtures for 21–22 Nov.
- Estonia next-known fixture: 22 Nov; Lithuania next-known fixture: 21 Nov.
- Latvia returned no fixtures in the next three days.
- This validates the API response and future fixture schedule, not the authenticated MONEYBALL import.

## Implementation

- Code commit: 2d1ae325a7d8ad4bbaf4d2697434c5e6a2b62acb
- Owner-only licence gate commit: f382cab9cb8228ef64ad154a602966e9037edf42
- Supabase Edge Function footynomad-sync v88, verify_jwt=true.
- Source is fetched only for owner UUID 668d578c-40dd-4767-8b9d-6b17c7eeebb5; other accounts skip it.
- Integration lives in authenticated footynomad-sync, not moneyball-public-sources.
- Eight calls per scan; full success cached for 12 hours, partial failure for 30 minutes. Exact Brussels-day filter, minimal fixture fields, source URL/attribution, provider predictions/stats/odds ignored.
- Production SQL migration 20261117102000_add_footballcharts_bulgaria_lithuania_aliases.sql applied; adds efbet League and TOPLYGA to shared tier-1/2 predicate.
- SQL regression: 15/15 pass. Frontend tests, type-check and build pass.
- GitHub CI 44053372684 SUCCESS; Cloudflare MAIN deploy 44053372690 SUCCESS.

## Limits and next validation

- Two daily scans could consume 16 of 25 keyless requests if Edge Function cache is cold. Avoid repeated manual scans; API failure must never block FootyNomad.
- Next authenticated MAIN scan must confirm source status, inserts, deduplication, eligibility and prediction generation. No user token is available to run this authenticated end-to-end test from this audit.
- Do not treat the catalogue as full coverage; 18 UEFA associations remain without a verified current tier-1/tier-2 source.
- No bookmaker odds are provided; MAIN/MEGA/EXTRA remain blocked when verified fresh Belgian odds are absent.
## OpenLigaDB / FixtureDownload checks and remaining provider deploy — 2026-11-17 10:27 Europe/Brussels

- OpenLigaDB directory returned 849 historical/current-season rows. Filtering 2025+ showed the current 2026 season is concentrated in Germany plus selected already-covered countries (Austria, England, Netherlands, Spain) and international tournaments. It adds no new association among the remaining 18. The Spanish LaLiga 2026 endpoint returned 380 records with valid matchDateTime; Eredivisie returned 306 but matchDateTime was null and matchDateTimeUTC was the invalid 1970-01-01 sentinel; Austria shortcuts tested returned zero. Do not import the broken ERE time values.
- FixtureDownload's current football catalogue exposes UEFA tournaments and some major domestic leagues, but no verified domestic tier-1/tier-2 feed for the remaining 18 associations. No new integration added.
- Important deployment follow-through: moneyball-free-feed was updated in code with efbet League and TOPLYGA aliases but was still deployed at v43. It is now deployed as v44, verify_jwt=true, preserving JWT protection. footynomad-sync remains v88, verify_jwt=true. This closes the code-vs-edge version mismatch for the new aliases.
- No authenticated user scan was run from this audit; the next 15:00 MAIN scan remains the end-to-end check.