# European domestic source audit — 2026-11-17

## Result

Cross-checked the previously unverified UEFA associations against current 2026/27 federation, league and UEFA fixture sources. Combined source evidence is now at least 54 of 55 UEFA member associations. This is source-discovery coverage, NOT a claim that all 53 are already automatically imported by MONEYBALL.

- Belarus is now covered by the primary FootyNomad source: the 21 Nov 2026 page lists the senior men's Premier League and 1. Division. The authenticated parser v97 returns 8 Premier League matches and 6 eligible 1. Division matches after excluding reserve-team fixtures.
- Liechtenstein has no national league; its clubs play in the Swiss league pyramid. Its national competition is the Liechtenstein Cup, which MONEYBALL intentionally excludes. This leaves no UEFA association with an existing domestic league unverified in this source audit.
- The 16 newly verified associations and their official current sources are listed below.

## Verified official sources

| Association | Verified current senior competition(s) | Official source | Current evidence |
|---|---|---|---|
| Albania | Abissnet Superiore (tier 1) | https://fshf.org/sq/abissnet-superiore-percaktohet-kalendari-nga-java-e-6-te-deri-ne-javen-e-11-te/ | FSHF published 2026/27 rounds 6–11 with dates and fixtures. |
| Andorra | Lliga Multisegur Assegurances (tier 1); Lliga Grup Pirineu (tier 2) | https://www.faf.ad/pnfg/NNws_ShwNewDup?cod_primaria=3000277&cod_secundaria=3001702&codigo=1009345 | FAF confirms the 2026/27 season and describes Lliga Grup Pirineu as the national second division; current league calendar is published. |
| Armenia | Armenian Premier League (tier 1) | https://www.uefa.com/nationalassociations/arm/domestic/league/1079/matches/ | UEFA's official Armenia association page exposes the 2026/27 domestic fixture calendar. |
| Bosnia and Herzegovina | WWIN Liga Bosne i Hercegovine (tier 1); First League FBiH / First League RS (tier 2) | https://www.nfsbih.ba/en/news/football-m/wwin-league-bh/dates-set-for-postponed-wwin-league-bih-and-bih-supercup-matches/ | NFSBiH published current 2026/27 competition fixture decisions and match dates. |
| Faroe Islands | Meistaradeildin menn (tier 1); 1. deild menn (tier 2) | https://www.fsf.fo/kappingar-og-urslit/fm-og-steypavinnarar/2026-2/ | FSF's 2026 champions page lists both men's senior divisions; 2026 season ended 31 Oct. |
| Georgia | Erovnuli Liga (tier 1); Erovnuli Liga 2 (tier 2) | https://liga.gff.ge/en/node/4894 | GFF's official league platform exposes 2026 Erovnuli Liga 2 match reports and results; official 2026 regulations list Liga and Liga 2. |
| Gibraltar | Gibraltar Football League (tier 1) | https://www.gibraltarfa.com/competitions/gibraltar-football-league-26-27-3395567 | GFA's official 2026/27 table, results and upcoming fixtures page. |
| Iceland | Besta deild karla (tier 1); Lengjudeild karla (tier 2) | https://www.ksi.is/oll-mot/?name=lengjudeild&pageSize=10&season=2026 | KSÍ's official 2026 men's competition index lists both current divisions and match results; season ended in October. |
| Israel | Ligat Winner (tier 1); Liga Leumit (tier 2) | https://www.football.org.il/leagues/league/?league_id=40&season_id=27 | Israel FA's official competition pages expose the current senior leagues and 2026/27 season data. |
| Kosovo | Albi Mall Superliga (tier 1) | https://ffk-kosova.com/garat/Albi-Mall-superliga | FFK's official 2026 match rounds, results and standings. |
| Luxembourg | BGL Ligue (tier 1); Promotion d'Honneur (tier 2) | https://www.flf.lu/generaux-92804v4 | FLF's official detailed 2026/27 calendars for both divisions. |
| Malta | VBet Malta Premier League (tier 1); Challenge League (tier 2) | https://tickets.mfa.com.mt/ | Malta FA's official 2026/27 event/fixture listing includes dates, kick-off times and venues for Premier League games. |
| Moldova | Liga 7777 (tier 1); Liga 1 (tier 2) | https://fmf.md/ | FMF's official 2026/27 competition and schedule publications for both senior divisions. |
| Montenegro | Meridianbet 1. CFL (tier 1) | https://fscg.me/takmicenja/meridianbet-1-cfl/ | FSCG's official 2026/27 fixture, result and table page. |
| North Macedonia | Prva MFL (tier 1); Vtora MFL (tier 2) | https://www.ffm.mk/en/natprevaruvanje/prva-mfl27/ | FFM's official English 2026/27 fixture and result page. |
| San Marino | Campionato Sammarinese (tier 1) | https://www.fsgc.sm/it/campionato/campionato-sammarinese/1 | FSGC's official 2026/27 matchday fixtures, results and dates. |

## Existing source coverage and exceptions

- Prior combined source catalogue: at least 37/55 UEFA associations.
- 16 further associations above have verified current official source pages; Belarus is additionally confirmed through FootyNomad, bringing evidence to 54/55.
- Belarus primary-feed proof: FootyNomad 21 Nov 2026 lists `Premier League` (8 fixtures) and `1. Division` (9 raw fixtures). Production `footynomad-sync` v97 GET returns 8 top-tier fixtures plus 6 senior second-tier fixtures after excluding 3 reserve-team fixtures. All 14 Belarus fixtures returned by the parser pass the production SQL eligibility predicate.
- Production `footynomad-sync` v97 GET for 21 Nov returns 301 eligible fixtures across 43 countries. All 301/301 pass `moneyball_is_eligible_european_match`; this is a live parser/source check, not yet proof of authenticated database insertion.
- Liechtenstein has no domestic national league. UEFA confirms its clubs play in the Swiss pyramid; only a national cup exists. Exclude Liechtenstein Cup from MONEYBALL league predictions.

## MONEYBALL alias coverage updated

The canonical domain predicate, both FootyNomad Edge Function filters, and the production SQL predicate now recognize the current names for the newly verified competitions, including: Abissnet Superiore; Lliga Multisegur Assegurances; Lliga Grup Pirineu; WWIN Liga Bosne i Hercegovine; Meistaradeildin menn; 1. deild menn; Erovnuli Liga 2; Gibraltar Football League; Lengjudeild karla; Ligat Winner / Winner League; Albi Mall Superliga; BGL Ligue; Promotion d'Honneur; VBet Malta Premier League; Liga 7777; Meridianbet 1. CFL; Prva MFL / Vtora MFL. Existing aliases already covered Armenian Premier League and Campionato Sammarinese.

Production migrations applied for these alias additions: `20261117102000` (Bulgaria/Lithuania), `20261117113000` (Moldova/Israel), `20261117114000` (Faroe/Iceland), `20261117115000` (Montenegro/North Macedonia/Bosnia), `20261117116000` (Albania/Kosovo/Luxembourg/Malta), and `20261117117000` (Andorra). SQL regression checks confirmed the aliases and rejected women's competitions.

## Important integration distinction

These official pages prove current league identity and provide fixtures/calendars, but they have NOT all been wired as automated MONEYBALL feed adapters. The live automatic feed remains FootyNomad; Football Charts is an owner-only private-use fallback for eight allowlisted leagues. Official sites above are future adapter candidates only after their access terms, robots policy, data reuse permissions, update frequency and stable page/API structure are checked. Do not copy or scrape them into production merely because pages are publicly readable.

Do not claim 53-country automated import. Current source discovery is 54/55; production importer coverage remains narrower and requires source-by-source integration and authenticated end-to-end verification.

## Belarus and 21 November live parser regression — 2026-11-17

The initial audit incorrectly left Belarus as the remaining country without a verified source. A follow-up read of FootyNomad's actual 21 Nov page found Belarus: `Premier League` (8 fixtures) and `1. Division` (9 raw fixtures). Production `footynomad-sync` v97 GET returns 8 senior top-flight matches and 6 eligible senior second-tier matches; three reserve-team fixtures are excluded. All 14 returned Belarus fixtures pass the production SQL eligibility predicate.

The same live GET for 2026-11-21 returned 301 fixtures across 43 countries; SQL validation found 301 eligible and 0 rejected. This confirms the parser and canonical scope for that dated source response, but does not prove authenticated insertion into the owner's `matches` table.

Updated source discovery evidence: 54/55 UEFA associations. Liechtenstein is the sole association without a domestic national league; its clubs compete in Switzerland and its national cup is excluded. There is no remaining UEFA domestic-league association without at least one verified source in this audit. Automated import coverage remains narrower than source-discovery coverage.


## Additional tracker evaluation — 2026-11-17 17:10 Europe/Brussels

The following candidates were checked against the existing no-API-key / no-paid-provider project constraint:

| Candidate | Current public facts | Decision for MAIN |
|---|---|---|
| PitchAPI | Official site states 77 leagues, free/no paid tier and unlimited requests, but every call requires an API key. | Best future candidate for xG, shots, lineups and stats if the user explicitly permits a free API key. Not enabled under the current no-key constraint. |
| StrikerAPI | Official docs state 500 free credits/month, every request requires an API key; paid tiers start at $19/month. | Not suitable for full Europe-wide polling; keep disabled and do not consume credits. |
| API-Football | Official coverage lists 1,251 competitions, but the free plan is limited to 100 requests/day and requires an API key. | Catalogue is broad, quota is too small for a frequent all-Europe scan; do not enable under current no-key constraint. |
| Football Charts | No-key tier is limited to 25 requests/day and private/personal use; 8 allowlisted competitions are currently integrated. The 17 Nov scan returned 429 for 4 of 8 leagues. | Keep optional and owner-only only after durable caching and controlled request cadence; never let it block FootyNomad. |
| Flashscore third-party scraper | An unofficial scraper claims broad Flashscore competition coverage and no account/API key. | Do not add as a production dependency until the scraper's terms, source access, uptime, rate limits and redistribution rights are independently cleared. Use Flashscore as a manual verification source only. |
| FotMob / SofaScore | Existing project checks found unstable/restricted automated access; current research does not justify bypassing their controls. | Do not scrape or bypass blocks. |
| Fotbalinfo + Jina Reader | Current test function fetches one hard-coded Slovenian 2. SNL match page through a text proxy. | A one-match parser experiment, not a general European fixture tracker; do not enable for production ingestion. |
| OpenMatchday | Free/no-key daily CSV source with a fixed published competition index; useful for results/history and some fixtures, but not every European league. | Keep as an independent supplemental feed, with date, status and eligibility reconciliation. |

Official provider references checked:
- PitchAPI: https://pitchapi.dev/
- StrikerAPI docs/pricing: https://strikerapi.com/docs and https://strikerapi.com/
- API-Football coverage/pricing: https://www.api-football.com/coverage and https://www.api-football.com/pricing
- Flashscore scraper candidate: https://github.com/clearfetch/flashscore-football-scraper
- OpenMatchday: https://github.com/oladeeayo/open-matchday

No new provider was enabled, no API key was added, and no provider credits were consumed. The current best no-key primary fixture source remains FootyNomad, with OpenMatchday and carefully limited Football Charts as supplemental sources. The 54/55 official source-discovery audit remains distinct from automated importer coverage.


## FootballCharts durable cache deployment — 2026-11-17 17:45 Europe/Brussels

- Fixed the repeated cold-isolate fetch risk. Removed the isolate-local in-memory Map cache and added persistent owner-scoped cache storage in `public.moneyball_provider_cache`.
- Cache key is stable per owner/provider, stores the upcoming fixture set across dates, and filters the requested Europe/Brussels date on read. A successful or partial response is retained for 24 hours. An atomic insert / conditional expired-row update with a five-minute refresh lease prevents concurrent manual scans from issuing duplicate provider batches. Concurrent scans use the cached response (or a pending/stale response) rather than calling FootballCharts again.
- One refresh makes at most eight requests (one per allowlisted league), not eight requests per scan. Provider failure is cached for 24 hours to avoid repeated 429 retries; the primary FootyNomad scan remains independent and catches any optional cache/provider failure.
- The cache table is private per owner: RLS enabled; three owner-only select/insert/update policies; authenticated grants only; no anon/public access and no delete permission. The migration has been applied as Supabase version `20261117163632`.
- GitHub MAIN migration file commit: `60732b238f58edcc61c5c5e57666713b646182c9`. Function source commits: `b257abb189298943ca864e6da664f45e63739179` (durable cache) and `f308c90cd41fd33ad730b7250ac92a46b1027cf7` (date-regex correction).
- Deployed the exact current MAIN `footynomad-sync` source as Supabase Edge Function v102; deployment returned ACTIVE with `verify_jwt=true` preserved. Shared imports were bundled from MAIN. The deployment bundle compiled successfully.
- Database verification: cache table exists, RLS is enabled, three owner policies are present, and no cache rows were created by the deployment itself. This is expected until the next authenticated owner scan. The owner-scoped policy was also checked against a different simulated JWT subject; the other user sees zero rows.
- Production Cloudflare Worker root smoke fetch succeeded: title `MONEYBALL GLOBAL 2.0`, expected Polish landing copy, no fetch errors. No frontend/Worker code changed, so no Cloudflare redeployment was required.
- Current Football Charts official docs confirm the keyless limit is 25 requests/day per IP and the provider updates once daily; free use requires personal/research use and attribution, with no raw-data redistribution. The existing hard owner gate remains; no key or paid plan was added. Source: https://www.football-charts.com/developers
- Not yet proven: an authenticated owner POST scan after v102 deployment, persistence/readback of a real provider cache row, and signed-in visual click-through of Matches/Predictions. Available browser profiles have no recorded sign-in for the Worker domain. Do not claim those acceptance checks passed; keep issue #77 open until the user completes sign-in and the screens are verified.
- No matches, predictions, coupons, settlement rows, or bankroll values were changed.


## Cache lease recovery follow-up — 2026-11-17 17:47 Europe/Brussels

- A final failure-mode review found that a worker crash after creating a pending cache row could otherwise leave that pending row fresh for 24 hours. Fixed the lease recovery: a pending row is reclaimed once its five-minute refresh lease expires, using a conditional owner-scoped update; a ready row remains cached for 24 hours.
- Latest MAIN function commit: `c34fb2fd175fb92a3359c0c460a2c09a6a1bb39d`.
- Redeployed the corrected source as `footynomad-sync v103`, ACTIVE, `verify_jwt=true` preserved. Supabase bundling succeeded.
- Rechecked the production function registry: v103 ACTIVE. Rechecked cache table: RLS enabled, three owner-only policies, no production cache rows yet (expected until authenticated owner scan).
- The earlier v102 deployment is superseded; v103 is the current target for the first authenticated scan.
- Still pending: owner-authenticated POST scan and real cache write/read proof, then authenticated UI click-through. No user match, prediction, coupon, settlement or bankroll data changed.


## Expanded tracker search — 2026-11-18

### Candidates tested against the all-tier European domestic scope

| Candidate | Verified facts | Decision |
|---|---|---|
| API-Football (API-Sports) | Official coverage lists 1,251 leagues/cups, all competitions included in every plan, with data depth varying by competition/season. Official fixtures endpoint supports a date-wide query with a timezone parameter; one daily date request can be the broad daily candidate feed, with paging checked from the response. Free plan is $0 and 100 requests/day, but requires a private API key and is limited by available seasons. | **Best broad-coverage candidate for a second automated source.** Implement as an optional server-side adapter only after explicit approval for a free API key. Never expose the key to the browser. Preserve FootyNomad as the existing independent source and reconcile IDs/fixtures before import. |
| PitchAPI | Official docs describe 77 leagues, including second tiers, cups and UEFA competitions, unlimited requests on the free plan, but all requests require an API key. | Useful independent cross-check / stats source, but its 77-league catalogue is narrower than API-Football's published 1,251 competitions. Keep as a later optional adapter if a key is approved. |
| Football API (footballapi.org) | 60 leagues across 30 countries; free key reads Premier League only; full catalogue and live fixtures require $29/month. | Not selected for all-Europe coverage. |
| FootyCheck | Public country index advertises a rolling 7-day fixture index, 149 countries and 776 leagues. Its robots.txt sets `Content-Signal: search=yes,ai-train=no,use=reference`; that grants reference use, not full data ingestion. No stable public API contract or automated-ingestion permission verified. | Use only as a manual coverage-reconciliation reference. Do not scrape or import its match database. |
| Flashscore | Its public Terms of Use prohibit automated requests that burden the service and prohibit scraping/aggregating/recreating site content without express consent; its database is protected. No public fixtures API is offered. | Reject third-party scraping as a production dependency unless Livesport grants written permission. |
| SofaScore | Official terms prohibit automated scraping/aggregation and protect database content; its FAQ says it cannot provide API endpoints because of provider agreements. Direct API requests from our test environment returned HTTP 403. | Reject scraping or bypassing its access controls. |
| TheSportsDB | Free daily schedule endpoint has a three-event limit; premium limit is 1,500. | Not suitable as the all-Europe primary source. |
| Sportmonks | Free plan only exposes Danish Superliga and Scottish Premiership; broader coverage requires paid league access. | Not suitable for free all-Europe ingestion. |

### Recommended implementation path

1. Keep the current no-key sources active: FootyNomad, OpenMatchday/OpenFootball, OpenLigaDB and ESPN; retain the existing tightly rate-limited FootballCharts private fallback.
2. Add API-Football as a separate, optional fixture adapter, querying `/fixtures?date=YYYY-MM-DD&timezone=Europe/Brussels` once per target day (and any additional pages only when the provider's paging metadata requires them). The provider's published coverage is broad, but per-league fixture coverage must be read from its league coverage metadata and validated against observed fixtures; never equate 1,251 listed competitions with 1,251 active/complete fixture feeds.
3. Normalize all provider fixtures into the existing canonical all-tier geographic-Europe scope. Preserve provider IDs and source provenance. Do not create predictions or alter historical/settlement data from unverified fixtures.
4. Before accepting the source, compare daily fixture IDs and country/competition counts against FootyNomad and official federation calendars, log missing/extra fixtures and stale timestamps, and run a second scan to prove stable deduplication.
5. Keep the new adapter disabled until a free API-Football key is explicitly approved and stored only as a Supabase Edge Function secret. No paid plan is required by the published free tier; its 100 requests/day quota is sufficient for one date-wide request plus pagination and limited diagnostics, but not for frequent per-league polling.

### Status and constraints

- This is a source-research checkpoint, not an integration or completeness claim.
- No API keys were created, requested, or stored. No provider credits/requests were consumed. No Supabase function, database row, match, prediction, coupon, settlement or bankroll data was changed.
- Existing project constraint against introducing API keys remains in force until the owner explicitly approves the free API-Football key.
- Official references checked 2026-11-18: API-Football coverage/pricing/docs (https://www.api-football.com/coverage, https://www.api-football.com/pricing, https://www.api-football.com/documentation-v3); PitchAPI (https://pitchapi.dev/); Football API (https://footballapi.org/); FootyCheck robots and country index (https://footycheck.com/robots.txt, https://footycheck.com/football/countries/); Livesport Terms (https://www.livesport.eu/terms-of-use/en); SofaScore Terms/FAQ (https://www.sofascore.com/terms-and-conditions, https://sofascore.helpscoutdocs.com/article/129-does-sofascore-offer-sports-data-api).


## Production source-parser correction — 2026-11-18

A code review of the OpenMatchday/ESPN/TheSportsDB aggregator found regex literals with doubled backslashes. In regex literals, this caused several intended tokens to be treated as literal backslash sequences rather than word boundaries or digit classes. Affected paths included team-name accent normalization, club-name history keys, reserve/youth-team exclusions, WSL detection, ISO offset recognition and TheSportsDB date validation.

Corrections committed on MAIN:
- `f2155d6`: added shared `_shared/team-normalization.ts` so source adapters use one canonical team normalizer, one reserve/youth exclusion rule and one history-key normalizer.
- `112703c`: added Deno regression tests for accents, whitespace, reserve/academy/youth teams, senior-team retention and women's identity.
- `ffdbcdd` and `1a8425b`: repaired the escaped regexes in `moneyball-public-sources`, including WSL, ISO offsets and date parsing.
- `7461cb1`: changed `footynomad-sync` to use the same shared senior-team exclusion helper.
- `223fe2b`: corrected the women's history-key expected value in the regression test.
- `2831819`: added the new test file to the MAIN GitHub Actions CI workflow.

Validation status at the time of this entry: GitHub Actions was triggered for MAIN commit `2831819`; its run was queued when checked. Do not describe CI or the production Edge Function deployments as passed until the run completes and the two affected Edge Functions are deployed and smoke-tested. No database rows, match records, predictions, coupons, settlements or bankroll values were changed by these source edits.


## Live Europe-wide fixture and gender-classification audit — 2026-11-18

Read-only audit of the FootyNomad 18 Nov 2026 page:
- The source page advertises 185 fixtures; its live HTML contains 185 fixture anchors and 185 complete home/away team cards.
- Replayed the current MAIN FootyNomad parser's anchor, country-section and league-group extraction against the live page HTML, then applied the MAIN geographic-Europe, domestic-senior-league and reserve/youth filters.
- Result: 31 eligible senior men's domestic-league fixtures across 7 countries: Germany 2, Bulgaria 5, Bosnia and Herzegovina 1, England 2, Poland 1, Scotland 6 and Spain 14.
- Examples demonstrate the required all-tier scope: Germany Oberliga/Regionalliga, Bulgaria Third League, Bosnia First League RS, England Non-League Premier, Poland III Liga, Scotland Lowland League and Spain Segunda/Tercera RFEF. Cups, women, reserve sides and non-European fixtures are excluded.
- The independent OpenMatchday/ESPN/OpenLigaDB/TheSportsDB aggregator returned zero eligible European fixtures for this date. OpenMatchday checked 47 eligible catalogue folders but had no fixture rows for 18 Nov. This is a supplemental-source gap for this date, not evidence that FootyNomad has no matches; the FootyNomad primary source remains essential.

A second parser defect was found during this comparison: `/\bW\b|Women|female|girls/i` treated a lowercase final `w` as the women's `W` suffix. It misclassified Poland's Barycz Sułów vs Polonia Nysa. The correction adds shared `isWomensTeam` logic: uppercase standalone `W` is case-sensitive, while explicit women's words/competition markers remain case-insensitive. Both `footynomad-sync` and `moneyball-results-sync` now use the shared detector. Regression tests cover Barycz Sułów, Wolves, Häcken W, Women, WSL, and additional lower-tier competition aliases.

Code/history:
- `1bb5fe6`: shared women's-team detector.
- `cbe8d5b`: regression tests for false women's classification.
- `ab3b71c`: FootyNomad importer uses the shared detector.
- `b6c4518`: result-sync parser uses the shared detector.
- `21ebaa0`: adds Bulgaria Third League, Bosnia First League RS and Poland III Liga to all-tier scope regression tests.

Validation boundary: the new Deno regression test passed in the CI run for `b6c4518`; type-check and app tests also passed there, while the build was still running at the time of this entry. The later scope-alias test commit `21ebaa0` requires its own completed CI result. The live authenticated `footynomad-sync` endpoint remains JWT-protected (GET without a user session returns 401), so this source-page replay is not a substitute for the pending authenticated owner scan/database readback. Do not claim the owner import is verified until that scan succeeds.

Deployments: `moneyball-public-sources` v66 is ACTIVE with corrected parser regexes; `footynomad-sync` v106 is ACTIVE but predates the new gender-detector change; `moneyball-results-sync` still requires the matching source deployment. Deploy these affected functions only after MAIN CI passes, preserving `footynomad-sync verify_jwt=true` and the existing results-sync setting.

No production match, prediction, coupon, result, settlement, or bankroll rows were changed by these read-only audits or code commits.
