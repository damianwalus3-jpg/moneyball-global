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
