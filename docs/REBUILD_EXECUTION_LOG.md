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
