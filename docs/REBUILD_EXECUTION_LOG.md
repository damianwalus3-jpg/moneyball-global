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

## Stage 34 — idempotent automatic result and coupon settlement
- Automatic result retrieval now inserts a result only when no result record for that fixture already exists, using the Tracker's fixture key.
- Paper coupon settlement rows are inserted idempotently by parentCouponId, preventing repeated refresh cycles from creating duplicate child settlement records.
- Added Tracker-store regression coverage for repeated result and coupon settlement writes.
- This is best-effort browser-local deduplication; localStorage is not a transactional cross-device database, so it does not promise atomic multi-device writes.
- Commits: App integration `d453b6ef41a1daf1f1c13dc4f3da9d31772f25eb`; tests `eaed5b016a6fe6675fe13e115bb5d11fa4c5f603`.
- CI and Cloudflare deployment pending for the final stage commit.

## Stage 35 — newest-first history after backup import
- Fixed Tracker backup merge ordering: after importing previously unseen rows, the combined history is sorted by createdAt descending, preserving the newest-first contract used by result and prediction selection.
- Existing records with matching IDs remain unchanged; only missing IDs are merged.
- Added regression coverage for chronological ordering and preservation of an existing record.
- Commits: implementation `ad83e9112a8d2d15befddc3869c4d39d503d2076`; test `aefa6649637d55d3351fb56a115274a046259349`.
- CI and Cloudflare deployment pending for the latest branch commit.

## Stage 36 — retry malformed result settlements
- Pending-result selection previously treated any result row with a fixtureId as settled, even if its actual outcome was malformed. Such a row could permanently suppress future provider retries for that fixture.
- The settled fixture set now accepts only recognized 1/X/2 outcomes. Invalid result rows no longer block a fresh retrieval attempt.
- Added a regression test for an invalid result record followed by a valid pending prediction.
- Commit: `8b9518b0f644636ea1529adbcdef86e81ca44f8a`; test: `fb7dc5913a8320338c89cca72b8ca37b4c73b216`.
- CI and Cloudflare deployment pending for the next consolidated commit.

## Stage 37 — verified result can replace malformed legacy result
- Follow-up audit found an interaction between stages 34 and 36: retry selection correctly ignored malformed result rows, but the generic idempotent insert still treated any existing fixtureId as a duplicate, preventing the verified result from being saved.
- Result-key deduplication now ignores legacy result rows unless actual is one of 1/X/2. Valid results remain idempotent.
- Added regression coverage for malformed legacy result followed by verified result and a repeated verified insert.
- Implementation commit: `13ba2dfaf9cc04e3830d076342a3b33a5faa102e`; test commit: `53d70ca157be88ecf8b670e5d566d8be3a4b8626`.
- CI and deployment pending for the final log commit.


### Stage 37 — CI regression correction (2026-11-17)
- The first Stage 37 CI run exposed a pre-existing test-fixture timing assumption in the Stage 35 backup-order test, not a TypeScript or application runtime failure.
- The test used the current wall-clock time for the existing Tracker row but a fixed earlier timestamp for the imported backup row, while asserting that the imported row must sort first. On the CI runner the existing row was correctly newer.
- Corrected the test fixture to use a deterministic future timestamp for the imported newest row. Production sorting behavior is unchanged.
- Stage 37 implementation remains in place; final CI and Cloudflare deployment must pass on the corrected branch HEAD before marking this stage deployed.


### Stage 38 — deterministic newest prediction for coupon generation (2026-11-17)
- Coupon candidate generation no longer assumes Tracker rows are newest-first. This matters for older/imported records, which can arrive in a different order.
- For each fixture, the engine now explicitly selects the eligible prediction with the latest valid `createdAt` timestamp before constructing three-leg combinations.
- Added regression coverage with an older high-probability prediction appearing before a newer lower-probability prediction for the same fixture; the newer prediction must be selected.
- Preserves the existing rules: same selected date, exactly three distinct fixtures, each selected outcome probability at least 75%, and no bookmaker odds claim.
- CI and Cloudflare deployment are required before this stage is marked complete/deployed.

- First Stage 38 CI run caught an error in the new regression fixture: the intended older prediction was accidentally assigned its own fixture ID rather than sharing the newer prediction's fixture ID. Corrected the test data to model two predictions for the same match; the production selector logic is unchanged. Re-run CI/deploy required.


## Stage 39 — retryable prediction enrichment
- Found a refresh-path bug in `savePredictionRecord`: once a fixture/model had any prediction row, later scans could never save a successful form-based prediction if the first attempt had been a placeholder with missing probabilities.
- Added a small policy helper: first attempt is retained; repeated failed attempts do not flood Tracker; a later successful probability set can supersede an earlier invalid/empty row; once a valid prediction exists, it remains the canonical saved prediction for that fixture/model.
- Added regression tests for first attempt, duplicate failure suppression, recovery after source data becomes available, valid-record protection, and fixture isolation.
- Existing history is append-only; no rows are deleted or overwritten. Intelligence already selects the newest prediction per fixture.
- CI and Cloudflare deployment required before marking complete.


## Stage 40 — meaningful, deduplicated fixture scan history
- The 15-minute fixture refresh previously appended an identical Tracker scan row every cycle, steadily growing local history without adding information.
- Scan summaries are now idempotent by a stable signature containing Brussels date, source set, fixture count, checked catalogue count and the failed-source list. A materially changed scan still creates a new append-only history row.
- Retained source-level fixture counts (open-matchday, OpenLigaDB, OpenFootball) and failed-source names in each scan record to improve later coverage audits.
- Added regression coverage proving identical summaries are deduplicated while changed scan outcomes remain visible.
- No fixture, prediction, result, coupon or historical Tracker row is deleted or overwritten.
- CI and Cloudflare deployment required before marking deployed.


## Stage 41 — strict final-score validation for OpenLigaDB
- Audited automatic settlement and historical-form ingestion. Both previously fell back to the last arbitrary OpenLigaDB result row when an explicit final-result row was missing; that could mistake a halftime or other intermediate score for a final score.
- Centralized final-score selection and now accept only OpenLigaDB resultTypeID 2 or an explicitly named final/end-result row. If no explicit final score exists, the fixture remains pending and can be retried on the next refresh.
- Added regression tests for halftime-only rows in both team-form history and settlement lookup.
- This intentionally favors a delayed verified settlement over a false result. Existing Tracker history remains untouched.
- CI and Cloudflare deployment required before marking deployed.


## Stage 42 — transparent European coverage disclosure
- Added an explicit note beside live source-coverage counters explaining that the public feeds do not guarantee exhaustive coverage of every European league, regional tier, women's competition or youth competition.
- The note distinguishes successful source retrieval from completeness of the underlying datasets; zero feed errors must not be interpreted as full European coverage.
- No source coverage has been artificially inflated and no unsupported completeness claim is made.
- CI and Cloudflare deployment required before marking deployed.


## Stage 43 — separate Double Chance market audit
- Intelligence now evaluates Double Chance as a separate binary-market set (1X, X2, 12), independently from the official 1X2 accuracy/Brier/log-loss metrics.
- For each verified fixture with valid stored DC probabilities, the audit evaluates three binary outcomes and reports sample count, accuracy, Brier score and log loss. Missing/invalid DC fields are excluded without contaminating 1X2 metrics.
- Added a regression test proving the DC sample and scores are calculated separately; added a dedicated UI section with explicit three-markets-per-fixture sample labeling.
- DC probabilities remain derived from the current 1X2 model; this audit does not claim an independently trained DC model.
- CI and Cloudflare deployment required before marking deployed.


## Stage 44 — Cloudflare Worker integration regression tests
- Added isolated tests for the production Worker OpenLigaDB proxy: fixture endpoint mapping, safe encoding of team names, source/CORS/cache headers, successful-response caching, no caching of failed upstream responses, and pass-through to static assets.
- These tests exercise the Worker handler contract in CI without requiring paid services or live API credentials.
- This is automated integration coverage, not a substitute for visual testing on a physical Android device.
- CI and Cloudflare deployment required before marking deployed.


## Stage 45 — final release acceptance and capability boundaries
- Added a consolidated acceptance record for the implemented local-first analytical/paper-tracking scope and its verified CI/Cloudflare release.
- Recorded the exact production branch, Worker, release commit and workflow evidence.
- Explicitly documented remaining platform/data boundaries: non-exhaustive public fixture coverage, no xG-trained model, DC derived from 1X2, no bookmaker odds/EV, browser-local Tracker, no Web Push, and no physical-device or authenticated end-to-end smoke test.
- The release is complete for the implemented scope; the documented boundaries remain future work rather than being falsely marked as delivered.


## Stage 46 — specialist product, UX and engineering audit
- Performed a source-level review of the full rebuild branch, product/domain specifications, CI/deploy workflows, PWA service worker and live production page content.
- Added `docs/REBUILD_SPECIALIST_AUDIT_2026-11-17.md` with prioritized P0/P1/P2 findings, product/UX recommendations, source-compliance concerns and acceptance gates.
- The audit is analysis only: no application behavior was changed in this stage. Interactive physical-device smoke testing and a reproducible historical backtest remain unperformed and are explicitly called out.


## Stage 47 — explain every rejection and surface one strongest daily candidate
- Added explicit pre-kickoff protection: when a fixture's scheduled local kickoff has passed, the analysis is rejected and the reason is persisted instead of recording it as a pre-match forecast.
- Prediction records now retain the fixture kickoff time, allowing later selection logic to exclude started matches.
- Added a deterministic dashboard/Typ dnia selector: it chooses at most one saved candidate, ranking derived Double Chance markets by probability and requiring at least 80%; it displays the exact fixture, market, probability, kickoff and model limitations. If no candidate qualifies, it explicitly shows no pick.
- Added per-fixture rejected-status explanation in the match list, using the stored rejection reason; missing reasons receive an explicit diagnostic fallback.
- This is a model-ranked candidate, not a guaranteed bet. Double Chance probabilities remain mathematically derived from the 1X2 model and are not independently calibrated.
- European fixture coverage audit: the scanner queries all non-empty European folders listed in open-matchday's public build index, all catalogue entries accepted by its OpenLigaDB Europe classifier, and the current OpenFootball Europe feed list. It merges duplicate team/date matches. It cannot prove that every European fixture exists in these feeds: source catalogues are incomplete, OpenLigaDB classification uses league-name/shortcut heuristics, and deduplication currently keys by date+normalized teams (not competition/kickoff). The UI must not claim 100% coverage; source counts and fetch failures are the verifiable coverage evidence.
- CI and Cloudflare deployment required before marking this stage deployed. Country-by-country independent fixture reconciliation remains outstanding.


## Stage 48 — selected/rejected odds and stake ledger
- Added a dedicated Stawki workspace for manual tracking of model predictions as selected or rejected decisions.
- Both decision types retain market, decimal odds, fixture, competition and decision history. Selected entries require a positive stake and calculate potential return/profit; rejected entries always carry zero stake and remain hypothetical.
- Added summary metrics for selected count, settled count, wins/losses, net P/L, ROI, average odds and rejected-pick hit rate once settlement data is available.
- The current UI records decisions and odds locally in the existing Tracker store. Automatic settlement/P&L and rejected-pick counterfactual grading are the next implementation gate; until then open records must not be counted as realized profit/loss.
- Existing Tracker history and backup format remain preserved; new record kind is additive.
- CI and Cloudflare deployment required before marking this stage complete.


### Stage 48 — automatic result settlement and P/L comparison
- Added outcome evaluation for 1, X, 2 and Double Chance selections (1X, X2, 12) against verified final result rows.
- Selected entries are settled once: win profit is stake × (decimal odds − 1); loss is negative stake. Rejected entries receive a separate hypothetical hit/miss status and never affect bankroll/P&L.
- Settlement events are append-only child rows keyed by parentBetId, preventing repeated 15-minute refreshes from duplicating settlement outcomes.
- Added unit tests for 1X2/DC grading, win/loss accounting, rejected hypothetical grading and idempotency.
- CI and Cloudflare deployment required before this feature is considered live.


## Stage 49 — research automatycznego pobierania kursów i przekazanie do nowego czatu (2026-11-17)
- Przeprowadzono przegląd publicznych stron dostawców kursów: API-Football, APIfootball.com, The Odds API, Odds-API.io, Sportmonks, football-data.org, Betfair oraz publicznego repozytorium OddsPortal scraper.
- Wniosek: brak potwierdzonego feedu, który jest równocześnie darmowy, bez klucza API, stabilny i pokrywa wszystkie europejskie ligi. Scraping bukmacherów bez sprawdzenia ToS/licencji nie jest bezpiecznym zamiennikiem.
- Najlepszy kandydat na ograniczony darmowy pilot: API-Football Free (100 req/day; pre-match/live odds; klucz wymagany; pre-match aktualizowane orientacyjnie co 3h; dostępność zależy od fixture/league/bookmaker). Nie gwarantuje pełnego pokrycia.
- Alternatywa APIfootball.com Free deklaruje 180 req/h/endpoint i odds 65+ bukmacherów, ale free fixtures ograniczone są do Championship i Ligue 2; wymaga klucza.
- The Odds API ma 500 kredytów/miesiąc w free planie; Odds-API.io wstrzymało wydawanie nowych darmowych kluczy; Sportmonks free obejmuje dwie ligi, a odds bundle jest płatny; football-data.org ma płatny Odds Add-On; Betfair ma osobne warunki klucza delayed/live i licencji.
- Zapisano pełny raport: `docs/ODDS_PROVIDER_RESEARCH_2026-11-17.md`.
- Zapisano przekazanie do nowego czatu: `docs/NEW_CHAT_HANDOFF_2026-11-17.md`, zawierające rozdzielenie środowisk, stan produktu, ograniczenia, etapy 1–48, decyzje i kolejne kroki.
- Nie wdrożono jeszcze żadnego odds providera, nie dodano sekretu ani klucza API i nie zmieniono kodu aplikacji. Powód: brak potwierdzonego feedu zero-key z wymaganym pokryciem; użytkownik wcześniej preferował rozwiązanie bez kluczy i bez opłat.
- Następny krok po decyzji o dostępie do klucza: adapter provider-neutral w Workerze, snapshot history append-only, konserwatywne dopasowanie fixture, freshness/status UI, test coverage kilku lig. Bez klucza pozostawić moduł jawnie jako brak automatycznego feedu.


## Stage 50 — rozszerzone przeszukanie forów, GitHub i alternatywnych odds feedów (2026-11-17)
- Rozszerzono badanie o publiczne dyskusje Reddit/r/algobetting, projekty GitHub, katalogi API, Polymarket, OddsPapi i StrikerAPI oraz regulaminy OddsPortal/BetExplorer/football-data.co.uk.
- Nowy kandydat nr 1: OddsPapi Free — 250 requestów/miesiąc, pre-game REST i historyczne odds, szeroka lista bookmakerów wg dostawcy; darmowy klucz wymagany, WebSocket nie jest w darmowym planie, brak gwarancji kursu na każdy mecz. Wymaga live testu coverage. Dane o liczbie bookmakerów i pełnym boardzie pochodzą głównie od dostawcy.
- Nowy kandydat nr 2: StrikerAPI Free — 500 credits/miesiąc; get_odds kosztuje 5 credits dla meczu lub 10 credits dla dnia; odds aktualizowane co godzinę dla spotkań z najbliższych 4 dni; brak in-play; ograniczony zestaw europejskich lig. Dobry jako dodatkowy feed/benchmark, nie gwarantuje pełnej Europy.
- Polymarket Gamma jest bez klucza, ale to prediction-market pricing, a nie bukmacherskie kursy; ewentualna integracja wyłącznie jako oddzielny benchmark z kontrolą płynności/spreadu.
- FootballAPIs.com jest katalogiem porównawczym providerów, nie źródłem kursów.
- OddsHarvester ma dojrzały kod Playwright i pobiera upcoming/historic odds z OddsPortal, ale regulamin OddsPortal zabrania automatycznych żądań, scrapingu/agregacji i publicznego wykorzystywania istotnej części bazy bez zgody. MIT licencjonuje kod, nie dane. Nie wdrażać bez pisemnej zgody.
- BetExplorer ToS także zakazuje automatycznych żądań i scrapingu bez zgody. football-data.co.uk oferuje CSV odds, lecz warunki ograniczają użycie do prywatnego użytku i wykluczają komercyjne produkty/boty/scraping/AI training bez zgody. Nie podłączać do produkcji bez licencji.
- Publiczne fora wskazują na blokady Cloudflare, zmiany HTML/XHR, regionalne różnice list bookmakerów i nieaktualne kursy. Nie obchodzić blokad rotacją VPN/proxy.
- Raport rozszerzono w `docs/ODDS_PROVIDER_RESEARCH_2026-11-17.md`; handoff uzupełniono w `docs/NEW_CHAT_HANDOFF_2026-11-17.md`.
- Nie zmieniono kodu aplikacji, nie dodano kluczy/secrets, nie wdrożono scrapera. Badanie nie może dowieść pokrycia wszystkich europejskich lig bez live testów providerów.
- Rekomendowana następna bramka: użytkownik zgadza się na darmowy klucz OddsPapi i/lub StrikerAPI, następnie wykonujemy test coverage 5–10 spotkań z kilku krajów, sprawdzamy bukmacherów, timestampy, limity i dopasowanie do fixture; dopiero potem implementujemy Worker adapter.


## Stage 51 — przygotowanie równoległego pilota OddsPapi + StrikerAPI (2026-11-17)
- Użytkownik wyraźnie zaakceptował użycie obu darmowych kluczy API: OddsPapi i StrikerAPI.
- Zweryfikowano aktualną dokumentację: OddsPapi v4 `/v4/tournaments`, `/v4/fixtures`, `/v4/odds`; limit Free 250 requestów/miesiąc, billable calls liczone także przy błędach endpointu. StrikerAPI `POST /v1/get_odds`; 10 credits za dzień lub 5 za mecz; 500 credits/miesiąc; obsługiwane ligi są ograniczone.
- Dodano plan testu `docs/ODDS_PROVIDER_PILOT_TEST_2026-11-17.md` z limitami zapytań, próbą 5–8 meczów, kryteriami fixture matching, 1X2, bookmakerów, freshness, błędów i kosztu quota.
- Klucze muszą być utworzone przez użytkownika w darmowych kontach i zapisane bezpośrednio w Cloudflare Worker Secrets jako `ODDSPAPI_API_KEY` i `STRIKERAPI_API_KEY`. Nie wolno przesyłać ich przez czat, commitować do repo ani umieszczać w frontendzie.
- Na tym etapie nie wykonano live requestów, ponieważ klucze nie zostały jeszcze wygenerowane/ustawione. Nie stworzono kont, nie włączono billing i nie dodano sekretów. Nie ma jeszcze wyniku coverage.
- Następna bramka: po ustawieniu obu Worker Secrets uruchomić ograniczony live pilot na 5–8 rzeczywistych fixture'ach, bez zapisywania danych testowych do P/L. Dopiero raport wyników zdecyduje, czy którykolwiek provider nadaje się do integracji.


## Stage 52 — izolowany proxy pilota kursów OddsPapi + StrikerAPI (2026-11-17)
- Dodano w Cloudflare Worker dwa endpointy: `GET /api/odds/status` (wyłącznie informacja true/false, czy sekret jest skonfigurowany) oraz `GET /api/odds/pilot?fixtureId=...&strikerGameId=...`.
- Sekrety `ODDSPAPI_API_KEY` i `STRIKERAPI_API_KEY` są odczytywane wyłącznie po stronie Worker; endpoint status nie ujawnia wartości, odpowiedzi mają `Cache-Control: no-store`, a klucze nie są zwracane klientowi.
- OddsPapi: Worker wywołuje `GET /v4/odds` dla jawnie podanego fixtureId. StrikerAPI: Worker wywołuje `POST /v1/get_odds` dla jawnie podanego game_id i normalizuje trzy kursy moneyline do decimal odds, gdy wszystkie wartości są poprawne.
- Pilot zwraca surowe dane OddsPapi oraz znormalizowane kursy StrikerAPI. Nie wykonuje automatycznego cross-provider matching, nie zapisuje kursów do Tracker/P&L i nie uruchamia masowego skanu.
- Identyfikatory providerów są odrębne od fixture ID aplikacji; należy je dopasować i zweryfikować przed interpretacją wyników. Nie zakładać, że oba providery zwracają dane dla tego samego meczu.
- Dodano testy: status sekretów bez wycieku, walidacja identyfikatorów, wywołanie OddsPapi, moneyline-to-decimal StrikerAPI, brak wywołania bez sekretu oraz zachowanie proxy OpenLigaDB.
- Commity: Worker `a6cd74c18d20a63b1c9ed6b2f81edd096fd20270`; testy `acc8dd051946c6d23967dea6aa388905034740bf`.
- GitHub Actions Rebuild Checks dla commita Worker `a6cd74c18d20a63b1c9ed6b2f81edd096fd20270` uruchomił się jako run `44187285622`; w chwili zapisu był IN_PROGRESS. Końcowy status CI i deploy należy potwierdzić po zakończeniu workflow.
- Nie potwierdzono obecności sekretów w Cloudflare przez API; endpoint `/api/odds/status` po deployu będzie właściwą metodą sprawdzenia. Nie wykonano jeszcze rzeczywistych zapytań do providerów ani nie potwierdzono coverage.
- Ograniczenie: StrikerAPI wymaga jego własnego game_id. Nie wolno przekazywać do niego lokalnego fixture ID, jeśli nie jest to zgodny identyfikator dostawcy.

### Stage 52 — walidacja CI i deployment
- Commit dokumentacyjny po implementacji: `dbd612e68f31569b3536d6b35f36f2f3b608d9eb`; aktualny branch HEAD w chwili weryfikacji.
- Legacy MONEYBALL rebuild CI run `44187392610`: SUCCESS — bun install, typecheck, testy i build.
- Rebuild Checks run `44187392532`: SUCCESS — instalacja, TypeScript, wszystkie testy i production build.
- Cloudflare deployment run `44187392628`: SUCCESS — krok deploy oddzielnego Worker zakończony powodzeniem.
- Live smoke test endpointu `/api/odds/status` nie został potwierdzony: dostępne narzędzia nie mogły odczytać publicznego endpointu. Nie twierdzić, że Worker odpowiada ani że sekrety są skonfigurowane, dopóki endpoint nie zostanie sprawdzony z przeglądarki.
- Kod/testy są wdrożone według statusu GitHub Actions, ale realne wywołanie dostawców, konfiguracja sekretów i coverage nadal czekają na smoke test.


## Stage 53 — korekta autoryzacji OddsPapi i odpowiedzi CORS (2026-11-17)
- Ponowna kontrola branch HEAD oraz workflow: commit `9e8289f22fecf61e9733485f0d7bc721c4d680c4` miał SUCCESS dla Rebuild CI, Rebuild Checks i Cloudflare deployment (runy `44187555051`, `44187555135`, `44187555077`).
- Audyt kodu wykrył dwa problemy: preflight OPTIONS zwracał body przy statusie 204; OddsPapi było autoryzowane nagłówkiem `x-api-key`, podczas gdy oficjalna dokumentacja v4 wymaga parametru query `apiKey`.
- Poprawiono OPTIONS na pustą odpowiedź 204 z nagłówkami CORS.
- Poprawiono OddsPapi: klucz jest przekazywany jako query parameter wyłącznie z Worker (nie trafia do frontendu ani odpowiedzi). Dodano testy dla obu przypadków.
- Oficjalna dokumentacja OddsPapi potwierdza parametr `apiKey` w query string: https://oddspapi.io/en/docs oraz https://oddspapi.io/us/docs/errors. Źródła: dokumentacja producenta.
- Commity: Worker `ee80716922515e680acd701c11b63948e82a971f`; testy `ff3252aeed5c72bf127396aace5c360ff78c8d3a`.
- Wymagane po commitach: potwierdzić CI i deployment dla najnowszego HEAD. Nie wykonywać jeszcze billable zapytań OddsPapi. Live endpoint status nadal nieosiągalny w narzędziach; obecność sekretów i rzeczywiste działanie providerów pozostają niepotwierdzone.

### Stage 53 — wynik końcowy walidacji po poprawce
- Pierwsza iteracja testów ujawniła, że zmiana autoryzacji nie została zastosowana do rzeczywistego fragmentu kodu (test oczekiwał parametru apiKey, Worker nadal wysyłał x-api-key). Błąd wykryto w CI i poprawiono przed uznaniem etapu za zakończony.
- Finalny commit kodu: `728650d7492eecaee11ad46f327f23b287263ff5`.
- Finalne workflow dla tego samego HEAD: MONEYBALL rebuild CI `44189226174` SUCCESS; MONEYBALL Rebuild Checks `44189226170` SUCCESS; Cloudflare deployment `44189226159` SUCCESS.
- Zmiany OPTIONS i OddsPapi query authentication są więc w finalnym wdrożeniu REBUILD. Poprzednie runy dla commitów pośrednich zakończone failure/cancelled nie są aktualnym stanem; finalny HEAD ma komplet SUCCESS.
- Nadal niepotwierdzone: publiczny smoke test `/api/odds/status`, obecność obu sekretów, live odpowiedź OddsPapi/StrikerAPI oraz coverage i fixture matching. Nie wykonywano billable zapytań do OddsPapi.


## Stage 54 — odds pilot access hardening — 2026-11-17
- Audit found the public `/api/odds/pilot` endpoint could call configured paid/credit-metered providers without owner authentication. This could allow third parties to consume the user's provider quota.
- Added fail-closed `ODDS_PILOT_TOKEN` bearer authentication. When the secret is absent the pilot returns HTTP 503 without contacting either provider; an invalid token returns HTTP 401.
- Restricted CORS grants to the exact production REBUILD origin. Arbitrary origins no longer receive Access-Control-Allow-Origin. OPTIONS allows the Authorization header.
- Added a 10-second upstream timeout to OddsPapi, StrikerAPI and OpenLigaDB fetches.
- Kept `/api/odds/status` read-only; it reports only whether provider secrets and the pilot token are configured, never their values.
- Added unit tests for disabled pilot, invalid token, arbitrary-origin CORS denial, authenticated provider requests and secret non-disclosure.
- Code commits: Worker `e204fc4ead9b9a661802a9ffe672faee0a50121d`; tests `f9058ab38a2dcea1f8bd8902fef98e62073c8da3`.
- Required before live provider pilot: set a strong random `ODDS_PILOT_TOKEN` secret on the separate `moneyball-global-rebuild` Worker. Until then the provider pilot is intentionally disabled, even though provider keys are configured.
- CI and Cloudflare deployment must pass for the test commit before marking Stage 54 deployed. No provider credits were consumed and no Tracker, coupon, settlement or bankroll records were changed.


## Stage 54 — odds pilot access hardening — 2026-11-17 (verified)
- Audit found the public `/api/odds/pilot` endpoint could call configured credit-metered providers without owner authentication.
- Added fail-closed `ODDS_PILOT_TOKEN` bearer authentication. If absent, pilot returns HTTP 503 without contacting providers; invalid token returns HTTP 401.
- Restricted CORS grants to the exact production REBUILD origin. Arbitrary origins do not receive `Access-Control-Allow-Origin`; OPTIONS permits the Authorization header.
- Added a 10-second timeout to upstream OddsPapi, StrikerAPI and OpenLigaDB requests.
- `/api/odds/status` reports only configuration booleans, never secret values.
- Added tests for disabled pilot, invalid token, arbitrary-origin CORS denial, authenticated provider calls and secret non-disclosure.
- Worker commit `e204fc4ead9b9a661802a9ffe672faee0a50121d`; test correction commit `d50cae3e857fad0fa5f4d1913beb84e9a6132b74`.
- CI `44190808454` (commit d50cae3) passed; Cloudflare deployment `44190808432` (commit d50cae3) passed. Public smoke test confirmed both provider secrets are configured and pilot remains disabled until the owner token is added.
- No provider odds endpoint was called; no credits consumed and no Tracker/coupon/settlement/bankroll records changed.

## Stage 55 — verified kickoff guard for pre-match predictions — 2026-11-17 (verified)
- Audit found fixtures with missing kickoff time (`—`) were treated as future events by the prediction workflow and could enter the pre-match prediction path.
- Added strict date/time validation through `hasKnownKickoff`; invalid dates and unknown times are now rejected before form retrieval or prediction.
- The safest-pick selector also excludes any prediction without a valid, known kickoff time, including legacy Tracker rows.
- Added tests for unknown kickoff, malformed calendar dates and normal future kickoff values.
- Final implementation is on `moneyball-rebuild`; latest validation run `44191051496` passed typecheck, all Vitest tests and production build. Cloudflare deployment `44191051439` passed all validation steps and deployed successfully.
- Production smoke test after deployment confirmed the app shell responds, `/api/odds/status` returns both provider keys configured and `pilotEnabled:false`, and unauthenticated `/api/odds/pilot` returns HTTP 503 without contacting providers.
- Intermediate commits had failed/cancelled workflow runs while test fixtures and the kickoff helper regex were corrected. Only the final successful run/deployment above is the accepted release evidence.
- No existing Tracker, prediction, coupon, settlement, bankroll or historical record was changed.


## Stage 56 — coupon candidate probability integrity — 2026-11-17 (verified)
- Audit found that imported or malformed Tracker prediction rows could be admitted to the three-leg coupon pool when each probability was individually in range but the 1X2 distribution did not sum to 1, or when the stored selection was not the model's highest-probability outcome.
- Coupon candidate creation now rejects non-finite/out-of-range probabilities, non-normalized 1X2 distributions (tolerance 0.0001), and selections that do not match the highest 1X2 probability.
- Added regression tests for invalid probability sums and inconsistent selections.
- Final commit: `f87a0b44eabcf454c8ad0df7a07379b8f8da0a27`.
- CI `44191380721`, rebuild checks `44191380973`, and Cloudflare deployment `44191380659` all completed successfully. TypeScript, production build and all 92 tests across 17 test files passed.
- No existing Tracker rows, coupons, settlements, bankroll or historical records were rewritten.


## Stage 57 — StrikerAPI daily batch odds lookup — 2026-11-17 (verified)
- Added a protected `strikerDate=YYYY-MM-DD` lookup mode to the existing pilot endpoint. The Worker sends one `POST /v1/get_odds` request with `{ date }` and normalizes all returned games/bookmakers using the same decimal-odds adapter as the single-game mode.
- Retained the single-game `strikerGameId` mode. The API rejects malformed dates and requests that supply both date and game ID, before contacting the provider.
- Response identifies the lookup as `utc_date`; the warning explicitly requires conversion of `startsAt` to Europe/Brussels before fixture matching. The provider's date parameter is UTC, not the user's local calendar date.
- Official StrikerAPI documentation states that `get_odds` costs 5 credits for one game or 10 credits for a date lookup, and that the date parameter is UTC. Reference: https://strikerapi.com/docs/get-odds and https://strikerapi.com/docs.
- Added tests for request body, multi-game normalization, invalid date and conflicting lookup modes. No real provider request was made and no credits were consumed.
- CI `44191675525` passed TypeScript, tests and production build; all 94 tests across 17 files passed. Cloudflare deployment `44191675193` completed successfully.
- Current pilot remains disabled until `ODDS_PILOT_TOKEN` is configured; provider keys remain configured. No Tracker, coupon, settlement, bankroll or historical records changed.


## Stage 58 — conservative odds-to-fixture matching — 2026-11-17 (verified)
- Added a reusable provider-to-MONEYBALL fixture matcher using normalized home/away names, exact Europe/Brussels calendar date and a maximum 30-minute kickoff difference.
- The matcher refuses unknown kickoff times, reversed home/away order, wrong local dates and large kickoff differences.
- It never guesses when multiple provider games match one fixture or one provider game is claimed by multiple local fixtures; those cases are returned as ambiguous for manual review.
- Added six regression tests for normalized club names, Brussels timezone conversion, kickoff tolerance, wrong date/order, ambiguity and missing time.
- CI `44191916368` passed TypeScript, all tests and production build; 100 tests across 18 test files passed. Cloudflare deployment `44191916355` completed successfully.
- The matcher is a tested module and is not yet connected to the user-facing odds panel or automatic Tracker snapshot creation. No provider request or credits were used.


## Stage 59 — user-facing StrikerAPI odds workflow — 2026-11-17 (CI/deploy verified)
- Added a protected odds connection panel to the Stawki workspace. The user can enter the same `ODDS_PILOT_TOKEN` configured as a Cloudflare Worker secret; the token is stored only in this browser's localStorage and never written to Tracker or repository.
- Added an explicit manual daily StrikerAPI batch action. It calls only `/api/odds/pilot?strikerDate=YYYY-MM-DD` after a click; no automatic provider calls occur on app load or refresh.
- The UI explains the UTC date semantics and 10-credit daily call cost. It blocks an accidental second call for the same date unless the user explicitly unlocks another request.
- Uses the Stage 58 conservative fixture matcher. Only unambiguous future fixtures with exact normalized home/away names, same Brussels date and kickoff within 30 minutes are linked.
- Saves each bookmaker's 1X2 prices as append-only Tracker odds snapshots with fixture/provider IDs, bookmaker, source, capture time, completeness flag and matching time difference. Existing records are never overwritten.
- Added a recent-snapshots table in the Stawki workspace. Incomplete prices remain visibly incomplete; they are not silently treated as complete 1X2 odds.
- CI `44192192529` and Cloudflare deployment `44192192228` passed; all 100 tests across 18 test files passed.
- No real provider call was made. Production `/api/odds/status` still reports both provider keys configured and `pilotEnabled:false` because the owner token has not yet been configured. Therefore the UI cannot fetch live odds until the user sets the Worker secret and enters the same token in the app.
- Visual browser click-through was not completed because the browser automation wallet had a zero balance. The code build, unit tests and deployment did pass.


## 2026-11-17 — Stage 19: enforce strong odds pilot secret
- Hardened the rebuild Worker so an absent or shorter-than-32-character `ODDS_PILOT_TOKEN` keeps the odds pilot disabled (HTTP 503) before any provider call.
- `/api/odds/status` now reports `pilotEnabled: true` only when the configured secret meets the minimum length; it still never returns secret values.
- Added regression coverage for a weak configured token and updated successful test fixtures to use strong-length tokens.
- No real OddsPapi or StrikerAPI request was made and no provider credits were consumed.
- Code commits: `a1d97fdf18c09d10977f0e1980bdbd99e06dac1d` and `26576025587354f4d5a67f0581ea02f2b1c8ee9d`.
- CI and Cloudflare deployment verification: pending; do not mark this stage deployed until both pass.

- Follow-up test-fixture correction: `c89db32c15af9630c151862acc7b1c9d18ca05be` updates the status endpoint test to use a strong-length pilot secret.
- GitHub combined status for the latest code commit currently exposes only a failing `Vercel` context with a build-rate-limit URL. This is not the required Cloudflare rebuild deployment check and is not treated as a successful CI/deploy result. Stage 19 remains PENDING verification; no Vercel deployment was requested or attempted.


## 2026-11-17 — Stage 20: conservative odds valuation engine
- Added `src/odds-value.ts` as a pure valuation layer over append-only Tracker odds snapshots.
- Valuation requires the exact fixture ID and an explicitly selected bookmaker; it only accepts rows marked complete 1X2 with all three valid decimal prices.
- Selects the newest eligible snapshot, rejects snapshots older than six hours by default or captured in the future, and rejects invalid/non-normalized model probability distributions.
- Removes bookmaker margin by normalizing the three reciprocal prices (proportional no-vig method), then calculates selection expected value as `modelProbability × decimalOdds − 1`.
- Added bookmaker discovery restricted to complete, valid and fresh snapshots.
- Added tests for EV, no-vig probability, newest snapshot choice, bookmaker isolation, incomplete/stale/future/invalid odds and malformed model probabilities.
- Files added: `src/odds-value.ts` commit `7391f33b490b1539ea2d41e0c29f42743eb8f7df`; `src/odds-value.test.ts` commit `9d22aeed105ae8bde764ea281588515e9a13be15`.
- This stage is the tested-by-design valuation module only; coupon UI, coupon persistence, stake/return settlement and bookmaker selection UI are intentionally not marked integrated yet.
- No live provider requests were made and no credits were consumed. CI and Cloudflare deployment validation remain pending.


## 2026-11-17 — Stage 21: three-leg coupon valuation
- Added `src/coupon-value.ts` to value a three-leg candidate only when all three fixture legs have complete, valid and fresh 1X2 snapshots from the same explicitly selected bookmaker.
- Uses each leg's newest stored prediction probabilities and the verified price for that leg's selected 1/X/2 outcome.
- Calculates combined decimal AKO odds, combined model probability, coupon EV, stake, potential gross return and potential net profit.
- Default paper stake is €4; invalid/non-positive stakes and any missing/stale/other-bookmaker leg fail closed.
- Added tests for combined odds/EV/€4 return, same-bookmaker requirement, missing leg odds and stale snapshots.
- Files added: `src/coupon-value.ts` commit `99e386923f10b79450700ee37bd4355a24d6e33a`; `src/coupon-value.test.ts` commit `33eacdbeed43423bd79b41fb0d20c124cd5d6fc3`.
- Coupon valuation is a calculation module only. UI selection, persistence of bookmaker/odds/stake into coupon records, and settlement of priced paper coupons remain outstanding.
- No real provider calls or credits consumed. CI and Cloudflare deployment validation remain pending.


## 2026-11-17 — Stage 22: coupon UI and paper settlement integration
- Integrated bookmaker selection into the Coupons module; the list is derived only from fresh, complete, valid 1X2 snapshots for fixtures in the current candidate pool.
- Coupon cards now show per-leg verified decimal prices and EV, plus combined AKO odds, combined EV, and €4 paper stake / potential gross return / net profit when all three prices exist from the same bookmaker.
- If any leg lacks a complete fresh quote, the UI explicitly says so and only offers saving a no-odds paper coupon. It never estimates missing prices.
- Priced coupons are stored as `PAPER_WITH_ODDS`, preserving bookmaker, captured prices, combined odds, model probability, EV, €4 stake, potential return/profit and per-leg prices in Tracker history.
- Paper settlement now accepts priced and unpriced coupons. For priced coupons, the settlement record retains bookmaker, AKO odds, stake, gross return on a hit and net profit/loss; an all-leg miss records the full stake as loss. Unpriced historical coupons continue to settle without invented financial values.
- Added regression test that priced coupons settle using the same fixture result logic.
- Code commits: coupon settlement support `61733339efde2b4d0c8f4fd349a577e18aefa93c`; UI integration `88310ec99573371a405773383a53bb2f083f1460`; settlement regression test `2bcc5a594d283f20140bc3e1069658d065e189a4`.
- No existing Tracker records were rewritten; the new status applies only to coupons saved after this deployment.
- CI and Cloudflare deployment validation remain pending. Do not claim this workflow is live until those checks pass.


## Continuity checkpoint — 2026-11-17 (chat handoff)
- Active project: **MONEYBALL REBUILD**, repository `damianwalus3-jpg/moneyball-global`, branch `moneyball-rebuild`, isolated Worker `https://moneyball-global-rebuild.damianwalus3.workers.dev/`.
- Hard exclusions: do not modify branch `main` or the MAIN Worker; do not use Vercel, TEST, Lovable, Supabase or paid database services for this rebuild. Preserve existing local Tracker records and coupon/result history.
- Execution log is the canonical task history: this file contains the rebuild stages and their code commits, validation state, source limitations and next steps. Append a dated entry for every implementation/audit step.
- Stage 19 strong pilot token hardening is committed but not validated by the required Cloudflare CI/deploy. Latest related code commits: `a1d97fdf18c09d10977f0e1980bdbd99e06dac1d`, `26576025587354f4d5a67f0581ea02f2b1c8ee9d`, test-fixture correction `c89db32c15af9630c151862acc7b1c9d18ca05be`. A short Worker secret is rejected before provider calls; minimum length is 32 characters.
- Stage 20 odds valuation module: `7391f33b490b1539ea2d41e0c29f42743eb8f7df`; tests `9d22aeed105ae8bde764ea281588515e9a13be15`.
- Stage 21 three-leg coupon valuation: `99e386923f10b79450700ee37bd4355a24d6e33a`; tests `33eacdbeed43423bd79b41fb0d20c124cd5d6fc3`.
- Stage 22 coupon UI and priced paper settlement: settlement support `61733339efde2b4d0c8f4fd349a577e18aefa93c`; UI `88310ec99573371a405773383a53bb2f083f1460`; regression test `2bcc5a594d283f20140bc3e1069658d065e189a4`.
- Latest docs checkpoint commit: `57b091b362739a2f45025dadfaae7e0f7cdc26d5`.
- GitHub combined status for recent commits currently reports only a failing Vercel build-rate-limit context; that is not accepted as proof of a Cloudflare build/deployment. Do not deploy to Vercel. CI/typecheck/test/build and Cloudflare deployment for Stages 19–22 remain pending independent verification.
- No actual OddsPapi/StrikerAPI request was made, no credits consumed, and no provider secret was requested in chat. Do not run paid provider requests without the user explicitly enabling the Worker pilot and initiating the intended request.
- Next actions: (1) obtain a valid branch build/test and isolated Cloudflare deploy signal; (2) fix any TypeScript/test regressions; (3) verify priced coupon settlement and financial ledger/bankroll effects without mutating old history; (4) add cross-tab server-side odds-fetch protection if feasible without introducing paid infrastructure; (5) continue fixture coverage, source reliability and model calibration audits. Do not mark overall rebuild complete while any of these remain open.


## Stage 60 — coupon valuation must match the current qualified prediction (2026-11-17)
- Re-audited the Stage 20–22 odds valuation and coupon UI integration against the actual ThreeLegCandidate, Tracker schema and save/settlement path.
- Found an integrity gap: valueThreeLegCoupon selected the newest prediction row for each fixture but did not require it to remain a qualified KANDYDAT prediction, did not verify that the chosen 1/X/2 selection still matched the coupon leg, and trusted the coupon's stored combined probability rather than recomputing it from the current model probabilities.
- Hardened valuation to fail closed unless there are exactly three distinct legs and each fixture's newest prediction is still KANDYDAT, explicitly marked strongCandidate, has a normalized probability distribution, retains the exact selected outcome and per-leg probability used by the candidate, and still meets the 75% threshold.
- Combined coupon probability is now recomputed from the three current model probabilities and compared with the candidate snapshot before any odds/EV/return calculation. A newer rejected or materially changed prediction invalidates the old coupon price.
- Corrected the coupon valuation test fixture so it reflects the actual 75%+ strong-candidate eligibility rule. Added regression tests for a newer rejected prediction and changed probabilities.
- Commits: implementation 9777696caeabe226b791be45f91b935fe641253b; tests d9747d31d50a9f9d6f7bc49623144d2948ee3539.
- Validation: source and test changes are committed to moneyball-rebuild. CI and Cloudflare deployment status for the resulting branch HEAD must be checked before marking this stage verified/deployed. No provider requests, credits, Tracker records or bankroll values were changed.
- Follow-up audit still required: confirm coupon save deduplication and paper-settlement financial arithmetic; verify all latest code commits with the isolated rebuild CI and Cloudflare deployment workflows. Do not use the unrelated Vercel status as a release signal.

- CI feedback loop: the first TypeScript run on implementation commit 9777696 detected a redundant runtime length comparison against the statically fixed three-element tuple. Removed that impossible comparison in commit efbf610ddb3e676acc62f112c879274dd0fb2b8b; the distinct-fixture validation remains. A fresh CI and deployment run is required on the corrected HEAD.


## Stage 61 — idempotent paper coupon creation (2026-11-17)
- Continued the coupon workflow audit after Stage 60. The UI previously used addRecord directly, so repeated taps or revisiting the same candidate could create duplicate paper coupons and duplicate apparent exposure.
- Added a stable couponKey based on Brussels scan date, the three fixture IDs and selections, and the selected bookmaker (or NO_ODDS). The UI now disables the save action once that exact coupon is already present.
- Coupon writes now use addRecordsIfMissing keyed by couponKey. This is append-only and does not alter historical coupon rows or settlements.
- Added a Tracker regression test proving repeated writes with the same couponKey create exactly one coupon.
- Implementation commit: 0a4f12599d12efb51ec231a9ea1156a4ace33f0c; test commit: c32cfc01faa1a0b99bbc03d016ed43e6a3cf48a5.
- Validation/deployment: pending CI and Cloudflare workflow completion on the latest branch HEAD. Stage 61 is not marked deployed until both are verified.

- CI feedback loop for Stages 60–61: the first run caught two TypeScript-only issues in sequence (a redundant comparison against a fixed tuple length, then an unused callback argument in the updated test fixture). Both were corrected; the second correction is commit be4810ab09c1d26507b6c2d76b7b759fcbb43c67. Fresh CI and Cloudflare deployment runs on the latest HEAD are required; earlier failed/cancelled runs are not release evidence.


## Stage 62 — repair CI regressions exposed by full test run (2026-11-18)
- Retrieved full GitHub Actions job logs for the latest Stage 60–61 candidate. TypeScript passed, but unit tests exposed three fixture/expectation defects:
  1. Two coupon candidate legs still declared 50% probability although their current KANDYDAT predictions were 80%; this correctly caused the new probability-integrity guard to refuse valuation. Updated fixture probabilities to 80% so the positive-path test now represents a valid eligible coupon.
  2. Worker status test used an ODDS_PILOT_TOKEN shorter than the enforced 32-character minimum but expected pilotEnabled=true. Updated it to a valid-length dummy test secret.
  3. Invalid-owner-token test configured a too-short server secret, so the Worker correctly returned 503 pilot_disabled before checking authorization. Updated configured secret to valid length while retaining a wrong supplied bearer token, so the test exercises 401 unauthorized.
- Commits: coupon fixture 0900bb1984419db202b9c3b15196b27f610f0a39d; Worker auth fixtures 09f03e3bc7d7816c41d078bf72ac17c013f49ec5.
- Earlier CI run reported 109 passing / 3 failing tests (112 total); these were test-data issues, not reasons to weaken the fail-closed security or prediction validation.
- New CI and Cloudflare deployment checks on the latest branch HEAD are pending. No external odds API was called and no Tracker or bankroll data was modified.

- Follow-up CI exposed one remaining regression-test ordering mistake: the simulated newer rejected prediction had the same createdAt as the existing KANDYDAT row, so stable sorting correctly retained the original first row. Updated the test to use a strictly later timestamp in commit b38fd98821ead5bd276bf9b37836ad6f62fe4553. The production newest-prediction ordering was not weakened.


## Stage 62 — CI repair verified and deployed (2026-11-18)
- After correcting the fixtures, GitHub Actions passed on branch moneyball-rebuild at commit c03eecce7a6a65738c20d60e32627ea7eca78959:
  - MONEYBALL rebuild CI: success (run 44195657321)
  - MONEYBALL Rebuild Checks: success (run 44195657257)
  - Cloudflare Free Worker deployment: success (run 44195657199)
- Verified the live REBUILD Worker URL returned the MONEYBALL application shell with the expected title, Polish UI, and current navigation/dashboard content. No production MAIN resources were touched.
- The test suite completed successfully after fixing the coupon test's timestamp ordering; the successful CI run includes typecheck, tests and build.
- Stage 60/61 changes are therefore validated and deployed to the separate REBUILD Worker.

## Stage 63 — explicit paper coupon settlement accounting (2026-11-18)
- Moved paper coupon settlement financial arithmetic from inline UI code into the tested pure helper buildPaperCouponSettlementRecord.
- For a priced PAPER_WITH_ODDS coupon with valid decimal AKO odds and positive stake: win records gross return = stake × odds and net profit = stake × (odds − 1); loss records gross return 0 and net loss = −stake.
- Legacy PAPER_NO_ODDS coupons, and malformed price/stake values, retain null odds/stake/P&L/return rather than inventing a financial result. Existing Tracker history remains append-only.
- App now uses the shared helper when adding the settlement child record; duplicate protection remains keyed by parentCouponId.
- Added tests for priced win, priced loss, unpriced legacy coupon and invalid price/stake.
- Commits: helper 931c1f4ffde9a1e47007a75e67f27ad13889b9f7; App integration dae0748baee6d5ef1685aefd6796809cece2f9ea; tests d6acb2964858fe6380a3bf7db42cbf2462ff7bf6.
- Validation and deployment for Stage 63 are pending the latest CI and Cloudflare workflow results.


- Stage 63 validation: GitHub Actions on commit f796b532e34f1bf94c4c91cd05943ff1e5926916 reported MONEYBALL rebuild CI success; the deployment workflow reached successful build, typecheck, test, production build and Cloudflare deploy steps. The Stage 63 changes are validated and deployed on the separate REBUILD Worker.

## Stage 64 — latest prediction controls coupon eligibility (2026-11-18)
- Deeper coupon-engine audit found a separate stale-candidate bug: candidate generation filtered out rejected/weak prediction rows BEFORE choosing the newest row per fixture. Consequently, an older KANDYDAT at 75%+ could remain in a coupon even after a newer ODRZUCONY or weak prediction existed.
- Changed the order of operations: first choose the newest prediction record per fixture/date regardless of status/eligibility, then apply the KANDYDAT, strongCandidate, normalized-probability, top-selection and 75% rules. Newer rejected/weak rows now invalidate old candidates.
- Added regression tests for a newer rejected prediction and a newer weak prediction superseding an older strong candidate.
- Commits: implementation 5fc3d8470089d1c01a2cad0f8b7d3175fc883d7b; tests 1ee2f7d9aef18e12ab19a4b486410aab3e0a3d9d.
- Validation/deployment: pending latest branch workflow results. Existing Tracker rows are read-only; no records or bankroll values were changed.


- Stage 64 validation: CI and Cloudflare deployment both succeeded on commit 958ca5e543c5710618cfb1fdade6fd33771bcfa7 (MONEYBALL rebuild CI run 44196031052; rebuild checks 44196030890; deployment run 44196031053). Typecheck, unit tests and production build passed. The updated coupon eligibility logic is live on the REBUILD Worker.

## Stage 65 — safe settlement of manually selected bets (2026-11-18)
- Audited buildBetSettlementRows and found that imported or malformed Tracker rows could be settled with invalid odds/stakes, producing misleading or non-finite P/L. The result map also relied on array order rather than timestamps.
- Settlement now chooses the newest valid result by createdAt, accepts only known decisions and supported 1X2/Double Chance selections, and refuses to create a financial settlement for selected bets unless odds are finite and >1 and stake is finite and positive.
- Added regression tests for invalid odds, negative stake and out-of-order result records.
- Commits: implementation aeb700e3bff9b4efcc4d4107b706aecb5975911a; tests 45221e63ebd330a14122d05f68587a886e1cf812.
- Validation/deployment pending latest CI and Cloudflare workflow results. No historical Tracker records or bankroll values were modified.


## Stage 66 — expand European fixture discovery and remove static OpenFootball feed ceiling (2026-11-18)
- User reported that the daily scan returned only 10 fixtures and asked for a full audit and deployed correction.
- Audited the actual scan path in src/free-fixtures.ts, src/openfootball.ts and the match-list UI. The UI does not cap the full list at 10 (the dashboard only previews six); the actual OpenFootball adapter was limited to a hard-coded list of 18 feeds and never discovered newly published European country/competition files. The OpenLigaDB classifier also omitted several common two-letter European feed prefixes (for example fr1, nl1, pt1, gr1, ch1 and Nordic/Central European codes).
- Inspected the live OpenFootball Europe Git tree: 271 entries, 212 text files, with current-season files across additional countries/competitions beyond the 18 hard-coded feeds. The source tree is not exhaustive or always current; this change expands discovery but does not claim complete European coverage.
- Implemented dynamic discovery from the single recursive OpenFootball Europe Git tree endpoint, selecting only current-season/calendar-year files for known European country directories; retains existing standalone country feeds; records catalogue failures in source errors; registers discovered feed IDs so team-form and result adapters can resolve them after scan. Bumped both fixture-cache versions so an old 15-minute cached scan cannot hide newly discovered feeds; dynamic feed registry is initialized before any cached scan is returned.
- Expanded OpenLigaDB country shortcut classification using strict country-code-plus-digit/separator matching for ISO-2 and ISO-3 codes; ambiguous shortcuts beginning with a country code are rejected unless they match the code pattern, while verified named feeds such as NOFV and Regionalliga remain included. Added regression tests for the missing country prefixes. Added dynamic OpenFootball discovery tests to exclude stale seasons, RSSSF history files and non-European folders.
- No paid provider requests, credits, Tracker records, coupon history or bankroll values were touched. Stage validation and separate Cloudflare REBUILD deployment are pending CI.


## Stage 66 — validation and deployment confirmation
- CI run 44197660638 succeeded: typecheck, unit tests and production build.
- Rebuild checks run 44197660818 succeeded.
- Separate Cloudflare REBUILD deployment run 44197660690 succeeded.
- Live Worker https://moneyball-global-rebuild.damianwalus3.workers.dev/ returned the expected Polish MONEYBALL application shell. No MAIN Worker or main branch was changed.
- Source audit: open-matchday advertised 62 European competition folders and its index timestamp was 2026-11-17T07:19:26Z. The current OpenFootball Europe tree exposed eight 2026/27 or 2026 calendar-year files on the audit date. These public catalogues are finite and do not establish complete coverage of every European division.
- UI audit confirmed there is no 10-match cap in the scan or full Mecze list. The Dashboard intentionally previews up to six fixtures; the full Mecze tab renders every fixture returned by the scan. The observed count of 10 is therefore not caused by a scan `.slice(0,10)` limit. The exact ten browser rows were not available for row-by-row reconciliation.
- Current state: dynamic feed discovery, stricter European OpenLigaDB shortcut recognition, and stale-cache invalidation are deployed. Do not describe the scan as exhaustive. Next stage: qualify additional genuinely free, no-key European fixture sources and integrate only providers with verified coverage and usage terms.


## Stage 67 — ESPN daily scoreboard as a fourth independent European fixture source (2026-11-18)
- User again confirmed the live app still returned only 10 matches and asked for an internet-backed definitive correction. Re-opened the actual current branch, execution log and live source endpoints before changing code.
- Reproduced a live source-coverage gap for 2026-11-18: the ESPN public all-soccer daily scoreboard returned 28 events. Filtering by actual venue country yielded 19 European events (Spain 10, England 7, Sweden 1, Italy 1). The current open-matchday Copa del Rey CSV independently confirmed six Spanish fixtures on that date; ESPN included those same six plus European fixtures from competitions that the previous three sources did not supply. This provides a concrete reason why a scan can be stuck near 10 even though more European fixtures exist.
- Researched FotMob's public endpoint as another candidate. Its own current documentation states its Terms of Use prohibit automated/systematic retrieval without permission; therefore FotMob is NOT integrated. ESPN is used only as a low-volume, date-scoped supplemental scoreboard with five-minute Worker cache, not as a claim of complete coverage.
- Added a pure ESPN event parser that uses venue country to retain European matches, converts UTC kickoffs to Europe/Brussels, rejects non-European venues, validates payload shape, and preserves source IDs/competition labels.
- Added a separate Cloudflare Worker proxy route /api/espn/scoreboard/YYYYMMDD, with strict date validation, upstream timeout, JSON validation, CORS and five-minute cache. The app now queries this as source four, deduplicates it against the existing sources, records per-source counts/errors and invalidates its old scan cache.
- Updated Tracker scan diagnostics and the matches-tab source coverage line to show ESPN counts/errors. Existing Tracker history, coupon records, settlement history and bankroll values are untouched. No paid provider API was called.
- Stage 67 CI and deployment pending.

- CI caught an over-escaped slash in the new Worker route regex on the first pass; corrected the matcher before deployment. No production release was made from the failing revision.

- Hardened ESPN day boundaries: a Brussels-local calendar day is assembled from both the preceding UTC date and the same UTC date, then filtered by actual Europe/Brussels kickoff date. One scoreboard may fail without discarding the successful day's results; the scan reports partial source errors.

- Deployment queue safeguard: the prior REBUILD deploy workflow run 44199523416 remained stuck `in_progress` with no job steps and held the old concurrency group. Bumped the isolated REBUILD deploy concurrency group from v2 to v3 so the verified current build can deploy without touching MAIN.

- Post-deploy smoke test: the new ESPN proxy route was reachable but the upstream returned HTTP 403 to the initial Worker-specific automation User-Agent. Updated the upstream request to use ordinary ESPN website browser headers (User-Agent, Referer, Origin, Accept-Language) and will re-test the live route before considering Stage 67 complete.


## Stage 67 — live validation and separate Worker deployment
- Final code revision 6ce822efae3b4700b17d6dd95a6dc0c134f32cc8 passed MONEYBALL rebuild CI run 44200136994 (typecheck, unit tests, production build), Rebuild Checks run 44200137044, and separate Cloudflare REBUILD deployment run 44200136932.
- Live smoke test of https://moneyball-global-rebuild.damianwalus3.workers.dev/ succeeded. The new proxy endpoints `/api/espn/scoreboard/20261117` and `/api/espn/scoreboard/20261118` both returned HTTP-success JSON (65 and 28 raw events respectively).
- Combined those live scoreboards and filtered by Europe/Brussels local date plus European venue country: 19 unique European fixtures for 2026-11-18 (Spain 10, England 7, Sweden 1, Italy 1). The six Copa del Rey fixtures also occur in open-matchday and are deduplicated by normalized date/home/away keys; the additional European women's competitions were absent from the previous source-only set.
- The app now has four independent public fixture sources and explicitly reports source fixture counts/errors in the Matches tab. ESPN is supplementary, not a guarantee of complete all-European lower-tier coverage; source coverage must remain visible and no missing fixtures are fabricated.
- ESPN's initial Worker request was blocked with HTTP 403 when using the custom MONEYBALL User-Agent. Switching to ordinary browser User-Agent, Referer, Origin and Accept-Language headers fixed the live Worker request. The previous stale deployment concurrency lock was bypassed by moving the isolated REBUILD deploy group to v3; MAIN remains untouched.
- Existing Tracker records, coupon history, settlement history and bankroll were not modified.

## Stage 68 — cross-source fixture identity and women's-team alias deduplication
- Reviewed the user's 2026-11-18 screenshots and identified duplicate display rows caused by inconsistent team labels across feeds: women's suffixes, club suffixes (FC/F.C.), and known club aliases. Examples include Chelsea–Paris Saint-Germain, Juventus–OH Leuven, BK Häcken–Manchester City and Real Madrid–Inter appearing with different source labels.
- Reworked the fixture identity key to normalize Unicode diacritics, punctuation, club suffixes and the verified aliases OH Leuven / Oud-Heverlee Leuven and Inter / Inter Milan / Internazionale.
- Added an explicit gender dimension to the key. Women's markers in team or competition names (Women, WSL, WCL, etc.) are normalized but remain separate from men's/open fixtures, preventing false merges between men's and women's teams.
- Added regression tests for the screenshot examples, source spelling variants, date boundaries and gender separation.
- Initial CI attempts correctly caught edge cases in Unicode normalization, punctuation and suffix order. Each was corrected from the failing test logs; no failing revision was deployed.
- Final revision: 27ebd8357541974029eaad255bb6d3186ebe4b43. MONEYBALL rebuild CI run 44235321967 succeeded; Rebuild Checks run 44235321845 succeeded; separate Cloudflare REBUILD deployment run 44235322019 succeeded. Typecheck, unit tests and production build all passed.
- External same-day benchmark for 2026-11-18: Sky Sports' indexed fixtures list includes 19 European fixtures across UEFA Women's Champions League, Scottish women's league, Women's FA Cup, WSL Cup, Copa del Rey and Southern Premier League South. This is a benchmark for the competitions it covers, not a verified census of every European division. ESPN's two-UTC-day local-date scan previously returned 19 unique European venue events, but provider coverage differs and the totals must not be treated as exhaustive.
- No paid provider calls, Tracker records, coupon history, settlement history or bankroll values were modified. Only the isolated moneyball-rebuild branch and its separate Cloudflare Worker were changed.
- Next verification: compare the fresh in-app 2026-11-18 scan against the external benchmark and inspect source coverage diagnostics. Do not claim complete Europe-wide coverage until independent source reconciliation is complete.

## Stage 69 — Europe-wide fixture source research and coverage benchmark
- User priority reaffirmed: discover multiple dependable sources for every European football fixture, including lower divisions, women's, youth and regional competitions; record research and deployments in this log.
- Re-checked the isolated branch before research. The previous experimental API-Football adapter was only a partial stub: its Worker proxy route did not exist and no secret was configured. Removed that incomplete adapter immediately in commit 0f29efec58b43462c73dc2f15037ec8e96ccfa57 so it cannot create a false source or a permanent 404 warning. No production MAIN changes.
- Strongest new public discovery: FootyNomad publishes a date-specific, server-rendered fixture catalogue at `/fixtures/YYYY-MM-DD`. On 2026-11-18 its page showed 185–186 matches across 40 countries (the page changed by one between independent reads). Country/competition sections include lower and regional tiers, e.g. German Oberliga/Regionalliga, Bulgarian Third League, Italian Coppa Italia Serie D, Turkish 2. Lig, Albanian Cup, English non-league and WSL Cup, Scottish Lowland League, Spanish Segunda/Tercera RFEF, plus UEFA Women's Champions League. Summing the European country groups shown in that snapshot gives 99 domestic fixtures plus 4 UEFA Women's Champions League fixtures = 103 Europe-tagged matches. This is a strong benchmark for that day's listed competitions, not proof of every European competition.
- FootyNomad's public `robots.txt` allows general pages including `/fixtures/` and disallows `/api/`; it exposes no documented public API. Its privacy page says team/league logos are served by API-Football, but does not identify the fixture data provider. Do not call its hidden `/api/` routes or infer an API contract. Candidate integration is one low-frequency fetch of the permitted public date page, with attribution and a robust parser, subject to checking page structure and terms; no automated integration committed yet.
- SportScore public fixture endpoint was tested on 2026-11-18. It returns a maximum of 200 records per response, and its OpenAPI schema does not define pagination or offset. Passing `offset=200/400` returned the same first records; status filters separate upcoming/finished/live but the upcoming result itself hit the 200 cap. It has no country field in each fixture row and requires a visible dofollow “Powered by SportScore” link for free use. Therefore it is only a supplemental/validation candidate, not a completeness source.
- OpenFootAPI documents 120+ competitions, all 55 UEFA nations as coverage metadata, free Starter tier 5,000 requests/month, but requires an account/API key; coverage/freshness varies by source and no per-fixture guarantee. Good optional source if owner later chooses to configure a free key; demo key is explicitly not intended for production.
- API-Football documents 1,200+ leagues/cups and a free 100 requests/day plan requiring an API key. A single date-filtered fixtures call could fit the daily quota, but user preference has been no API keys, so it is not integrated without explicit owner choice.
- Football Charts documents 98 leagues in 44 countries, no-key trial quota 25 requests/day and 200/day with a free key; however its free key is personal-use only and a public app used by others requires a commercial plan. Not suitable as a no-key production dependency.
- Football Soccer API's free key covers yesterday's results only (50 calls/day); today's fixtures/live are on the paid Live plan. Not suitable for today's free fixture scan.
- LiveScore MCP claims 1,000+ competitions and free public endpoint, but its README/usage policy explicitly disallows bulk scraping and automated data harvesting. Do not integrate it as a background fixture feed.
- SofaScore confirms it does not offer public API endpoints due to data-provider agreements. Community scrapers use unofficial internal endpoints; not suitable as a dependable production source.
- Existing open data remains useful but limited: open-matchday says 75 competitions and updates daily; openfootball/europe is CC0 but coverage is volunteer-maintained and upstream updates are not reliably daily; OpenLigaDB is a free community API with 840 catalogue entries, but community freshness and league coverage vary; ESPN remains a supplementary scoreboard, not a census.
- Next step: implement and test a permitted FootyNomad public `/fixtures/{date}` parser in REBUILD only, if the page markup exposes stable match IDs/team names/competition and kickoff data; reconcile the result against the 103 Europe-tagged benchmark and existing sources. If parser cannot obtain reliable kickoff and country/competition identity, do not ingest guessed values. Also inspect OpenLigaDB country classification and source runtime, as the current four-source scanner still misses a large share of FootyNomad's published same-day fixtures.
- No paid calls, user Tracker records, coupon history, settlement history or bankroll values were modified. No production MAIN Worker or branch was touched.

## Stage 70 — FootyNomad integration into REBUILD daily scan
- Implemented a server-side Cloudflare Worker proxy for FootyNomad's permitted public date pages only: `/fixtures/YYYY-MM-DD`. It does not call or reverse-engineer FootyNomad's disallowed `/api/` paths.
- To produce the Brussels local day correctly, the Worker requests the previous and current UTC date pages, parses each fixture's exact `<time datetime="...Z">` timestamp, converts it with `Europe/Brussels`, and retains only matches whose Brussels date equals the requested date. The source page's local display text is not trusted as a timezone source.
- Parser extracts country group, competition, fixture ID, home/away names, kickoff, and status. Non-European country groups are filtered out; the World group is admitted only for UEFA/European competitions. Live cards without an exact timestamp are skipped and counted rather than assigned a guessed kickoff.
- Added source cache (15 minutes), upstream timeout, date validation, CORS, source diagnostics, and visible FootyNomad attribution link in the fixture panel. Browser scan cache version was bumped to avoid stale results.
- Live Worker test for 2026-11-18: 2 UTC pages checked; 197 European fixture entries across both source pages; 102 unique FootyNomad fixtures for the Brussels date after UTC-to-Brussels filtering; 15 country/competition groups represented (14 European domestic country groups plus UEFA); 0 missing-time skips in the European subset; 0 source errors. Sample matches include Turkish 2. Lig, Ukrainian U19, Polish Central Youth League, Bulgarian Third League, Italian Coppa Italia Serie D, Spanish RFEF, German Regionalliga, and UEFA Women's Champions League.
- This is a substantial improvement over the earlier 10/23-match scans, but 102 is the count from FootyNomad's coverage for this date, not proof that every European competition is included. Continue merging the four existing sources and verify unique union and overlap.
- Gender deduplication was extended for teams whose source names use a standalone `W` suffix (e.g. Chelsea W / Häcken W), preventing women's fixtures from being misclassified as open/mens or duplicated against "Women" variants.
- Additional independent benchmark: LigaToday advertises 680+ active leagues across 76 countries and its 2026-11-18 page listed 60 matches, including 43 European fixtures (Copa del Rey, Northern Irish Championship, Turkish 2. Lig, Bulgarian Third League, Italian Serie D Cup, Spanish RFEF, German Regionalliga and Polish III Liga). Its terms grant only a limited personal/non-commercial website-viewing licence and prohibit redistribution of its REST API responses without a written commercial agreement; therefore it is validation-only and not integrated.
- Flashscore/Livesport terms prohibit scraping/aggregating/recreating its database without express consent; Sofascore terms similarly prohibit extraction/reuse of substantial database content and automated scraping. Their unofficial GitHub scrapers/internal endpoints are not used.
- CI for the integrated FootyNomad source passed on commit `fbfce2b46c38f0f015b86ce67d49bdd759cf7cc6`: run `44238446882` success; Cloudflare REBUILD deployment `44238446810` success; Rebuild Checks `44238446831` success. Subsequent small diagnostics/attribution refinements are in progress on the same isolated branch.
- No API keys, paid data calls, Vercel, TEST, Lovable, Supabase, production MAIN branch/Worker, Tracker records, coupon history, settlements, or bankroll data were touched.
- Next: finish CI/deploy for the last diagnostics changes; run an in-app fresh scan and compare the union count against FootyNomad (102), LigaToday (43), ESPN, OpenLigaDB, open-matchday and openfootball; inspect which competitions are still missing. Do not mark Europe-wide completeness as achieved until the source overlap/gap report proves it.

## Stage 71 — final deployment verification
- Latest branch HEAD: `84589ace860f72b341aecc2927d1dfce9808a5f3`.
- Final CI run `44238643305`: success. Cloudflare REBUILD deployment `44238643293`: success. Rebuild Checks `44238643254`: success.
- Re-queried the deployed Worker endpoint after deployment for 2026-11-18: 102 Europe-only FootyNomad fixtures, both UTC source pages checked, 197 European source entries across the two pages, zero source errors and zero skipped missing-time fixtures in the European subset. Country distribution: TUR 17, UKR 7, POL 3, BUL 5, ALB 8, BIH 1, SRB 3, SVN 3, ENG 9, ITA 8, ESP 24, UEFA 4, GER 3, NIR 1, SCO 6.
- The Worker endpoint is verified live; the full browser UI scan/merged count has not been verified because the available remote browser runner could not start (zero wallet balance). Do not report the UI's final merged count as tested. The client scanner is wired to merge FootyNomad into the existing four sources and the diagnostics panel reports the separate source counts.
- Work remains open: independently compare the full merged scan with the FootyNomad 102 and LigaToday 43 benchmarks, identify remaining missing competitions/countries, and seek a legally usable broad-coverage feed that does not require a paid subscription or disallowed scraping. The app is not yet certified to contain every European match without exception.


## Stage 72 — live source endpoint audit and coverage checkpoint (2026-11-18)
- Read-only live checks were run against the separate REBUILD Worker and public provider pages. No Tracker records, predictions, coupons, settlements, bankroll values, secrets or provider credits were changed.
- REBUILD app root responds with the expected Polish MONEYBALL — Trust the Process shell. The production REBUILD Worker is reachable at https://moneyball-global-rebuild.damianwalus3.workers.dev; the existing production MAIN Worker and `main` branch were not touched.
- Live `GET /api/footynomad/fixtures/2026-11-18`: HTTP fetch succeeded; date=2026-11-18; 2 UTC source pages requested and checked; pageMatches=197 across both source pages; 102 unique Europe-filtered fixtures after Brussels-time conversion and provider-ID deduplication; 15 country/UEFA groups; skippedNoTimestamp=0; errors=0. Country totals: TUR 17, UKR 7, POL 3, BUL 5, ALB 8, BIH 1, SRB 3, SVN 3, ENG 9, ITA 8, ESP 24, UEFA 4, GER 3, NIR 1, SCO 6.
- Public FootyNomad date page independently reports 185 total fixtures across 40 countries, including the European country groups and four UEFA Women's Champions League fixtures. This provider's page count is a benchmark only; it is not a complete census of European football.
- Live ESPN proxy checks succeeded for both UTC dates needed by the Brussels day: 20261117 returned 65 raw events and 20261118 returned 28 raw events. These are raw scoreboard event counts, not Europe-filtered fixture counts; the app's parser still needs an in-app merged scan to record the actual European subset.
- open-matchday `build_summary.json` is reachable and reports 75 catalogues; generated_utc=2026-11-17T07:19:26Z. Per-league fixture freshness varies, so the catalogue count must not be mistaken for today's fixture count or full live coverage.
- `GET /api/odds/status` reports OddsPapi and StrikerAPI secrets configured, while `pilotEnabled=false`. No provider odds calls were made and no credits were consumed.
- Browser-level app scan and merged five-source union count remain unverified in this session: the remote browser runner could not start because its separate wallet balance was zero. Do not claim that the app's merged UI count or every source's Europe-filtered count passed.
- Next implementation gate: obtain the in-app fresh scan's per-source counts and merged fixture IDs; reconcile against the FootyNomad 102 benchmark and identify missing/extra fixtures by country, competition, gender/age category and kickoff. Inspect any mismatch before changing parser or deduplication logic. Keep source provenance and no-fabrication behavior. Do not mark Europe-wide completeness as achieved.
- Final state: Stage 71 endpoint verification remains valid; Stage 72 adds an independently observed read-only live audit. No code changes or deployment were made in this stage.


## Stage 73 — country-heading reconciliation for FootyNomad (2026-11-18)
- Read-only heading extraction of the complete public FootyNomad page `/fixtures/2026-11-18` returned all 40 country/World groups (the page reports 185 total matches).
- All European country groups present on this date are covered by the deployed `FOOTYNOMAD_COUNTRIES` parser map: Germany 3, Bulgaria 5, Italy 8, Turkey 17, Albania 8, Bosnia 1, England 9, Northern Ireland 1, Poland 3, Scotland 6, Serbia 3, Slovenia 3, Spain 24, Ukraine 7; World contains 4 UEFA Women's Champions League fixtures plus 3 ASEAN Club Championship fixtures.
- European domestic total is 98; adding the 4 UEFA fixtures gives exactly 102. This reconciles the live Worker endpoint's 102 unique European fixtures with the independent public page's country/competition headings for this date. The earlier rough 103 benchmark estimate in Stage 70 was an overcount and is superseded by this exact 102 reconciliation.
- Non-European groups on the same page (Algeria, Argentina, Bolivia, Brazil, Cameroon, Colombia, Congo DR, India, Japan, Jordan, Liberia, Mexico, Nigeria, Panama, Paraguay, Peru, Qatar, Saudi Arabia, South Korea, Suriname, Tunisia, Uganda, Uruguay, Venezuela and Zambia) are correctly excluded from the Europe-only feed.
- This validates FootyNomad country-group parsing for the 18 Nov snapshot only; it does not establish complete coverage of every European competition or prove that all fixtures listed by every federation are present.
- No code or user data changed; no additional provider calls beyond the public page read were made. Next: complete the in-app five-source merged scan and compare provider overlaps/unique additions.


## Stage 74 — UEFA Nations League fixture and prediction support (2026-11-18)
- User requested that UEFA Nations League fixtures be included in the European scan and receive the same pre-match prediction workflow as other fixtures.
- Verified the 2026/27 UEFA league phase schedule against UEFA's official fixture/results pages: matchday 6 concluded on 17 November 2026; no league-phase fixtures are scheduled on 18 November. Knockout/play-off draw is 20 November; quarter-finals and promotion/relegation play-offs are scheduled for 25–30 March 2027. No artificial same-day matches are inserted.
- Confirmed existing source paths recognize UEFA/Nations League as a European competition (FootyNomad's World-group allowlist and OpenLigaDB's `nla` catalogue shortcut), but ESPN/FootyNomad-only records did not carry the OpenLigaDB history key. Such fixtures could appear without a usable team-history path for the prediction engine.
- Updated ESPN and FootyNomad fixture normalization so Nations League fixtures are explicitly classified as UEFA and carry `leagueShortcut=nla` plus the season year. Added timezone.football slug aliases `nations-league` and `uefa-nations-league` with the same history metadata.
- This routes Nations League fixtures through the existing OpenLigaDB national-team match-history loader and preserves the current Poisson prediction workflow. If the provider has fewer than three prior matches for a team, the model marks the prediction unavailable/rejected rather than inventing form.
- Bumped fixture scan cache to v12 to prevent older cached metadata from hiding the tournament mapping.
- Added regression coverage for ESPN and timezone.football Nations League classification, UEFA grouping, and the `nla` history key.
- Research sources: UEFA official 2026/27 fixture/results schedule; OpenLigaDB public API docs (no API key; 60 requests/minute fair-use limit); openfootball/martj42 international results data (CC0) reviewed as a potential independent historical fallback, but not substituted into live prediction history because the accessible snapshot ends 30 September 2026 and is stale for November pre-match form.
- Changes are limited to the isolated `moneyball-rebuild` branch and `moneyball-global-rebuild` Worker. No MAIN, Tracker history, coupons, settlements, bankroll or paid odds credits were touched.
- Verification/deployment status: pending CI and isolated REBUILD deploy after this commit.


## Stage 75 — prediction rejection diagnosis and dashboard drill-down (2026-11-18)
- Reviewed the user screenshots: Dashboard showed 115 same-day fixtures and 128 stored prediction records; Intelligence showed only 2 settled 1X2 predictions, 126 awaiting results, 50.0% accuracy (n=2), and DC sample size 6. Stored analyses are not the same as qualified candidates or settled outcomes.
- Root cause in the analysis path: for each team the loader returned the first provider response even when it contained fewer than the required 3 completed prior matches. The Poisson model then rejected the prediction without trying the next available history provider. Changed the loader to continue to OpenLigaDB/OpenFootball when a source returns fewer than 3 matches, and to record the exact per-source sample shortfall in the rejection reason.
- Additional source-merge defect: fixture deduplication kept the first canonical row but only appended source labels from later providers. It discarded useful history identifiers (leagueShortcut, leagueSeason, openFootballFeedId, etc.). Added a shared metadata/provenance merge helper and applied it to OpenLigaDB, OpenFootball, ESPN, FootyNomad and timezone.football merges. This lets the prediction workflow use history providers discovered by a secondary source.
- Added a regression test proving an ESPN fixture retains the OpenLigaDB nla history identifier after deduplication.
- Dashboard metric cards now open their relevant detail tabs. The safest-pick panel links to its full selection page. Intelligence now has an expandable diagnostics section showing candidate/rejected counts, missing-probability count and grouped rejection reasons, plus an explanation of the distinct 75% 1X2 and 80% DC gates.
- The codebase contains no FV feature or variable. It does contain EV (expected value) as an optional coupon-pricing display; EV is not used by prediction or candidate-rejection logic. No EV removal was made pending clarification that the user meant EV rather than another feature.
- The 75% 1X2 candidate threshold and 80% DC main-pick threshold are strict and explain why the app can show few/no picks even when it computes many probabilities. No threshold was silently lowered; retain transparency until the user explicitly changes this policy.
- No local Tracker records, existing predictions, coupons, settlements or bankroll data were deleted. Only isolated moneyball-rebuild source code and documentation were modified. CI and isolated Worker deployment status: pending.

- Follow-up UI refinement: clickable Dashboard metric cards retain the app's dark visual style and inherit typography; the metric-card navigation opens the relevant module.
- CI/deployment check: the commit-status API currently exposes only a Vercel build-rate-limit failure, which is outside the permitted REBUILD deployment path. No successful Cloudflare REBUILD run is visible yet for this change set, so deployment is not claimed. The isolated branch changes are saved; verify the Cloudflare workflow before treating the UI fixes as live.


## Stage 76 — continuation verification (2026-11-18)
- Re-opened the current `moneyball-rebuild` branch files after the user asked to continue. Confirmed the cross-source metadata merge helper is present in `src/free-fixtures.ts`, the fallback threshold of 3 completed matches is present in `src/App.tsx`, the dashboard drill-down and `predictionDiagnostics` are present, and the regression test is present.
- Inspected the actual model implementation: `predictFromRecentForm` uses last completed match goals, preferring at least 2 home-only/away-only matches where available, and then derives Poisson 1X2 probabilities. It does not use xG, confirmed lineups, injuries, tactical data or current bookmaker odds. This is a key model limitation and must be disclosed in the UI, not marketed as a full-data model.
- Confirmed the 75% threshold labels a top 1X2 probability as `KANDYDAT`; the main daily pick independently requires one of 1X/X2/12 probabilities >=80%. A match may have valid probabilities but not pass either selection gate.
- Confirmed the EV value displayed in coupon pricing is a post-model coupon pricing metric, not a rejection gate. The user wrote FV; no FV symbol/feature was found. EV removal remains unapproved/unresolved; do not remove it without confirmation.
- Rechecked TinyFish wallet: available balance is $0.00 as of 2026-11-18 07:09 UTC. Interactive browser verification remains blocked until the wallet is topped up. No new browser run was started and no additional charge was incurred.
- Public web open of the isolated Worker was not accessible to the web reader; therefore live UI deployment is not verified from this check. GitHub combined commit status only showed a Vercel build-rate-limit failure, not a Cloudflare success. Continue to keep MAIN untouched and do not claim REBUILD is deployed until the Cloudflare workflow result or a live app response confirms it.
- Current work remains isolated to `moneyball-rebuild`. No user Tracker/localStorage data, predictions, coupons, results or bankroll records were deleted or rewritten.
- Persistent history is this execution log plus Git commit history. Continue appending each meaningful investigation, change, test, and deployment result here.


## Stage 77 — independent Double Chance eligibility and panel drill-downs (2026-11-18)
- Found a critical selection bug: `savePredictionRecord` set status KANDYDAT only when the highest 1X2 probability was >=75%. However the main pick selector `getSafestPick` only reads KANDYDAT rows and separately requires Double Chance >=80%. This meant a fixture whose 1X2 max was below 75% but whose 1X/DC probability was >=80% was excluded before the DC threshold was even checked. The UI described 1X2 and DC as independent gates, but the persisted status accidentally coupled them.
- Fixed candidate persistence so a fixture is eligible for the candidate pool when either 1X2 max >=75% OR any Double Chance market >=80%. Preserved `strongCandidate` as the 1X2-only flag and added `strongDoubleChance` as the DC-only flag. Diagnostics now report 1X2 >=75% and DC >=80% separately. Coupon engine remains protected by its explicit `strongCandidate === true` check and still only uses 1X2-qualified fixtures.
- Updated `getSafestPick` to accept an explicit `KANDYDAT_DC` status as well as existing KANDYDAT records; added a regression test for a DC-qualified fixture that fails the 1X2 gate. Existing KANDYDAT status is also used for DC-only eligible records written by the new save path, preserving old consumers.
- Added expandable details to each fixture row (Brussels date/time, country/federation, provider provenance, source update timestamp, fixture ID, history IDs and direct source link). Added expandable key/value details to each Tracker record, with mobile-friendly styling.
- Dashboard metric cards continue to navigate to their corresponding detail modules; match list, Tracker rows, prediction diagnostics, coupon legs, and odds/bet sections expose further detail or source provenance.
- Commits for this stage: `e9eb92a80a6ea25fc3f311caa3fff97b478d932f`, `a72dd1f2ea4f7ce01ac58d020bb462701b1d218a`, `1d7c216d778201a15179e2e1b255788840baae04`, `85390046d06d3d9cbb3e658f0d332ef73864b928`, `e329e374354a3f04e334c6b7742dff22704d78f4`.
- Verification limitation: GitHub combined status still reports a Vercel build-rate-limit failure only. The available GitHub connector does not expose workflow dispatch/list operations for the push-triggered Cloudflare workflow; no Cloudflare run success is verified. Do not claim deployment. TinyFish wallet was previously verified at $0.00; interactive browser scan remains blocked until funded.
- No production `main` changes; no local browser Tracker or bankroll records were deleted.


## Stage 78 — metric-panel explanations and verified deployment (2026-11-18)
- After the user asked to continue without stopping, inspected the live GitHub Actions workflow history rather than relying on the incomplete Vercel status check. Latest run #463 for commit `807d1f21f5d325712bc05f92e02d60ac6f1b52f4` completed successfully; job `build-and-deploy` succeeded, including dependency install, TypeScript check, unit tests, production build and deploy to the separate Cloudflare Worker. Logs confirm 20 test files / 145 tests passed and Worker version `39f7bfcb-a822-491b-9d52-f0b579e058a5` was deployed.
- Live Worker's fixture proxy endpoints were reachable: `/api/footynomad/fixtures/2026-11-18` returned structured fixture JSON, and `/api/espn/scoreboard/20261118` returned structured ESPN scoreboard JSON. This verifies API proxy connectivity, not completeness of the full merged European list.
- Expanded panel drill-down coverage further: added a reusable DetailMetric component with a clickable “Szczegóły” disclosure to every Intelligence 1X2/DC metric and each betting/P&L metric. Each disclosure explains sample size, accuracy, Brier, log loss, ROI, settled vs open stake, rejected hypothetical picks and average odds.
- CSS for metric explanations added. These new edits are after run #463 and therefore still require their own CI/deploy confirmation.
- Live shell extraction confirms the app is served by the expected Cloudflare Worker. The extraction tool reads the static shell and does not prove React client-side interactions; the visual mobile test remains outstanding.


## Stage 79 — ESPN historical team-form fallback for fixtures without league IDs (2026-11-18)
- Root cause found for FootyNomad-only fixtures: the UI previously showed no `Forma 5 + typ` action when a fixture had no open-matchday folder, OpenLigaDB competition ID or OpenFootball feed ID. Those matches could appear in the European fixture list but had no history-provider route to the prediction model.
- Researched and verified ESPN's free, keyless team search endpoint (`/apis/common/v3/search?query=...&type=team`) and team schedule endpoint (`/sports/soccer/{league}/teams/{id}/schedule`). A live test for France resolved team ID 478 in `uefa.nations` and returned six completed UEFA Nations League matches with dates, opponents, venues and scores.
- Added isolated Worker route `/api/espn/team-form?team=...&before=YYYY-MM-DD`: exact team-name matching only (to avoid attaching another club's history), Europe-only ESPN league slug allowlist, finished results only, Europe/Brussels date conversion, 6-hour Cloudflare cache, timeout/error handling, and source timestamp. The worker uses the verified ESPN request headers already used by the scoreboard proxy.
- Added browser-side `loadEspnRecentTeamForm` with in-flight request deduplication and 6-hour localStorage cache, plus a pure `mapEspnTeamForm` that rejects invalid scores, future matches and malformed payloads. App history loading now tries ESPN after the existing open-matchday/OpenLigaDB/OpenFootball providers if they do not yield at least 3 completed prior matches. The match action is now available even for rows with no local league IDs; it is disabled for invalid or already-started kickoffs.
- Added regression tests for ESPN history mapping, venue split, points, invalid payload and target-date exclusion. Latest CI run #479 succeeded: TypeScript check, 20 test files, 147 tests, production build, Cloudflare upload/deploy. Deployed Worker version `120bf59b-a166-4074-9b6a-93c40ffe31a7` from commit `d17a53b`.
- Live endpoint verification succeeded for France: six prior UEFA Nations League results returned. Coverage limitation verified: Adana Demirspor resolves to ESPN league `tur.1` but the schedule returned zero prior results; Kastamonuspor was not found by exact ESPN search. Therefore ESPN fallback improves international and selected club coverage but does not solve all lower-division history coverage. No false predictions are created when the exact team or history is unavailable.
- Strict TypeScript caught and fixed three issues during integration (schedule response typing, implicit callback types, optional score values). The failed runs were not deployed; only the final successful run #479 deployed.
- Latest stage remains isolated to `moneyball-rebuild` and the separate Cloudflare Worker. Production MAIN and user-local Tracker/bankroll data remain untouched.


## Stage 80 — live ESPN endpoint validation and source attribution cleanup (2026-11-18)
- The first live call to the new `/api/espn/team-form` route returned HTTP 502. Investigated the upstream calls; switched the team-search host from `site.web.api.espn.com` to the working `site.api.espn.com` host and aligned the team-search/schedule request headers with the known-working ESPN scoreboard proxy headers. The final Worker version now responds successfully.
- Live validation for France before 2026-11-18 returned six completed results in the UEFA Nations League schedule: 15 Nov vs Türkiye (2–1), 12 Nov at Italy (1–3), 5 Oct vs Belgium (4–1), 2 Oct vs Italy (1–1), 28 Sep at Belgium (1–0), and 25 Sep at Türkiye (1–0). The Worker correctly identified France as ESPN team 478 / `uefa.nations`, converted dates to Europe/Brussels and returned only completed fixtures before the requested target date.
- Tested a lower-division club: Adana Demirspor resolved in ESPN `tur.1` but returned zero schedule results; Kastamonuspor did not resolve in ESPN search. The fallback is therefore useful for international fixtures and selected teams but is not a complete lower-league history source. It deliberately requires exact team-name matching to avoid assigning incorrect form.
- Confirmed latest successful Worker version after the ESPN fallback and request-header fix: `120bf59b-a166-4074-9b6a-93c40ffe31a7`, run #479, commit `d17a53b`. CI: TypeScript passed, 20 test files passed, 147 tests passed, production build and Cloudflare deployment succeeded.
- Dashboard's source attribution list had omitted FootyNomad despite counting six sources. Added the FootyNomad link so the visible list now names all six: open-matchday, OpenLigaDB, OpenFootball, ESPN, FootyNomad and timezone.football.
- The source-list correction is a subsequent UI-only commit and needs its own push-triggered workflow confirmation. Continue to preserve the distinction between deployed code and the newest branch commit.


## Stage 81 — final source-list deployment and further source research (2026-11-18)
- Latest source attribution and history-log commit `5b8fa4226d076db4bf3e2eb2244b7eb2c6c8558a` completed Cloudflare workflow run #482 successfully. TypeScript, production build, 20 test files / 147 tests all passed. Cloudflare Worker version `88833341-3df7-4031-b37b-4dea80abdcb0` deployed.
- Live dashboard shell extraction confirms the visible source list now contains all six providers: open-matchday, OpenLigaDB, OpenFootball, ESPN, FootyNomad and timezone.football.
- Additional public source research: Sports Data Campus 2026-10-14 roundup points to FBref, Sofascore, FotMob, FootyStats, Futbolme, StatsBomb Open Data, Football-Data.co.uk, API-Football and 5DollarFootballAPI. These are not equivalent open APIs; several are web platforms, key-gated APIs or only cover selected top leagues. Do not treat a free website as permission to scrape.
- Checked Futbolme robots.txt: general site paths are not disallowed, but `/json/` and several internal paths are explicitly disallowed; no public supported API was established. Do not call its disallowed JSON paths.
- Checked Football-Data.co.uk notes: CSV results/odds and some match stats are available; source notes identify XScores for results and several providers for stats. This is a useful historical-data candidate for supported leagues, but it is not a complete current European lower-division fixture source and a redistribution licence still needs to be established before integration.
- ESPN team-history fallback remains live and verified for France / UEFA Nations League. Lower-division test confirmed Adana Demirspor has no ESPN history results and Kastamonuspor is not indexed. Keep those matches visible with explicit no-history diagnostics; do not manufacture predictions.
- Full interactive mobile UI test is still not completed because TinyFish wallet balance is $0.00; static shell and API route tests are available. No top-up or paid browser run was initiated.


## Stage 82 — Double Chance threshold unified at 75% and expanded provider audit (2026-11-18)
- User explicitly changed the Double Chance qualification threshold from 80% to 75%, matching the existing 1X2 candidate threshold. Applied the 75% boundary consistently to prediction persistence (`strongDoubleChance`), persisted candidate status, diagnostics counts, dashboard and pick-panel empty states, panel explanatory text, and `getSafestPick` default selection minimum. The top Double Chance selector still selects the highest eligible probability and still ignores started/unknown-kickoff matches.
- Added a regression test proving exactly 75.0% DC is eligible even when 1X2 does not pass its 75% gate, while 74.9% DC is not eligible. Updated rejected-reason wording so DC-qualified picks are not incorrectly described as below threshold. Coupon engine continues to require `strongCandidate === true`, so lowering the DC gate does not silently put DC-only picks into 1X2 coupons.
- Source research: inspected the public `worldcup26.ir` no-key API and its open-source `rezarahiminia/livescoreFootball` project. Live metadata claimed 35 active competitions (29 European and 6 outside Europe), 3,296 stored matches, and a last successful sync at 2026-11-18 07:46 UTC. It has useful England EFL / National League, Spanish Segunda and cup catalogues. However, date-scoped scoreboard calls returned no events for checked lower-division dates even where the league calendar listed a matchday; the fixtures range endpoint exposed completed historical matches but did not expose upcoming fixtures in the tested date range. No clear dataset redistribution permission was established. Therefore NOT integrated as an upcoming-fixture provider; retain as a research candidate, not an asserted coverage source.
- Inspected `footballcsv/england` and `footballcsv/deutschland`: both declare CC0-1.0 and provide historical CSV mirrors of openfootball data, but repository listings show old seasons (latest visible directory 2020-21), so they do not add current 2026/27 fixtures.
- Inspected Football-Data.co.uk reuse conditions. Its contact/data pages state personal research use only, no commercial or automated bot/scraper/AI training use, and at most light automated download twice weekly. This conflicts with automated app ingestion; explicitly rejected integration rather than violating source terms.
- Inspected FDB4: free browsing of a large historical database is advertised, but its REST/JSON API and MCP server are paid. Rejected as a no-key integration source.
- Inspected `rezarahiminia/livescoreFootball`: public read API currently says no key required and fair-use limits apply; its own README says rollout starts with England/Spain and country expansion is staged. It may be useful later if future-fixture coverage and data reuse terms can be independently established.
- Workflow note: commits `09faa02` (threshold changes) and `1b17808` (reason correction) triggered the serialized Cloudflare workflow. GitHub showed run #484 in progress and latest run #487 waiting for #484 under concurrency group `moneyball-global-rebuild-v3`; no successful deployment of the 75% change is claimed until that queue clears and the final run's steps/version are verified.
- All work remains confined to `moneyball-rebuild`; no MAIN changes.


## Stage 83 — 75% DC boundary test fixed, live history checks, and successful deployment (2026-11-18)
- CI run #488 correctly caught an outdated test assumption: an old assertion treated 79% as weak, which is no longer true after the requested threshold change. Updated that regression fixture to 74.0%, 73.0%, and 74.9%; the new dedicated test separately verifies exactly 75.0% passes and 74.9% fails.
- Final threshold code commit `d4796c3828a438b0e9e51fa04040bc00ae7129e5` passed CI run #489. TypeScript passed; 20/20 test files and 148/148 tests passed; production build passed; Cloudflare deploy succeeded. Deployed Worker version: `53e713d5-873e-4d35-9e83-6f4a28084f28`.
- Live Worker shell check confirms the displayed dashboard empty state now says `DC ≥75%`, no obsolete 80% threshold remains in the extracted dashboard text, and FootyNomad appears in the six-source attribution list.
- Additional live ESPN history tests: Gateshead (English National League / `eng.5`) returned 10 completed results; AFC Hornchurch (`eng.5`) returned 10; Real Valladolid (Spanish LALIGA 2 / `esp.2`) returned 10. This demonstrates that the already integrated ESPN fallback does cover at least these lower divisions, although it is not universal. Earlier Adana Demirspor returned zero and Kastamonuspor was not found, so gaps remain explicit.
- The no-key `worldcup26.ir` API was not integrated: although its metadata advertised 35 active competitions / 3,296 stored matches, date-scoped scoreboards for checked lower divisions returned no events, and its date-range fixture endpoints exposed past events but no tested future schedule. It therefore did not meet the requirement for dependable upcoming fixtures; its reuse/data licence also remains unclear.
- User's DC rule is now the same as 1X2 at 75%; the coupon engine still requires `strongCandidate === true`, preventing DC-only qualification from leaking into 1X2 coupon construction.
- No changes to production MAIN; all changes remain on `moneyball-rebuild` and the isolated `moneyball-global-rebuild` Worker.


## Stage 83 — 75% Double Chance change deployed and verified (2026-11-18)
- The first CI attempt exposed one stale test that still treated 79% DC as below the old 80% cutoff. Updated the weak-pick test values to 74%, 73%, and 74.9%, preserving its purpose under the new rule. No production logic rollback was needed.
- Final workflow run #489 / GitHub run `44262090421` succeeded on commit `d4796c3828a438b0e9e51fa04040bc00ae7129e5`. TypeScript check passed; **20/20 test files and 148/148 tests passed**; production build passed; Cloudflare upload/deploy passed.
- Deployed to isolated `moneyball-global-rebuild` Worker. Cloudflare reported version `53e713d5-873e-4d35-9e83-6f4a28084f28`. This confirms deployment of the 75% threshold change to REBUILD only.
- Additional API audit: although the `worldcup26.ir` catalogue advertises 35 competitions, live fixtures-range requests confirmed actual stored match history for National League and Spanish Segunda. The Worker already returns 10 recent matches for Gateshead, AFC Hornchurch and Real Valladolid through its existing ESPN team-form endpoint. This means the candidate API may duplicate existing team-form coverage; it did not demonstrate usable future fixtures on checked dates, so it remains excluded from fixture ingestion until future schedule delivery and reuse permission are verified.
- No MAIN changes.


## Stage 84 — Double Chance independently admitted to three-leg coupons (2026-11-18)
- Extended `CouponLegCandidate` to distinguish `1X2` from `DOUBLE_CHANCE` and to represent DC selections `1X`, `X2`, `12`.
- Coupon candidate selection now accepts a record with `strongDoubleChance === true` and its highest valid DC probability >=75%, even when `strongCandidate === false`. 1X2 remains independently qualified using `strongCandidate === true` and its own normalized 1X2 probabilities >=75%. The existing latest-record-per-fixture guard, date filter, three distinct fixture rule and exact three-leg coupon construction remain in place.
- Added regression coverage for a coupon made entirely of DC-only candidates at exactly 75% or above. Existing 1X2 valuation fixtures now explicitly declare their market.
- Safety of odds handling: bookmaker snapshots currently contain only 1X2 prices. DC coupon legs are therefore deliberately not priced using 1X2 odds; the valuation helper fails closed for a coupon containing DC legs until genuine Double Chance odds are available. This prevents misleading EV/return figures.
- Final CI run #496 / run `44262768894` succeeded on commit `85102e26bb3430b65e5a8bfe785ebf5b91cc51c1`. TypeScript passed; **20/20 test files and 149/149 tests passed**; production build passed; isolated Cloudflare REBUILD deploy succeeded.
- Cloudflare Worker `moneyball-global-rebuild` version: `2dc2e008-295e-4f71-9944-2a35118c3497`.
- No MAIN changes.


## Stage 85 — multi-source historical form acceptance and conflict-safe merge (2026-11-18)
- User explicitly authorized accepting suitable historical match data from multiple sources and instructed that match analysis should combine several independent sources, not rely on a single provider.
- Audited the existing prediction path: it previously stopped at the first source returning at least three matches. This discarded additional valid history from OpenLigaDB, OpenFootball and ESPN even when available.
- Changed team-history loading to query every applicable provider for each team: open-matchday, OpenLigaDB, OpenFootball and ESPN. Provider-specific adapters retain their existing competition/feed context and validation.
- Added `mergeVerifiedTeamForms`: filters invalid scores, collapses exact duplicate match rows, merges distinct historical matches, sorts chronologically and keeps the latest five overall/home/away. If two providers disagree on the score for the same date/opponent/venue, that match is excluded rather than arbitrarily selecting a result.
- A prediction now requires at least three unique, non-conflicting completed matches after the multi-source merge. Source names and provider update timestamps are retained in the resulting form metadata. Failures from individual providers do not discard successful data from other providers.
- Added tests for multi-provider aggregation, duplicate collapse and conflict rejection.
- Research findings: OpenFootball Europe declares its datasets public domain and provides historical results for selected European leagues; its coverage is selective. The open-football curated catalogue identifies additional results/statistics datasets including StatsBomb Open Data (attribution terms), schochastics/football-data (ODC-BY, 1.2M+ historical results through 2023), Fjelstul English and World Cup databases (CC BY-SA 4.0), and footballcsv (CC0). The openfootball/leagues repository also states public-domain data. These are research candidates for further validation; they are not automatically imported merely because a repository is public.
- Football-Data.co.uk's current download page reports a 16 Nov 2026 update and lists 16 country datasets, but its reuse restrictions already audited in Stage 81 prohibit the intended automated app ingestion; it remains excluded.
- Current public research references: https://github.com/openfootball/europe ; https://github.com/openfootball/leagues ; https://github.com/withqwerty/open-football ; https://github.com/xgabora/Club-Football-Match-Data ; https://github.com/datasets/football-datasets .
- Code commits: `e0a40f59d7252b835e5126c232727637b7a6c136` (merge helper), `8071a155ec0fb18b997567a3ed8c0f8103ccff45` (prediction path), `dc789652ac538ffa40545ef013f6bd63334a8531` (tests). CI/deployment status must be verified before calling this stage deployed.
- No production MAIN changes. No existing Tracker records, predictions, coupons, results or bankroll data were deleted or rewritten.

- Follow-up cleanup commit: `e4484f34c8af988d658a4c88827387019600860e` removes an unused local declaration from the prediction loader. The branch's combined status still shows only the unrelated Vercel build-rate-limit failure; the available GitHub Actions connector returned no PR-triggered workflow runs for this push. This is not proof that the Cloudflare deploy ran. The new multi-source behavior remains pending CI/build/deploy verification.


### Stage 85 follow-up — preserve deeper samples from each provider (2026-11-18)
- Code review found that the first multi-source implementation still requested only five matches per provider. That could hide distinct older games when sources overlap heavily.
- Increased the raw per-provider history window to 15 matches for open-matchday, OpenLigaDB, ESPN and OpenFootball; the merged TeamForm still exposes the latest five unique non-conflicting games to the existing prediction model. This improves the chance of finding five distinct matches across partially overlapping feeds without changing the model's feature window.
- Updated the open-matchday regression test to assert all six available pre-target records are retained by the source adapter.
- Re-fetched the four changed source files from `moneyball-rebuild` and verified the merge call, parallel provider requests, conflict regression test, and 15-match raw caps are present. This is source inspection only, not a TypeScript/test execution.
- New web research (2026-11-18):
  - OpenFootball Europe explicitly declares its data and schema public domain and lists multiple European leagues including lower divisions such as France Ligue 2, Switzerland Challenge League, Turkey 1. Lig and others. Its catalogue was updated in Oct 2026. Candidate for wider history/fixtures ingestion after comparing current-season coverage and duplicate IDs.
  - OpenFootball Leagues separately lists broad national and international club competitions including England tiers 1–5 and Germany tiers 1–3, also public domain. Candidate for expanding the feed catalogue beyond the currently discovered Europe tree.
  - StatsBomb Open Data contains event-level JSON, match lists, lineups and selected 360 data. StatsBomb terms require source attribution and logo when publishing research/analysis; its stated free-use purpose is research and genuine football analytics. Treat as a research/feature-validation source, not assume unrestricted commercial redistribution.
  - `xgabora/Club-Football-Match-Data` describes 238,858 results across 38 league/division codes and 273,972 Elo records through 3 Sep 2026, but explicitly says match results/statistics are sourced from Football-Data.co.uk. Because Football-Data.co.uk reuse terms conflict with automated app ingestion (Stage 81), do not import this mirror unless rights are clarified directly. A GitHub repository being public does not supersede upstream data restrictions.
  - `schochastics/football-data` is described in the curated open-football catalogue as 1.2M+ historical matches from 207 domestic leagues and 20 international tournaments (1888–2023), ODC-BY. Strong candidate for historical training/validation, subject to checking the exact licence, attribution and source coverage before ingestion.
  - FBref, Understat, ClubElo and other sources have coverage and access limitations; do not scrape restricted pages or infer xG where unavailable.
- Research citations/URLs: https://github.com/openfootball/europe ; https://github.com/openfootball/leagues ; https://github.com/hudl/open-data ; https://github.com/xgabora/Club-Football-Match-Data ; https://github.com/withqwerty/open-football .
- Latest code commits in this follow-up: `d13095e6645df68fbdaec0fe29d42a31a6017d4f`, `63e301d74f92dcdcfbc7111d964c3ebc05cd1cf6`, `df72c21a3d57e0486e4a23996dc26d265d58d1da`. CI, tests and deployment are still unverified; do not claim this code is live.


## Stage 86 — OpenLigaDB history depth consistency (2026-11-18)
- Re-audited the actual provider adapters after Stage 85. Open-matchday and OpenFootball exposed up to 15 recent rows to the merge layer, but OpenLigaDB still truncated its overall history to five rows before merging.
- This could cause OpenLigaDB to contribute fewer distinct historical fixtures when its newest matches overlap with other feeds, reducing the benefit of multi-source history.
- Changed OpenLigaDB's overall history output to retain up to 15 validated, finished, pre-fixture matches. Home/away split arrays remain capped at the latest five, matching the existing model's venue-split behavior.
- Added a regression test with nine finished pre-fixture OpenLigaDB matches to ensure all nine reach the multi-source merge layer and future-dated records remain excluded by the mapper.
- Commits: implementation da8a0520aed1abf3e4085231d55ef6cf0a99fc9b; regression test 69ad9cd0b8bd3f7c88ba8b2327ea8f55369fd345.
- Validation and deployment are pending the latest GitHub Actions runs. No production MAIN resources, Tracker records, coupon history or bankroll values were changed.


### Stage 86 — CI correction
- First CI run on the test commit failed at TypeScript because the regression-test import had been added but the test body was not inserted at the intended marker. No application logic failure was reported; tests/build were skipped by the typecheck gate.
- Inserted the missing OpenLigaDB regression test in the correct test suite in commit 90476c25c8347d7a222a7e1c50f39672363fd0b2.
- The follow-up CI and deployment results must be checked on the newest branch head before this stage is marked complete.


## Stage 87 — external historical and xG provider evaluation (2026-11-18)
- Reviewed the current provider documentation and dataset licences before adding another dependency.
- schochastics/football-data: ODC-BY dataset with 1,237,935 match results across 207 top-tier domestic leagues and 20 international tournaments, 1888–2023. The repository states the results update was in November 2024 and notes historical errors/team identity changes; it is suitable only as a historical baseline, not current fixtures/results. A provenance/semantics clarification issue is open (#5), so no automatic ingestion is enabled yet.
- StatsBomb Open Data: selected competition/season match files, events, lineups and selected 360 data are available for research/genuine interest, with source attribution and logo required when publishing analysis. Coverage is selective, so it cannot be the default xG source for every European match.
- Football Soccer API: current terms allow display of API-derived results in an app but prohibit bulk republication/redistribution of the data. Its free key is restricted to a recent time window and low daily call allowance; the broader historical archive, statistics/xG and upcoming fixtures require paid plans according to current docs. Not integrated because it does not satisfy the no-paid, no-key requirement for full app coverage.
- Football API (footballapi.org): free tier is restricted to Premier League and 50 calls/day; broader 68-competition coverage is paid. Not integrated.
- Decision: keep existing public feeds for fixtures and recent results; do not fabricate xG. Only add historical datasets after verifying exact provenance, usable fields, attribution and a real evaluation split. A broad historical dataset ending 2023 cannot be used to claim current-season form.
- Sources reviewed: schochastics/football-data README and issue #5; StatsBomb Open Data terms/README; Football Soccer API terms, acceptable-use policy, matches documentation, changelog and pricing; footballapi.org documentation and terms.


## Stage 88 — prediction-level data provenance (2026-11-18)
- Added a structured `history` object to newly saved prediction Tracker rows: per-team source names, provider update timestamps, unique historical match counts, home/away sample counts and the exclusive fixture-date cutoff.
- Persisted the prediction method and its actual sample counts alongside the probability record. This makes later model audits reproducible and lets the UI/exported Tracker retain which free sources supported each prediction.
- Existing Tracker rows remain unchanged; fields are additive and optional for legacy records. Prediction calculation, 75% eligibility and coupon logic are unchanged.
- Implementation commit: 396a633a217df067ceb0544dc3e53d33521d48f1.
- CI and Cloudflare deployment are pending verification on the newest HEAD.
- Zero-cost constraint reaffirmed: no paid fixture/history/xG service, subscription, paid API key or paid database may be required. A paid source may only be mentioned as a rejected alternative, never silently enabled.


### Stage 88 — Tracker schema compatibility correction
- Initial CI caught that TrackerRecord.details intentionally accepts primitive JSON values only, not nested objects. The app change was corrected to serialize the provenance and sample-count structures as JSON strings, preserving the existing storage schema and backward compatibility.
- Corrective commit: 3ee68109d11ed5de256869be200c5b3205df18ee.
- No Tracker data was migrated or rewritten. Fresh CI and deploy must pass before release confirmation.


## 2026-11-18 — Stage 89: readable prediction history provenance
- Confirmed the latest rebuild HEAD `19c0505ca07e7a20fd001566cc7130f1ae9be400` passed all three workflows: rebuild CI, Rebuild Checks and Cloudflare Free Worker deployment (runs `44266341464`, `44266341494`, `44266341386`).
- Reviewed the Tracker rendering path and found Stage 88's multi-source history provenance was persisted as JSON text but displayed as opaque raw JSON.
- Added safe parsing and human-readable formatting for each side's contributing history source, total/home/away sample counts, source update timestamp and exclusive fixture-date cutoff.
- Tracker detail view now renders this metadata in readable Polish; old records, absent values and malformed JSON remain safe and unchanged.
- Added tests for valid multi-source metadata, legacy/malformed values and invalid sample counts.
- No historical Tracker rows, predictions, coupons, settlements or bankroll values were rewritten. No paid service or key added.
- Stage 89 code changes committed; CI and deployment validation pending.


## Stage 90 — OpenFootball country catalogue coverage correction (2026-11-18)
- Live code audit found that the dynamic OpenFootball Europe repository-tree scanner recognised many European country folders but omitted five major country keys: Belgium, England, Germany, Italy and Spain. The static fallback list covered only selected competitions in those countries, so dynamically available lower divisions and additional competitions in those five countries were silently skipped.
- Added the five missing country/time-zone mappings to the dynamic catalogue parser. The existing Europe-only country allowlist, season selection, timezone conversion and source attribution remain unchanged.
- Added a regression test proving that current-season feeds from all five country folders are discovered and assigned the correct country codes.
- Implementation commit: 1ffb8b797f2c73750bdc9031e18c25aa93ed065f; regression test commit: eafccdef13468caba799423bfca474a755ed6273.
- Validation and Cloudflare REBUILD deployment are pending the resulting GitHub Actions runs. Do not mark Stage 90 deployed until CI and Worker deployment both pass.
- No production MAIN resources, historical Tracker rows, predictions, coupons, settlements or bankroll values were changed. No paid API, key, database or subscription added.


## Stage 91 — discover complete current-season national OpenFootball catalogues (2026-11-18)
- Corrected the initial Stage 90 diagnosis after inspecting the actual public GitHub repository trees: the openfootball/europe catalogue does not contain separate England, Germany, Italy, Spain or Belgium folders. Those countries are maintained in distinct repositories (england, deutschland, italy, espana, belgium); Austria also has a separate repository.
- Implemented dynamic current-season feed discovery across the Europe catalogue plus all six separate national repositories. The national parser includes nested season paths, so Belgium's provincial/regional competitions and Germany's Regionalliga files are discoverable, not just top divisions.
- Excludes RSSSF archive paths from the live-fixture feed discovery; historical archive ingestion remains a separate provenance/licensing task. Existing static feeds remain as fallback and are deduplicated by feed ID.
- Added regression coverage for current-season feeds in all six national repositories, multiple tiers, nested Belgian provincial paths, correct country codes, and exclusion of prior-season/RSSSF paths.
- Implementation commit: 75ae831eae3ff3d574f4fe87db8afb6511c505e8; tests commit: 99cb24e35984838303863c638593c550c2bd5818.
- Stage 90's initial country-map-only change is superseded by this more accurate repository-aware implementation. CI and deployment for Stage 91 are pending; do not claim it is deployed until all checks pass.
- No production MAIN resources, historical Tracker rows, predictions, coupons, settlements or bankroll values were changed. No paid API, key, database or subscription added.


## Stage 92 — resilient partial OpenFootball catalogue discovery (2026-11-18)
- Live code review after Stage 91 found a reliability defect: the seven parallel GitHub tree requests used `Promise.all`, so one unavailable country repository caused the entire dynamic OpenFootball discovery to fail and discarded feeds from healthy repositories.
- Replaced the all-or-nothing catalogue collection with `Promise.allSettled` plus deterministic feed merging and deduplication. Successful repositories now continue to contribute fixtures when another catalogue fails; failed repositories are reported separately in scan diagnostics. If every catalogue fails, the existing static-feed fallback remains available and the catalogue failure is visible.
- Added a regression test for mixed healthy/failed repositories and duplicate feed IDs.
- The broader fixture pipeline already integrates open-matchday, OpenLigaDB, OpenFootball, ESPN, FootyNomad and timezone.football. open-matchday currently publishes 75 competitions with daily CSV refresh, but its README limits the free dataset to informational/non-commercial use; it is not evidence of complete European national-league coverage. Detailed stats are uneven and it does not provide xG.
- Verified the deployed REBUILD homepage is live and identifies the project as CLEAN BUILD 0.1.0; it currently labels fixture-source coverage as ACTIVE and explicitly says coverage is not complete. Visual mobile testing remains outstanding.
- Source change commit: 31215a60166de5907473106097cbebd7ba1d2986; regression test commit: e090656c6093663c1e29d80ebc3bdd0ef2b5c97f.
- CI for the implementation commit passed typecheck, tests and production build (run 44270232489). Rebuild Checks and Cloudflare deploy for the latest test commit are still running at the time of this log entry; do not mark Stage 92 deployed until both pass.
- No production MAIN resources, historical Tracker rows, predictions, coupons, settlements or bankroll values were changed. No paid API, key, database or subscription added.


## Stage 93 — live fixture coverage audit and source admissibility (2026-11-18)
- Confirmed Stage 92 on the isolated REBUILD branch: CI, Rebuild Checks and Cloudflare Free Worker deploy all succeeded for commit `5fd2ff3b3ec476f97aa03c0288866459b0d72079` (runs 44270316372, 44270316186, 44270316448).
- Post-deploy read-only smoke test confirmed the live REBUILD homepage and FootyNomad proxy return successfully. The live FootyNomad endpoint for 2026-11-18 returned 102 unique fixtures across 28 named competitions and 15 country/area codes, from two source pages; 197 source match cards were examined, with zero missing-timestamp skips and zero endpoint errors. This is a one-date observation, not a claim of full Europe coverage.
- Counted the open-matchday current-season league index: 75 competitions total, 65 European competition rows by country label. Its country/competition inventory is broader than the currently available OpenFootball feed list, but it still does not represent all UEFA member countries or every domestic tier.
- Researched two additional public league directories. Fixtures Hub advertises 634 competitions, but its Terms explicitly prohibit automated bots/crawlers and automated extraction at scale without written permission, so it is rejected for scraping/integration. Match Terminal advertises 1,000 leagues/160 countries, but its published methodology says its primary fixture/team/league source is API-Football with Highlightly supplementary coverage; it is not an independent free public data feed and is not integrated.
- Reviewed Football Charts: its free API has 98 leagues and a 200-request/day free key, but a key is required for the free quota and its terms limit free-key use to private projects; the app's no-API-key constraint rules it out for this build. Do not silently add a key or use it as a scraper workaround.
- Current decision: retain the six already-integrated public fixture sources and focus next on measuring per-country/per-competition overlap and omissions from FootyNomad vs OpenLigaDB, open-matchday, OpenFootball and ESPN. Never scrape a provider whose terms prohibit it; never treat a directory's advertised league count as proof that each league has fixtures for the requested date.
- No production MAIN resources, historical Tracker rows, predictions, coupons, settlements or bankroll values were changed. No paid API, key, database or subscription added.


## Stage 94 — OpenLigaDB non-football category guard regression (2026-11-18)
- Queried the live REBUILD OpenLigaDB proxy's 2026 catalogue: 88 competition entries were returned, with explicit sport metadata on every entry. Sport categories included Fußball, Frauenfußball, Eishockey and Test.
- Confirmed the current European football filter rejects non-football sport names, including the live catalogue's Darts entries classified as sportName `Test`. Added a regression test for the exact observed `Poland Darts Open 2026` catalogue shape so it cannot accidentally be admitted in a future filter refactor.
- This is a test-only hardening change; fixture selection behavior is unchanged. No new provider was added.
- Regression test commit: cdf7ba5259e0099df9a914ed2605260e69712d16. CI and deploy for the resulting latest HEAD must pass before recording validation.
- No production MAIN resources, historical Tracker rows, predictions, coupons, settlements or bankroll values were changed. No paid API, key, database or subscription added.


## Stage 95 — fail-closed OpenLigaDB sport metadata validation (2026-11-18)
- Live catalogue audit found 88 OpenLigaDB competition entries for season 2026, each with explicit `sport.sportName`; categories include football, women's football, ice hockey and test data.
- Previous European competition filter rejected explicit non-football categories but allowed missing/blank sport metadata to continue to country/shortcut heuristics. Tightened it to require an explicit sport name containing football/Fußball before a competition can be imported.
- Updated positive classification fixtures to include the verified football sport metadata; added regression tests that missing/blank metadata is rejected. Existing tests also reject Basketball, the live Darts `Test` category, and synthetic Bundesliga entries.
- Source commit: 2d591a6beafbce2a5842080994f98124526b8f4b. Test commit: 18cd8c791a0ef0a4154d369b201e8888d62ff989. Documentation commit: pending.
- Tradeoff: this deliberately prefers a false negative over importing a non-football event when OpenLigaDB omits the sport category. The current live catalogue confirms this field is populated for all 88 entries.
- CI, rebuild checks and Cloudflare deployment for the new test commit must pass before marking Stage 95 deployed.
- No production MAIN resources, historical Tracker rows, predictions, coupons, settlements or bankroll values were changed. No paid API, key, database or subscription added.


## Stage 96 — ESPN Nations League geography correction (2026-11-18)
- Date-specific audit of the live ESPN UTC scoreboards for Brussels 2026-11-18 exposed a serious false-positive: the parser treated any competition containing the words "Nations League" as UEFA, so five Concacaf Nations League fixtures at non-European venues could be incorrectly labelled European.
- Corrected the rule: only an explicit `UEFA Nations League` note receives the UEFA national-team history key. All other events must independently qualify by a recognized European venue country or an explicitly UEFA/European tournament note.
- Added a regression case with the observed Concacaf Nations League / Guadeloupe venue shape alongside the valid UEFA Nations League case.
- Live ESPN raw source inventory: 65 events on 2026-11-17 UTC and 28 on 2026-11-18 UTC. Applying the Brussels-date and geography rules showed 24 event candidates on 2026-11-18 before the correction; five were Concacaf Nations League false positives. The corrected rule removes those five.
- Source commit: 3755a47aaa84c463c9d1faf12d8f827ec17d57c3. Test commit: 28b3f625f1f34c105db7219b86cf0e77966ccb87. Validation and deployment pending.
- No production MAIN resources, historical Tracker rows, predictions, coupons, settlements or bankroll values were changed. No paid API, key, database or subscription added.


### Stage 96 validation correction
- First CI run exposed a regression in the UEFA key assignment: after narrowing the Nations League regex, a valid Denmark-hosted UEFA Nations League fixture was attributed to DEN instead of UEFA. This was a test failure; that build was not deployed.
- Corrected assignment to preserve the UEFA key only for explicit UEFA Nations League notes, while leaving the venue-country mapping unchanged for other fixtures. The Concacaf regression case remains in the test.
- Follow-up source commit: 3cb05202f78da94d9c13ee14bb5147246267426a. Latest test/deploy validation is pending.


### Stage 96 additional confederation guard
- Further review showed that relying only on the venue country would still admit an explicitly CONCACAF/CONMEBOL/AFC/CAF/OFC event if it happened to use a neutral venue in Europe.
- Added an explicit non-UEFA confederation exclusion before geographic venue checks, plus a regression test for a CONMEBOL event at an England venue. The observed Guadeloupe-hosted Concacaf Nations League case remains covered.
- Follow-up implementation commit: c62fa63400a14f0e5ff5571892ca0e3fb10177a1. Test commit: 21e1cd27109d84c50898d3d5e156d08483ac4c6d. Validation pending.

## Stage 97 — date-specific source overlap audit (2026-11-18)
- Read the 62 European open-matchday current-season CSVs for 2026-11-18. Exactly six fixtures were listed for that date, all from Copa del Rey First Round (Spain); no matches were listed for the 10 sampled top-flight domestic league feeds, UEFA men's club competition feeds, or the other 51 European feed files checked.
- Compared those six Spanish cup fixtures with the live FootyNomad date proxy: two of six were also present there (Alcoyano–Mallorca and Badajoz–Tenerife); four were absent from FootyNomad. The live ESPN scoreboard independently contained all six Spanish cup fixtures, so the multi-source design can recover these omissions.
- The six open-matchday fixtures plus ESPN events show why a single global source is insufficient: provider coverage differs by competition and fixture, even on one date. Keep the source provenance when merging and do not infer missing matches from a competition directory alone.
- This is a one-day snapshot; it is not a season-wide completeness estimate. No data rows were written into the app's historical Tracker.


### Stage 95–97 final validation
- Latest integrated branch HEAD at validation: 9ffaae970992225cb688316d5b6336e1d2304c0a.
- Stage 95 strict OpenLigaDB sport metadata guard, Stage 96 ESPN non-UEFA confederation exclusions (including neutral venues in Europe), and Stage 97 source-overlap audit all included in this HEAD.
- GitHub Actions CI passed typecheck, all unit tests, and production build (run 44272490290).
- Rebuild Checks passed typecheck, all unit tests, and production build (run 44272490353).
- Cloudflare Free Worker deployment completed successfully (run 44272490389). The live REBUILD homepage was read-only checked after deployment and returned successfully.
- The failed intermediate Stage 96 test build was not deployed; the regression was corrected, the full suite passed, and only the corrected HEAD was deployed.
- MAIN production and its historical data remain untouched.


## Stage 98 — FootyNomad world-section confederation filter (2026-11-18)
- Continued source-level audit after the ESPN correction. FootyNomad groups international competitions under a mixed `World` heading; its previous parser allowed any competition name containing the generic phrase "Nations League". That could import Concacaf Nations League fixtures as European when they appeared in that section.
- Added a fail-closed exclusion for explicit CONCACAF, CONMEBOL, AFC, CAF and OFC competitions before accepting a World-section competition. World-section inclusion now requires explicit UEFA, European Championship, or UEFA Nations League wording.
- Added a live-shape regression fixture for Concacaf Nations League under World; existing UEFA Champions League Women fixture remains included and Brazil domestic fixture remains excluded.
- Source commit: 673c182030c409c872da61500c45d1f4dc847d15. Test commit: e22b05a1a6588c98cf5f1943a251ac9fc467e062. CI and Cloudflare deployment pending.
- Production API read-only checks before this change: FootyNomad date endpoint returned 102 normalized fixtures, 2 pages checked, 197 page matches and no upstream errors; ESPN scoreboard endpoint returned 28 raw events for 2026-11-18; OpenLigaDB season catalogue returned 88 entries. These are provider payload counts, not unique final scan totals.
- No scan records, predictions, coupons, bets, settlements, bankroll or production MAIN data were modified. No paid provider/API key added.


## Stage 99 — Europe coverage inventory and free-source feasibility (2026-11-18)
- Re-read the live open-matchday index (generated 2026-11-18 06:43:48 UTC): 75 total competition folders, 65 European-code folders, 62 European folders with nonzero fixture rows. Three European folders currently have zero published fixtures: Ireland First Division, Finland Veikkausliiga and Kazakhstan Premier League. Ten non-European folders are correctly excluded.
- The 62 active European feeds cover 37 country/competition codes in the index; they are not a complete inventory of every UEFA member country or every division. Do not label this source "all Europe".
- Evaluated Football Charts as a possible supplement: the public Dify connector describes 98 leagues in 44 countries, current/previous season fixtures, daily refresh and a no-key tier limited to 100 requests/day per IP. Its published terms say an app/bot used by other people requires a paid plan, so it is not integrated into this public Worker app under the free-only requirement.
- Evaluated the MIT-licensed omkarcloud/flashscore-scraper: it is a local Python service using curl_cffi/BeautifulSoup and claims broad Flashscore coverage without an API key. It is not a drop-in Cloudflare Worker dependency; self-hosting or a verified serverless-compatible feed adapter is required before it can be considered. No paid Apify/RapidAPI hosted scraper is used.
- Current free app sources remain open-matchday, OpenLigaDB, openfootball, ESPN, FootyNomad and timezone.football. Their date coverage differs, so fixture totals must be deduplicated and source provenance retained.
- No new paid API, subscription, API key, external hosting service or production MAIN change was introduced.
- This stage is an evidence/feasibility audit, not a claim of complete European coverage. Next implementation target: investigate a direct, free Flashscore public-feed adapter that can run inside the existing Cloudflare Worker without curl_cffi or a paid intermediary; only keep it if production tests show reliable access and correct Europe-only/date filtering.


## Stage 100 — Flashscore integrated into daily European scan (2026-11-18)
- Verified the direct Flashscore public feed from Cloudflare Free Worker: HTTP 200, structured feed 291 KB, 89 competition headers and 215 raw match rows in the global feed sample. This feed includes many non-European competitions, so it is NOT accepted wholesale.
- The existing Europe-only parser keeps verified European country competitions and UEFA competitions, rejects other confederations and generic world friendlies, and filters kickoffs to the exact Europe/Brussels current date. Statuses are mapped as scheduled/live/finished.
- Fixed the Flashscore date route matcher (it previously escaped the digit token incorrectly, so requests fell through to the SPA); corrected the regression test expectation for the additional generic Europe/world exclusion.
- Integrated `/api/flashscore/fixtures/{today}` into `scanTodayEuropeanFixtures`, including source merge/deduplication and explicit coverage counters (competitions, raw matches, accepted fixtures, non-European skips, wrong-date skips, missing timestamps, errors).
- The temporary diagnostic endpoint was removed after the connectivity test. No debug feed/sample remains exposed.
- Earlier baseline sources returned: FootyNomad 102 normalized date fixtures (2 pages checked; 197 page matches), OpenLigaDB 88 season catalogue entries, ESPN 28 raw events. These are separate provider counts and must not be summed as unique fixtures.
- Final validation and deployment for the latest commits are running; production endpoint verification is pending. No MAIN Tracker records, predictions, coupons, settlements or bankroll were modified. No paid API or API key added.


## Stage 101 — Flashscore parser regression fixture correction (2026-11-18)
- CI caught a test-fixture placement issue: the "next-day" row inherited the preceding Concacaf competition header, so the parser correctly counted it as non-European rather than as a European wrong-date row.
- Moved the synthetic next-day row under an explicit England competition header. This makes the test exercise the intended Brussels-date exclusion path rather than confounding it with confederation filtering.
- No production data was involved; all changes are confined to source tests and fixture ingestion.


## Stage 102 — Production verification of Flashscore integration (2026-11-18)
- Cloudflare deployment completed successfully for the Europe-only Flashscore integration. Live read-only request to `/api/flashscore/fixtures/2026-11-18` returned HTTP 200 and JSON for the correct Brussels date: 89 competitions checked, 215 raw rows, 113 accepted Europe/UEFA fixtures, 102 non-European rows excluded, 0 missing timestamps. The public global feed contained no additional wrong-date European rows for this snapshot.
- Live FootyNomad endpoint independently returned 102 date fixtures, two pages checked and no errors.
- The app homepage returned the expected MONEYBALL rebuild title and content.
- Updated the browser fixture scan source label to include Flashscore and bumped the local scan cache key from v12 to v13 so existing browser sessions do not keep displaying a pre-Flashscore cached result. The cache refresh commit `cb8171a24da5291f9153a6d8b0782bd7c498bf34` and final docs commit `8bcab8f52a41c07011a8d1b667c883cb29341586` are included in the successful CI/deploy runs recorded in Stage 103.
- Counts above are per-source counts, not a combined deduplicated total. Full scan UI verification still needs an in-app scan; historical Tracker and bankroll data remain untouched.


## Stage 103 — final release acceptance and maintenance boundary (2026-11-18)
- Locked the active release target to repository `damianwalus3-jpg/moneyball-global`, branch `moneyball-rebuild`, Worker `https://moneyball-global-rebuild.damianwalus3.workers.dev/`. Historical MAIN and TEST deployments are not release targets for this rebuild.
- Final deployed source commit: `8bcab8f52a41c07011a8d1b667c883cb29341586`.
- Verified GitHub Actions on that exact HEAD: rebuild CI run `44274730608` SUCCESS; rebuild checks `44274730606` SUCCESS; Cloudflare deploy `44274730636` SUCCESS. Deploy job steps for TypeScript check, unit tests, production build and static Worker deployment all completed successfully.
- Verified live homepage and read-only production fixture endpoints. Flashscore returned 113 Europe/UEFA fixtures, 89 competition headers, 215 raw rows and 102 excluded non-European rows; FootyNomad returned 102 normalized fixtures across two checked date pages with no reported errors. Provider totals are not additive and are not the final deduplicated scan count.
- Source-level acceptance confirms the app calls all seven fixture sources, filters each source to the Brussels date, merges source provenance and deduplicates by date/team identity while distinguishing women's fixtures. The app starts a scan on load and refreshes fixtures/results every 15 minutes; manual refresh is available.
- Scan history and fixture rows are appended idempotently to the browser-local Tracker. The scan action intentionally writes fixture and scan records; no live browser acceptance action was performed in this audit to avoid modifying the user's Tracker. Existing history, predictions, coupons, settlements and bankroll were not changed by this release audit.
- The automated browser interaction / physical Android visual acceptance remains unverified. Do not represent the CI and API checks as a complete visual end-to-end test.
- Product boundaries recorded in README: source catalogues do not prove exhaustive European coverage; recent-form Poisson predictions are not xG-trained and do not include confirmed squads/injuries; odds pilot is disabled and no live odds/EV is available; Tracker is localStorage and does not sync across devices; coupons are paper records and are not placed with bookmakers.
- Updated README and this log so the active source list, successful final deployment, limitations and handoff are accurate.
- **Release/maintenance decision:** treat this build as released for the implemented local-first analytical and paper-tracking scope. Stop creating open-ended feature stages. Reopen development only for a reproducible defect, a production source outage, a security issue, or an explicitly requested feature. No claim of 100% European match coverage is permitted.


## Stage 104 — release dashboard consistency and handoff boundary (2026-11-18)
- Final source review found two stale dashboard labels: the fixture-source row still said six sources although the scanner now combines seven, and the acceptance row implied the visual Android check was merely pending without distinguishing it from completed CI/deployment checks.
- Corrected the dashboard to show seven public fixture sources, explicitly state that coverage is not exhaustive, and mark the remaining physical Android visual check as a documented limitation rather than an open development stage.
- No fixture data, Tracker rows, predictions, coupons, settlement records or bankroll values were changed by this text-only UI correction.
- Release remains limited to the documented free/local-first scope. Reopen only for reproducible defects, provider outages, security issues or an explicitly requested feature; do not create new stages by default.


## Stage 105 — cup fixture team-history fallback and source review (2026-11-18)
- User supplied an Android screenshot showing Copa del Rey fixtures rejected with `open-matchday: Nieprawidłowy identyfikator ligi`, ESPN team-history HTTP 404, and only 0/3 merged historical results.
- Root cause at code level: team history was primarily requested using the fixture's competition folder/shortcut. Cup fixtures and fixtures discovered only by global feeds often do not have a usable league-history identifier; the ESPN fallback also depends on an exact team lookup and a valid default league schedule endpoint. A cup competition is not a reliable proxy for a club's league form.
- Added `loadRecentTeamFormAcrossCountry`: for non-UEFA clubs, it searches every published open-matchday results folder in the same country, loads the current season results with bounded concurrency, matches normalized team names (including diacritics), filters strictly before kickoff date, and deduplicates identical match records. It does not synthesize scores or count future/current matches.
- Cup fixture analysis now attempts the country-wide league-history fallback in addition to valid competition-specific OpenMatchday, OpenLigaDB, OpenFootball and ESPN sources. Invalid/malformed league folder identifiers are skipped instead of being sent to the provider.
- Added tests for cup fixtures with no usable league folder, country filtering, accent-insensitive team matching, and invalid UEFA/country identifiers. Existing minimum of three unique consistent previous results remains unchanged; no threshold was weakened.
- Public source review: open-matchday publishes daily CSVs for 75 competitions, including scores and (for a subset) shots, shots on target, fouls, cards and corners; coverage of detailed statistics is uneven and its stated access is free/no-key but non-commercial. OpenFootball Europe provides selected European fixtures/results under CC0/public-domain licensing. StatsBomb Open Data provides event-level data and xG for a limited selection of historical competitions/seasons, but does not provide broad current-day coverage. Understat/FBref/Transfermarkt scraping is not introduced as an unverified or terms-risky production dependency.
- Sources reviewed: https://github.com/oladeeayo/open-matchday ; https://github.com/openfootball/europe ; https://github.com/withqwerty/football-docs/blob/main/docs/free-sources/overview.md
- Commits: country-wide history implementation `9fb993359ea953c7d96707ff919f6bb4c68a4bac`; cup fixture integration `dbbe00f718fd95d4f0e0ce0d9623377fe887906a`; regression test `a0a37c48954b68bd779b00a161455bc56c797939`; folder/date validation correction `133af0af65b6feacac6b7d9c61ffe1aae5d9d1a3`; App folder guard correction `12df961104bde3fc510ab7c3237355c2d98a6cad`.
- Final validated HEAD: `3c1d632b723588e672f13d9add4074c99fe56ab3`. MONEYBALL rebuild CI run `44280775114`, Rebuild Checks run `44280775142`, and Cloudflare deploy run `44280775129` all completed SUCCESS on this exact HEAD. TypeScript check, unit tests and production build passed; test summary: 21 files and 161 tests passed. Cloudflare Free Worker deploy completed successfully to `https://moneyball-global-rebuild.damianwalus3.workers.dev/`.
- No existing Tracker rows, historical predictions, coupons, settlement records or bankroll values were modified. No paid API, key, hosting or database was added.


## Stage 107 — evidence gate validation and release (2026-11-18)
- Commit `3be3474183cfa89eac77480bb4a3f7c3a4891e52` adds the eight-area evidence audit, explicit goals-lambda-not-xG labelling, strict coupon evidence gate, 15-minute odds freshness and the source/licensing decision matrix in `docs/REBUILD_ANALYSIS_EVIDENCE_POLICY.md`.
- CI run `44286224630`: SUCCESS; 22 test files and 164 tests passed, including TypeScript and production build.
- Rebuild Checks run `44286224684`: SUCCESS.
- Cloudflare Free Worker deploy run `44286224601`: SUCCESS for the same code commit.
- The eight-factor evidence feed itself remains incomplete: no verified no-key/free source was found for all eight areas across all European clubs. The app now reports those areas as missing and blocks strong-candidate/coupon eligibility rather than claiming unsupported certainty. No paid provider or API key was introduced.
- Historical Tracker records, predictions, coupons, settlements and bankroll were not rewritten.


## Stage 108 — PitchAPI server-side connector approved and deployed (2026-11-18)
- User approved using PitchAPI's no-charge API key.
- Reviewed official provider docs and key-registration page. The docs describe 77 leagues, all documented endpoints and history back to 2021; they explicitly require the API key in `X-API-KEY` and say it must remain server-side.
- Added a strict Cloudflare Worker proxy for date fixtures and allowlisted match resources. Date/status and opaque match IDs are validated; only GET is accepted; unknown paths and external browser origins are rejected. The key is never returned to the client.
- Cache policy: date feed 10 minutes, predicted/confirmed lineups 2 minutes, match/standard analytics 30 minutes, shots/advanced analytics 6 hours, live snapshots never cached.
- Added tests for missing secret, invalid date/status, allowlisted upstream calls, CORS/origin protection, and live no-cache behaviour.
- The API key has NOT been provisioned yet. The user must create a free key and enter it directly into Cloudflare Worker settings as `PITCHAPI_API_KEY`; never paste the secret into chat or commit it.
- Important source gap: no dedicated injuries/suspensions endpoints were found in the official PitchAPI reference; those two areas remain unverified and must not be filled from absence of a player in a predicted lineup.
- Key registration: https://pitchapi.dev/get-api-key ; official docs: https://pitchapi.dev/


## Stage 109 — accept provider-issued PitchAPI test keys (2026-11-18)
- User shared the PitchAPI key-generation screen. It visibly issues a `pk_test_` key; the previous Worker validator accepted only `pk_live_`, so it incorrectly returned `pitchapi_not_configured` before attempting the upstream request.
- Official PitchAPI documentation explicitly distinguishes production `pk_live_` and test `pk_test_` keys and uses the same `X-API-KEY` authentication header. Both prefixes are now accepted server-side; the secret remains in Cloudflare Worker settings and is never exposed to browser code.
- Updated regression tests to exercise the provider-issued `pk_test_` key path, including upstream header forwarding and existing security checks. No key value was committed; no existing Tracker, predictions, coupons, settlement or bankroll records were modified.
- Validation/deployment status is recorded after CI and live endpoint verification complete.


## Stage 110 — PitchAPI key activation and live smoke tests (2026-11-18)
- User confirmed the Cloudflare Worker secret was saved. Public REBUILT endpoint `/api/pitchapi/date/2026-11-18?status=all` now returns HTTP 200 through the deployed Worker; this confirms the key is accepted for the date-fixtures endpoint. The response contained 6 fixtures across Saudi First Division, Peru Liga 1 and Brazil Serie A; this is a mixed/global feed, not a Europe-only feed. Do not merge it into the European scan without a strict UEFA/Europe competition filter and deduplication.
- Tested real match `m_4QHczv`: `lineups` returned formations and 11 starters per side, but both sides have `confirmed:false` and `lineup_type:lastStarting11`; treat as historical/last-starting-XI data, never confirmed lineups. `stats` returned an empty periods array; `shots` returned periods null; `players` returned an empty array; `momentum` returned an empty points array. These are valid endpoint responses but no match-specific analytical evidence for this not-started fixture.
- `live` endpoint returned status not_started, live false, and stale true with no live snapshot; correctly do not treat as current live data.
- `events` initially produced a transient 401 in one fetch, then returned HTTP 200 with an empty events array on retry. Record as endpoint responsive but no event data for this not-started match; investigate 401 only if reproducible.
- `advanced`, `advanced/network`, and `advanced/players` could not be validated through the public fetch probe (reported page_not_found); Worker route regex does allow these exact paths and forwards them to PitchAPI. Re-test with a direct HTTP client/Cloudflare logs before marking these analytics available.
- No model integration or predictions were changed. No historical Tracker rows, coupons, settlement records or bankroll values were modified. No secrets were read or exposed.
- Next: validate a European fixture ID from the feed; re-test advanced endpoints with a direct request; check lineups again close to kickoff for `confirmed:true`; only then map verified fields into the model. Keep missing fields explicitly missing; never coerce null/empty to zero or infer xG from goals.


## Stage 111 — European PitchAPI fixture enrichment and historical xG/tactical match analysis (2026-11-18)
- Added server-side proxy routes for PitchAPI league metadata and league match history: `/api/pitchapi/leagues/{leagueId}` and `/api/pitchapi/leagues/{leagueId}/matches?season=...&status=played`. Query parameters are validated; provider key remains server-side. Historical league metadata/matches and immutable match stats/shots/advanced data are cached for 6 hours; predicted lineups retain the short 2-minute cache. Bulk match analysis is throttled to two fixtures at a time to protect the free API allowance.
- Added a typed PitchAPI client and strict country-code allowlist. The date feed is global, so a fixture is admitted into the Europe scan only after its league metadata returns an eligible European country/federation code. Display-name guessing is not used. Fixtures are mapped using Brussels-local kickoff date and retain PitchAPI match, league, season, home-team and away-team IDs; existing fixture records are enriched/deduplicated, and verified European PitchAPI fixtures can add coverage where other free feeds omit a match.
- Verified the new league metadata/history proxy live against Belgian First Division A: league `l_2L6d1F` resolves to country code `BEL`, season `2026/2027`; its played-match endpoint returns real historical fixtures with IDs, UTC kickoffs, teams and settled scores.
- Verified a real completed Belgian league match (Gent–Kortrijk, 2026-11-08, match `m_1IihxY`) from the deployed Worker. Team stats returned All-period xG 1.58–1.29, non-penalty xG 1.58–0.51, xGOT 1.42–1.36, total shots 12–12, shots on target 4–7 and big chances 1–1. Advanced analytics returned team-level PPDA 18.42 and 8.69, field tilt 40 and 60, box entries 9 and 6, plus xT, xAG and direct-speed metrics. This confirms these are actual provider fields, not synthetic goal-based estimates.
- Implemented recent-history analysis: for each upcoming fixture with PitchAPI identifiers, retrieve the league's played matches, select up to the latest five completed matches for each team strictly before the fixture's Brussels date, then retrieve match stats and advanced analytics. Null/missing xG, unplayed scores and missing tactical metrics remain null; they are never converted to zero. xG values from other providers are not mixed into PitchAPI averages.
- Added a separate `pitchapi-recent-xg-poisson` model using observed historical xG/xGA. It requires at least 3 matches with actual xG for each side. Shots, shots on target, xGOT, non-penalty xG, big chances, PPDA, field tilt, box entries, xT, xAG and direct speed are retained as supporting form metrics and shown in the match-analysis UI. Goal-derived lambda predictions remain explicitly labelled as not xG when PitchAPI history is unavailable.
- Safety/calibration gate remains unchanged: the new xG model is explicitly marked not yet calibrated out-of-sample and cannot independently produce a strong candidate or coupon. Other evidence areas (confirmed lineups, injuries, suspensions, tactical context when absent, fatigue and timestamped bookmaker odds/EV) remain required; no claims of complete analysis are made when fields are missing.
- Tests added for PitchAPI league proxy validation, documented league-match response envelope, settled-match cutoff, xG/xGA and shot-quality parsing, xGOT/big-chance metrics, tactical PPDA/territory/possession metrics, null-safe aggregation, European country filtering and separate xG-model labelling. One new aggregation test initially exposed a fixture-ID extraction error in the test stub; the stub was corrected and the subsequent CI passed.
- Final code HEAD `f20b28c7c6464da181b5e37cbf3a67384b3998d0`. MONEYBALL rebuild CI run `44296393434`: SUCCESS. MONEYBALL Rebuild Checks run `44296393345`: SUCCESS. Cloudflare Free Worker deployment run `44296393322`: SUCCESS to `https://moneyball-global-rebuild.damianwalus3.workers.dev/`.
- No legacy Tracker rows, predictions, coupons, settlement records or bankroll values were modified. No paid hosting/database was added; no secret was exposed to browser code or committed.


## Stage 112 — lineup confirmation, evidence audit integrity and Europe allowlist consolidation (2026-11-18)
- Integrated PitchAPI lineups into per-match analysis. The app now stores formations, coaches, starters and provider confirmation flags for both teams. A lineup is marked VERIFIED only when both teams report `confirmed=true` and each has exactly 11 starters; predicted/last-starting-XI data is retained as PARTIAL and never promoted to confirmed. UI labels predicted versus confirmed lineups explicitly and warns that a lineup is not proof of injury-free availability.
- Evidence audit now separately verifies xG/xGA, shots/chances, tactical metrics and confirmed lineups only when the required minimum sample/flags are present. Shots/chances requires both for/against totals, shots on target and big chances for both teams; tactics requires PPDA, field tilt and box entries for both teams. Missing/partial areas remain missing from the strong-candidate gate.
- Corrected evidence timestamp ordering: the audit assessment timestamp is now set after provider observations are added, then completeness is recalculated with `isEvidenceAuditComplete`. This prevents valid observations collected during analysis from appearing later than the audit assessment time. Prediction records now retain the exact prediction method and basis (PitchAPI xG or goal-derived lambda proxy).
- Consolidated the canonical European country allowlist into `src/european-countries.ts`, shared by the original fixture providers and PitchAPI. This avoids divergent filters and preserves the project's established European scope, including the configured UEFA domestic associations. PitchAPI eligibility still requires explicit league `country_code`; league-name guessing is not used.
- Added regression coverage for predicted versus confirmed lineup flags and the full shared European country allowlist. The latest code commit `86347c06ce9113a68ba430de0099d44f26543f72` passed MONEYBALL rebuild CI run `44297012373`, Rebuild Checks run `44297012329`, and Cloudflare Free Worker deployment run `44297012346`.
- Additional free-source research for injuries/suspensions: Soccer Data documents team-level injured/suspended player records and a $0 Free plan with 50 requests/day, 10/minute, current-season stats endpoints; odds are excluded. This is a candidate for a separate optional connector, not yet integrated because it requires a second user-created API key and league-by-league coverage checks. Sources: https://soccer-data.co/pricing ; https://soccer-data.co/docs/reference/teams/injuries ; https://soccer-data.co/docs/concepts/rate-limits . No paid plan is proposed.
- No legacy Tracker rows, predictions, coupons, settlement records or bankroll values were modified. No additional secret was created or requested in this stage.


## Stage 113 — live PitchAPI history and xG coverage verification (2026-11-18)
- Confirmed the current REBUILT Cloudflare Worker is serving authenticated PitchAPI data after the user configured the server-side secret. No key value was read, logged, or exposed.
- Verified current-date fixture endpoint for 2026-11-18. The returned PitchAPI date feed contained Saudi First Division, Peru Liga 1 and Brazil Serie A entries; the shared European country allowlist correctly excludes these from the European fixture scan. This is a concrete example of why provider date feeds must not be treated as complete European schedules.
- Verified the 2026-11-19 feed and league metadata. It returned Fredericia vs Hillerød in Denmark 1. Division at 18:00 UTC / 19:00 Europe/Brussels. League metadata reports country_code=DEN and season=2026/2027; this is admitted by the explicit European country allowlist.
- Retrieved the full 2026/2027 Danish 1. Division played-match history and the last five completed matches for each side before the fixture. All ten selected match-stat payloads contained observed xG and total shots. Fredericia's sample xG-for/xG-against values: 1.10/1.15, 1.87/1.13, 3.25/2.07, 2.72/0.25, 2.01/0.58. Hillerød's: 1.78/1.24, 0.46/0.82, 0.37/0.59, 1.00/0.87, 0.58/2.01. Stats were parsed from the provider's All period, Expected goals (xG) and Shots groups; xAG from advanced analytics is not substituted for xG.
- Sanity-checked the exact venue-specific model inputs for Fredericia (two prior home matches) and Hillerød (two prior away matches): estimated goals 1.57–0.71. An independent Poisson calculation gives indicative 1X2 probabilities approximately 58.0% / 25.2% / 16.8%, and 1X approximately 83.2%. This is a diagnostic calculation only, not a saved official pick or a betting recommendation: the xG model remains uncalibrated out-of-sample and all other required evidence is not complete.
- Checked the upcoming fixture's lineup endpoint. Both sides returned lineup_type=lastStarting11 and confirmed=false (4-4-2 Fredericia; 4-2-3-1 Hillerød). These are historical/likely XIs, not confirmed match lineups. The system must keep lineup evidence PARTIAL.
- Confirmed that PitchAPI match stats and advanced endpoints can be complementary: a real completed match returned xG 1.27–0.51, xGOT 1.52–0.19, and 11–11 total shots in the standard stats endpoint; advanced analytics separately returned PPDA, field tilt, box entries, xAG and possession-value metrics. Keep the metric names distinct.
- No verified injury/suspension list or current bookmaker odds/EV was obtained in this audit. Do not issue a strong-candidate or coupon status based on the diagnostic xG estimate.
- Existing app implementation already includes country-verified PitchAPI fixture merging, league history retrieval, xG/shot/advanced metric aggregation, lineup confirmation flags, and separate xG model labelling. No additional production code change was needed for this verification.
- No legacy Tracker rows, predictions, coupons, settlement records or bankroll values were modified.


## Stage 114 — catalogue-wide European fixture discovery and first xG backtest (2026-11-18)
- Added a server-side, cached `GET /api/pitchapi/leagues` proxy route. The API key remains in the Cloudflare Worker secret and is not returned to the client. Added Worker regression coverage for the catalogue route, upstream URL, key header, source marker and cache behavior.
- Added typed league-catalogue and status-aware league-match clients. The daily scan now enumerates catalogue leagues, filters them by the shared explicit European country-code allowlist, requests each league's current-season upcoming fixtures with bounded concurrency, converts UTC kickoff to Europe/Brussels, and admits only fixtures on the requested local date. Non-European leagues, finished fixtures and other dates are excluded.
- Catalogue fixtures preserve PitchAPI match, team and league IDs so the same historical xG and lineup pipeline can analyze them. Date-feed and catalogue results merge through the existing normalized fixture key, avoiding duplicate rows while preserving source provenance.
- Added explicit scan coverage fields for total catalogue leagues, European catalogue leagues, upcoming catalogue fixtures, exact-day catalogue fixtures and errors. The app now displays these separately from the PitchAPI date-feed count, so a partial date feed is not mistaken for the whole provider schedule.
- Added tests for catalogue parsing, upcoming status query, European-only country filtering, UTC-to-Brussels date rollover, exact-day matching and preservation of provider identifiers. Current code HEAD `2685e1da3cce8684b89d5033e95837af848aa766`: MONEYBALL rebuild CI run `44303861937` SUCCESS; Cloudflare Free Worker deployment run `44303861990` SUCCESS. The deployed catalogue endpoint returned the provider's league catalogue successfully.
- Conducted a leakage-safe retrospective backtest on Denmark 1. Division 2026/2027: 84 completed fixtures; 83/84 team-stat endpoints returned; 66 matches had at least three prior xG observations for each team. The venue-split PitchAPI xG Poisson model achieved 36.36% 1X2 accuracy, Brier 0.23309, log loss 1.14321 and mean top probability 49.12%. The equivalent goals-only recent-form Poisson baseline on the same 66 matches achieved 33.33% accuracy, Brier 0.23862, log loss 1.16847 and mean top probability 48.58%.
- Confidence-bucket result for xG model: top-probability 50–60% had 4/15 hits (26.7%); 60–70% had 3/9 (33.3%); 70–80% had 1/1. The 70–80% bucket is only one observation and has no statistical weight. This one-league/one-season sample is exploratory, not sufficient to calibrate the model or authorize the 75% coupon gate. Do not raise candidate status based on this result.
- The xG model shows a small improvement over the goal-derived baseline in this sample, but confidence calibration is weak. Keep the xG model separate, record calibration by league and season, and require a broader multi-league out-of-sample audit before considering any calibrated probabilities.
- No legacy Tracker rows, predictions, coupons, settlement records or bankroll values were modified.


## Stage 115 — deep audit: PitchAPI catalogue season correctness and free-plan scope (2026-11-18)
- Audited the complete catalogue-driven fixture-discovery implementation after Stage 114. Found a substantive bug missed by the first tests: the provider catalogue's `seasons` array is ordered oldest-first (e.g. 2024/2025, 2025/2026, 2026/2027), while the initial discovery code selected `seasons[0]`. This caused historical season requests instead of the target-date season. The earlier single-season mock test did not expose this.
- Corrected season selection with `selectPitchApiSeason(league, targetDate)`: select the season whose start year matches the European July–June season for the requested month; support calendar-year seasons; sort independently of provider array order; and fall back only to the latest non-future available season. The selected season is now retained on each fixture and also on fetch-error records. No use of array position remains.
- Found a second scope issue: the catalogue includes leagues outside the free plan. Added the explicit `is_free === true` requirement in addition to the European country-code allowlist. Unknown/missing `is_free` is excluded (fail closed), so the free workflow does not deliberately call paid catalogue leagues. UI coverage now reports all catalogue leagues, European leagues, free European leagues, skipped non-free leagues, upcoming fixtures, exact-day fixtures and errors separately.
- Added regression tests for unsorted season arrays, January season selection, calendar-year competitions, future-season exclusion, explicit free-plan eligibility and persistence of the selected season on a fixture. Existing tests still cover exact Brussels date conversion, status filtering, country exclusion and provider ID retention.
- The previous live catalogue sample showed a real league catalogue with `is_free` metadata and seasons ordered oldest-first. Live provider re-fetch is temporarily unavailable in this audit because the external fetch allowance was exhausted; therefore the new season and free-plan logic is validated by deterministic unit tests and CI, not claimed as a new live provider smoke test.
- This audit changes the interpretation of Stage 114: its catalogue-driven scan implementation had been deployed, but before Stage 115 it could query the oldest season and non-free European leagues. Stage 115 corrects both issues; do not treat Stage 114's discovery count as a validated current-season/free-plan count.
- No predictions, coupons, settlement records, bankroll values or legacy Tracker rows were modified.


## Stage 116 — fail-closed season selection hardening (2026-11-18)
- Resumed from the confirmed moneyball-rebuild branch state. The interrupted prior tool sequence had in fact persisted its changes; this was verified from the branch HEAD and commit history before any new writes.
- Re-audited the catalogue-driven PitchAPI scan and its regression tests. Confirmed the scanner selects only explicitly free (is_free === true) leagues whose country code is in the shared European allowlist, records all/european/free-european/skipped league counts separately, and uses bounded concurrency of four league requests.
- Confirmed the season selector handles July–June seasons, January dates, calendar-year competitions and unordered provider season arrays. Found one remaining edge case: when the catalogue contains only future seasons, the fallback could still return league.season, even if it was itself a future season.
- Hardened the selector to fail closed (undefined) if no season at or before the target season is available. Added a regression test where both seasons and season contain only future seasons. This prevents the scan from querying a knowingly invalid future season.
- The date feed now also stores the date-appropriate season metadata instead of blindly copying the provider's season field. The catalogue feed stores the exact selected season on each fixture, including error-path metadata.
- Verified the source tree includes tests for explicit free-plan eligibility; unknown/non-European exclusion; unordered season arrays; January season selection; calendar-year leagues; future-only season rejection; exact Brussels-day conversion; finished fixture rejection; and provider ID/season retention.
- Latest confirmed successful deployment before this final edge-case patch was commit 7d97d3589edb02757e90b42acd97260ff762b31d. Subsequent code/test commits 6352189e040cdd1df8beae882de6550959a38375 and df14ba716f00fc17eef24281bd9e521b59be464b require their own CI and deployment confirmation. Do not claim these last commits are deployed until their workflow runs succeed.
- Live catalogue counts and current-day fixture totals remain unverified in this stage. The earlier provider fetch allowance was exhausted; no fabricated counts are reported. A successful build/deploy is not evidence that every European competition or fixture is covered.
- No historic predictions, Tracker records, coupons, settlement rows or bankroll values were changed.


## Stage 117 — upcoming fixture cache freshness audit (2026-11-18)
- Reviewed the official PitchAPI reference after the season-selection audit. It documents `status=upcoming` as fixtures with `status=not_started`, null scores, and states that fixture kickoffs are updated in place when rescheduled. It also documents the catalogue `is_free` field as true for all currently covered leagues (legacy compatibility field), and the league-match endpoint's season formats for fall/spring and calendar-year competitions. Source: https://pitchapi.dev/ .
- Found a freshness issue in the Worker proxy: all league-match requests, including upcoming schedules, were cached for six hours. This could delay the app from seeing same-day kickoff reschedules even though the client refreshes its scan more frequently.
- Changed only the Worker cache policy: date feeds and non-played league schedules (`upcoming` and `all`) now use a ten-minute cache; played-only league history and the static catalogue/metadata retain the six-hour cache; confirmed lineup reads retain their existing two-minute cache; live snapshots remain no-store.
- Added a Worker regression test asserting the exact Cache-Control values for upcoming (600 seconds) and played-only (21600 seconds) league schedules. This change does not increase request volume beyond the existing scan's bounded concurrency and ten-minute upstream cache.
- Previous date-aware season hardening was deployed successfully on commit f2b17bd1ca11a65dee67a118274dc33de7221e18 (Cloudflare Version ID d9a4fdb7-093d-4f0e-9b41-984e04a4e638). Stage 117 code/test commits 0d33bc0785939335e3b5a417bfe6d3d59cf6080e and 9a892b81c589393e72b7ebeebb5de6e7e9a85f8b are awaiting their own CI/deployment confirmation.
- Live provider catalogue and fixture counts were not re-queried in this stage; no completeness claim is made. No predictions, Tracker rows, coupons, settlements or bankroll data were modified.


## Stage 118 — cache-policy regression test harness correction (2026-11-18)
- The first CI run for Stage 117 exposed one failing test in the new cache-policy regression. The production code typechecked; the failure was isolated to the test mock: `mockResolvedValue` reused one `Response` instance for two upstream calls, but a Response body can only be consumed once. The second call therefore entered the Worker error path and returned `Cache-Control: no-store`, falsely appearing to violate the played-history cache policy.
- Corrected the test fixture to construct a fresh Response for each mocked upstream request. No production Worker logic was changed in this correction.
- This is recorded as a test-harness defect, not as a production cache regression. The Stage 117 cache policy remains: 600 seconds for upcoming/all league schedules and date feeds; 21600 seconds for played-only league history and catalogue/metadata; existing live and lineup policies unchanged.
- New test commit b00f36b1963fd43531f27bbad7390d95bd423421 is awaiting CI and deployment confirmation. Do not claim Stage 117 is deployed until the latest branch workflows pass.


## Stage 119 — automatic daily odds ingestion (2026-11-18)
- Research confirmed that the existing StrikerAPI integration can use the provider's free tier: 500 credits/month, no payment card; `get_odds` costs 10 credits for a date-wide batch and returns 1X2 bookmaker prices. A single daily fetch is therefore budgeted at approximately 300 credits per 30-day month, leaving a 200-credit buffer. Official sources: https://strikerapi.com/ and https://strikerapi.com/docs/get-odds .
- The provider documents odds refreshes hourly for matches in the next four days. Its documented competition enum is limited to 17 competitions across several regions; it is not a complete all-Europe odds feed. The app must continue to show unmatched and unsupported fixtures honestly rather than imply full bookmaker coverage. Official coverage and pricing: https://strikerapi.com/ .
- Replaced the manual-only daily odds action with automatic ingestion after the European fixture scan, provided the owner-only `ODDS_PILOT_TOKEN` is saved in the app and the server-side `STRIKERAPI_API_KEY` is configured in the REBUILT Worker. The token remains browser-local and the API key remains a Worker secret; neither is written to Git or Tracker.
- Added a persistent attempt-date guard: one automatic provider call per scan date, including across reloads and 15-minute fixture refreshes. The attempt is persisted before the request to protect the free monthly credit allowance from duplicate calls and React StrictMode double effects. The previous manual 'unlock another 10-credit fetch' control was removed.
- Existing conservative odds-to-fixture matching remains in place: normalized home/away names, exact Brussels local date, kickoff within 30 minutes, no reversed teams, and ambiguous provider candidates rejected. Only complete 1X2 snapshots are saved, with bookmaker, provider, captured timestamp and matching provenance; missing odds are not imputed.
- Added unit tests for one-fetch-per-day eligibility, missing token, successful/attempted dates, and invalid calendar dates. The actual automatic flow still requires the two pre-existing secrets to be configured; this stage does not create a new paid subscription or spend credits during CI.
- Odds currently ingested are 1X2 prices from the provider's `*_ml_close` fields. Handicap, totals, BTTS and Double Chance are not claimed as automatically populated by this change and remain follow-up work after confirming the provider's exact payload coverage and mapping.
- No historical predictions, coupons, settlements, bankroll or Tracker rows were modified. Full European odds coverage is not yet achieved; provider coverage and per-fixture match rates must be audited from live app diagnostics.


## Stage 120 — per-fixture odds visibility and provider readiness (2026-11-18)
- Added a per-match 1X2 odds panel directly to the European fixture list. It shows up to three latest complete bookmaker snapshots, decimal prices and the provider capture timestamp. Fixtures without a verified matched snapshot explicitly show that no price was found; no odds are guessed or copied across fixtures.
- Added a read-only `/api/odds/status` check in the app. Automatic ingestion is now gated on all required configuration being present: the StrikerAPI server key, the Worker owner-only pilot secret, and the owner token saved locally in the app. The UI reports which prerequisite is missing without exposing any secret. This prevents useless API calls when the Worker is not configured.
- The first test run caught a malformed date-regex escape in the new daily-fetch guard. Corrected the regex and added provider-readiness as an explicit guard condition with regression coverage. This was a test-discovered defect; no production odds request was made by CI.
- The daily fetch guard remains one attempt per Brussels scan date, persisted before the request to avoid duplicate calls on refresh/reload. The StrikerAPI free allowance documented by the provider is 500 credits/month; one daily `get_odds` call costs 10 credits (about 300 credits in a 30-day month). The app deliberately does not expose a repeated-fetch unlock that could exhaust the allowance.
- Current automated market mapping is 1X2 only. Other markets are not advertised as populated until their provider fields and settlement mapping are independently verified. StrikerAPI's published league list is limited; unsupported European fixtures remain visible with an explicit no-verified-odds message.
- Latest code changes across odds guard, tests, App UI and fixture rows are awaiting the final CI and Cloudflare deployment confirmation. No historical prediction, coupon, settlement, bankroll or Tracker data was altered.


## Stage 121 — additional bookmaker markets (2026-11-18)
- Extended the existing daily StrikerAPI odds normalization to preserve the documented Asian/goal handicap line and prices, plus totals line and over/under prices, in addition to the 1X2 moneyline. American prices are converted to decimal odds; line values remain numeric line values and are not treated as prices.
- Persisted the extra market fields on the same fixture/bookmaker/time-stamped Tracker snapshot. The European fixture list now displays 1X2, AH and O/U when the provider actually returns complete values. Missing market fields remain absent; no inferred lines or prices are generated.
- Added a Worker regression test covering American-to-decimal conversion for home/away handicap and over/under prices, as well as preservation of the handicap and totals lines. Existing 1X2 completeness checks and EV calculations remain unchanged and continue to use only complete 1X2 prices.
- Official field definitions and sample response: https://strikerapi.com/docs/get-odds . The endpoint describes per-bookmaker three-way moneyline, goal handicap and total, with date-wide batch cost 10 credits.
- Stage 121 code/test/UI commits are awaiting CI and production deployment confirmation. No historical records or bankroll data were modified.


## Stage 122 — odds ingestion release verification (2026-11-18)
- Confirmed final branch HEAD `39cb8d109261ab9953ad089911b3a48ea75711ef`.
- MONEYBALL rebuild CI passed: TypeScript check, all unit tests and production build succeeded. MONEYBALL Rebuild Checks passed.
- Cloudflare Free Worker deployment completed successfully at 2026-11-18 12:46 UTC. Worker version ID: `105dabdd-f7de-4289-ba56-b9a10e79a7dc`.
- The production build now contains automatic once-per-date odds ingestion (when all owner/provider secrets are configured), per-fixture display of matched 1X2 prices, and optional AH/O-U prices when present in the StrikerAPI response.
- Important activation check remains in the app's Stawki section: it reads `/api/odds/status` and reports whether `STRIKERAPI_API_KEY` and `ODDS_PILOT_TOKEN` are configured. The app does not expose or return either secret. The browser-local owner token must also be saved once. If either server secret is missing, the automatic fetch stays gated and does not consume provider credits.
- No live odds request was made during CI/deployment. Live fixture-to-odds match rate, provider configuration state and actual market coverage must be confirmed from the deployed app; this stage does not claim every European match has odds.

## Stage 123 — StrikerAPI error diagnostics and empty-response guard (2026-11-18)
- The live UI screenshot showed `upstream_http_400`. The Worker previously discarded the provider response body and exposed only the HTTP status, preventing diagnosis without another paid request.
- Updated the StrikerAPI proxy to parse non-2xx response bodies and return only a short provider message (`message`, `detail`, `error`, or `description`) with provider and pilot secrets redacted. Non-JSON error bodies are reported as `non_json_response`; malformed successful JSON is reported separately.
- Added a Worker regression test proving a 400 diagnostic is surfaced while both secrets remain absent from the response.
- Updated the app to reject an empty `games` response as an unsuccessful ingestion rather than marking the date as successfully fetched. The attempt lock remains in place after a provider request to prevent accidental repeat credit consumption.
- Official StrikerAPI documentation confirms `POST /v1/get_odds`, the `date` parameter in UTC as `YYYY-MM-DD`, and documents 5 credits for a match / 10 for a day in its overview while the page's notes currently state 5 credits per call. Treat provider credit wording as inconsistent and do not make test calls to resolve it.
- No live provider request was made during this fix. No historical predictions, coupons, settlements, bankroll or existing Tracker records were modified. CI and production deployment must pass before this change is considered active.

## Stage 124 — Lower-tier history coverage diagnosis (2026-11-18)
- Investigated the attached production screenshot: Piacenza–Lucchese had no PitchAPI fixture/team IDs, Open-Matchday returned no matching team results, and the ESPN fallback returned HTTP 404.
- Read the live Open-Matchday build index (generated 2026-11-18 06:43:48 UTC). Its Italian folders are Serie A, Serie B and Coppa Italia only; it does not publish Serie C or Serie D. Therefore the Piacenza/Lucchese Serie D gap is a source-coverage limitation, not evidence that the app should relax team/score matching.
- Improved `loadRecentTeamFormAcrossCountry` diagnostics: when no rows match, the app now reports the number of country league files scanned, the source index timestamp, and explicitly warns that the dataset does not cover every tier.
- Added a regression test for this coverage-gap message.
- Researched SportsEvents24 as a potential free, keyless supplement. Its documented beta allows 100 data requests/day, 5,000 returned rows/month and only event dates from the previous 7 days to next 30 days; that window cannot independently supply a reliable 3–5 match historical sample for weekly leagues. Not integrated as a replacement for historical form and no request was made.
- No live odds fetches, paid calls, or secrets were used. No existing predictions, coupons, settlements, bankroll, or Tracker rows were modified.

## Stage 125 — Italian Serie D history fallback (2026-11-18)
- Expanded the free historical-results search beyond Open-Matchday's published Italian Serie A/B/Coppa coverage.
- Researched calcio.it and verified its Serie D group pages (A–I), team directory pages and round-by-round results archive. The site publishes identifiable team links and completed match pages; source coverage can be resolved per team instead of assuming a cup fixture's teams share one league group.
- Added a cached same-origin Worker proxy restricted to calcio.it Serie D group A–I team directories and results pages (base latest round or explicit round 1–34). No arbitrary URL proxy is exposed.
- Added client parsing to resolve a team's group by matching the official team link and to extract completed results from the latest eight league rounds. It excludes matches on/after the fixture date, deduplicates by date/opponent/venue, and requires at least three earlier results before contributing a form sample.
- Integrated this source as an additional fallback for Italian Serie D and Coppa Italia Serie D fixtures. It merges with other sources using existing conflict checks; conflicting results are not silently selected.
- Added parser tests for team-to-group resolution and round result extraction.
- No paid API calls, bookmaker calls, or secret values were used. No existing predictions, coupons, settlements, bankroll or Tracker rows were modified. Deployment and live source validation remain pending CI.

## Stage 126 — Guarantee a recorded 1X2 prediction for analyzed fixtures (2026-11-18)
- Added a neutral-prior Poisson fallback for a fixture when PitchAPI xG and all historical-results sources fail or return fewer than three valid matches.
- The fallback produces a normalized 1/X/2 distribution and separately derived 1X/X2/12 probabilities, so the analyzed fixture is no longer left without a prediction record solely because historical sources are missing.
- The fallback is explicitly identified as `neutral-prior-poisson`, records zero observed history samples, documents its generic λ assumptions, and always sets `strongCandidate=false`.
- Existing evidence gating remains unchanged: fallback predictions remain `ODRZUCONY` while evidence is incomplete and cannot enter candidate/coupon pools. This is a prediction placeholder, not an empirical or calibrated forecast.
- Integrated the fallback into the shared fixture analysis path used by bulk analysis and individual fixture analysis. Added a regression test for normalized probabilities, method label, zero sample counts and non-candidate status.
- CI/typecheck/test/build validation pending for this stage. No historical predictions, coupons, settlement, bankroll or Tracker rows were edited.
- Follow-up hardening: fixtures without a verified kickoff time also receive the same explicit neutral-prior 1X2/DC record, while retaining the warning that kickoff is unverified. Fixtures whose kickoff has already passed remain excluded from pre-match forecasting.


## Stage 127 — automatic prediction generation after European fixture scans (2026-11-18)
- Root cause confirmed in the production code: the fixture scan stored and displayed the day's matches, but it did not invoke the shared bulk-analysis path. Forecasts therefore depended on the user manually pressing “Analizuj wszystkie” or opening each fixture.
- Updated the shared bulk-analysis action to accept the just-returned fixture list directly, so a successful initial, manual or scheduled 15-minute scan automatically starts analysis without waiting for React state to settle.
- Added an in-memory lock to prevent overlapping bulk runs. Fixtures are deduplicated by fixture ID, already-recorded rows with complete 1X2 probabilities are skipped, and fixtures whose kickoff has passed are not sent to the pre-match model again. Rows without complete probabilities remain eligible for retry.
- Retained concurrency of two fixture analyses to limit load on free public sources. The existing neutral-prior fallback remains visibly marked and evidence-gated; it cannot become a strong candidate or enter coupons.
- The manual “Analizuj wszystkie” action remains available for recovery. The scan UI's progress count is based on the number of fixtures actually queued for analysis.
- This change does not request paid odds, add API keys, change historical prediction values, or modify coupons, settlements, bankroll, or existing Tracker records. CI, rebuild checks, and Cloudflare deployment must pass before activation is claimed.


## 2026-11-18 — independent 1X2/DC markets, model comparison and coupon guards

- Added independent Tracker rows per fixture/model for 1X2 and Double Chance; 1X2 and DC duplicate prevention is scoped by market.
- The scan coverage diagnostic now compares today's fixture register against both market registers and reports missing 1X2/DC rows. Started fixtures receive explicit rejected pre-match records, never fake pre-match picks.
- The goals-only and PitchAPI xG/xGA Poisson models are run side-by-side when each has at least three prior matches per team. Each model/market is independently evaluated after results arrive.
- Model audit reports Brier score, log loss, accuracy, five calibration bands and ECE. Minimum sample qualification is 30 distinct settled matches per model/market; smaller samples are labelled provisional.
- Coupon selection enforces 75% per selected market, exact three legs, three distinct fixture IDs, latest-per-model/market records, and excludes fixtures after kickoff. Paper settlement supports 1X2 and Double Chance selections separately.
- Tracker UI no longer exposes destructive row deletion; imports remain merge-only and preserve existing history.
- CI/test history: initial test failures were traced to legacy single-row Double Chance and coupon-value compatibility. Backward-compatible reads were restored; latest commit `d8b20b2` passed the main CI validation.


## Stage 128 — independent market repair, Double Chance integrity and live feed smoke checks (2026-11-18)
- Fixed the bulk-analysis queue so a fixture with an existing 1X2 row but no separate Double Chance row is queued for analysis again. The repair check is fixture-level, so it does not repeatedly requeue a fixture once both market records exist.
- Failed/incomplete probability lookups now use a six-hour retry window instead of being retried on every 15-minute fixture refresh. Neutral-prior and missing-xG retries retain their existing six-hour controls.
- Added regression tests for missing 1X2/DC market repair detection.
- Hardened Double Chance probability validation: the three pairwise probabilities derived from a normalized 1X2 distribution must each be in [0,1] and sum to 2. The coupon engine now also requires the selected DC outcome to be the highest-probability DC option.
- Hardened paper coupon settlement so a declared market cannot conflict with its selection type (for example, selection 1X cannot be labelled 1X2).
- Extended the isolated REBUILT deployment smoke test to query the live PitchAPI date feed for the Europe/Brussels current date and the FootyNomad date endpoint, checking their response shapes rather than only the PitchAPI league catalogue.
- Code commit: `d1e480e7e2adaa0f700edb7dc5d2d3195e174946`.
- Validation/deployment: pending CI, rebuild checks and Cloudflare deployment for the documentation-triggered branch head. Do not mark Stage 128 deployed until the new live endpoint smoke checks pass.

 
## Stage 129 — live European fixture reconciliation and visible source coverage (2026-11-18)
- Added a CI live audit that runs the same `scanTodayEuropeanFixtures(true)` pipeline as the application against the deployed REBUILT Worker and all integrated public sources.
- Live snapshot for Europe/Brussels date 2026-11-18: **171 unique fixtures**, **20 countries/federations**, **63 competitions**.
- Source results: Flashscore 113; FootyNomad 77; ESPN 18; open-matchday 6; OpenLigaDB 4; OpenFootball 0; timezone.football 0; PitchAPI 0 verified European fixtures for that local date (the date endpoint itself returned 6 non-European fixtures; catalogue contained 39 free European leagues and 6,609 upcoming season fixtures).
- All eight integrated source checks responded without recorded fetch errors. The reconciliation found 0 duplicate canonical fixtures, 0 wrong-date fixtures and 0 non-European fixtures.
- Important limitation: a healthy source response and 171 deduplicated fixtures do not prove that every national, regional, women's, youth or amateur competition is covered. OpenFootball and timezone.football returned no fixtures for this date; PitchAPI's daily response had no European fixtures. The current total is a verified multi-source snapshot, not a completeness guarantee.
- Updated the Matches tab to display Flashscore diagnostics and the countries/competition count alongside other source metrics.
- Live audit script: `scripts/audit-live-fixtures.ts`; deployment workflow runs it after Worker smoke checks.
- Validation/deployment: **PASS** on code commit `5985ae49999973ea38254881997f54a92cb0b842`; CI run [44360948632](https://github.com/damianwalus3-jpg/moneyball-global/actions/runs/44360948632) and Rebuild Checks [44360948778](https://github.com/damianwalus3-jpg/moneyball-global/actions/runs/44360948778) both succeeded; Cloudflare deployment [44360948599](https://github.com/damianwalus3-jpg/moneyball-global/actions/runs/44360948599) succeeded. Test suite: **24 files / 220 tests passed**. Worker version: `dbce743f-d7bc-4a36-a9e2-4e4ab9ec40a3`. Live fixture reconciliation passed with 171 unique fixtures, 20 countries/federations, 63 competitions, all 8 sources responding and zero fetch errors, duplicate canonical keys, wrong-date fixtures or non-European fixtures.
- Open blocker: empirical xG-vs-goals model quality cannot yet be certified from this snapshot: PitchAPI returned zero verified European fixtures for 2026-11-18, OpenFootball and timezone.football returned zero fixtures for that date, and calibration needs at least 30 different settled matches per model/market. Keep these as explicit gaps, not inferred success.
- Open blocker: the prior StrikerAPI `upstream_http_400` has not been retried because the provider call consumes paid credits. The documented request format is already used; do not spend credits without user approval. The raw upstream response from the failed attempt is still needed to identify a provider-side cause.
- Open verification: live source audit and unit tests pass, but the app's per-fixture prediction records live in the user's browser Tracker. CI cannot inspect that device-local storage. The app exposes the missing 1X2/DC counters and auto-repair logic; confirm those counters are zero in the user's current browser after refresh.

## Stage 130 — niezależna naprawa kompletności prawdopodobieństw 1X2/DC (2026-11-18)

- Ponowny audyt ścieżki `analyzeAllFixtures` wykazał błąd logiczny: kontrola retry sprawdzała prawdopodobieństwa 1X2, natomiast rekord DC mógł już istnieć z wartościami `null` lub z niepoprawną sumą. Sama obecność wiersza DC była traktowana jako kompletność rynku i blokowała naprawę.
- Rozdzielono kontrolę retry dla `1X2` oraz `DOUBLE_CHANCE`. Każdy rynek sprawdza własny wektor prawdopodobieństw, zakres [0,1] oraz prawidłową sumę (1X2 = 1, Double Chance = 2). Sześciogodzinny cooldown jest teraz oddzielny dla fixture+market, więc nie blokuje naprawy drugiego rynku.
- Kontrola modelu xG została wzmocniona: samo istnienie rekordu `moneyball:pitchapi-recent-xg-poisson` nie oznacza już, że model został poprawnie policzony. Za kompletny uznaje się go dopiero wtedy, gdy ma poprawne, najnowsze rekordy 1X2 i DC.
- Zmieniono diagnostykę na ekranie Intelligence: osobno pokazuje mecze bez poprawnych prawdopodobieństw 1X2 oraz bez poprawnych prawdopodobieństw Double Chance. Rekord pusty albo matematycznie niepoprawny nie jest przedstawiany jako użyteczna prognoza.
- Naprawiono również zakres dat diagnostyki: liczniki bieżącego skanu filtrują prognozy po `fixtureDate` zgodnym z aktualną datą Europe/Brussels. Historyczne rekordy Trackera nie mogą już zawyżać dzisiejszej liczby kandydatów ani sztucznie zmniejszać liczby braków.
- Dodano testy regresyjne dla pustego DC, sumy DC równej 2, izolacji modeli i sprawdzania najnowszego rekordu modelu. Istniejące rekordy historyczne i kupony nie są nadpisywane ani usuwane.
- Zmiany kodu/testów: `25882592f5964349391bcfbd2fa30200b7808806`, `fa0dd688b08c7cae03d67e7c99cfcae4ed96d793`, `42e31f1c7838cc4f63f98f82580880f56335cafc`, `0ee6e6fcb80da8b9ea6d974beb59ef5db95435bd`, `adbe077335b446b7ba595290c7ea86192f91cddc`, `505bcda720c72d694319e1afc7e7d9adefca07e7`.
- Publiczny przegląd źródeł: OpenFoot API deklaruje archiwa wyników i dane xG/shot-map dla wybranych lig, lecz zakres i dostępność konkretnych endpointów trzeba potwierdzić przed integracją; FootballAPIs publikuje katalog i porównanie 17 dostawców, przydatne do dalszej selekcji darmowych źródeł. Open-matchday pozostaje użytecznym bezkluczowym źródłem 75 rozgrywek, ale jego własna dokumentacja wskazuje nierówne pokrycie i licencję non-commercial. Źródła: https://openfootapi.com/docs ; https://footballapis.com/api/ ; https://footballapis.com/compare/ ; https://github.com/oladeeayo/open-matchday
- StrikerAPI: aktualna dokumentacja rozróżnia koszt pobrania pojedynczego meczu i całego dnia (5/10 kredytów) oraz wymaga daty UTC. Nie wykonano żadnego płatnego żądania i nie zużyto kredytów. Błąd upstream 400 pozostaje nierozstrzygnięty do czasu uzyskania surowej odpowiedzi lub świadomej zgody na koszt.
- Walidacja CI, testów, buildu, wdrożenia Cloudflare i live reconciliation po tych zmianach: **OCZEKUJE**. Nie ogłaszać etapu jako wdrożonego, dopóki workflow na gałęzi `moneyball-rebuild` nie zakończy się powodzeniem. Nie używać Vercel jako celu wdrożenia.
- Zakres zmian pozostaje wyłącznie w repozytorium `damianwalus3-jpg/moneyball-global`, gałęzi `moneyball-rebuild` i Workerze REBUILT. MAIN, TEST, historyczny Tracker, kupony, rozliczenia i bankroll nie były modyfikowane przez tę poprawkę.


## Stage 131 — ograniczenie ponawiania brakujących prognoz (2026-11-18)

- Dalszy przegląd Stage 130 wykrył wtórny problem: brak rekordu 1X2/DC (a nie tylko istniejący rekord z błędnymi prawdopodobieństwami) omijał sześciogodzinny cooldown, ponieważ funkcja retry natychmiast zwracała `true` dla brakującego rekordu. Dodatkowy warunek obecności rynku w kolejce również wymuszał ponowną analizę przy każdym odświeżeniu co 15 minut.
- Zmieniono retry tak, aby pierwszy brakujący/niepoprawny rynek był analizowany natychmiast, a kolejne nieudane próby tego samego fixture+market były blokowane przez sześć godzin. 1X2 i DC zachowują niezależne znaczniki czasu.
- Usunięto redundantne wymuszanie analizy wyłącznie z powodu braku wiersza rynku; tę sytuację w pełni obsługuje teraz kontrola cooldown dla konkretnego rynku. Retry modelu xG i neutral fallback pozostają niezależne.
- Dodano testy dla pierwszej próby, blokady w oknie cooldown, granicy wygaśnięcia i nieprawidłowego znacznika czasu.
- Przegląd OpenFootAPI: darmowy Starter obejmuje katalog 120 rozgrywek, terminarze, wyniki, tabele i wyszukiwanie przy 5 000 żądań/miesiąc; xG, shot maps i składy są opisane w planie Developer za 14 USD/miesiąc, więc nie spełniają wymogu bezpłatnego xG. Publiczny klucz demonstracyjny jest ograniczony i nie powinien być używany jako produkcyjne źródło. OpenFootAPI nie został podłączony ani nie wygenerowano kosztów. OpenPlay zawiera 26 536 historycznych meczów z xG dla pięciu głównych lig i wybranych rozgrywek UEFA, ale jest statycznym archiwum do sezonu 2025/26, nie feedem na dziś.
- Źródła: https://openfootapi.com/docs ; https://openfootapi.com/pricing ; https://github.com/nlbair/openplay ; https://www.football-charts.com/developers
- Zmiany kodu/testów: oczekują na walidację CI i wdrożenie. Zakres: wyłącznie `moneyball-rebuild` / REBUILT. Nie zmieniano historycznego Trackera, kuponów, rozliczeń ani bankrolla. Nie użyto płatnych API.


## Stage 132 — ponawianie chwilowych błędów transportowych PitchAPI (2026-11-18)

- Walidacja Stage 131 zakończyła się powodzeniem: CI, Rebuild Checks i deployment Cloudflare REBUILT przeszły; 24 pliki testowe / 227 testów, TypeScript i build PASS. Worker wdrożony na commit `091611995a8530ebf780647ec39de76121d020dc`.
- Ponowny live audit dla 2026-11-18 potwierdził 171 unikalnych meczów, 20 krajów/federacji, 63 rozgrywki, 8/8 źródeł z poprawnymi punktami wejścia, 0 duplikatów, 0 złych dat i 0 meczów spoza Europy. Różnica wobec poprzedniego audytu: dwa żądania podrzędne PitchAPI zwróciły przejściowe `fetch failed` (jedna liga w endpointcie szczegółów oraz terminarz Eliteserien). Katalog PitchAPI i endpoint dzienny działały; pozostałe źródła nie zgłosiły błędów. Audyt raportuje te dwa błędy, ale nie uznaje ich za błąd całego skanu, ponieważ dane są łączone z pozostałych źródeł.
- Dodano ograniczone ponowienie tylko dla błędów transportowych i odpowiedzi 502/503/504: jedna próba po 300 ms. Odpowiedzi 4xx, błędy walidacji JSON i brak pola `data` nie są ponawiane. To ogranicza przypadkowe braki z powodu chwilowej awarii sieci, bez pętli odpytywania i bez agresywnego ponawiania limitów 429.
- Dodano testy: transient `fetch failed` → sukces, 503 → sukces, 404 → pojedyncze żądanie i błąd.
- Dalszy przegląd źródeł: Football Charts ma bezpłatne 200 żądań/dzień z kluczem, lecz jego regulamin ogranicza darmowy plan do użytku osobistego/badawczego; aplikacja/strona/bot używany przez inne osoby wymaga planu Commercial (39 EUR/mies.). Nie integrujemy go do publicznie dostępnej aplikacji na darmowym planie. Statyczny zbiór OpenPlay zawiera 26 536 meczów z eventami, 669 404 strzały z xG i licencję CC BY 4.0, ale obejmuje wybrane męskie rozgrywki do sezonu 2025/26, nie aktualne mecze i nie pełną Europę. Jest potencjalnym źródłem historycznego benchmarku, po osobnym sprawdzeniu rozmiaru, kompletności i pipeline'u importu.
- Źródła: https://www.football-charts.com/developers ; https://www.football-charts.com/about ; https://github.com/nlbair/openplay/releases/tag/data-v0.1.0 ; https://github.com/nlbair/openplay/blob/main/DATA_DICTIONARY.md
- Zmiany kodu/testów: oczekują na CI, testy i wdrożenie. Bez płatnych API, bez nowych sekretów i bez zmian MAIN/TEST/Tracker/kuponów/bankrolla.


## Stage 133 — limity czasu żądań źródeł publicznych (2026-11-18)

- Po wdrożeniu Stage 132 testy, TypeScript i build zakończyły się sukcesem (24 pliki / 229 testów). Deployment Cloudflare i smoke test produkcyjnego Worker oraz PitchAPI również przeszły.
- Live reconciliation dla Stage 132 utknęło na kroku skanującym wszystkie źródła; w poprzednim audycie ten sam krok trwał około 71 sekund, a część funkcji pobierających dane nie miała limitu czasu. Nie można pozwolić, aby pojedynczy zawieszony feed blokował raport i kolejne automatyczne audyty.
- Dodano 15-sekundowy timeout do bezpośrednich żądań w skanerze (JSON/CSV), katalogów GitHub OpenFootball, plików feedów OpenFootball i wszystkich żądań PitchAPI. Błąd timeoutu pozostaje błędem konkretnego źródła i nie blokuje wyników pozostałych providerów.
- Poprawiono też rozpoznawanie przeglądarkowego komunikatu `Failed to fetch` w mechanizmie jednorazowego retry PitchAPI; Node'owe `fetch failed` i błędy sieciowe nadal są obsługiwane. Dodano test dla obu wariantów komunikatu.
- Nie dodano nieograniczonych retry. PitchAPI nadal ponawia maksymalnie raz błędy sieciowe i 502/503/504; timeout pojedynczego żądania to 15 sekund. Odpowiedzi 4xx i 429 nie są ponawiane.
- Stage 132 live audit nie został uznany za zaliczony, ponieważ nie zakończył się przed przerwaniem przez nowszy commit. Ostatni kompletny audyt nadal pozostaje snapshotem 171 meczów / 20 krajów / 63 rozgrywki z dwoma przejściowymi błędami żądań podrzędnych PitchAPI; nie ogłaszamy nowej kompletności bez ponownego audytu.
- Walidacja Stage 133 zakończona: CI [44366760298](https://github.com/damianwalus3-jpg/moneyball-global/actions/runs/44366760298) PASS; Rebuild Checks [44366760301](https://github.com/damianwalus3-jpg/moneyball-global/actions/runs/44366760301) PASS; Cloudflare deployment i live audit [44366760983](https://github.com/damianwalus3-jpg/moneyball-global/actions/runs/44366760983) PASS. Testy: **24 pliki / 230 testów**, TypeScript i build PASS.
- Deployment code+docs commit: `278a62b6c4b23f1baeab880a475b9a1e2e45ae42`; Worker version: `9ef2cf63-111b-47e0-9bbd-f56ffe0e6b2c`. Smoke test health, PitchAPI catalogue/date endpoint i FootyNomad date endpoint PASS.
- Live reconciliation po dodaniu timeoutów zakończyło się w ok. 2 min 24 s: **171 unikalnych fixture, 20 krajów/federacji, 63 rozgrywki, 8/8 źródeł z prawidłowymi punktami wejścia**. Walidacja: 0 duplikatów, 0 złych dat, 0 meczów spoza Europy.
- Pokrycie źródeł: Flashscore 113 fixture (90 rozgrywek, 218 raw, 105 odrzuconych jako poza Europą); FootyNomad 77 fixture (199 raw, 7 bez timestampu pominiętych); ESPN 18; open-matchday 6; OpenLigaDB 4; OpenFootball 0; timezone.football 0; PitchAPI 0 europejskich fixture z dziennego endpointu i 0 z katalogowych terminarzy na ten dzień. PitchAPI katalog: 77 lig, 39 europejskich darmowych, 6 609 nadchodzących spotkań w katalogach.
- Jeden odosobniony błąd źródła: `OpenLigaDB · Permier League England: The operation was aborted due to timeout`. Pozostałe żądania OpenLigaDB oraz pozostałe 7 źródeł bez błędów. Skan zakończył się poprawnie dzięki timeoutom i łączeniu źródeł. Nie traktować pojedynczego timeoutu jako dowodu kompletności.
- Aktualny wynik 171 jest zweryfikowanym snapshotem wielu źródeł, nie gwarancją 100% pokrycia każdej ligi, szczebla, kobiet, młodzieży i rozgrywek amatorskich.
- Brak potwierdzenia danych lokalnego Trackera na telefonie użytkownika: CI nie ma dostępu do localStorage w jego przeglądarce. Po odświeżeniu aplikacji należy sprawdzić osobne liczniki brakujących prawidłowych prawdopodobieństw 1X2 i DC. Empiryczna kalibracja modeli nadal wymaga co najmniej 30 odrębnych rozliczonych meczów na model/rynek.
- Zakres: wyłącznie `moneyball-rebuild` / Worker REBUILT. MAIN, TEST, historyczny Tracker, kupony, rozliczenia i bankroll nie były modyfikowane.


## Stage 134 — on-device Tracker integrity diagnostics and European source review (2026-11-18)
- Added an integrity panel directly to the Tracker tab, using the current Europe/Brussels scan date and the same local Tracker records as the rest of the app.
- The panel reports stored record count, fixture count, 1X2/DC record presence, and separately the number of fixtures without valid normalized 1X2/DC probabilities. It explicitly explains that the data is browser-local and cannot be remotely read by CI.
- Added a one-click JSON backup export beside the integrity report so the user can provide the actual Android/WebView Tracker snapshot for inspection. Existing backup/import semantics remain additive; no local data is overwritten or deleted.
- Rechecked model audit: qualification is 30 distinct settled fixtures per model and market; DC reports three binary events per fixture but uses unique fixture count for the threshold. No unqualified performance claim is made.
- Researched additional open fixture sources. OpenMatchday is a useful daily 75-competition supplement but coverage is uneven and its compilation is non-commercial; OpenFootball Europe/Austria are public-domain selected-league supplements, with Austria already represented in the existing national catalogue discovery; FootballAPI.org free access covers only the Premier League while broader coverage is paid. No new broad, terms-compatible free provider was added based on insufficient evidence.
- Last completed 2026-11-18 multi-source audit remains 171 unique fixtures / 20 countries or federations / 63 competitions; this is a snapshot, not a 100% completeness claim. One OpenLigaDB request timed out in that run.
- Detailed evidence and limitations: `docs/STAGE_134_TRACKER_DEVICE_AND_SOURCE_RESEARCH_2026-11-18.md`.
- Validation completed successfully on final docs head `42a899fc51faf0007aa87c406bf32714b10e0773`, including Tracker code commit `40e12c39514fbc74047a3c6b1063e0000ba04b77`: CI [44369076034](https://github.com/damianwalus3-jpg/moneyball-global/actions/runs/44369076034) PASS; Rebuild Checks [44369075697](https://github.com/damianwalus3-jpg/moneyball-global/actions/runs/44369075697) PASS; Cloudflare REBUILT deployment + smoke test + full current-day European reconciliation [44369075778](https://github.com/damianwalus3-jpg/moneyball-global/actions/runs/44369075778) PASS. All steps in the deployment job completed successfully.
- Remaining user-device action: open Tracker on Android, inspect the integrity panel and share the JSON export. Server-side automation cannot access browser localStorage.


### Stage 134 — canonical REBUILT project addresses
- Saved the current application, health-check, repository/branch, deployment workflow, execution-log and live feed endpoint addresses in `docs/PROJECT_ENDPOINTS_REBUILT.md`.
- Explicitly distinguished the active REBUILT Worker from the older MAIN Worker to prevent accidental deployment or testing against the wrong environment.


## Stage 135 — fallback audytu Double Chance po uszkodzonym rekordzie (2026-11-18)

- Przegląd src/model-audit.ts wykazał, że sama obecność osobnego rekordu DOUBLE_CHANCE blokowała użycie poprawnych wartości DC zachowanych w rekordzie 1X2, nawet jeśli osobny rekord DC miał nieprawidłowy wektor prawdopodobieństw.
- Zmieniono kwalifikację osobnego rekordu DC: blokuje fallback wyłącznie wtedy, gdy jego najnowszy rekord ma poprawne, znormalizowane prawdopodobieństwa DC. Nieprawidłowy rekord DC nie może ukrywać poprawnych wartości dc1x/dcx2/dc12 zapisanych w 1X2.
- Dodano test regresyjny obejmujący uszkodzony osobny rekord DC i poprawne wartości DC w 1X2; test sprawdza także, że próbka DC liczona jest jako jeden odrębny mecz, a nie trzy zdarzenia.
- Zmiany kodu: c689aa86ef2bf2e78b318647ba1abeb527ca4577; test: acba3caaef38cf014c859988704c219b3325c48c.
- Walidacja końcowego HEAD 7fec5e8: TypeScript PASS, 24 pliki / 231 testów PASS, build PASS; CI [44371736067](https://github.com/damianwalus3-jpg/moneyball-global/actions/runs/44371736067) PASS; Rebuild Checks [44371735936](https://github.com/damianwalus3-jpg/moneyball-global/actions/runs/44371735936) PASS; Cloudflare REBUILT deployment, smoke test i live source reconciliation [44371736017](https://github.com/damianwalus3-jpg/moneyball-global/actions/runs/44371736017) PASS.
- Stage 135 jest wdrożony na REBUILT.
- Zakres wyłącznie moneyball-rebuild / REBUILT. Bez zmian MAIN, TEST, historii lokalnego Trackera, kuponów, rozliczeń i bankrolla; bez płatnych API.

## Stage 136 — newest settlement ordering in model audit (2026-11-18)
- Audit code review found that duplicate result rows were resolved by first occurrence in Tracker array order. This could select an older score after a correction, because array order is not a reliable settlement timestamp contract.
- Changed result resolution to sort valid result records by createdAt descending, with deterministic ID tie-break, before selecting the newest result per fixture. Invalid actual values remain excluded.
- Added regression coverage that submits newer and older valid result rows in both array orders; both must use the newest settlement.
- Code commit: a4dca821c7bcd104587a4ab7dec4b7c386fd0377. Test commit and final HEAD: a31dd24499329a8897a926be0056089501c2cf6f.
- CI [44376848091](https://github.com/damianwalus3-jpg/moneyball-global/actions/runs/44376848091) PASS; Rebuild Checks [44376848385](https://github.com/damianwalus3-jpg/moneyball-global/actions/runs/44376848385) PASS. TypeScript, 24 test files / 231 tests, and production build PASS.
- Cloudflare REBUILT deployment, health/PitchAPI/FootyNomad smoke checks and full current-day European source reconciliation [44376848094](https://github.com/damianwalus3-jpg/moneyball-global/actions/runs/44376848094) PASS. Worker version 43345c68-ac22-47e1-8ea6-efc7da41b7ba.
- Live source snapshot for Europe/Brussels 2026-11-18: 169 unique fixtures, 20 countries, 61 competitions; all 8 source integrations healthy; 0 duplicate canonical keys, 0 wrong-date fixtures, 0 non-European fixtures, 0 source errors. Coverage remains a multi-source snapshot, not proof of every European youth/women/amateur league.
- Separate audit of the user's 2026-11-18 local Tracker backup (not imported or modified): 232 match records, 818 prediction records, 225 distinct prediction fixture IDs; 56 fixtures have 1X2 but no separate DC row; 7 match records have no prediction rows (including Turkish 2. Lig Red and White fixtures; other rows include cup/UEFA/U19 competitions). 7 coupons are PAPER_NO_ODDS with three legs each; no verified odds or stake. 12 result records. These are backup observations, not a server-side localStorage claim.
- 461 1X2 rows and 108 DC rows lack numeric probability vectors in the backup, but this includes explicitly unavailable/rejected model rows and must not be interpreted as 569 failed active predictions. No Tracker records were changed or imported.
- Remaining work: diagnose why the backup lacks DC rows for 56 fixtures and determine the correct eligibility handling for the 7 unpredicted match rows; inspect Android-local Tracker again after the next scan. Model calibration remains unqualified until at least 30 distinct settled matches per model/market.
- Scope remains only moneyball-rebuild / Cloudflare REBUILT. No MAIN/TEST/Vercel/Lovable, no destructive local Tracker changes, and no paid API calls.



## Stage 137 — commit retry cooldown after analysis completes (2026-11-18)
- Follow-up review of the six-hour retry mechanism found that the retry timestamp was written while fixtures were only being queued. With concurrent batches this could start the cooldown before the corresponding analysis had actually run, delaying retries for fixtures that had not yet been processed.
- Changed the flow so the eligibility check is read-only and the per-fixture/per-market retry timestamp is committed only after `loadFixtureForms(match)` completes. 1X2 and DOUBLE_CHANCE timestamps remain independent. Storage errors remain non-blocking.
- Code and tests are on branch `moneyball-rebuild`, final HEAD `ad4b775c07bac032622789560088047770682e1a`.
- CI [44377383780](https://github.com/damianwalus3-jpg/moneyball-global/actions/runs/44377383780) PASS; Rebuild Checks [44377384117](https://github.com/damianwalus3-jpg/moneyball-global/actions/runs/44377384117) PASS. TypeScript, unit tests and production build passed.
- Cloudflare REBUILT deployment, production health/PitchAPI smoke checks and full current-day European source reconciliation [44377384176](https://github.com/damianwalus3-jpg/moneyball-global/actions/runs/44377384176) PASS. Worker version `f5ccf565-b795-4aa9-8793-0743d93e394e`. Reconciliation reported 0 duplicate canonical keys, 0 wrong-date fixtures, 0 non-European fixtures and 0 source errors. This remains a live multi-source snapshot, not a guarantee of complete coverage of every European competition.
- Re-audit clarification for the local Tracker backup: 56 fixture IDs have no separate DOUBLE_CHANCE row; 28 of those retain a valid embedded DC vector on their 1X2 row (available to the model-audit fallback), while 28 have no valid embedded DC vector. Therefore the count of missing explicit DC rows must not be described as 56 completely missing DC probability sets. No backup records were modified or imported.
- The 7 match records without prediction rows include cup/UEFA/U19 fixtures outside the requested domestic-league scope; the two Turkish 2. Lig fixtures are domestic league matches but their recorded kickoff times had already passed by the backup export. The backup alone cannot prove whether they were discovered before kickoff, so do not invent retrospective predictions.
- Remaining work: validate on the user's Android Tracker after a fresh daily scan; investigate why the 28 fixtures without embedded DC probabilities have no valid DC output; maintain the >=30 distinct settled fixture threshold for each model/market. No local history, coupons, settlements or bankroll modified; no paid API calls; no MAIN/TEST/Vercel/Lovable.


## Stage 138 — atomic multi-model and multi-market Tracker writes (2026-11-18)
- Review of the Android backup and prediction persistence path identified a partial-write risk: each model/market prediction row was written with a separate localStorage.setItem call. An interrupted write or quota failure between the 1X2 and DOUBLE_CHANCE inserts could leave only one market persisted. This is a plausible failure mode, not proof that it caused every historical missing row in the supplied backup.
- Added `addRecords()` to `src/tracker-store.ts`; it constructs all IDs/timestamps first and persists the complete group with one localStorage write.
- Changed `savePredictionRecord()` in `src/App.tsx` to collect all eligible model/market rows and commit them as one batch. Existing records are read-only during candidate construction; no legacy rows are rewritten, deleted or deduplicated.
- Added a regression test asserting a 1X2 + DOUBLE_CHANCE pair is stored with exactly one storage write. Existing import/merge, coupon, settlement, and bankroll behavior is unchanged.
- Commits: tracker batch helper `f057d982025a76a8a99dca8619374cc8b163261a`; prediction integration `b5e88244412a17e59ba80ec9cfad61d43164de1d`; regression test/final code HEAD `c3d54e08ddc40f6313b791d142dedcb5b0acd8da`.
- CI [44378622391](https://github.com/damianwalus3-jpg/moneyball-global/actions/runs/44378622391) PASS; Rebuild Checks [44378622400](https://github.com/damianwalus3-jpg/moneyball-global/actions/runs/44378622400) PASS. TypeScript PASS, 24 test files / 232 tests PASS, production build PASS.
- Cloudflare REBUILT deployment, production Worker smoke test and full current-day Europe reconciliation [44378622322](https://github.com/damianwalus3-jpg/moneyball-global/actions/runs/44378622322) PASS. Live snapshot for Europe/Brussels 2026-11-18: 165 unique fixtures, 20 countries, 60 competitions; 8/8 source entry points healthy; 0 duplicate canonical keys, 0 wrong-date fixtures, 0 non-European fixtures, 0 source errors. Coverage is a live multi-source snapshot, not a completeness guarantee for every European federation, youth, women's or amateur competition.
- No historical Tracker records, coupons, settlements or bankroll were modified. No paid API calls; no MAIN, TEST, Vercel or Lovable work. Follow-up: inspect a fresh Android Tracker export after the next scan to confirm real-device persistence and quantify any remaining incomplete market rows.


## Stage 139 — app-selected matches dashboard view (2026-11-18)
- Added a prominent Dashboard button, **Mecze wytypowane przez aplikację**, linking to a dedicated view. Renamed the navigation destination from “Typ dnia” to “Wytypowane mecze”.
- The view groups the latest stored model output by fixture and presents independent 1X2 and Double Chance selections, with the exact probability attached to the selected outcome (not a generic maximum copied from another market).
- Each market card distinguishes a qualified candidate (evidence complete and market-specific >=75% flag) from missing evidence, invalid selection, or a probability below 75%. It also shows the prediction method, sample metadata, expected-goals basis/estimate where stored, and recorded evidence gaps/reason.
- Model preference for display is xG history first, recent-goals model second, neutral prior last; newest row wins within the same model priority. The view is read-only and does not write to Tracker or alter coupons, settlements, history or bankroll.
- Commits on `moneyball-rebuild`: App view `1cb0bac2f6c4a8140028a57853d171a24359c7ea`; responsive styles `96a515dcb5607fd3e65453a80c5b01f8dc196ef8`; status distinction fix `5e1192d2da9c4202ed9bb983f7467d11e57a7803`.
- Verification status at log time: GitHub combined status exposed only a Vercel rate-limit failure; no passing REBUILT CI/build or Cloudflare deployment was confirmed for these commits. Do not treat the feature as deployed until the branch checks and Cloudflare REBUILT health are verified.
- Next: run typecheck, tests and production build; deploy only to Cloudflare REBUILT; visually verify the new button and list on Android. Then obtain a fresh Android Tracker export for the separate Stage 138 persistence audit.


## 2026-11-18 — Stage 140–143: selected matches, evidence gate, odds freshness and evidence retries

### Stage 140 — current-day selected matches and sorting
- Audited Stage 139 and found that the selected-matches view grouped every prediction in local Tracker history, so older and future-day records could appear beside today's fixtures.
- Added src/selected-matches.ts: it scopes the view to the current Europe/Brussels scan date, keeps the highest-priority model (xG history, then recent-goals, then neutral prior) per fixture/market, and sorts by kickoff time ascending.
- Dashboard's safest pick is now scoped to the same Brussels date. It no longer selects a future-day fixture as today's pick.
- Tests cover Brussels date rollover, historical/future exclusion, market separation, model priority and kickoff ordering.

### Stage 141 — one consistent evidence qualification rule
- Found an inconsistency: the selected-matches card masked incomplete evidence, but the stored prediction status and dashboard candidate counter could still say KANDYDAT based only on model probability and sample size.
- Candidate status now requires both the model's market-specific >=75% flag and evidenceComplete=true across all eight required areas. Probability-only threshold results are retained separately as modelStrongCandidate / modelStrongDoubleChance for analysis, while the official candidate flags stay false until the evidence gate passes.
- Rejection reasons now include the actual missing evidence areas.
- Added src/prediction-eligibility.ts and tests; dashboard metrics and selected-matches UI use the same market-specific eligibility helper.
- Hardened src/coupon-engine.ts: a coupon leg now requires BOTH couponEligible=true AND evidenceComplete=true. This closes a legacy-record edge case where one true flag could previously let an incomplete-evidence record through. Added regression test.

### Stage 142 — odds freshness and history labeling
- Found that the fixture list displayed the newest odds snapshots even when they were stale, and the history table did not show the capture time or freshness status.
- Added listFreshOddsSnapshots; the current fixture view now displays only complete 1X2 snapshots captured within 60 minutes, rejects future-dated/incomplete quotes, and explicitly says StrikerAPI data does not itself confirm a Belgian bookmaker's local offer.
- Older snapshots remain in the local history, but are visibly marked ARCHIWALNY with their capture timestamp. They are not presented as current prices.
- Aligned default odds valuation/bookmaker freshness checks to the provider's documented hourly refresh interval and added tests for stale, future, incomplete and wrong-fixture snapshots.

### Stage 143 — re-analysis when evidence improves
- Found that valid probability vectors prevented a later analysis from being saved even when the evidence audit had improved; valid-but-incomplete records also did not enter the six-hour retry path.
- Prediction retries now respect the existing six-hour cooldown when evidence is incomplete, even if probabilities are mathematically valid.
- New prediction rows are appended (never overwritten) when the evidence-complete flag or missing-evidence list changes. Existing history, coupons, results and Tracker IDs remain intact.
- Added tests for evidence-change append behavior and retry cooldowns.

### Provider pricing review (2026-11-18)
- Refreshed docs/ODDS_PROVIDER_RESEARCH_2026-11-17.md: official API-Football pages showed differing Pro prices ($16 on the homepage vs $19 on the pricing page), with 7,500 requests/day and odds/lineup/injury endpoints; StrikerAPI Starter is $19/month for 10,000 credits. VAT and final EUR checkout totals are not confirmed.
- No paid plan was activated, no key was copied between MAIN/Supabase and REBUILT/Cloudflare, and no provider credits were spent as part of this code work.
- REBUILT still has only the optional owner-controlled StrikerAPI pilot; broad odds coverage and Belgian-bookmaker confirmation remain unproven.

### Validation checkpoint
- Code HEAD before this log update: 3a188008297457171bc12cab3c6dfc6664df8cbc.
- CI [44412089269](https://github.com/damianwalus3-jpg/moneyball-global/actions/runs/44412089269): PASS — TypeScript, 26 test files / 244 tests, production build.
- Rebuild Checks [44412089162](https://github.com/damianwalus3-jpg/moneyball-global/actions/runs/44412089162): PASS.
- Cloudflare deployment for this exact code SHA was still pending at the time of this entry; do not claim it deployed until the deployment workflow and production smoke/reconciliation finish successfully.
- No MAIN, TEST, Vercel, Lovable or destructive Tracker/database work.


## 2026-11-18 — Stage 144–145: trustworthy scan timestamps and truthful source health

### Stage 144 — separate live scan time from upstream catalogue time
- Corrected `src/free-fixtures.ts`: `generatedAt` now records the actual completion time of the current scan; the OpenMatchday index timestamp is preserved separately as `catalogueGeneratedAt`.
- This prevents a several-hour-old source index timestamp from being mistaken for the time at which the current fixture scan ran.
- Code commit: `970dd0ba8b2cd0f6772ec2dfe06e6318ff7d0700`.
- CI [44413393870](https://github.com/damianwalus3-jpg/moneyball-global/actions/runs/44413393870) PASS; Rebuild Checks [44413393751](https://github.com/damianwalus3-jpg/moneyball-global/actions/runs/44413393751) PASS; Cloudflare REBUILT deployment and live reconciliation [44413393735](https://github.com/damianwalus3-jpg/moneyball-global/actions/runs/44413393735) PASS.
- Live Europe/Brussels snapshot (2026-11-18 22:39 UTC): 168 unique fixtures, 20 countries, 63 competitions; 0 duplicate canonical keys, 0 wrong-date fixtures, 0 non-European fixtures. Current scan timestamp age 0 seconds; OpenMatchday catalogue age 15.9 hours; timezone.football feed age 0.9 hours.
- The same live audit exposed an important reporting defect: OpenFootball was marked healthy because its feed counter was non-zero even though its dynamic catalogue reported HTTP 403 across seven GitHub repositories (Europe, England, Germany, Italy, Spain, Belgium and Austria). Its error was present in diagnostics but not reflected in the source-health boolean.

### Stage 145 — source health now reflects actual errors and feed freshness
- Updated `scripts/audit-live-fixtures.ts`: a source is healthy only when it was checked and has no source-specific errors; failed sources are listed in `degradedSources`, and the report now includes `sourceErrorCount` and `requiredSourcesHealthy`.
- Added explicit 24-hour freshness gates for the OpenMatchday catalogue and timezone.football feed, alongside the existing 5-minute live-scan timestamp gate.
- The audit now requires fresh scan/catalogue/feed timestamps, both critical live fixture feeds (Flashscore and FootyNomad), at least 6 of 8 healthy source entry points, and zero duplicate, wrong-date or non-European fixtures. A supplemental source can be visibly degraded without falsely presenting it as healthy or automatically blocking the whole scan when the remaining coverage is healthy.
- Code commit: `2dcd9a94c058cbbead5684e78ce122a4f011c7a7`. CI, Rebuild Checks and Cloudflare deployment/reconciliation are triggered for this commit; final results must be appended after the runs complete.
- Source investigation: reviewed the public `openfootball/football.json` current-season directory as a possible replacement. Verified eight 2026/27 files (Germany 1, England 1–2, Spain 1, France 1, Italy 1, Netherlands 1, Portugal 1); all eight contained zero fixtures dated 2026-11-18, and this set is top-division/selected-league coverage rather than a broad European replacement. It was therefore not inserted as a claimed fix for OpenFootball's dynamic catalogue failure.
- Outstanding: restore reliable OpenFootball dynamic discovery or replace it with a verified public European competition index; inspect and remediate its HTTP 403 without weakening the country/date filters. Keep European completeness explicitly unproven until independent source reconciliation demonstrates it.
- Scope preserved: only `moneyball-rebuild` and Cloudflare REBUILT. No MAIN/TEST/Vercel/Lovable changes; no Tracker history, coupons, settlements, results or bankroll were edited; no paid API usage.


### Stage 145–146 validation and Stage 146 — restore dynamic OpenFootball discovery (2026-11-18)
- The Stage 145 source-health/freshness audit and Stage 146 OpenFootball request fix were validated together on code commit `b14cfcf26851c0a4a1246266c3e74157bc47f25c`.
- Root cause of the seven OpenFootball catalogue HTTP 403 responses: the GitHub REST tree requests did not include the required `User-Agent` header. Added an explicit MONEYBALL REBUILT User-Agent. Catalogue errors now include GitHub's safe diagnostic message and, when applicable, the rate-limit reset time; no credentials or API keys are exposed.
- Live reconciliation confirms the fix: OpenFootball checked 33 feeds and returned 0 fixtures for 2026-11-18 (no current-day matches in those feeds), with 0 errors. This is a source-access recovery, not proof that OpenFootball lists every European competition.
- Latest live snapshot for Europe/Brussels 2026-11-18: 168 unique fixtures, 20 countries, 63 competitions; all 8/8 source entry points healthy; 0 degraded sources; 0 source errors; scan age 0 seconds; OpenMatchday catalogue age 16 hours (within the 24-hour gate); timezone.football feed age 1 hour (within the 24-hour gate); 0 duplicate canonical keys, 0 wrong-date fixtures and 0 non-European fixtures.
- FootyNomad returned 73 European fixtures from 2 UTC date pages; Flashscore returned 112 fixtures from 90 competitions checked; ESPN returned 18; OpenLigaDB returned 4; OpenMatchday returned 6. These are source contributions before cross-source deduplication, not an exhaustive match-count promise.
- CI [44414053802](https://github.com/damianwalus3-jpg/moneyball-global/actions/runs/44414053802) PASS: TypeScript, 26 test files / 244 tests, production build.
- Rebuild Checks [44414053981](https://github.com/damianwalus3-jpg/moneyball-global/actions/runs/44414053981) PASS.
- Cloudflare REBUILT deployment, production Worker/PitchAPI/FootyNomad smoke checks and full live Europe reconciliation [44414053951](https://github.com/damianwalus3-jpg/moneyball-global/actions/runs/44414053951) PASS.
- Final code HEAD: `b14cfcf26851c0a4a1246266c3e74157bc47f25c`; documentation history is being updated in this commit sequence.
- Scope preserved: only `moneyball-rebuild` and Cloudflare REBUILT. No MAIN/TEST/Vercel/Lovable changes; no Tracker history, coupons, settlements, results or bankroll were edited; no paid API usage.
- Remaining limitation: a clean 8/8 source-health result means all configured feeds answered correctly for this scan, not that every European federation, division, women's/youth/amateur league is covered. Continue independent competition-level reconciliation and do not claim 100% European completeness.


### Stage 147 — dashboard scan-time and source-label accuracy (2026-11-18)
- Audited the live dashboard and match-list presentation after the source timestamp repair.
- Fixed a misleading dashboard caption that still called `fixtureScan.generatedAt` an “open-matchday build”. It now labels it correctly as the live scan completion time and separately shows the upstream OpenMatchday catalogue timestamp when available.
- Removed a stale hard-coded “7 public sources” label from the dashboard stage summary; the active source set is described without a brittle count.
- No prediction, odds, fixture, coupon, settlement, Tracker or bankroll data was modified.
- Code commit: `ff2077779c83cd5a4afb59137c4c18a0c1e55667`. CI, Rebuild Checks and production deployment are triggered; record their final status after completion.


### Stage 148 — API-Football Pro server-side gateway (2026-11-18)
- Added `API_FOOTBALL_KEY` to the Cloudflare Worker environment contract and a date-scoped `GET /api/api-football/fixtures/YYYY-MM-DD` proxy.
- Uses API-Sports v3 fixtures with explicit `Europe/Brussels` timezone, 5-minute cache, upstream status/error handling, and server-side secret only. The key is never returned to the browser or written to repository files.
- This first integration exposes raw provider fixture data for validation; it does not yet merge API-Football fixtures into the canonical European fixture list or claim complete coverage. Statistics, injuries and lineups require separate endpoints and will be added after validating the subscription response.
- Code commit: `adc5602944faf7bb5b95c7f89dcb3275254abe2a`. Secret presence and upstream response must be verified by the production smoke test before claiming the paid key is active.


### Stage 149 — API-Football Pro in canonical European fixture scan (2026-11-18)
- Production smoke test confirmed the server-side API-Football Pro key is configured and the v3 fixtures endpoint returned HTTP 200 with 183 provider fixtures for Europe/Brussels date 2026-11-18. This validates the key and fixtures endpoint only; it does not prove that all 183 are European or that odds/statistics/lineups are included.
- Integrated the API-Football daily response into `scanTodayEuropeanFixtures` as an additional source. Fixtures are admitted only when the provider's country maps to a known European country code and the kickoff converts to the requested `Europe/Brussels` date. Non-European, unknown-country, malformed, and wrong-date records are excluded.
- API-Football fixtures merge into the existing canonical fixture map using the same normalized fixture key; source provenance and provider fixture/league IDs are retained without overwriting historical records.
- Added API-Football coverage counters (provider response count, European same-day mapped count, source errors) to the scan result.
- Added unit tests for Brussels date rollover, country filtering, provider IDs/provenance, empty payload and malformed response.
- Code commits: `00e3829c8ecbd2de4d1797581f973f976f27f899` (integration), `084b091fb1edc4c45807d3d5dcda79dcdafc5754` (tests).
- Validation/deployment workflow runs are recorded after the final documentation commit. Do not claim full European coverage from this source; API-Football is one additional feed in the multi-source reconciliation.
- Next: after production deployment, compare API-Football's mapped European same-day fixtures with FootyNomad/Flashscore and inspect source disagreements. Then validate separate API endpoints and plan entitlements for statistics, injuries, lineups and odds before integrating those datasets.
- Scope preserved: only repository `damianwalus3-jpg/moneyball-global`, branch `moneyball-rebuild`, and Cloudflare REBUILT. No MAIN/TEST/Vercel/Lovable or legacy Supabase projects touched. No tracker history, predictions, coupons, settlements, results or bankroll were modified.


## Stage 150 — API-Football widoczny w audycie źródeł (2026-11-18)
- Po wdrożeniu Stage 149 pełny audyt produkcyjny zakończył się sukcesem dla daty Europe/Brussels 2026-11-18: 168 unikalnych meczów, 20 krajów, 63 rozgrywki; 0 duplikatów, 0 meczów z błędną datą, 0 spoza Europy, 0 błędów źródeł.
- API-Football gateway odpowiedział HTTP 200, ale w tym przebiegu zwrócił 0 fixtures; zapisujemy to jako poprawną odpowiedź źródła, nie jako dowód pokrycia meczów. Wcześniejszy test endpointu zwrócił 183 fixtures dla tej daty. Różnica wymaga dalszej diagnostyki zmienności odpowiedzi/API planu/cache.
- Dodano API-Football Pro do `sourceHealth` w audycie live. Źródło jest zdrowe, gdy wywołanie skanera nie zgłosiło błędu; liczba 0 meczów nie jest automatycznie traktowana jako awaria.
- Nie zmieniono danych historycznych, kuponów, rozliczeń ani bankrolla.
- Weryfikacja Stage 149: commit `bbcae7f`, CI + Rebuild Checks + Cloudflare deploy + live reconciliation — SUCCESS; 26 plików testowych, 247 testów.
- Następny krok: sprawdzić dlaczego API-Football zwrócił 0 w pełnym skanie mimo wcześniejszego 183, a następnie porównać jego listę meczów z FootyNomad/Flashscore bez dopisywania duplikatów.


## Stage 151 — wykrywanie błędów API-Football przy HTTP 200 (2026-11-18)
- Audyt Stage 149 pokazał, że endpoint API-Football zwrócił HTTP 200, ale 0 fixtures, podczas gdy wcześniejszy smoke test dla tej daty raportował 183. Sam kod HTTP nie wystarcza więc do uznania odpowiedzi za poprawną.
- Parser API-Football odrzuca teraz payloady z niepustym polem `errors` (obiekt lub tablica), aby błędy autoryzacji, limitów lub parametrów nie były mylone z poprawnym pustym dniem.
- Dodano testy dla błędów providera ukrytych za HTTP 200.
- Audyt źródeł rozszerzono w Stage 150 o status API-Football; po tej poprawce nieprawidłowa odpowiedź zwiększy liczbę błędów źródła i oznaczy je jako zdegradowane.
- Oczekiwana walidacja: typecheck, pełny zestaw testów, build, wdrożenie REBUILT i porównanie surowej odpowiedzi z dziennym feedem. Nie zakładamy, że 0 fixtures oznacza brak meczów.


## Stage 152 — API-Football Pro: potwierdzony przyrost europejskiego pokrycia (2026-11-18)
- Wdrożenie commita `ef17890` na Cloudflare REBUILT zakończone sukcesem; CI, Rebuild Checks i deploy zakończone SUCCESS.
- Smoke test produkcyjny: API-Football Pro HTTP 200, 183 mecze dostawcy dla 2026-11-18.
- Główny skaner: 103 mecze API-Football przeszły filtr europejski i datę Europe/Brussels.
- Wynik uzgodnienia wieloźródłowego: 189 unikalnych meczów, 20 krajów, 65 rozgrywek. Poprzedni audyt przed integracją: 168 unikalnych meczów i 63 rozgrywki. Przyrost netto: +21 meczów i +2 rozgrywki.
- Jakość: 0 duplikatów, 0 błędnych dat, 0 meczów spoza Europy, 0 błędów źródeł. Wszystkie 9 monitorowanych źródeł zdrowe; API-Football Pro: providerFixtures=183, europeanDateFixtures=103, errors=0.
- Odpowiedź API-Football z HTTP 200 i pustą listą z wcześniejszego przebiegu nie powtórzyła się. Wprowadzona walidacja pola `errors` pozostaje aktywna, aby błędy providera nie były mylone z prawidłowym pustym dniem.
- Ograniczenie: snapshot potwierdza bieżące pokrycie, ale nie dowodzi kompletności wszystkich federacji, lig kobiecych, młodzieżowych i amatorskich w Europie. Kontynuować porównanie brakujących rozgrywek.
- Bez zmian w historycznych rekordach, kuponach, rozliczeniach i bankrollu.


## Stage 153 — bezpieczny pilot kursów API-Football (2026-11-19)
- Dodano do istniejącego chronionego endpointu `/api/odds/pilot` parametr `apiFootballFixtureId` (wyłącznie numeryczne ID fixture z API-Football).
- Endpoint odpytuje `GET /odds?fixture={id}` z kluczem API-Football wyłącznie po stronie Workera; klucz nie trafia do przeglądarki ani odpowiedzi.
- Dostęp nadal wymaga właścicielskiego `ODDS_PILOT_TOKEN`; źródło nie pobiera kursów przy publicznym wejściu do aplikacji.
- Odpowiedzi są cache'owane na edge 15 minut, aby ograniczyć zużycie limitu API. Zwracane są status, liczba wyników, błędy dostawcy i surowe dane bookmaker/market bez automatycznego zapisywania do Tracker, kuponów lub P/L.
- Rozróżniamy `ok`, `provider_error`, `not_configured` i `error`; brak kursów w danym fixture nie jest przedstawiany jako kurs 0 ani jako oferta bukmachera.
- Dokumentacja API-Football opisuje endpoint odds i informuje, że pokrycie odds jest zależne od ligi/sezonu; pole coverage ligi może mieć wartość false. Sam plan Pro daje dostęp do endpointu, ale nie gwarantuje kursów dla każdego spotkania.
- Źródła dokumentacji: API-Football v3 docs i oficjalna tabela planów/coverage (sprawdzone 2026-11-19).
- Wdrożenie i testy CI są wymagane przed uznaniem pilota za aktywny produkcyjnie. Nie wykonywano jeszcze zapytań live o kursy na konkretnych meczach.

- Walidacja pierwszego commitu Stage 153 wykryła nieaktualny tekst oczekiwanej odpowiedzi w istniejącym teście 400 (kod produkcyjny poprawnie rozszerzył listę parametrów, test nadal oczekiwał starej listy). Zaktualizowano asercję i dodano test odrzucający niepoprawne API-Football fixture ID przed wywołaniem dostawcy. Typecheck przechodził; test suite miała 247/248 zaliczonych przed korektą. Ponowna walidacja i wdrożenie są uruchamiane po poprawce.


## Stage 154 — diagnostyka błędów API-Football (2026-11-19)
- Produkcyjny deploy Stage 153 zakończył się sukcesem: CI, Rebuild Checks i Cloudflare Deploy SUCCESS. Weryfikacja produkcyjna wykazała 45 unikalnych meczów na 2026-11-19, 15 krajów, 25 rozgrywek; źródła główne zdrowe, ale API-Football Pro zwróciło 0 fixture i zostało oznaczone jako zdegradowane.
- Pierwotny komunikat parsera ukrywał rzeczywisty szczegół błędu dostawcy, przez co nie dało się rozróżnić ograniczenia planu, autoryzacji, limitu zapytań ani innego problemu.
- Parser zmieniono tak, aby raportował ograniczony do 300 znaków szczegół błędu dostawcy, z redakcją wartości token/apiKey/authorization/password. Dodano testy diagnostyki i redakcji sekretów.
- To jest poprawa obserwowalności, nie naprawa przyczyny upstream. API-Football pozostaje zdegradowane do czasu ponownego sprawdzenia szczegółu błędu po wdrożeniu.
- Stage 153 deployment jest aktywny; Stage 154 wymaga pełnego CI, testów, builda, wdrożenia i ponownego live audit. Nie zmieniono historii trackerów, kuponów ani bankrolla.


### Stage 154 — poprawka redakcji sekretów i ponowna walidacja (2026-11-19)
- Workflowy Stage 154 wykryły, że regex redakcji był nadmiernie escapowany i nie dopasowywał separatorów pól JSON; w efekcie test `apiKey` wykazał, że wartość sekretu pozostawała w komunikacie diagnostycznym.
- Zastąpiono kruchą redakcję regexem JSON replacerem, który maskuje wartości pól o nazwach zawierających token, api_key/apiKey, authorization lub password, niezależnie od wielkości liter i zagnieżdżenia.
- Rozszerzono test o `apiKey` oraz zagnieżdżone `Authorization`; sekret nie może pojawić się w komunikacie.
- Poprawka kodu: `727b77603c0162e657b624fd839e60ac83443cee`; test: `c5ee9c4d3bb5eb24ca4aadde6ca1d2a92c80c234`.
- Wdrożenie Stage 154 nadal oczekuje na zielone CI, Rebuild Checks, build i produkcyjny deploy. Nie uznajemy API-Football za naprawione upstream do czasu odczytania bezpiecznego komunikatu po wdrożeniu.
- Bez zmian w danych historycznych, kuponach, rozliczeniach i bankrollu.


### Stage 155 — rozdzielenie prawdopodobieństwa modelu od kwalifikacji kuponowej (2026-11-19)
- Analiza zrzutu ekranu „Wytypowane mecze” wykazała mylący komunikat: wynik 75,5% dla 1X2 i 90,9% dla Double Chance był wyświetlany obok etykiety „ODRZUCONY · BRAK DANYCH”.
- Przyczyna: liczby są surowymi prawdopodobieństwami modelu recent-form-goals-poisson, wyliczonymi z historycznych goli (nie xG); Double Chance jest pochodną tego samego rozkładu. Nie są one automatycznie dowodem wiarygodności. Audyt wymaganych obszarów nadal wykazuje braki (xG/xGA, składy, absencje, strzały/jakość sytuacji, taktyka, terminarz, aktualne kursy i EV).
- Nie obniżono bramki bezpieczeństwa ani progu dowodowego. Rekordy bez kompletnego, zweryfikowanego materiału nadal nie mogą wejść do puli kuponowej.
- Poprawiono warstwę prezentacji: takie liczby otrzymują status „WSTĘPNA PROGNOZA · NIEKWALIFIKOWANA” oraz ostrzeżenie, że to surowe prawdopodobieństwo modelu, nie potwierdzona wiarygodność ani kwalifikacja do kuponu. Status KANDYDAT ≥75% pojawia się tylko po przejściu pełnej kontroli dowodów i flagi rynku.
- Dodano testy rozdzielające status prezentacji od kwalifikacji; 1X2 i DC sprawdzane niezależnie.
- Commity: `a5c43bc8` (logika statusu), `98d66ade` (testy), `363c841d` (UI).
- Bez zmian w historycznych predykcjach, kuponach, rozliczeniach i bankrollu.


### Stage 155 — czytelny status wysokich prognoz bez pełnych dowodów (2026-11-19)
- Analiza zrzutu ekranu wykazała problem prezentacyjny: surowe prawdopodobieństwo 75,5% (1X2) i 90,9% (Double Chance) było wizualnie oznaczone czerwonym statusem odrzucenia, mimo że model poprawnie zachował te wartości jako prognozy niezakwalifikowane.
- W widoku „Wytypowane mecze” status z niepełnymi dowodami otrzymuje osobną klasę wizualną `preliminary` (bursztynową), a opis wyraźnie mówi: „Wysokie prawdopodobieństwo modelu — prognoza wstępna. Nie oznacza potwierdzonego typu ani dopuszczenia do kuponu.”
- Statusy rzeczywiście odrzucone z innych powodów pozostają czerwone; zakwalifikowani kandydaci pozostają zieloni.
- Wewnętrzny warunek `KANDYDAT`, `evidenceComplete === true` oraz reguły kuponów nie zostały poluzowane. Sam procent nie może automatycznie promować typu.
- Zmiany: UI `47f0adcf2f88dae593603291b2ac3838e5fa5d31`; CSS `e61968c438de2fa1b6909bf7304be80e40c405b7`.
- Bez modyfikacji zapisanych rekordów, historii, kuponów, rozliczeń i bankrolla. Walidacja CI/deploy Stage 155 oczekuje na zakończenie.


### Stage 156 — diagnostyka planu i limitów API-Football (2026-11-19)
- Po wdrożeniu Stage 155 pełny audyt europejski zakończył się sukcesem technicznym, ale API-Football Pro pozostał zdegradowany: 0 fixture, 1 błąd. Dokładny komunikat: `Too many requests. You have exceeded the limit of requests per minute of your subscription.`
- Oficjalna dokumentacja API-FOOTBALL opisuje endpoint `/status`, który nie zużywa dziennego limitu. Dodano serwerowy, cache'owany endpoint `/api/api-football/status`.
- Endpoint zwraca wyłącznie plan, aktywność i datę końca subskrypcji oraz bieżące liczniki/limity dzienne i nagłówki limitu na minutę. Dane osobowe konta i klucz API są celowo pomijane.
- Odpowiedź z dziennego feedu fixtures wzbogacono o nagłówki limitu minutowego i pozostałego limitu dziennego, jeśli dostawca je zwróci.
- Dodano testy bezpieczeństwa, konfiguracji sekretu, cache i maskowania danych prywatnych. Zmiany kodu: worker `0297599e14c9224c9a8e62626d7de8265bc02287`; testy `6aba45bbe5668f64ce3b62efb965163e71c16baa`.
- To narzędzie diagnostyczne — nie deklarujemy jeszcze naprawy rate limit. Po wdrożeniu odczytamy rzeczywisty plan i limity przypisane do klucza, a potem dobierzemy harmonogram i cache.
- Bez zmian w rekordach trackerów, kuponach, rozliczeniach i bankrollu.


### Stage 156 — walidacja produkcyjna i smoke test statusu API-Football (2026-11-19)
- Commit `aa2aadbf`: CI, Rebuild Checks i Cloudflare Deploy SUCCESS. Produkcyjny smoke test potwierdził API-Football Pro: 111 fixtures dla daty Brussels 2026-11-19.
- Pełny audyt po wdrożeniu: 48 unikalnych meczów, 15 krajów, 27 rozgrywek; wszystkie 9 źródeł healthy, 0 źródeł zdegradowanych, 0 błędów, 0 duplikatów, 0 meczów spoza daty i 0 nieeuropejskich.
- Dodano dodatkowy smoke test w workflow deploy dla endpointu `/api/api-football/status`, aby przy każdym wdrożeniu weryfikować strukturę bezpiecznych metadanych subskrypcji i liczników limitów bez ujawniania danych prywatnych.
- Workflow change commit: `efb241f50d08cf199f9f973ab2e67ea7445abed2`. Walidacja i wdrożenie tego dodatkowego smoke testu oczekują na CI.
- Endpoint statusu nie został jeszcze niezależnie odczytany poza workflow; nie deklarujemy potwierdzenia dokładnego planu/licznika konta, dopóki smoke test nie przejdzie.
- Brak zmian w historycznych rekordach, kuponach, rozliczeniach i bankrollu.


## Stage 157 — source health, contribution and coverage made explicit (2026-11-19)
- Added a dedicated source-diagnostics module for the nine fixture providers.
- The Matches screen now separates checked requests/catalogues, raw provider records, records accepted after the Europe/Brussels date and European filters, and provider errors.
- A successful provider response with zero relevant fixtures is no longer visually conflated with a provider failure; provider error, no-data, zero-match response and positive contribution are separate states.
- The screen reports the unique merged fixture count, distinct countries/federations and distinct competitions. It explicitly warns that provider counts overlap and that the feed union is not proof of exhaustive European coverage.
- API-Football raw provider volume is kept separate from European/date-qualified fixtures; PitchAPI catalog size, European catalog, free catalog and date-qualified contribution are shown independently.
- Added unit tests for zero-match success vs failure, raw-vs-accepted counts, and unique country/competition summaries.
- Historical Tracker records, coupons, settlements and bankroll were not modified.
- Implementation commits: `48960ce`, `b1b2806`, `d84d682`, `4af8525`.
- Deployment status: pending CI, production deployment and smoke-test confirmation.

## 2026-11-19 — Stage 158: production odds freshness hardening and scan-integrity audit
- Confirmed Stage 157 status-label correction is deployed on the isolated rebuild Worker; CI and deploy workflows both completed successfully, including TypeScript, unit tests, build, Worker smoke test and current-day European source reconciliation.
- Audited the live implementation paths for prediction persistence, 1X2/DC market coverage, odds snapshots, coupon valuation, paper settlement, and Tracker storage.
- Confirmed bulk scan invokes analysis for every discovered pre-kickoff fixture; each model attempt writes independent 1X2 and Double Chance rows, including explicit rejected/incomplete rows when a usable model distribution is unavailable. Actual completeness still must be checked against the owner's local Tracker export because Tracker data lives in browser localStorage and is not available to CI.
- Confirmed coupon generation enforces exactly three unique fixtures and only uses latest qualifying prediction per fixture/model/market. Current odds valuation deliberately refuses Double Chance legs because the connected snapshot schema contains only 1X2 prices.
- Found and fixed a critical provenance defect: when a provider omitted its capture timestamp, the UI previously substituted the local current time, which could falsely make an old/untimestamped quote appear fresh. Missing provider timestamps are now stored as an empty value and marked UNVERIFIED_TIMESTAMP; they cannot enter fresh-odds lists or coupon valuation.
- Tightened the default coupon quote freshness window from 360 minutes to 60 minutes, matching the app's hourly odds freshness policy. Added regression tests for missing timestamps and quotes just beyond 60 minutes.
- Confirmed the current odds pilot is StrikerAPI-based and requires the owner-configured Worker secret/token; no direct Bwin Belgium feed has been verified. Do not label bookmaker coverage or Bwin availability as confirmed until a real provider response proves it.
- Confirmed local Tracker is device/browser-local JSON storage; it is not a shared cloud database. Cross-device state and the actual phone's match/market counts cannot be certified from GitHub CI alone.
- Confirmed evidence qualification is intentionally strict: xG/xGA, confirmed lineups, injuries, suspensions, shots/chances, tactics, schedule/fatigue and current odds/EV must all be verified before the record can be a coupon-eligible candidate. A raw probability >=75% can therefore remain rejected if the evidence checklist is incomplete; the UI now distinguishes this from a genuinely sub-75% forecast.
- Remaining acceptance blockers: owner-side Tracker export for the real current scan; live odds provider secret and real bookmaker response (especially Bwin Belgium); verification of DC quote source; audit of historical device records and bankroll ledger; real Android navigation/performance checks. No old coupon, settlement, Tracker or bankroll record was modified by this stage.
- No paid API, subscription, database or hosting tier was added. Existing main branch and its production Worker remain untouched.
- Stage 158 code changes are committed; CI and Cloudflare deployment must pass before marking the stage deployed.

### Stage 158 — deployment and live source reconciliation passed
- Final branch commit at deployment: 1ef60e167279cb857e83169bedb067d8b2ff5ccf.
- CI run 44455688874: SUCCESS — TypeScript, all unit tests and production build passed.
- Cloudflare deployment run 44455688918: SUCCESS — build, deploy, Worker smoke test, PitchAPI health/catalogue/date-feed checks and live European source reconciliation all passed.
- Live Europe/Brussels scan at 2026-11-19T04:05:25Z: 48 unique fixtures across 15 countries/federations and 27 competitions; all 9 configured source-health checks passed; zero source errors, duplicate canonical keys, wrong-date fixtures or non-European fixtures. OpenMatchday catalogue age 21.4h and timezone.football feed age 1.8h, both within the 24h check.
- Source contribution snapshot: Flashscore 21 accepted fixtures from 60 competitions checked; FootyNomad 18 fixtures from 2 UTC pages; API-Football 16 European date fixtures from 111 provider fixtures; ESPN 8; OpenLigaDB 5; PitchAPI 1 European date fixture. Source counts overlap and are not additive.
- This is a live multi-source snapshot only; it does not prove every European amateur, youth, women's or regional competition is represented.

## 2026-11-19 — Stage 159: cross-module acceptance blockers discovered
- Code audit confirms there is currently no implemented bankroll-balance calculation, opening-balance ledger workflow, or available-balance stake guard in the rebuilt Stawki module. The module records decisions and realized P/L only. Bankroll protection therefore remains NOT IMPLEMENTED/NOT VERIFIED; do not infer a balance from the legacy MAIN project or mutate its records.
- The current evidence gate requires all eight evidence areas to be VERIFIED before a model prediction can become coupon-eligible. The App currently populates xG/xGA, shots/chances and tactics only when PitchAPI supplies them, and confirmed lineups when available. No App writer was found for injuries, suspensions, schedule/fatigue or current odds/EV. This explains why high raw model probabilities can remain rejected and means strong-candidate qualification is presently structurally constrained. Do not weaken the gate by fabricating VERIFIED evidence.
- Odds adapter currently consumes StrikerAPI pilot snapshots only; the repository has no Bwin-specific adapter. Current 1X2 snapshot support does not price Double Chance coupon legs. The active Worker status endpoint reports API-Football Pro subscription active through 2026-12-18; confirm the owner's intended billing before treating the configuration as free. No new service or paid plan was purchased by this work.
- Live Worker page and health endpoint were read successfully. A separate browser interaction/navigation run could not start because the external browser automation wallet had zero balance; this is not an application failure and no top-up is recommended. Android visual/performance acceptance remains unverified.
- The actual on-device Tracker is localStorage-only. GitHub CI and Worker source audit cannot see the user's phone records, so actual per-fixture 1X2/DC record counts, legacy bankroll and historic settlements still require a user-exported JSON backup before final acceptance.
- Stage 159 is an audit finding, not a completion claim. Next implementation work: add a tested virtual bankroll ledger and stake reservation guard; add truthful evidence-source adapters or explicit unavailable states for the four unpopulated evidence areas; evaluate free bookmaker data coverage and Bwin Belgium availability without inventing prices; then re-run regression and live checks. Preserve all existing records and do not write to main.

### Stage 159 — virtual bankroll guard implementation
- Added src/bankroll.ts and unit tests. The rebuilt virtual opening balance defaults to the user's last confirmed €91.60; a newer explicit local Tracker ledger row with event OPENING_BALANCE overrides that seed.
- Available balance is calculated as opening balance plus settled net P/L minus stakes reserved by open selected bets and priced paper coupons. Settled paper coupons contribute their actual stored profit/loss; unpriced paper coupons and rejected comparisons do not change the balance.
- Added stake-reservation checks before saving a selected bet and before saving a priced three-leg paper coupon. The app blocks a stake that exceeds available virtual balance and displays the amount available.
- CI run 44456262858 on commit 4052de714bd680014e0d813c310cb84fb10e4885: SUCCESS — TypeScript, unit tests and production build passed, including bankroll tests for opening balance, exposure, win/loss/void settlement, coupon exposure and overspending rejection.
- Cloudflare deployment run 44456262742: deploy step and Worker smoke test completed successfully; full live fixture reconciliation was still running when this log entry was written.
- No previous local Tracker records, coupons, settlement rows or legacy MAIN bankroll were modified. The €91.60 amount is a virtual opening seed for the fresh rebuild only; legacy history is not silently imported.
- Remaining acceptance: complete the final live reconciliation for the latest commit; verify the new balance guard in a real Android session; obtain the user's current Tracker JSON export to compare actual on-device history; implement/verify remaining evidence adapters and bookmaker integration separately.


## 2026-11-19 — Stage 160: API-Football Pro enrichment and live acceptance
- Integrated the existing API-Football Pro Worker secret into the European date scan and match analysis. The key remains server-side; no credential is shipped to the browser.
- Added a 1–20 fixture batch endpoint for full fixture payloads (available events, lineups, team statistics and player statistics), plus a daily injuries/suspensions endpoint and safe subscription/quota diagnostics.
- Integrated the returned fixture details and injury rows into prediction Tracker metadata. Empty injury feeds remain PARTIAL rather than being misrepresented as proof of no injuries.
- Cache policy: daily fixture feed 15 minutes; fixture enrichment 15 minutes; injury feed 24 hours; status metadata 60 seconds. Provider rate-limit responses are sanitized, are not cached as successful data, and are handled as a temporary upstream limitation.
- Fixed provider error parsing so empty/null error fields do not become false rate-limit failures. Added safe diagnostic details, fresh status bypass, and workflow smoke-test handling for HTTP 429.
- Extended API-Football Europe filtering to include UEFA competitions whose provider country is reported as World, while continuing to reject non-UEFA world competitions.
- Latest live audit (2026-11-19T04:48:24Z): 48 unique fixtures, 15 countries/federations, 27 competitions; all 9 source-health checks healthy; zero source errors, duplicate canonical keys, wrong-date fixtures or non-European fixtures. API-Football Pro: 111 raw provider fixtures, 21 accepted European fixtures.
- Latest CI: TypeScript, unit tests and production build passed; 290 tests passed across 29 files. Cloudflare deployment to the separate REBUILT Worker, production smoke tests and full live European source reconciliation all passed. Feature commit: 4404b769e9ef6331362538051adf972464674e8b; deployment run: 44460654084; validation run: 44460654085.
- A temporary API-Football per-minute 429 was observed during repeated development/deployment smoke tests. The workflow now treats a correctly identified provider throttle as a safe upstream limitation rather than a failed application deployment. No paid plan was purchased or upgraded by this work.
- No historical Tracker rows, coupons, settlement records or bankroll entries were rewritten. The Tracker remains browser-local and requires JSON export/import between devices. Physical Android interaction/performance acceptance remains unverified.


## 2026-11-19 — Stage 161: compact Tracker storage and full API detail view
- Prevented duplication of the full API-Football fixture and injury payload across every model and market row. Compact provenance and counts remain on all rows; the complete JSON is stored once per fixture on the primary 1X2 row.
- Added an expandable match-analysis panel showing the full available API-Football Pro payload: events, lineups, team statistics, player statistics and injury/suspension entries.
- Added tests for compact versus full Tracker metadata. Latest validation: 291 tests passed across 29 files; TypeScript and production build passed.
- Latest feature commit: 96755818fc9b980887c7e16ed85acc4fb5abc923. Deployment run: 44461128461; validation run: 44461128261.
- Live source reconciliation at 2026-11-19T04:52:48Z remained healthy: 48 unique fixtures, 15 countries/federations, 27 competitions; all 9 sources healthy; API-Football Pro 111 raw / 21 accepted European fixtures; zero errors, duplicates, wrong-date or non-European fixtures.
- Full physical Android testing is still outstanding; the CI/build and production endpoint checks are not represented as a device test.


## 2026-11-19 — Stage 162: OddsPapi live account, canonical cross-source fixture identity and full European source reconciliation

- Production OddsPapi account verified through the REBUILT Worker: account status active, request limit 250, request count 0, remaining 250. The server-side pilot token is configured. The account response exposes only sanitized quota and bookmaker metadata, never secrets.
- Confirmed 9 Belgium-specific bookmaker feeds in the account: `bwin.be`, `unibet.be`, `betcenter.be`, `bingoal.be`, `betfirst.be`, `goldenpalacesports.be`, `starcasino.be`, `scooore.be`, `napoleonsports.be`. Also available as separate international comparison feeds: `unibet`, `ladbrokes`, `bet365`, `pinnacle`.
- OddsPapi daily flow is connected to the active app path. It batches fixtures and odds by tournament, matches provider events to local fixtures by teams/date/kickoff, records bookmaker-specific 1X2 quotes and timestamps, and keeps odds pricing separate from prediction eligibility. A missing quote or failed provider match does not remove the match or its 1X2/DC prediction.
- Morning and afternoon OddsPapi sync slots are separate and idempotent; the app refreshes its scan every 15 minutes while open. Each slot uses two billable provider calls (fixtures + odds-by-tournaments). StrikerAPI remains a separate optional source and is limited to one attempt per date. No new paid plan was purchased.
- Account endpoint rate-limit hardening: `/v4/account` is unmetered but has a 1-second cooldown. Worker cache TTL increased to 300 seconds and retry delay to at least 2.1 seconds. The post-deploy status check returned active / 250 remaining / 0 used.
- The parser accepts a complete, timestamp-verified 1X2 snapshot only when all three prices have their own update timestamps; snapshot freshness is governed by the oldest of the three. Public OddsPapi documentation identifies market 101 as 1X2 with outcomes 101/102/103. The app now opts into the billable market catalogue once per 7-day cache window to discover direct Double Chance definitions; the Worker enforces the existing live-quota guard (at least 3 requests remaining), caches discovered definitions for 7 days, and falls back to documented 1X2 only if discovery is unavailable. No synthetic DC prices are created.
- Cross-provider Tracker identity is now canonicalized by date and teams for match, prediction and coverage rows. This prevents duplicate cards and false missing-market counts when Flashscore, FootyNomad or another provider assigns different IDs to the same fixture. Historical rows are not rewritten.
- Odds audit state now preserves OddsPapi matched/unmatched/ambiguous/snapshot counts even when StrikerAPI is not configured. The UI separates 7 core sports-evidence areas from market pricing; missing odds are not an evidence rejection.
- Current-day live European source reconciliation (2026-11-19T07:08:52Z): 48 unique fixtures, 15 countries/federations, 27 competitions; all 9 source-health checks healthy; zero source errors, degraded sources, duplicate canonical keys, wrong-date fixtures or non-European fixtures. Freshness: scan age 0 seconds, OpenMatchday catalogue 0.4 hours, TimezoneFootball feed 4.8 hours.
- Source contribution: OpenLigaDB 5 fixtures; ESPN 8; FootyNomad 18 (118 page matches, 2 pages); Flashscore 21 (136 raw, 115 non-European filtered); API-Football Pro 21 accepted European fixtures from 111 provider fixtures; PitchAPI 1 current-date European fixture. OpenMatchday, OpenFootball and TimezoneFootball returned zero accepted fixtures for this date but no source errors. PitchAPI catalogue: 39 European free leagues and 6,609 upcoming catalogue fixtures.
- Live audit limitation: this is a fresh multi-source snapshot, not proof that every European federation, youth, women's or amateur competition is represented.
- CI on commit `a874f04f7027122c23046df98ac7129387c68a56`: TypeScript, 310 tests across 31 files and production build passed. Cloudflare deployment, production smoke test and full current-day European source reconciliation passed.
- Android/PWA static acceptance: manifest, standalone display mode, portrait orientation, `/sw.js`, viewport-fit and responsive CSS breakpoints verified. Physical interaction on the user's Samsung device remains untested.
- The 18 November Tracker backup audit remains historical only: 195 canonical fixtures, 195 1X2 records, 169 DC records; 7 historical PAPER_NO_ODDS coupons (3 legs each, 21 legs over 7 distinct fixtures, with cross-coupon reuse); 12 result rows; no odds, bet or ledger rows. Configured opening bankroll remains €91.60; no realized P/L can be reconstructed from that export.
- No real OddsPapi odds request has yet been executed from the user's Android-local app session: account request count remains 0. First live quote import requires the pilot token to be saved locally in the app; the token must not be pasted into chat.



## 2026-11-19 — Stage 163: enable guarded OddsPapi Double Chance market discovery
- Enabled the already-tested direct market-catalogue discovery path in the production Worker configuration and daily app request. The app now explicitly opts in; the Worker still checks the live account quota before spending the extra request.
- Market discovery is limited by the existing seven-day cache and requires at least three requests remaining; the daily 1X2/odds calls remain quota-guarded. If the catalogue does not return a verified Double Chance market, the parser safely keeps 1X2 only and never synthesizes DC prices.
- The owner-only ODDS_PILOT_TOKEN gate remains in place; no secret is exposed to the browser or repository. A first real quote import still requires the token to be saved locally in the app.
- This stage changes only future OddsPapi discovery behavior; it does not alter Tracker history, predictions, coupons, settlements or bankroll entries.



## 2026-11-19 — Stage 164: correct OddsPapi v4 odds request contract and monthly quota pacing
- Compared the production adapter with the current official OddsPapi v4 documentation and found that `/v4/odds-by-tournaments` requires exactly one `bookmaker` parameter and accepts at most three `tournamentIds` per request. The previous adapter sent multiple bookmakers and unbounded tournament IDs in one request.
- Corrected the adapter to prefer `bwin.be`, fall back to the next entitled Belgian bookmaker only when Bwin is not included in the active subscription, and send one bookmaker per request.
- Added deterministic batches of at most three tournament IDs, ordered by earliest kickoff. Each additional request respects the documented 1-second endpoint cooldown. The response now reports queried and skipped tournament IDs and the number of odds batches.
- Added a monthly request budget based on the remaining account allowance and days left in the Brussels-local month, split across morning/afternoon sync slots with a small reserve. The adapter never spends beyond the slot budget; when quota is tight it prioritizes the earliest kickoffs and explicitly reports skipped competitions.
- The weekly market catalogue opt-in remains quota-guarded and cached for seven days. The app now reports the slot budget and the number of competitions omitted by quota; no synthetic Double Chance prices are created.
- Added tests for the documented one-bookmaker/three-tournament request shape, four-tournament batching, Bwin priority, and monthly slot budgeting. TypeScript, unit tests and production build passed.
- Production deployment run `44482763273` succeeded on commit `bf43dedab03fad91641d325ed36926ea9c135ddf`; Worker smoke tests and live European source reconciliation passed. The reconciliation returned 48 unique Europe/date fixtures before competition scope, 20 eligible domestic league fixtures, 9 healthy sources, 0 source errors, 0 duplicate canonical keys, 0 wrong-date fixtures and 0 non-European fixtures.
- This corrects the request format but does not yet prove a real OddsPapi quote import from the Android browser. The Worker reports the owner-only pilot gate configured, but the token must be saved in the app's local browser before the first owner-authorized daily quote request. No secret was copied into the repository or exposed by the status endpoint.


## 2026-11-19 — Stage 165: production OddsPapi health smoke test
- Added a deployment smoke check for `/api/odds/status`. It verifies that the OddsPapi provider and owner-only pilot gate are configured, then logs only sanitized account quota status when the unmetered account endpoint is available.
- The check makes no billable OddsPapi request and never logs API keys or pilot tokens. Temporary account-status unavailability is a warning, not a false application-deployment failure.
