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
## Correction: FootyNomad upcoming day pages expand verified coverage — 2026-11-17 10:35 Europe/Brussels

The previous 18-country gap was overstated because it relied too heavily on the FootyNomad /browse directory, which lists only 13 countries and is not a complete catalogue. Current day fixture pages expose more country/league sections.

### Day-page observations
- 20 Nov 2026: 342 fixtures / 72 countries. Additional senior domestic top-two labels included Bulgaria First/Second League, Cyprus 2. Division, Armenia Premier League, Azerbaijan Premyer Liqa/Birinci Dasta, Georgia Erovnuli Liga, Gibraltar Premier Division, Kosovo Superliga, Macedonia First League and Malta Premier League.
- 21 Nov 2026: 1,269 fixtures / 103 countries. Additional labels included Andorra 1a Divisió, Armenia First League/Premier League, Belarus Premier League/1. Division, Bosnia Premijer Liga and 1st League FBiH/RS, Georgia Erovnuli Liga 2, Gibraltar Premier Division, Kosovo Superliga, Macedonia First/Second League, Montenegro First/Second League and San Marino Campionato.
- 22 Nov 2026: 908 fixtures / 95 countries. New senior domestic top-two labels include Albania Superliga/1st Division and Luxembourg National Division; the page also confirms Andorra, Armenia, Azerbaijan, Bosnia, Gibraltar, Kosovo, Macedonia, Malta and San Marino.
- 23 Nov 2026: 113 fixtures / 42 countries; no new previously-unobserved UEFA domestic league source was identified in the page's section headings.
- This adds 13 previously unobserved UEFA associations to the prior 37/55 catalogue evidence: Andorra, Armenia, Belarus, Bosnia and Herzegovina, Georgia, Gibraltar, Kosovo, Malta, Montenegro, North Macedonia, San Marino, Albania and Luxembourg. Current observed source coverage is therefore at least 50/55, not 37/55.
- Five associations remain unverified in this sample: Faroe Islands, Iceland, Israel, Liechtenstein and Moldova. Liechtenstein has no independent national league; its clubs play in the Swiss league system. Faroe Islands and Iceland use calendar-year seasons and may be between seasons in November. Israel has no fixture section in the 20–23 Nov sample. Moldova appears as a country heading with a match count but no competition heading or fixture-card details; do not infer a competition.

### Filter and parser validation
- Production SQL regression across 43 labels from the 20–21 Nov FootyNomad day pages passed 43/43. Controls include Andorra, Armenia, Azerbaijan, Belarus, Bosnia, Bulgaria, Cyprus, Georgia, Gibraltar, Kosovo, Macedonia, Malta, Moldova named leagues, Montenegro, San Marino, Northern Ireland, Romania and Croatia; lower-tier controls (Bulgaria Third League, Georgia Liga 3, Poland II Liga, England National League/League One, France Ligue 3, Italy Serie C, Spain Primera RFEF, Portugal Liga 3, Belgium First Amateur, Scotland Highland League, Switzerland 1. Liga Promotion) all reject.
- Additional 22 Nov SQL regression passed 12/12 for Albania, Luxembourg, Faroe Islands, Iceland, Israel, named Moldova leagues and empty Moldova competition. Empty competition correctly rejects; do not infer a league from country alone.
- The importer parser previously found the nearest league-group before checking the country heading. If a country section had no league heading, this could inherit a league from the previous country. Commit 243de2f00c8c86875c6a7335996e3a9abd41ce12 reverses the order and requires the league group to be after the current country heading (gs > cs). A regression test confirms blank competition remains rejected.
- Supabase footynomad-sync v89 deployed with verify_jwt=true. GitHub CI 44055361844 SUCCESS. Cloudflare MAIN deploy run 44055361947 was initiated for commit 243de2f; verify final status. The parser correction is not yet proven by a live authenticated import; verify at the next 15:00 scan.

### Current coverage statement
- At least 50/55 UEFA associations have a verified current tier-1/tier-2 fixture source in the combined catalogue/day-page evidence. This is source/season evidence, not a guarantee that every country has fixtures every day.
- The remaining five are not all true gaps: Liechtenstein has no domestic league; Faroe Islands and Iceland are out of season in November; Israel and Moldova need further official source/fixture verification.
- The FootyNomad /browse page is not an authoritative complete league directory. Use actual dated /fixtures/YYYY-MM-DD pages for source discovery and compare their competition sections against importer output. Do not count every global match as an eligible European match.
- The 17 Nov reconciliation remains unchanged: 41 European domestic-category rows in the page/DB; only two Northern Ireland Championship fixtures meet tier-1/2 senior-men scope.