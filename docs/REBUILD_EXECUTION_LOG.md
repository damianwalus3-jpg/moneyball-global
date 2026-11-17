# MONEYBALL fresh rebuild — execution log

## 2026-11-17 — Start
- User explicitly requested a complete restart from zero.
- Created isolated branch: `moneyball-rebuild`.
- Replaced the branch working tree with a clean baseline; production `main` was not modified.
- Added fresh product specification and initial React/Vite PWA foundation.
- Added Polish mobile-first six-module application shell.
- No production database was reset or deleted. The new build has no connected database yet.
- No paid API, database, hosting tier, or subscription is required by this rebuild.

## Completed and verified foundations
- GitHub Actions run `44098471244` completed successfully on the clean rebuild branch.
- Core domain tests cover 1X2 probability normalization, derived Double Chance, duplicate fixture suppression, three-leg coupon constraints and return calculation.
- Removed unused Supabase/Postgres migrations; no new database or paid resource was created.
- Tracker runs locally in browser storage with versioned JSON export/import; imports merge missing IDs and preserve existing records.
- Daily Europe/Brussels fixture retrieval uses the public open-matchday CSV dataset, restricted to European domestic league folders. Its non-commercial terms and coverage limitations must be respected.
- Separate Cloudflare Worker deployment is isolated from the existing production Worker and D1 database.

## Deployment checkpoint — 2026-11-17
- Application URL: https://moneyball-global-rebuild.damianwalus3.workers.dev
- Worker: `moneyball-global-rebuild`.
- First successful deployment run: `44103378010`; latest documentation-only CI run `44103526507` and deployment run `44103526551` both completed successfully.
- Automated browser-level visual verification remains outstanding; deployment success is not represented as a full end-to-end acceptance test.
- No paid resources were provisioned.

## Stage 02 — prediction engine foundation
- Implemented a transparent independent-Poisson 1X2 engine that accepts explicit expected-goals inputs. It does not fabricate xG: predictions cannot be produced until real expected-goals inputs are supplied by a verified source or entered by an operator.
- Double Chance remains a separately derived output from the 1X2 distribution.
- Added validation of expected-goals range, goal-matrix truncation and normalized probabilities.
- Added settled-prediction evaluation metrics: multiclass Brier score, log loss and accuracy. Empty samples return no metric rather than a misleading zero.
- Added unit tests for model directionality, probability normalization, input rejection and evaluation.
- Status at commit time: implementation committed; CI and Cloudflare deployment must pass before this stage is marked deployed.

### Stage 02 — passed and deployed
- Commit: `f352cfa298f0ddbce9221018981637160e04e176`.
- CI run `44106668871`: success; install, TypeScript typecheck, Vitest suite and production build all passed.
- Cloudflare deploy run `44106669013`: success; same validation steps and static asset deployment passed.
- Stage 02 is marked COMPLETE/DEPLOYED. The prediction engine is a tested calculation module, not yet fed by verified expected-goals data.

## Stage 03 — free historical results and recent form
- Added retrieval of public season results CSV by European domestic league.
- Team recent form uses completed score rows strictly earlier than the fixture date; the current fixture and future rows are excluded.
- Computes last five overall results plus separate home/away subsets, score, opponent, W/D/L and points.
- UI exposes an on-demand "Forma 5" action on each listed fixture; result data is cached locally for six hours.
- Source coverage and non-commercial limitations remain visible; missing result files are reported instead of synthesizing form.
- Status: implementation committed; CI and Cloudflare deployment pending.

### Stage 03 — passed and deployed
- Final Stage 03 implementation commit: `fe2231b961730e38cc90242ad055aff42333f56f`.
- CI run `44107577459`: success; TypeScript, tests and production build passed.
- Cloudflare deploy run `44107577440`: success; all deploy steps completed.
- Stage 03 is COMPLETE/DEPLOYED. Recent-form history remains sourced from the corresponding open-matchday league CSV.

## 2026-11-17 — European fixture coverage expansion (Stage 04 implementation)
- User clarified that the scan must include **all European football matches without competition exclusions**: senior/youth, men's/women's, domestic leagues at every tier, regional/amateur leagues, domestic cups and UEFA competitions.
- Removed the previous filters that excluded cup folders, U21 folders and UEFA folders from open-matchday. All recognised European country/UEFA folders with fixtures are now scanned.
- Added OpenLigaDB as a second fixture source. It discovers season leagues dynamically and retrieves match lists for recognised European competitions, including its German lower-tier/regional catalogue where available.
- Added Europe/Brussels date conversion for OpenLigaDB UTC kick-off timestamps.
- Added normalized fixture-key deduplication across providers; source provenance is retained when two feeds identify the same match.
- Added tests for European source classification, non-football rejection and cross-provider fixture deduplication.
- OpenLigaDB requests now pass through the separate rebuild Cloudflare Worker. Successful upstream responses are cached at the edge for 8 hours to reduce duplicate requests and respect the provider's fair-use expectations. Local Vite development uses a matching proxy.
- Updated match UI: recent-form lookup is shown only where a compatible historical league folder exists; no fabricated form is displayed for OpenLigaDB-only matches.
- Updated product scope to include every competition category, not just senior domestic leagues.
- Sources reviewed: open-matchday (75 competitions, daily public CSV; non-commercial terms and uneven coverage), OpenLigaDB (keyless API, ODbL 1.0, 60 requests/minute maximum and fair-use caching guidance), football-data.org (12 competitions on free tier), Sportmonks (2 leagues on free tier; broader coverage is paid), and openfootball Europe (public-domain datasets for selected European leagues).
- Important limitation: the combined public feeds materially broaden coverage but do **not** prove every European amateur/youth/women's match is present. A complete guarantee is impossible without a comprehensive provider or direct federation feeds. The app must show provider failures and actual coverage counts instead of claiming 100% coverage.
- Commits: source expansion `d60fe542ccb4557605b923dc9cfd84fee16a4a6c`; UI `e94f0aa06b4867aca12dca554218dcfce91941a6`; source tests `15e5cd037945baa5dfd2f18367c1fdb54e5701cd`; shared Worker cache and proxy final fix `78040fedfd9133b72fbe7e666db036036e88ac2a`.
- Final code validation: CI run `44108958296` SUCCESS (typecheck, tests, build).
- Cloudflare rebuild deployment: run `44108958539` SUCCESS.
- Stage 04 implementation is DEPLOYED. Live endpoint/browser smoke test and a country-by-country coverage audit remain outstanding; do not mark coverage acceptance as complete until these checks pass.
- Existing production `main` and Worker remain untouched. No paid API, hosting, database or subscription was added.

### Stage 04 — follow-up hardening and final verification
- Added dynamic European season selection: July–December uses the current start-year season; January–June uses the previous start-year season. Fixture CSVs, form-history CSVs and their cache keys now follow the fixture season instead of a hard-coded `2627` filename.
- OpenLigaDB season discovery checks both the current and previous season during January–June, then filters fixtures by Europe/Brussels calendar date.
- Added unit tests for season rollover and OpenLigaDB catalogue year selection.
- Added source-count visibility and clearer warnings in the match list. Empty results are explicitly described as “no matches found in the downloaded feeds,” not proof that Europe has no matches.
- Fixed the local Vite proxy to map the app's league/match paths to the documented OpenLigaDB upstream endpoints.
- Added support for the provider's German `Fußball` and `Fussball` sport labels.
- CI caught two issues during hardening and they were corrected before the final green run: Cloudflare-specific `ExecutionContext`/cache typing was replaced with runtime-safe types; an OpenLigaDB fallback reference to an out-of-scope `year` variable was changed to the discovered season year.
- Final verified branch HEAD: `971fab29a6a7eb01a5d588cf4c8d9ed19a9418bd`.
- Final CI run `44109705764`: SUCCESS — typecheck, all unit tests and production build passed.
- Final Cloudflare deployment run `44109705460`: SUCCESS — static assets and Worker code deployed to the separate rebuild Worker.
- Stage 04 source integration and season hardening are DEPLOYED. A real upstream live-data smoke test and exhaustive country-by-country source coverage audit remain pending because the current browser verification path cannot independently read the Worker API response. Do not claim 100% match coverage.
- The Cloudflare Worker caches OpenLigaDB API responses for 8 hours at the edge. App-local fixture cache is 30 minutes; manual refresh bypasses the local cache but still benefits from the edge cache.
- Historical team form cache is separated by league folder and season, six hours.
- Failed intermediate runs are not release status: final HEAD was revalidated successfully after fixes. No production `main` branch, existing Worker, historic records or paid resources were changed.

## 2026-11-17 — Stage 05: historical form, model output and audit persistence
- Added OpenLigaDB team-history retrieval for fixtures whose competition is not represented in open-matchday CSV. The Worker now proxies and edge-caches league, season, match and team-history endpoints; local Vite uses matching upstream rewrites.
- OpenLigaDB history mapping uses finished matches and the final regulation-time result, filters out matches on or after the fixture date, and calculates last five overall/home/away results, goals and points.
- History cache keys include competition, season, team and fixture date; six-hour browser cache plus eight-hour Worker edge cache.
- Added a transparent goals-only Poisson baseline using recent scored/conceded goals and venue splits. It is explicitly not labelled xG and does not pretend to include lineups, injuries or bookmaker odds.
- Displays 1X2 probabilities and separately derived Double Chance probabilities. A top outcome at or above 75% is marked KANDYDAT; weaker or insufficient-data analyses are recorded as ODRZUCONY with the reason.
- Scan executions and analysed match predictions are stored in the local Tracker with fixture ID, source, model version, probabilities, Double Chance values, expected goals and sample information. Duplicate analysis records for the same fixture/model are not inserted again.
- Added tests for OpenLigaDB final-score mapping, finished-match filtering, season discovery, European country/folder classification and goals-based model behavior.
- Expanded European folder recognition to include Belarus, Liechtenstein, San Marino, Monaco and Vatican codes where the source publishes fixtures. Cup and youth folders remain included; non-European country folders are excluded.
- Final code HEAD for this stage: `5f040d43265860e7c65a0befdebe38773425dd7a`.
- Final CI run `44111021785`: SUCCESS — typecheck, unit tests and production build passed.
- Final Cloudflare deploy run `44111021721`: SUCCESS — rebuild Worker deployment passed.
- Stage 05 is COMPLETE/DEPLOYED. Prediction generation currently runs when the user presses “Forma 5 + typ” on a match; it is not yet an automatic bulk prediction for every fixture. Matches without enough verified history are not assigned invented probabilities.
- Runtime visual verification and live upstream API smoke tests remain outstanding. The public feeds' actual catalogue coverage must still be audited country by country; no claim of exhaustive 100% coverage is made.

## 2026-11-17 — Stage 06: exact three-match paper coupon builder
- Added a coupon-candidate engine that reads only persisted 1X2 prediction records for the selected Brussels scan date.
- Eligibility requires a top 1X2 probability >=75%, a recorded strong-candidate flag, valid normalized probabilities, and a unique fixture ID.
- Generated candidates contain exactly three different matches. Duplicate prediction records for the same fixture are collapsed; fixtures from another date and weaker predictions are excluded.
- Candidate ordering uses the product of model probabilities. This is explicitly **not** bookmaker odds and is not represented as an AKO quote.
- Added a Kupony module listing up to 10 best candidates and a local action to save a paper coupon record. No real-money bet is placed.
- Coupon records store their legs as JSON text because Tracker's details schema intentionally accepts only primitive values.
- No real odds feed is connected yet. Coupon UI clearly says that odds and potential return are unavailable; no odds or winnings are fabricated.
- Added unit tests for the exact-three rule, unique fixtures, 75% threshold, same-day filter and no-odds status.
- CI had two failed test iterations: first, a test helper omitted the required scan date; second, floating-point arithmetic generated a tiny negative probability for a 90% case. Both test defects were corrected. A typecheck issue from storing nested arrays in primitive Tracker details was also corrected by serializing the legs.
- Final verified code commit: `0d164b2b17221fea7979710c47d7f2b3db5a905e`.
- Final CI run `44111904914`: SUCCESS — typecheck, all 33 unit tests and production build passed.
- Cloudflare deployment run `44111904679`: deploy step SUCCESS — separate rebuild Worker deployment completed. Workflow post-job cleanup was still finalizing at time of log update.
- Stage 06 is code-complete and deployed; live browser/UI verification remains outstanding.

## 2026-11-17 — Stage 07: bulk analysis of the discovered daily fixture list
- Added a dedicated “Analizuj wszystkie” action in the Mecze view. It processes every fixture returned by the current Europe/Brussels daily scan in batches of four.
- Each fixture uses its source-compatible history adapter, derives a 1X2 Poisson baseline and separate Double Chance probabilities where at least three prior results per side are available, then writes a prediction record.
- Insufficient history or source failures are recorded as ODRZUCONY with a reason instead of fabricating probabilities. Duplicate records for the same fixture/model are suppressed.
- Progress is displayed while the batch is running; scan and bulk analysis controls cannot be run concurrently.
- Added an in-flight promise cache for open-matchday historical CSVs so multiple matches from the same competition share a single download; existing six-hour local history cache remains.
- Final code commit: `6310c135220aa908524f1c490a5f397d016c0391` (`style(rebuild): add bulk fixture analysis controls`).
- CI run `44112255562`: SUCCESS — TypeScript, tests and production build all passed.
- Cloudflare rebuild deployment run `44112255634`: SUCCESS — deploy step and workflow completed.
- Stage 07 is COMPLETE/DEPLOYED. It now allows the user to generate audit records for the whole discovered daily fixture list without opening each match one by one.
- Coverage limitation remains: bulk analysis can only process fixtures discovered by the current public feeds; it does not establish complete coverage of every European amateur/youth/women's competition.

## 2026-11-17 — Stage 08: model audit and calibration dashboard
- Added an audit layer joining prediction records to result records by exact `fixtureId`.
- Added Brier score, log loss and 1X2 accuracy calculations using the existing validated prediction evaluator.
- Added five confidence buckets (0–20%, …, 80–100%) comparing average top-outcome confidence with observed hit rate; empty buckets are omitted.
- Added the Intelligence screen with settled sample count, pending predictions and calibration details.
- Added a separate Typ dnia summary with counts of saved predictions and strong candidates.
- Tests cover result joining, accuracy, calibration and predictions without matching results.
- Important: automatic result collection/settlement is NOT implemented yet. The dashboard correctly shows no metrics until actual results are recorded with the matching fixture ID; no synthetic performance is shown.
- Final code commit: `6c49f6920398da8f0911d217d9ad5ca177a32d0d` (`style(rebuild): add calibration and model metrics layout`).
- CI run `44112642412`: SUCCESS — TypeScript, all tests and production build passed.
- Cloudflare deployment run `44112642302`: deploy step SUCCESS — separate rebuild Worker deployed.
- Stage 08 is COMPLETE/DEPLOYED as an evaluation framework. Automatic result retrieval, settlement and bankroll reconciliation remain the next implementation stage.

## 2026-11-17 — Stage 09: verified final-result settlement
- Added a finished-match result adapter for open-matchday results CSV and OpenLigaDB season match feeds.
- OpenLigaDB settlement requires `matchIsFinished === true` and reads the final result row (resultTypeID 2 / final result), not half-time scores.
- Both adapters match fixture date in Europe/Brussels and normalized home/away names; missing, unfinished or invalid scores remain unsettled.
- Added shared in-flight OpenLigaDB season-feed requests so multiple predictions from one league can share the same response during a settlement batch.
- Added a “Pobierz wyniki i rozlicz” action in Intelligence. It checks predictions without a result record, processes in batches of four, records verified 1/X/2 outcome and final score, and refreshes model audit metrics.
- Result records are linked by the exact fixture ID. Predictions without result metadata or with provider errors remain pending; no guessed final scores are created.
- Stage 09 does not yet update a real-money bankroll: no real bookmaker odds or real stakes are connected. Paper coupon records remain separate.
- A TypeScript failure caused by optional league metadata was fixed by explicitly storing null for absent values.
- Final code commit: `2af49e22bc8c0659e41a85b15a1460a87f95d618` (`fix(rebuild): normalize optional fixture metadata for result settlement`).
- CI run `44113070380`: SUCCESS — typecheck, all tests and production build passed.
- Cloudflare deploy run `44113070381`: SUCCESS — separate rebuild Worker deployment passed.
- Stage 09 is COMPLETE/DEPLOYED as a verified-result settlement workflow. End-to-end visual testing and live source coverage validation remain outstanding.

## 2026-11-17 — Stage 10: paper coupon settlement
- Added a pure paper-coupon evaluator that requires exactly three unique fixture IDs and three corresponding verified result records.
- When all three outcomes are available, the coupon is recorded as PAPER_HIT (3/3) or PAPER_MISS (0–2/3). Incomplete or malformed coupons remain unsettled.
- The verified-result action now settles pending paper coupons after recording final match outcomes and stores the parent coupon ID, correct-leg count and per-leg results JSON.
- No bookmaker odds, stakes, returns or bankroll changes are fabricated; paper coupons remain explicitly no-odds.
- Added tests for full hit, partial miss, incomplete results and malformed coupon data.
- Final code commit: `16410e19bd7239e9909b4b6647b6de00de48e295` (`feat(rebuild): settle saved paper coupons after verified match results`).
- CI run `44113308266`: SUCCESS — TypeScript, all tests and production build passed.
- Cloudflare deploy run `44113307906`: SUCCESS — separate rebuild Worker deployment passed.
- Stage 10 is COMPLETE/DEPLOYED. Automatic paper result tracking is now connected end-to-end for saved coupons; real bookmaker odds and any real-money accounting remain out of scope.

## 2026-11-17 — Stage 11: third European fixture source (OpenFootball)
- Added an OpenFootball Football.TXT adapter for 18 current-season European feeds: Czech Republic, France, Greece, Netherlands, Portugal, Scotland, Switzerland, Turkey, Austria, England (Premier League and Championship), Germany (Bundesliga, 2. Bundesliga, 3. Liga and DFB-Pokal), Spain, Italy and Belgium.
- Feed paths are derived from the current European season (two-digit end year, e.g. `2026-27`); missing feed files are reported rather than silently ignored.
- Parser supports both `home v away` and score-between-teams formats, with and without a kickoff time. It handles date headers with or without explicit year.
- Kickoff times are converted from each feed's local IANA timezone to Europe/Brussels using DST-aware Intl time-zone offsets.
- Fixtures are deduplicated against open-matchday and OpenLigaDB by normalized date and home/away team names; source provenance is merged.
- Added tests for both Football.TXT match formats, date rollover, season path format and UK summer-time conversion to Brussels time.
- Source review: OpenFootball Europe repository describes its datasets as public-domain; coverage is still selected leagues rather than all European tiers. The repository updates at differing cadences; Belgium's source file may lag official fixture revisions. No 100% coverage claim is made.
- Current feeds are cached locally for six hours. Manual refresh bypasses the browser cache and re-reads the raw repositories.
- Final code commit: `2d5626a88047b0f51bdd0f3a35cdc24dee1f4566` (`fix(rebuild): update both season assertions to source filename format`).
- CI run `44114031886`: SUCCESS — TypeScript, all tests and production build passed.
- Cloudflare deployment run `44114031588`: deploy step SUCCESS — separate rebuild Worker deployment passed.
- Stage 11 is COMPLETE/DEPLOYED. Real-time completeness audit across every federation and every amateur/youth/women's division remains impossible with public feeds alone; provider gaps are reported in the UI.

## 2026-11-17 — Stage 12: provider coverage diagnostics
- Fixture scan now returns separate provider coverage summaries: catalogues/competitions/feeds checked, raw fixtures found and source errors for open-matchday, OpenLigaDB and OpenFootball.
- The Mecze screen displays these provider-level counts; duplicate matches may appear in more than one provider count but are merged into one fixture row.
- Empty scan results are explicitly described as no matches found in downloaded feeds, not as proof that Europe has no fixtures.
- Bumped the local fixture cache key to v5 so older cached payloads without the coverage object cannot break the new UI.
- Final code commit: `465c096f1bb0ca796d44ddb11f30126243bceb05` (`ui(rebuild): show per-provider catalog, fixture and error counts`).
- CI run `44114289890`: SUCCESS — TypeScript, all tests and production build passed.
- Cloudflare deploy run `44114289877`: SUCCESS — separate rebuild Worker deployment passed.
- Stage 12 is COMPLETE/DEPLOYED. This makes provider coverage and feed failures visible; it does not prove the public providers contain every European competition.

## 2026-11-17 — Stage 13: 15-minute fixture refresh
- The app now performs a fixture scan on entry and refreshes every 15 minutes while the app remains open.
- Browser fixture cache and OpenFootball cache were reduced to 15 minutes; the manual scan action bypasses browser cache.
- Cloudflare Worker cache TTL is now 15 minutes for OpenLigaDB match feeds, while league catalogues and team-history feeds remain cached for 8 hours to reduce provider load.
- The service worker remains network-first for same-origin GET requests and uses cached shell/API responses only when offline.
- This is foreground refresh only; a static PWA does not execute a background scan when fully closed.
- Final code commit: `dd63ec8f667581bf0e62e86931d437703b10a5d7` (`perf(rebuild): align OpenFootball cache with 15-minute fixture refresh`).
- CI run `44114595319`: SUCCESS — TypeScript, all tests and production build passed.
- Cloudflare deploy run `44114595317`: SUCCESS — separate rebuild Worker deployment passed.
- Stage 13 is COMPLETE/DEPLOYED.

## 2026-11-17 — Stage 14: OpenFootball form and result support
- OpenFootball fixtures now retain feed identity and final scores parsed from both Football.TXT match layouts.
- OpenFootball-only fixtures now expose “Forma 5 + typ”; the form adapter uses finished current-season matches, filters by Brussels date and calculates home/away results and points.
- Form retrieval falls back across open-matchday, OpenLigaDB and OpenFootball sources when an earlier provider does not have usable history.
- Result settlement also falls back to OpenFootball and records only matches with a published final score; unscored fixtures remain pending.
- Added tests for both source score formats, recent form, result settlement and yearless historical date headings.
- Fixed a missing App import found by CI before release; latest CI passed.
- Final code commit: `18abdf52087d729882424c67267080f80d96f172` (`test(rebuild): cover historical season inference for OpenFootball form`).
- CI run `44115497308`: SUCCESS — TypeScript, all tests and production build passed.
- Cloudflare deployment run `44115497817`: SUCCESS — separate rebuild Worker deployment passed.
- Stage 14 is COMPLETE/DEPLOYED. Predictions can now use the third source where no matching open-matchday/OpenLigaDB history exists.

## 2026-11-17 — Stage 15: current source coverage audit and policy
- Queried the live open-matchday `build_summary.json` generated at `2026-11-17T07:19:26Z`: 75 competitions were listed, of which 65 were European folders accepted by the app's country/UEFA allowlist. The current list includes domestic cups, multiple English tiers (including National League North/South and Northern Premier League), Scottish lower divisions, Welsh divisions, Belgian U21, German 2./3. tiers, Spanish Segunda, Italian Serie B, French Ligue 2 and Dutch Eerste Divisie.
- This is a dated provider snapshot, not a guarantee that all European competitions or all matches are present. Some folders may have missing or partial fixture spines; per-provider errors and counts are now exposed in the app.
- Reviewed further free sources: OpenFootball public-domain datasets add selected current-season European competitions; football-data.org free tier is limited; zerozero's free plan is limited to 250 calls/month and two club teams, not a Europe-wide feed.
- Rejected automated FotMob and Sofascore scraping as an implementation path: FotMob explicitly requested removal of automated access in a 2026 scraper issue; Sofascore terms restrict scraping/aggregation and its FAQ says it does not provide public API endpoints. No unauthorized scraping was added.
- Current source set remains open-matchday + OpenLigaDB + OpenFootball. All sources are free/public and no API keys or subscriptions were added.
- Final code HEAD before this documentation update: `7e2548a47c07190ad1b0a366681710985ae9c659`.
- 100% Europe coverage remains unprovable and unavailable from the current legal/free sources; the app must continue reporting source coverage honestly.

## 2026-11-17 — Stage 16: expand OpenLigaDB European competition classification
- Audited OpenLigaDB's live 2026 competition catalogue: 88 entries total, including real football competitions, tests, friendlies and other sports. The app continues to reject non-football sports and non-European/test-only shortcuts rather than importing every catalogue row blindly.
- Verified current OpenLigaDB fixtures for the `pl` shortcut: 380 Premier League 2026/27 matches with English clubs. Verified `ere` returns Eredivisie season matches.
- Extended the European filter for verified OpenLigaDB identifiers covering NOFV Oberliga Nord/Süd, Regionalliga Bayern, Thüringenliga, German women's Bundesliga tiers, Eredivisie, Austrian ÖBL, English Premier League (`pl`) and DFB Frauen Supercup (`wsc`).
- Added classification tests for the newly included competitions and retained the non-football rejection test.
- Bumped the local fixture cache version to v6 to force reclassification on next scan.
- Current OpenLigaDB snapshot is not a complete registry of all European leagues; it is community maintained and contains duplicate/test/friendly competitions. Only verified domestic/UEFA competition shortcuts are included.
- Final code commit: `dcb08f3991f7d893b8a2f6b553cdfa747c53fbef` (`test(rebuild): verify English Premier League and German women's cup classification`).
- CI run `44117588506`: SUCCESS — TypeScript, all tests and production build passed.
- Cloudflare deploy run `44117588677`: SUCCESS — separate rebuild Worker deployment passed.
- Live smoke test: the rebuild Worker returned the app HTML shell with the expected MONEYBALL title and Polish metadata. This does not verify client-side rendering or browser data fetching; visual/mobile E2E remains outstanding.
- Stage 16 is COMPLETE/DEPLOYED.

## 2026-11-17 — Stage 17: verified OpenLigaDB domestic and UEFA competition expansion
- Audited the live OpenLigaDB 2026 catalogue: 88 entries, with multiple sports, test feeds, friendlies and synthetic entries mixed together. Applied the app's football-sport guard and Europe-oriented name/shortcut filter rather than trusting the full catalogue.
- The accepted snapshot includes Spanish LaLiga, English Premier League, German 1./2./3. Bundesliga and selected regional leagues, DFB cup and national-team feeds, UEFA Champions/Europa/Conference League, Nations League, Dutch Eredivisie, Austrian Bundesliga and selected women's competitions.
- Added the UEFA Women's Champions League shortcut (WCL) after confirming its catalogue entry is marked Frauenfußball and therefore passes the football sport guard.
- Narrowed the generic la prefix to the verified LaLiga shortcut la1, preventing arbitrary Latin-American la* feeds from being treated as European.
- Added regression tests for LaLiga, UEFA women's competition, DFB national/youth competitions and rejection of a synthetic Latin-American shortcut, non-football entries and known test Bundesliga feeds.
- An intermediate test exposed the LaLiga regression after narrowing the prefix; corrected it by adding the verified la1 shortcut and reran the full suite successfully.
- Final code commit: dd4e0c609c05a95f23d4a9f64b9a893915217389 (fix(rebuild): explicitly recognize verified LaLiga shortcut la1).
- CI run 44118446492: SUCCESS — TypeScript, all tests and production build passed.
- Cloudflare deployment run 44118446658: SUCCESS — separate rebuild Worker deployment passed.
- The catalogue is still community-maintained and incomplete. This stage improves the set of recognized European feeds; it does not establish exhaustive coverage of every European country, division, women's/youth league or amateur competition.
- Stage 17 is COMPLETE/DEPLOYED.

## 2026-11-17 — Stage 18: dashboard status, activity and source attribution
- Replaced the obsolete dashboard progress labels (which still showed Tracker as NEXT and other modules as WAIT) with the actual current platform state: foundation and Tracker complete; source coverage, form/prediction/coupon workflows active; final audit and mobile visual verification still in progress.
- Dashboard metrics now calculate active paper coupons from local records rather than displaying a hard-coded zero.
- Dashboard activity now lists the latest five local Tracker records instead of always showing an empty placeholder.
- Added visible source links and attribution for open-matchday, OpenLigaDB and OpenFootball. The open-matchday non-commercial restriction is disclosed in the dashboard and match source notes.
- Clarified that an empty downloaded fixture list does not prove there are no European matches.
- Final UI commit: e2f8f46b6a9e416bc8fb10f06dcf69e59148e7cf (style(rebuild): make public data source attributions readable; includes dashboard update 90d7297029282d2995b87336f3da49157febc9cb).
- CI run 44119268126: SUCCESS — TypeScript, all tests and production build passed.
- Cloudflare deployment run 44119268133: SUCCESS — separate rebuild Worker deployment passed.
- Public Worker smoke check confirmed the updated dashboard copy, progress labels and source links. The text fetch does not execute the client-side React app or prove fixture data loading; visual/mobile E2E and live browser scan validation remain outstanding.
- Stage 18 is COMPLETE/DEPLOYED.

## 2026-11-17 — Stage 19: repair Cloudflare API routing and encoded OpenLigaDB paths
- Live endpoint verification found a production-path bug: requests under /api/openligadb/* were receiving the SPA index.html instead of JSON. The Worker handler existed, but Cloudflare Static Assets used asset-first routing with single-page-app fallback, so the API paths never reached the handler.
- Configured assets.run_worker_first for /api/* so the Worker now handles API requests before the SPA fallback. This is the documented Cloudflare routing mechanism for SPA + API Workers.
- Expanded the Worker route matcher to accept percent-encoded UTF-8 competition shortcuts and safely decode/re-encode them before forwarding to OpenLigaDB. Applied the same encoding treatment to team-history shortcut and team-name segments.
- CI run 44120043921: SUCCESS — TypeScript, all tests and production build passed.
- Cloudflare deploy run 44120043971: SUCCESS — separate rebuild Worker deployment passed.
- Live Worker smoke tests now return JSON, not HTML: league catalogue 88 entries; Premier League feed 380 matches; UEFA Women's Champions League feed 54 matches; UEFA WCL team-history route for FC Bayern München Frauen returned 6 matches. Encoded ÖBL/Thüringen shortcuts also returned valid JSON arrays (currently zero rows from those specific feeds, not an HTML fallback).
- This fixes a real integration blocker: OpenLigaDB catalogues, match feeds and team-history requests can now reach the upstream API through the Worker. Zero-row league feeds remain provider-data gaps and are not treated as errors.
- Final config commit: 6e4d0df0b7bf5211cf63ae5cb9d1fc5cc2105bd7 (fix(rebuild): route API requests through Worker before SPA assets).
- Stage 19 is COMPLETE/DEPLOYED.

## 2026-11-17 — Stage 20: live OpenLigaDB feed audit
- Re-read the current OpenLigaDB 2026 catalogue after the Worker routing repair: 88 total catalogue entries, 35 accepted by the app's current European-football classification rules.
- Queried all 35 accepted match feeds for season 2026 and filtered matchDateTimeUTC/matchDateTime to the Brussels calendar date 2026-11-17. OpenLigaDB returned two fixtures for that date: Denmark–Norway and Wales–Portugal (Nations League feed).
- Several accepted feeds returned no season rows or no fixtures for this date. They remain visible as provider limitations rather than being silently counted as matches. Other providers (open-matchday and OpenFootball) are merged separately and can contribute additional matches.
- Verified that the repaired Worker proxy serves the 88-entry catalogue and real league JSON, and that the UEFA Women's Champions League team-history endpoint returns six matches for FC Bayern München Frauen.
- No source rows or probabilities were fabricated. A provider's empty response is not evidence that no match exists in all European football.
- Stage 20 is COMPLETE as a source audit; no new code deployment was required beyond Stage 19.


## 2026-11-17 — Stage 21: idempotent fixture history in Tracker
- Connected every successful daily fixture scan to the local Tracker's match registry.
- Each discovered fixture is recorded with its provider fixture ID, Brussels date/time, competition, source and source-update timestamp when supplied.
- Repeated scans are idempotent: existing match rows with the same fixture ID are preserved and not overwritten; new fixtures are appended in one storage write.
- Hardened backup record validation to reject array-shaped details objects while retaining the existing merge-only import rule.
- Added regression tests for repeated scans, preservation of existing match rows and malformed details payloads.
- Validation/deployment status: pending GitHub Actions CI and separate rebuild Worker deployment after this commit.


## 2026-11-17 — Stage 22: Tracker integrity and multi-tab consistency
- Hardened backup validation: record IDs must be non-empty, timestamps parseable, and details values must remain flat JSON primitives. Nested objects/arrays are rejected rather than silently accepted into the typed Tracker schema.
- Backup import now deduplicates repeated IDs inside the same backup file as well as against existing local records. Existing records always win; imports only add missing IDs.
- Tracker writes emit a same-tab update event. The React app listens for same-tab updates and browser storage events, keeping open tabs/windows in sync without a server or overwriting existing records.
- Added regression tests for nested malformed details and duplicate IDs within one backup.
- Validation/deployment status: pending automated CI and separate rebuild Worker deployment. Cross-device sync remains a separate backend requirement; this stage only synchronizes tabs on the same browser origin.


## 2026-11-17 — Stage 23: PWA cache and install metadata hardening
- Reworked the service worker cache lifecycle so activation deletes only older MONEYBALL shell caches and never clears unrelated origin caches.
- Fixture/API routes are now network-only at the service-worker layer; this prevents stale match lists or results from being served as if they were current. Offline navigation still falls back to the cached application shell.
- Same-origin build assets use cache-first behavior; the hashed Vite asset names remain safe across deployments.
- Expanded manifest scope and descriptions and declared dedicated 192×192 and 512×512 vector app icons for install surfaces; added favicon and Apple touch icon metadata.
- This stage improves PWA installation metadata and offline shell behavior. Browser-specific installability and offline acceptance still require real device/browser testing.
- Validation/deployment status: pending CI and Cloudflare deployment.


## 2026-11-17 — Stage 24: isolated GitHub Actions verification pipeline
- Added a dedicated workflow triggered only by pushes and pull requests targeting `moneyball-rebuild`, plus manual dispatch.
- The pipeline installs Node 22 dependencies and runs TypeScript typecheck, the full Vitest suite and the production Vite build.
- The workflow does not deploy or modify the production `main` branch. Cloudflare deployment remains a separate gated release step.
- Validation status: workflow committed; waiting for the first Actions run and its actual job result.

- Follow-up hardening: offline navigation fallback now reads only the active MONEYBALL cache, and the 192px SVG icon declares matching intrinsic dimensions.


## 2026-11-17 — Stage 25: CI workflow bootstrap correction
- Audited the isolated verification workflow against the actual `package.json` and repository files.
- Removed `actions/setup-node` npm cache configuration because this branch currently has no `package-lock.json` or other npm lockfile. Without a lockfile, the cache action can fail before dependency installation and prevent the actual typecheck/tests/build from running.
- Kept Node 22 and the explicit install, typecheck, Vitest and production build steps. This is a bootstrap fix only; it does not establish that CI is green.
- Commit: 78f5aa67e933415d550ae75994a03a15beaefc13.
- Validation: awaiting the GitHub Actions run for this push; no claim of a successful pipeline or new Cloudflare deployment is made.


## 2026-11-17 — Stage 26: isolate static asset cache lookups
- Audited the service worker's fetch handler after Stage 23. Navigation fallback already queried only the active MONEYBALL cache, but static asset lookup still used global `caches.match(request)`, which can search unrelated caches on the same origin.
- Restricted static asset lookup to `CACHE_NAME` as well. This aligns asset reads with the existing activation cleanup policy and prevents another app's cache entry from being reused.
- Commit: 01360c91430dcd0623c310d857c3d0d434d6580f.
- Validation: source change committed; CI and production Worker deployment remain unverified for this commit.


## 2026-11-17 — Stage 27: honest notification status in the UI
- Replaced the inert notification bell with a working disclosure toggle.
- The panel explicitly states that Web Push is not configured and that the app does not currently send background or cross-device alerts. This avoids implying a capability that has not been implemented.
- Commit: e7d972d8df18e9c18bde476656af3755fb935050.
- Validation: source committed; CI, browser interaction and deployment checks remain pending.


## 2026-11-17 — Stage 28: automatic result refresh and paper settlement
- Connected the existing result lookup and paper-coupon settlement flow to app startup and the existing 15-minute refresh cycle.
- Pending predictions now attempt to retrieve final scores automatically at launch and on each refresh; complete three-leg paper coupons are settled when all three fixture results are present.
- Added an in-component lock to prevent overlapping settlement runs (including duplicate effect invocation) from creating duplicate result/settlement records.
- Manual Intelligence action remains available for an immediate check.
- Commit: 3bad5f6f59f25948a8d7e7c53b83417ba5dbc3c8.
- Validation: pending CI and Cloudflare deployment for this change; no live result-feed completeness claim.

## Stage 29 — model-audit integrity hardening
- Fixed result joining so duplicate settlement rows cannot cause an older result to overwrite the newest result during audit calculations. Tracker ordering is newest-first; the audit now keeps the first valid result per fixture.
- Added defensive probability validation before calibration and metric calculations. Malformed, out-of-range or non-normalized probability rows are excluded and remain counted as unmatched instead of breaking the Intelligence view.
- Added regression tests for newest-result precedence and malformed probability rows.
- Source commit: `b7c85a529ab5e704c74117e2aff1eec3ebf5d0aa`.
- Test commit: `f1f3e5311f316a2ffe72f9257a9cc7e4c936656d`.
- Validation and Cloudflare deployment are triggered by the latest branch push; stage remains pending until those workflows complete successfully.

## Stage 30 — idempotent pending-result selection
- Added a dedicated, tested selector that chooses only the newest-first prediction for each unsettled fixture and ignores fixtures that already have a result.
- Wired automatic/manual settlement to the selector, preventing duplicate provider requests and duplicate result records when older Tracker backups contain multiple predictions for one fixture.
- Regression tests cover duplicate prediction rows, already-settled fixtures and malformed rows.
- Commits: initial integration `06a0ff05952fc4e0c9b73055f0cac2257ec38526`; selector `ae8bd4e050ccf9c9e7cbeb1d27ec1484ac7126a6`; tests `945803fc9d97982c8c1a60ebaa6318e236339a41`; tested selector wiring `e483dc244a677b5753bce410c939c8c8ceb2e146`.
- CI and Cloudflare deployment are pending on the latest branch state; do not mark this stage deployed until both succeed.

## Stage 31 — Tracker CSV export
- Added a CSV export containing every Tracker row and all details as a JSON cell, with proper CSV quote escaping and UTF-8 BOM for spreadsheet compatibility.
- Added an explicit Eksport CSV action next to the versioned JSON backup; JSON remains the validated restore format and is not replaced.
- Added a regression test for the CSV header, text fields and fixture identifiers.
- Commits: implementation `a1bdda97535a5354c72c72098b76a9d90b3ca35f`; test `82225fe3b2af70f876220ebaaa08806acb5b8c6e`; UI `975b36eb779e0a68479a82705568f95e6f17780b`.
- CI and Cloudflare deployment are pending; this stage is not complete until both pass.

## Stage 32 — coupon settlement result precedence
- Fixed coupon settlement to retain the newest valid result for each fixture, matching Tracker's newest-first ordering and the prediction audit's behavior.
- This prevents older conflicting/legacy result rows from silently changing a coupon's hit/miss status.
- Added a regression test with conflicting result rows and an explicit correct-leg count assertion.
- Commits: implementation `ee2ae8d8db177cc06408a3c7180f3b6acae37a0d`; test updates `3834bdc39e1348d87aed93cc78e36feb22f9a6e9`, `09066643243f1b542da74c7b987b899fe2891c5e`, `8f9a1476fd86da75f918dee1a2380704a1d574a3`.
- CI and Cloudflare deployment pending on the latest branch push.

## Stage 33 — unique prediction weighting in Intelligence
- Hardened model audit to use only the newest prediction per fixture, matching the Tracker newest-first convention. This prevents duplicate/legacy prediction records from overweighting accuracy, Brier score, log loss and calibration.
- Invalid newest prediction rows remain unmatched rather than silently falling back to an older prediction.
- Added a regression test proving duplicate predictions for one fixture count once.
- Commits: implementation `8d4b9970e34a07ef15d185eb55cd08212b9f9a45`; test `9a884abcfcd4280e88620e6053b1372e2a6b7538`.
- CI and deployment pending on latest branch commit.
